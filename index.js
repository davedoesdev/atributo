'use strict';

const crypto = require('crypto'),
      sqlite3 = require('sqlite3'),
      { Client } = require('pg'),
      async = require('async'),
      iferr = require('iferr'),
      EventEmitter = require('events').EventEmitter;

/**
 Creates an object which allocates jobs across a number of instances.

 @param {Object} options - Configuration options.
 @param {'sqlite' | 'pg'} [options.db_type=sqlite] - Type of database to use.
 @param {string} options.db_filename - (sqlite) Filename in which to store the allocations. You can use the same file in multiple `Atributo` objects, even across different processes. They will all make and see the same allocations.
 @param {integer} [options.db_mode] - (sqlite) Mode to open the file in. See the [sqlite3](https://github.com/mapbox/node-sqlite3/wiki/API#new-sqlite3databasefilename-mode-callback) documentation.
 @param {integer} [options.busy_wait=1000] - (sqlite) Number of milliseconds to wait before retrying if another `Atributo` object has the database file locked.
 @param {Object} options.db - (pg) [`node-postgres` configuration](https://node-postgres.com/api/client).
 */
class Atributo extends EventEmitter
{
    constructor(options)
    {
        super();

        this._options = Object.assign(
        {
            db_type: 'sqlite',
            busy_wait: 1000
        }, options);

        switch (this._options.db_type)
        {
        case 'sqlite':
            this._db = new sqlite3.Database(this._options.db_filename,
                                            this._options.db_mode);
            this._db.on('open', () => this.emit('ready'));
            this._db.on('close', () => this.emit('close'));
            this._true = 1;
            this._false = 0;
            break;

        case 'pg':
            this._db = new Client(this._options.db);
            this._db.connect(err =>
            {
                if (err)
                {
                    return this.emit('error', err);
                }
                this.emit('ready');
            });
            this._db.on('end', () => this.emit('close'));
            this._true = true;
            this._false = false;
            break;

        default:
            throw new Error(`invalid database type: ${this._options.db_type}`);
        }

        this._db.on('error', err => this.emit('error', err));

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

     @param {closeCallback} [cb] - Called once the database is closed.
     */
    close(cb)
    {
        switch (this._options.db_type)
        {
        case 'sqlite':
            this._db.close(cb);
            break;

        case 'pg':
            this._db.end(cb);
            break;
        }
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
                    let sql;
                    switch (this._options.db_type)
                    {
                    case 'sqlite':
                        sql = 'INSERT OR IGNORE INTO instances VALUES ($1, $2);';
                        break;

                    case 'pg':
                        sql = 'INSERT INTO instances VALUES ($1, $2) ON CONFLICT DO NOTHING;'
                        break;
                    }
                    this._run(sql, [instance_id, this._true], cb);
                },
                cb =>
                {
                    // Do this in a transaction so we don't error if someone else
                    // deletes the row here.
                    this._run('UPDATE instances SET available = $1 WHERE id = $2;',
                              [this._true, instance_id],
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
                    let sql;
                    switch (this._options.db_type)
                    {
                    case 'sqlite':
                        sql = 'INSERT OR IGNORE INTO instances VALUES ($1, $2);';
                        break;

                    case 'pg':
                        sql = 'INSERT INTO instances VALUES ($1, $2) ON CONFLICT DO NOTHING;'
                        break;
                    }
                    this._run(sql, [instance_id, this._false], cb);
                },
                cb =>
                {
                    this._run('UPDATE instances SET available = $1 WHERE id = $2;',
                              [this._false, instance_id],
                              cb);
                }
            ];

            if (destroyed)
            {
                statements.push(
                    cb =>
                    {
                        this._run('DELETE FROM allocations WHERE instance = $1;',
                                  [instance_id],
                                  cb);
                    },
                    cb =>
                    {
                        this._run('DELETE FROM instances WHERE id = $1;',
                                  [instance_id],
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
                this._all('SELECT * from instances;',
                          [],
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
     @param {allocateCallback} cb - Called with the ID of the instance to which the job was allocated, and whether the allocation was persisted to the database. The default allocator chooses the instance based on a hash of `job_id`. You can override the [`_allocate`](#atributo_allocate) function to provide a different allocator.
     */
    allocate(job_id, cb)
    {
        let b = this._busy(cb, () => this.allocate(job_id, cb));

        this._in_transaction(b, cb =>
        {
            this._queue.unshift(cb => 
            {
                this._get('SELECT instance FROM allocations WHERE job = $1;',
                          [job_id],
                          cb);
            }, iferr(cb, r =>
            {
                if (r !== undefined)
                {
                    return cb(null, r.instance, false);
                }

                this._queue.unshift(cb => 
                {
                    this._all('SELECT id FROM instances WHERE available = $1;',
                              [this._true],
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
                    }, iferr(cb, (instance_id, persist) =>
                    {
                        if (!persist)
                        {
                            return cb(null, instance_id, false);
                        }

                        this._queue.unshift(cb =>
                        {
                            this._run('INSERT INTO allocations VALUES ($1, $2);',
                                      [job_id, instance_id],
                                      cb);
                        }, iferr(cb, r =>
                        {
                            cb(null, instance_id, true);
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
            this._run('DELETE FROM allocations WHERE job = $1;',
                      [job_id],
                      cb);
        }, this._busy(cb, () => this.deallocate(job_id, cb)));
    }

    /**
      Get whether an instance has jobs allocated to it.

      @param {string} instance_id - ID of the instance.
      @param {has_jobsCallback} cb - Receives whether there are jobs allocated to to the instance.
     */
    has_jobs(instance_id, cb)
    {
        this._queue.push(cb => async.waterfall(
        [
            cb =>
            {
                this._get('SELECT count(*) FROM allocations WHERE instance = $1;',
                          [instance_id],
                          cb);
            },
            (r, cb) =>
            {
                let key;
                switch (this._options.db_type)
                {
                case 'sqlite':
                    key = 'count(*)';
                    break;

                case 'pg':
                    key = 'count';
                    break;
                }
                cb(null, r[key] > 0);
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
                this._all('SELECT job from allocations WHERE instance = $1;',
                          [instance_id],
                          cb);
            },
            (r, cb) =>
            {
                cb(null, r.map(row => row.job));
            }
        ], cb), this._busy(cb, () => this.jobs(instance_id, cb)));
    }

    /**
     Gets the instance to which a job is allocated.

     @param {string} job_id - ID of the job.
     @param {instanceCallback} cb - Called with the ID of the instance to which the job is allocated, or `null`.
     */
    instance(job_id, cb)
    {
        this._queue.push(cb =>
        {
            this._get('SELECT instance FROM allocations WHERE job = $1;',
                      [job_id],
                      iferr(cb, r =>
                      {
                          cb(null, r === undefined ? null : r.instance);
                      }));
        }, this._busy(cb, () => this.instance(job_id, cb)));
    }

    _end_transaction(cb)
    {
        let f = (err, ...args) =>
        {
            if (err)
            {
                return this._queue.unshift(cb =>
                {
                    this._run('ROLLBACK',
                              [],
                              cb);
                }, this._busy(err2 => cb(err2 || err, ...args),
                              () => f(err, ...args),
                              true));
            }

            this._queue.unshift(cb =>
            {
                this._run('END TRANSACTION',
                          [],
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
            this._run('BEGIN TRANSACTION', [], cb2),
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

    // Note: $1, $2 placeholders in SQL statements are PostgreSQL syntax.
    // However, as long as they appear _in order_ (i.e. never $2 before $1)
    // then they work in SQLite too. This is because when $ is used, SQLite
    // binds first parameter in array to first $whatever in the statement,
    // second parameter to second $something etc.

    _run(sql, values, cb)
    {
        switch (this._options.db_type)
        {
        case 'sqlite':
            this._db.run(sql, ...values, cb);
            break;

        case 'pg':
            this._db.query(sql, values, iferr(cb, () => cb()));
            break;
        }
    }

    _all(sql, values, cb)
    {
        switch (this._options.db_type)
        {
        case 'sqlite':
            this._db.all(sql, ...values, cb);
            break;

        case 'pg':
            this._db.query(sql, values, iferr(cb, r => cb(null, r.rows)));
            break;
        }
    }

    _get(sql, values, cb)
    {
        switch (this._options.db_type)
        {
        case 'sqlite':
            this._db.get(sql, ...values, cb);
            break;

        case 'pg':
            this._db.query(sql, values, iferr(cb, r => cb(null, r.rows[0])));
            break;
        }

    }

    /**
     The default job allocator algorithm. `job_id` is hashed, treated as an
     integer and used as an index into the array of available instances.
     Override this method to provide a different algorithm.

     @param {string} job_id - ID of the job to allocate.
     @param {string[]} instance_ids - IDs of available instances.
     @param {_allocateCallback} cb - Your allocator method should call this once it's decided to which instance the job should be allocated.
     */
    _allocate(job_id, instance_ids, cb)
    {
        let h = crypto.createHash('md5'); // not for security, just mapping
        h.update(job_id);
        let buf = h.digest();
        cb(null, instance_ids[buf.readUInt32BE(0) % instance_ids.length], true);
    }
}

exports.Atributo = Atributo;
