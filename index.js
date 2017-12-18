const crypto = require('crypto'),
      sqlite3 = require('sqlite3'),
      async = require('async'),
      EventEmitter = require('events').EventEmitter;

class Atributo extends EventEmitter
{
    constructor(options)
    {
        super();

        this._db = new sqlite3.Database(options.db_filename);
        this._db.on('error', this.emit.bind(this, 'error'));
        this._db.on('open', this.emit.bind(this, 'ready'));

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

    _end_transaction(cb, err, ...args)
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
    }
        
    available(instance_id, cb)
    {
        this._queue.push(cb => async.waterfall(
        [
            cb =>
            {
                // Avoid SQLITE_BUSY_SNAPSHOT errors by starting the transaction
                // immediately so other transactions can't start. We can do this
                // because we know in this case that we're definitely going to
                // update the database.
                this._db.run('BEGIN IMMEDIATE TRANSACTION',
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
        ], cb), this._end_transaction.bind(this, cb));
    }

    unavailable(instance_id, destroyed, cb)
    {
        let statements = [
            cb =>
            {
                this._db.run('BEGIN IMMEDIATE TRANSACTION',
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
                         this._end_transaction.bind(this, cb));
    }

    has_no_jobs(instance_id, cb)
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
                cb(null, r['count(*)'] === 0);
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
        ], cb), (err, instance_id) =>
        {
            if (err)
            {
                return this._end_transaction(cb, err);
            }

            if (instance_id !== undefined)
            {
                return this._end_transaction(cb, null, false, instance_id);
            }

            this._queue.unshift(cb => 
            {
                this._db.all('SELECT id FROM instances WHERE available = 1;',
                             cb);
            }, (err, r) =>
            {
                if (err)
                {
                    return this._end_transaction(cb, err);
                }

                if (r.length === 0)
                {
                    return this._end_transaction(cb, new Error('no instances'));
                }

                this._queue.unshift(cb =>
                {
                    options.allocator.call(this,
                                           job_id,
                                           r.map(row => row.id),
                                           cb);
                }, (err, allocate, instance_id) =>
                {
                    if (err)
                    {
                        return this._end_transaction(cb, err);
                    }

                    if (!allocate)
                    {
                        return this._end_transaction(cb, null, false, instance_id);
                    }

                    this._queue.unshift(cb =>
                    {
                        this._db.run('INSERT INTO allocations VALUES (?, ?);',
                                     job_id,
                                     instance_id,
                                     cb);
                    }, err =>
                    {
                        if (err)
                        {
                            return this._end_transaction(cb, err);
                        }

                        this._end_transaction(cb, null, true, instance_id);
                    });
                });
            });
        });
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
