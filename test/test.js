'use strict';

const path = require('path'),
      async = require('async'),
      iferr = require('iferr'),
      expect = require('chai').expect,
      sqlite3 = require('sqlite3'),
      Atributo = require('..').Atributo,
      { db_type, db_type_name, ao_options } = require('./db_type');

describe(`atributo (${db_type_name})`, function ()
{
    let ao;

    before(function (cb)
    {
        ao = new Atributo(ao_options);
        ao.on('ready', cb);
    });

    after(function (cb)
    {
        ao.close(cb);
    });

    it('should throw error for unknown database type', function ()
    {
        expect(() => new Atributo({ db_type: 'foo' })).to.throw('invalid database type: foo');
    });

    it('should have no jobs by default', function (cb)
    {
        ao.has_jobs('foo', function (err, v)
        {
            if (err) { return cb(err); }
            expect(v).to.be.false;
            cb();
        });
    });

    it('should error if no instances', function (cb)
    {
        ao.allocate('bar', function (err)
        {
            expect(err.message).to.equal('no instances');
            cb();
        });
    });

    it('should make an instance available', function (cb)
    {
        ao.available('foo', cb);
    });

    it('should allocate to instance', function (cb)
    {
        ao.allocate('bar', function (err, instance_id, persisted)
        {
            if (err) { return cb(err); }
            expect(persisted).to.be.true;
            expect(instance_id).to.equal('foo');
            cb();
        });
    });

    it('should make another instance available', function (cb)
    {
        ao.available('foo2', cb);
    });

    it('should allocate to different instance', function (cb)
    {
        // bar2 just happens to hash to new instance
        ao.allocate('bar2', function (err, instance_id, persisted)
        {
            if (err) { return cb(err); }
            expect(persisted).to.be.true;
            expect(instance_id).to.equal('foo2');
            cb();
        });
    });

    it('should allocate to instance which already has an allocation', function (cb)
    {
        async.parallel(
        [
            cb =>
            {
                ao.allocate('bar5', function (err, instance_id, persisted)
                {
                    if (err) { return cb(err); }
                    expect(persisted).to.be.true;
                    expect(instance_id).to.equal('foo2');
                    cb();
                });
            },
            cb =>
            {
                ao.allocate('bar3', function (err, instance_id, persisted)
                {
                    if (err) { return cb(err); }
                    expect(persisted).to.be.true;
                    expect(instance_id).to.equal('foo');
                    cb();
                });
            }
        ], cb);
    });

    it('should make another instance available', function (cb)
    {
        ao.available('foo3', cb);
    });

    it('should allocate to same instance', function (cb)
    {
        async.parallel(
        [
            cb =>
            {
                ao.allocate('bar', function (err, instance_id, persisted)
                {
                    if (err) { return cb(err); }
                    expect(persisted).to.be.false;
                    expect(instance_id).to.equal('foo');
                    cb();
                });
            },
            cb =>
            {
                ao.allocate('bar2', function (err, instance_id, persisted)
                {
                    if (err) { return cb(err); }
                    expect(persisted).to.be.false;
                    expect(instance_id).to.equal('foo2');
                    cb();
                });
            },
            cb =>
            {
                ao.allocate('bar5', function (err, instance_id, persisted)
                {
                    if (err) { return cb(err); }
                    expect(persisted).to.be.false;
                    expect(instance_id).to.equal('foo2');
                    cb();
                });
            },
            cb =>
            {
                ao.allocate('bar3', function (err, instance_id, persisted)
                {
                    if (err) { return cb(err); }
                    expect(persisted).to.be.false;
                    expect(instance_id).to.equal('foo');
                    cb();
                });
            }
        ], cb);
    });

    it('should have jobs', function (cb)
    {
        async.parallel(
        [
            cb =>
            {
                ao.has_jobs('foo', function (err, v)
                {
                    if (err) { return cb(err); }
                    expect(v).to.be.true;
                    cb();
                });
            },
            cb =>
            {
                ao.has_jobs('foo2', function (err, v)
                {
                    if (err) { return cb(err); }
                    expect(v).to.be.true;
                    cb();
                });
            },
            cb =>
            {
                ao.has_jobs('foo3', function (err, v)
                {
                    if (err) { return cb(err); }
                    expect(v).to.be.false;
                    cb();
                });
            }
        ], cb);
    });

    it('should make available when already available', function (cb)
    {
        async.each(['foo', 'foo2', 'foo3'], (id, cb) =>
        {
            ao.available(id, cb);
        }, cb);
    });

    it('should get jobs for an instance', function (cb)
    {
        ao.jobs('foo', function (err, job_ids)
        {
            if (err) { return cb(err); }
            expect(job_ids.sort()).to.eql(['bar', 'bar3']);
            ao.jobs('foo2', function (err, job_ids)
            {
                if (err) { return cb(err); }
                expect(job_ids.sort()).to.eql(['bar2', 'bar5']);
                ao.jobs('foo3', function (err, job_ids)
                {
                    if (err) { return cb(err); }
                    expect(job_ids).to.eql([]);
                    cb();
                });
            });
        });
    });

    it('should be able to deallocate job', function (cb)
    {
        ao.deallocate('bar5', function (err)
        {
            if (err) { return cb(err); }
            ao.has_jobs('foo2', function (err, v)
            {
                expect(v).to.be.true;
                ao.deallocate('bar2', function (err)
                {
                    if (err) { return cb(err); }
                    ao.has_jobs('foo2', function (err, v)
                    {
                        expect(v).to.be.false;
                        ao.deallocate('bar4', function (err)
                        {
                            if (err) { return cb(err); }
                            ao.allocate('bar5', function (err, instance_id, persisted)
                            {
                                if (err) { return cb(err); }
                                expect(persisted).to.be.true;
                                expect(instance_id).to.equal('foo3');
                                ao.allocate('bar2', function (err, instance_id, persisted)
                                {
                                    if (err) { return cb(err); }
                                    expect(persisted).to.be.true;
                                    expect(instance_id).to.equal('foo3');
                                    ao.allocate('bar9', function (err, instance_id, persisted)
                                    {
                                        if (err) { return cb(err); }
                                        expect(persisted).to.be.true;
                                        expect(instance_id).to.equal('foo2');
                                        cb();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    it('should make an instance unavailable', function (cb)
    {
        ao.has_jobs('foo2', function (err, v)
        {
            if (err) { return cb(err); }
            expect(v).to.be.true;
            ao.unavailable('foo2', false, function (err)
            {
                if (err) { return cb(err); }
                ao.has_jobs('foo2', function (err, v)
                {
                    if (err) { return cb(err); }
                    expect(v).to.be.true;
                    ao.allocate('bar9', function (err, instance_id, persisted)
                    {
                        if (err) { return cb(err); }
                        expect(persisted).to.be.false;
                        expect(instance_id).to.equal('foo2');
                        ao.deallocate('bar9', function (err)
                        {
                            if (err) { return cb(err); }
                            ao.allocate('bar9', function (err, instance_id, persisted)
                            {
                                if (err) { return cb(err); }
                                expect(persisted).to.be.true;
                                expect(instance_id).to.equal('foo3');
                                cb();
                            });
                        });
                    });
                });
            });
        });
    });

    it('should make an instance unavailable and destroyed', function (cb)
    {
        ao.has_jobs('foo3', function (err, v)
        {
            if (err) { return cb(err); }
            expect(v).to.be.true;
            ao.unavailable('foo3', true, function (err)
            {
                ao.has_jobs('foo3', function (err, v)
                {
                    if (err) { return cb(err); }
                    expect(v).to.be.false;
                    ao.allocate('bar9', function (err, instance_id, persisted)
                    {
                        if (err) { return cb(err); }
                        expect(persisted).to.be.true;
                        expect(instance_id).to.equal('foo');
                        cb();
                    });
                });
            });
        });
    });

    it('should support a custom allocator', function (cb)
    {
        ao.available('foo3', function (err)
        {
            if (err) { return cb(err); }

            class TestAtributo extends Atributo
            {
                constructor(options)
                {
                    super(options);
                    this._test_allocate_called = false;
                }

                _allocate(job_id, instance_ids, cb)
                {
                    this._test_allocate_called = true;
                    super._allocate(job_id, instance_ids, function (err, instance_id, persisted)
                    {
                        if (err) { return cb(err); }
                        expect(persisted).to.be.true;
                        expect(instance_id).to.equal('foo3');
                        cb(null, instance_id, false);
                    });
                }
            }

            new TestAtributo(ao_options).on('ready', function ()
            {
                this.allocate('bar11', (err, instance_id, persisted) =>
                {
                    expect(this._test_allocate_called).to.be.true;
                    expect(persisted).to.be.false;
                    expect(instance_id).to.equal('foo3');
                    ao.has_jobs('foo3', (err, v) =>
                    {
                        if (err) { return cb(err); }
                        expect(v).to.be.false;
                        this.close(cb);
                    });
                });
            });
        });
    });

    it('should get jobs for an instance', function (cb)
    {
        ao.jobs('foo', function (err, job_ids)
        {
            if (err) { return cb(err); }
            expect(job_ids.sort()).to.eql(['bar', 'bar3', 'bar9']);
            ao.jobs('foo2', function (err, job_ids)
            {
                if (err) { return cb(err); }
                expect(job_ids).to.eql([]);
                ao.jobs('foo3', function (err, job_ids)
                {
                    if (err) { return cb(err); }
                    expect(job_ids).to.eql([]);
                    cb();
                });
            });
        });
    });

    it('should get instances', function (cb)
    {
        ao.instances(function (err, instances)
        {
            if (err) { return cb(err); }
            instances.sort((x, y) => x.id > y.id ? 1 : x.id < y.id ? -1 : 0);
            expect(instances).to.eql(
            [
                { id: 'foo', available: true },
                { id: 'foo2', available: false },
                { id: 'foo3', available: true }
            ]);
            cb();
        });
    });

    it('should get allocated instance for a job', function (cb)
    {
        ao.instance('bar', function (err, instance)
        {
            if (err) { return cb(err); }
            expect(instance).to.equal('foo');
            ao.instance('hasnotbeenallocated', function (err, instance)
            {
                if (err) { return cb(err); }
                expect(instance).to.be.null;
                cb();
            });
        });
    });

    it('should error if db errors', function (cb)
    {
        const ao2_options = Object.assign({}, ao_options,
        {
            db_filename: path.join(__dirname, 'does_not_exist.sqlite3'),
            db_mode: sqlite3.OPEN_READONLY
        });
        ao2_options.db = Object.assign({}, ao2_options.db,
        {
            database: 'does_not_exist'
        });

        const ao2 = new Atributo(ao2_options);

        ao2.on('error', function (err)
        {
            let msg;

            switch (ao2._options.db_type)
            {
            case 'sqlite':
                msg = 'SQLITE_CANTOPEN: unable to open database file';
                break;

            case 'pg':
                msg = 'database "does_not_exist" does not exist';
                break;
            }

            expect(err.message).to.equal(msg);
            cb();
        });
    });

    it('should retry reads', function (cb)
    {
        if (ao._options.db_type !== 'sqlite')
        {
            return this.skip();
        }

        this.timeout(30000);

        class TestAtributo extends Atributo
        {
            constructor(options)
            {
                super(options);
                this._busy_count = 0;
            }

            _busy(f, retry, block)
            {
                return (err, ...args) =>
                {
                    this._busy_count += 1;

                    switch (this._busy_count)
                    {
                        case 1:
                            expect(err.code).to.equal('SQLITE_BUSY');
                            this.jobs('foo', iferr(cb, job_ids =>
                            {
                                expect(job_ids.sort()).to.eql(['bar', 'bar3', 'bar9']);
                                retry();
                            }));
                            break;

                        case 2:
                            expect(err.code).to.equal('SQLITE_BUSY');
                            this.has_jobs('foo', iferr(cb, v =>
                            {
                                expect(v).to.be.true;
                                retry();
                            }));
                            break;

                        case 3:
                            expect(err.code).to.equal('SQLITE_BUSY');
                            this.instance('bar', iferr(cb, instance_id =>
                            {
                                expect(instance_id).to.equal('foo');
                                retry();
                            }));
                            break;

                        case 4:
                            expect(err.code).to.equal('SQLITE_BUSY');
                            ao._db.run('END TRANSACTION', iferr(cb, retry));
                            break;

                        case 5:
                        case 6:
                        case 7:
                        case 8:
                            expect(err).to.equal(null);
                            f(err, ...args);
                            break;

                        default:
                            cb(new Error('called too many times'));
                            break;
                    }
                };
            }
        }

        new TestAtributo(ao_options).on('ready', function ()
        {
            ao._db.run('BEGIN EXCLUSIVE TRANSACTION', iferr(cb, () =>
            {
                this.instances(iferr(cb, instances =>
                {
                    expect(this._busy_count).to.equal(8);
                    instances.sort((x, y) => x.id > y.id ? 1 : x.id < y.id ? -1 : 0);
                    expect(instances).to.eql(
                    [
                        { id: 'foo', available: true },
                        { id: 'foo2', available: false },
                        { id: 'foo3', available: true }
                    ]);
                    this.close(cb);
                }));
            }));
        });
    });

    it('should retry rollback', function (cb)
    {
        this.timeout(5000);

        class TestAtributo extends Atributo
        {
            constructor(options)
            {
                super(options);
                this._busy_count = 0;
            }

            _busy(f, retry, block)
            {
                return (err, ...args) =>
                {
                    switch (this._options.db_type)
                    {
                    case 'sqlite':
                        expect(err.message).to.equal('SQLITE_ERROR: cannot rollback - no transaction is active');
                        expect(err.code).to.equal('SQLITE_ERROR');
                        break;

                    case 'pg':
                        expect(err).not.to.exist;
                        break;
                    }

                    this._busy_count += 1;

                    switch (this._busy_count)
                    {
                        case 1:
                            retry();
                            break;

                        case 2:
                            f(err, ...args);
                            break;

                        default:
                            cb(new Error('called too many times'));
                            break;
                    }
                };
            }
        }

        new TestAtributo(ao_options).on('ready', function ()
        {
            this._end_transaction(err =>
            {
                switch (this._options.db_type)
                {
                case 'sqlite':
                    expect(err.message).to.equal('SQLITE_ERROR: cannot rollback - no transaction is active');
                    expect(err.code).to.equal('SQLITE_ERROR');
                    break;

                case 'pg':
                    expect(err.message).to.equal('dummy error');
                    break;
                }

                this.close(cb);
            })(new Error('dummy error'));
        });
    });

    it('should retry end transaction', function (cb)
    {
        this.timeout(5000);

        class TestAtributo extends Atributo
        {
            constructor(options)
            {
                super(options);
                this._busy_count = 0;
            }

            _busy(f, retry, block)
            {
                return (err, ...args) =>
                {
                    switch (this._options.db_type)
                    {
                    case 'sqlite':
                        expect(err.message).to.equal('SQLITE_ERROR: cannot commit - no transaction is active');
                        expect(err.code).to.equal('SQLITE_ERROR');
                        break;

                    case 'pg':
                        expect(err).not.to.exist;
                        break;
                    }

                    this._busy_count += 1;

                    switch (this._busy_count)
                    {
                        case 1:
                            err = new Error();
                            err.code = this._busy_code;
                            super._busy(f, retry, block)(err, ...args);
                            break;

                        case 2:
                            f(err, ...args);
                            break;

                        default:
                            cb(new Error('called too many times'));
                            break;
                    }
                };
            }
        }

        new TestAtributo(ao_options).on('ready', function ()
        {
            this._end_transaction(err =>
            {
                switch (this._options.db_type)
                {
                case 'sqlite':
                    expect(err.message).to.equal('SQLITE_ERROR: cannot commit - no transaction is active');
                    expect(err.code).to.equal('SQLITE_ERROR');
                    break;

                case 'pg':
                    expect(err).not.to.exist;
                    break;
                }

                this.close(cb);
            })();
        });
    });

    it('should emit a close event', function (cb)
    {
        new Atributo(ao_options).on('ready', function ()
        {
            this.on('close', cb);
            this.close();
        });
    });
});
