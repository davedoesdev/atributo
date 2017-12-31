'use strict';

const crypto = require('crypto'),
      sqlite3 = require('sqlite3'),
      async = require('async'),
      iferr = require('iferr'),
      EventEmitter = require('events').EventEmitter;

/**
 Creates an object which allocates jobs across a number of instances.

 @param {Object} options - Configuration options.
 @param {string} options.db_filename - Filenames in which to store the allocations. You can use the same file in multiple `Atributo` objects, even across different processes. They will all make and see the same allocations.
 @param {integer} [options.db_mode] - Mode to open the file in. See the [sqlite3](https://github.com/mapbox/node-sqlite3/wiki/API#new-sqlite3databasefilename-mode-callback) documentation.
 @param {integer} [options.busy_wait=1000] - Number of milliseconds to wait before retrying if another `Atributo` object has the database file locked.
 */
class Atributo extends EventEmitter
{
    constructor(options)
    {
        super();

        this._options = Object.assign(
        {
            busy_wait: 1000
        }, options);

        this._db = new sqlite3.Database(this._options.db_filename,
                                        this._options.db_mode);
        this._db.on('error', err => this.emit('error', err));
        this._db.on('open', () => this.emit('ready'));

        // We need to queue queries on a db connection:
        // https://github.com/mapbox/node-sqlite3/issues/304
        // Alternative would be to create a separate connection
        // for each query. The calling application can still do
        // this if required (to achieve more parallelism) by
        // creating many Atributo objects.
        this._queue = async.queue((task, cb) => task(cb));
    }

    /**
     Close the database file. Subsequent operations will fail.

     @param {closeCallback} cb - Called once the database is closed.
     */
    close(cb)
    {
        this._db.close(cb);
    }

    /**
     Make an instance available for job allocation.

     @param {string} instance_id - ID of the instance.
     @param {availableCallback} cb - Called once the instance has been made available.
     */
    available(instance_id, cb)
    {
        let b = this._busy(cb, () => this.available(instance_id, cb));

        this._in_transaction(b, cb =>
        {
            this._queue.unshift(cb => async.waterfall(
            [
                cb =>
                {
                    this._db.run('INSERT OR IGNORE INTO instances VALUES (?, 1);',
                                 instance_id,
                                 cb);
                },
                cb =>
                {
                    // Do this in a transaction so we don't error if someone else
                    // deletes the row here.
                    this._db.run('UPDATE instances SET available = 1 WHERE id = ?;',
                                 instance_id,
                                 cb);
                }
            ], cb), cb);
        });
    }

    /**
     Make an instance unavailable for job allocation.

     @param {string} instance_id - ID of the instance.
     @param {boolean} destroyed - If false, the instance won't be allocated any more jobs. If true, it is also removed from the database along with its existing job allocations.
     @param {unavailableCallback} cb - Called once the instance has been made unavailable.
     */
    unavailable(instance_id, destroyed, cb)
    {
        let b = this._busy(cb, () => this.unavailable(instance_id, destroyed, cb));

        this._in_transaction(b, cb =>
        {
            let statements = [
                cb =>
                {
                    this._db.run('INSERT OR IGNORE INTO instances VALUES (?, 0);',
                                 instance_id,
                                 cb);
                },
                cb =>
                {
                    this._db.run('UPDATE instances SET available = 0 WHERE id = ?;',
                                 instance_id,
                                 cb);
                }
            ];

            if (destroyed)
            {
                statements.push(
                    cb =>
                    {
                        this._db.run('DELETE FROM allocations WHERE instance = ?;',
                                     instance_id,
                                     cb);
                    },
                    cb =>
                    {
                        this._db.run('DELETE FROM instances WHERE id = ?;',
                                     instance_id,
                                     cb);
                    }
                );
            }

            this._queue.unshift(cb => async.waterfall(statements, cb), cb);
        });
    }

    /**
     Get a list of instance IDs along with their availability.

     @param {instancesCallback} cb - Called with the list of instances.
     */
    instances(cb)
    {
        this._queue.push(cb => async.waterfall(
        [
            cb =>
            {
                this._db.all('SELECT * from instances;',
                             cb);
            },
            (r, cb) =>
            {
                for (let row of r)
                {
                    row.available = !!row.available;
                }
                cb(null, r);
            }
        ], cb), this._busy(cb, () => this.instances(cb)));
    }

