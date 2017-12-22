const crypto = require('crypto'),
      sqlite3 = require('sqlite3'),
      async = require('async'),
      iferr = require('iferr'),
      EventEmitter = require('events').EventEmitter;

class Atributo extends EventEmitter
{
    constructor(options)
    {
        super();

        this._db = new sqlite3.Database(options.db_filename, options.db_mode);
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

    close(cb)
    {
        this._db.close(cb);
    }

    _end_transaction(cb)
    {
        return (err, ...args) =>
        {
            if (err)
            {
                return this._queue.unshift(cb =>
                {
                    this._db.run('ROLLBACK',
                                 cb);
                }, err2 => cb(err2 || err, ...args));
            }

            this._queue.unshift(cb =>
            {
                this._db.run('END TRANSACTION',
                             cb);
            }, err => cb(err, ...args));
        };
    }
        
    available(instance_id, cb)
    {
        this._queue.push(cb => async.waterfall(
        [
            cb =>
            {
                this._db.run('BEGIN TRANSACTION',
                             cb);
            },
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
        ], cb), this._end_transaction(cb));
    }

    unavailable(instance_id, destroyed, cb)
    {
        let statements = [
            cb =>
            {
                this._db.run('BEGIN TRANSACTION',
                             cb);
            },
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

        this._queue.push(cb => async.waterfall(statements, cb),
                         this._end_transaction(cb));
    }

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
        ], cb), cb);
    }

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
        ], cb), cb);
    }

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
        ], cb), cb);
    }

    allocate(job_id, options, cb)
    {
        if (typeof options === 'function')
        {
            cb = options;
            options = null;
        }

        options = Object.assign(
        {
            allocator: Atributo.default_allocator
        }, options);

        let end = this._end_transaction(cb);

        this._queue.push(cb => async.waterfall(
        [
            cb =>
            {
                this._db.run('BEGIN TRANSACTION',
                             cb);
            },
            cb =>
            {
                this._db.get('SELECT instance FROM allocations WHERE job = ?;',
                             job_id,
                             cb);
            }
        ], cb), iferr(end, r =>
        {
            if (r !== undefined)
            {
                return end(null, false, r.instance);
            }

            this._queue.unshift(cb => 
            {
                this._db.all('SELECT id FROM instances WHERE available = 1;',
                             cb);
            }, iferr(end, r =>
            {
                if (r.length === 0)
                {
                    return end(new Error('no instances'));
                }

                this._queue.unshift(cb =>
                {
                    options.allocator.call(this,
                                           job_id,
                                           r.map(row => row.id),
                                           cb);
                }, iferr(end, (allocate, instance_id) =>
                {
                    if (!allocate)
                    {
                        return end(null, false, instance_id);
                    }

                    this._queue.unshift(cb =>
                    {
                        this._db.run('INSERT INTO allocations VALUES (?, ?);',
                                     job_id,
                                     instance_id,
                                     cb);
                    }, iferr(end, r =>
                    {
                        end(null, true, instance_id);
                    }));
                }));
            }));
        }));
    }

    deallocate(job_id, cb)
    {
        this._queue.push(cb =>
        {
            this._db.run('DELETE FROM allocations WHERE job = ?;',
                         job_id,
                         cb);
        }, cb);
    }
}

Atributo.default_allocator = function (job_id, instance_ids, cb)
{
    let h = crypto.createHash('md5'); // not for security, just mapping
    h.update(job_id);
    let buf = h.digest();
    cb(null, true, instance_ids[buf.readUInt32BE(0) % instance_ids.length]);
};

exports.Atributo = Atributo;