    /**
     Allocate a job to an instance.

     @param {string} job_id - ID of the job to allocate.
     @param {allocateCallback} cb - Called with the ID of the instance to which the job was allocated, and whether the allocation was persisted to the database.
     */
    allocate(job_id, cb)
    {
        let b = this._busy(cb, () => this.allocate(job_id, cb));

        this._in_transaction(b, cb =>
        {
            this._queue.unshift(cb => 
            {
                this._db.get('SELECT instance FROM allocations WHERE job = ?;',
                             job_id,
                             cb);
            }, iferr(cb, r =>
            {
                if (r !== undefined)
                {
                    return cb(null, false, r.instance);
                }

                this._queue.unshift(cb => 
                {
                    this._db.all('SELECT id FROM instances WHERE available = 1;',
                                 cb);
                }, iferr(cb, r =>
                {
                    if (r.length === 0)
                    {
                        return cb(new Error('no instances'));
                    }

                    this._queue.unshift(cb =>
                    {
                        this._allocate(job_id, r.map(row => row.id), cb);
                    }, iferr(cb, (persist, instance_id) =>
                    {
                        if (!persist)
                        {
                            return cb(null, false, instance_id);
                        }

                        this._queue.unshift(cb =>
                        {
                            this._db.run('INSERT INTO allocations VALUES (?, ?);',
                                         job_id,
                                         instance_id,
                                         cb);
                        }, iferr(cb, r =>
                        {
                            cb(null, true, instance_id);
                        }));
                    }));
                }));
            }));
        });
    }

    /**
     Remove a job allocation.

     @param {string} job_id - ID of job to deallocate. If the job is allocated to an instance in the database, the allocation will be removed.
     @param {deallocateCallback} cb - Called when the allocation has been removed.
     */
    deallocate(job_id, cb)
    {
        this._queue.push(cb =>
        {
            this._db.run('DELETE FROM allocations WHERE job = ?;',
                         job_id,
                         cb);
        }, this._busy(cb, () => this.deallocate(job_id, cb)));
    }

    /**
      Get when an instance has jobs allocated to it.

      @param {string} instance_id - ID of the instance.
      @param {has_jobsCallback} cb - Receives whether there are jobs allocated to to the instance.
     */
    has_jobs(instance_id, cb)
    {
        this._queue.push(cb => async.waterfall(
        [
            cb =>
            {
                this._db.get('SELECT count(*) FROM allocations WHERE instance = ?;',
                             instance_id,
                             cb);
            },
            (r, cb) =>
            {
                cb(null, r['count(*)'] > 0);
            }
        ], cb), this._busy(cb, () => this.has_jobs(instance_id, cb)));
    }

    /**
     Gets the jobs allocated to an instance.

     @param {string} instance_id - ID of the instance.
     @param {jobsCallback} cb - Called with a list of job IDs allocated to the instance.
     */
    jobs(instance_id, cb)
    {
        this._queue.push(cb => async.waterfall(
        [
            cb =>
            {
                this._db.all('SELECT job from allocations WHERE instance = ?;',
                             instance_id,
                             cb);
            },
            (r, cb) =>
            {
                cb(null, r.map(row => row.job));
            }
        ], cb), this._busy(cb, () => this.jobs(instance_id, cb)));
    }

    _end_transaction(cb)
    {
        let f = (err, ...args) =>
        {
            if (err)
            {
                return this._queue.unshift(cb =>
                {
                    this._db.run('ROLLBACK',
                                 cb);
                }, this._busy(err2 => cb(err2 || err, ...args),
                              () => f(err, ...args),
                              true));
            }

            this._queue.unshift(cb =>
            {
                this._db.run('END TRANSACTION',
                             cb);
            }, this._busy(err => cb(err, ...args),
                          () => f(err, ...args),
                          true));
        };

        return f;
    }

    _in_transaction(cb, f)
    {
        this._queue.push(cb2 =>
            this._db.run('BEGIN TRANSACTION', cb2),
            iferr(cb, () => f(this._end_transaction(cb))));
    }

    _busy(f, retry, block)
    {
        return (err, ...args) =>
        {
            if (err && (err.code === 'SQLITE_BUSY'))
            {
                if (block)
                {
                    return this._queue.unshift(cb => setTimeout(cb, this._options.busy_wait),
                                               retry);
                }

                return setTimeout(retry, this._options.busy_wait);
            }

            f(err, ...args);
        };
    }

    _allocate(job_id, instance_ids, cb)
    {
        let h = crypto.createHash('md5'); // not for security, just mapping
        h.update(job_id);
        let buf = h.digest();
        cb(null, true, instance_ids[buf.readUInt32BE(0) % instance_ids.length]);
    }
}

exports.Atributo = Atributo;

// TODO:
// ready event
// closeCallback
// availableCallback
// unavailableCallback
// instancesCallback
// allocateCallback
// deallocateCallback
// has_jobsCallback
