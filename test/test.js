const path = require('path'),
      async = require('async'),
      expect = require('chai').expect,
      Atributo = require('..').Atributo;

describe('atributo', function ()
{
    let ao;

    before(function (cb)
    {
        ao = new Atributo(
        {
            db_filename: path.join(__dirname, 'atributo.sqlite3')
        });
        ao.on('ready', cb);
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
        ao.allocate('bar', function (err, allocated, instance_id)
        {
            if (err) { return cb(err); }
            expect(allocated).to.be.true;
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
        ao.allocate('bar2', function (err, allocated, instance_id)
        {
            if (err) { return cb(err); }
            expect(allocated).to.be.true;
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
                ao.allocate('bar5', function (err, allocated, instance_id)
                {
                    if (err) { return cb(err); }
                    expect(allocated).to.be.true;
                    expect(instance_id).to.equal('foo2');
                    cb();
                });
            },
            cb =>
            {
                ao.allocate('bar3', function (err, allocated, instance_id)
                {
                    if (err) { return cb(err); }
                    expect(allocated).to.be.true;
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
                ao.allocate('bar', function (err, allocated, instance_id)
                {
                    if (err) { return cb(err); }
                    expect(allocated).to.be.false;
                    expect(instance_id).to.equal('foo');
                    cb();
                });
            },
            cb =>
            {
                ao.allocate('bar2', function (err, allocated, instance_id)
                {
                    if (err) { return cb(err); }
                    expect(allocated).to.be.false;
                    expect(instance_id).to.equal('foo2');
                    cb();
                });
            },
            cb =>
            {
                ao.allocate('bar5', function (err, allocated, instance_id)
                {
                    if (err) { return cb(err); }
                    expect(allocated).to.be.false;
                    expect(instance_id).to.equal('foo2');
                    cb();
                });
            },
            cb =>
            {
                ao.allocate('bar3', function (err, allocated, instance_id)
                {
                    if (err) { return cb(err); }
                    expect(allocated).to.be.false;
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
                            ao.allocate('bar5', function (err, allocated, instance_id)
                            {
                                if (err) { return cb(err); }
                                expect(allocated).to.be.true;
                                expect(instance_id).to.equal('foo3');
                                ao.allocate('bar2', function (err, allocated, instance_id)
                                {
                                    if (err) { return cb(err); }
                                    expect(allocated).to.be.true;
                                    expect(instance_id).to.equal('foo3');
                                    ao.allocate('bar9', function (err, allocated, instance_id)
                                    {
                                        if (err) { return cb(err); }
                                        expect(allocated).to.be.true;
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
                    ao.allocate('bar9', function (err, allocated, instance_id)
                    {
                        if (err) { return cb(err); }
                        expect(allocated).to.be.false;
                        expect(instance_id).to.equal('foo2');
                        ao.deallocate('bar9', function (err)
                        {
                            if (err) { return cb(err); }
                            ao.allocate('bar9', function (err, allocated, instance_id)
                            {
                                if (err) { return cb(err); }
                                expect(allocated).to.be.true;
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
                    ao.allocate('bar9', function (err, allocated, instance_id)
                    {
                        if (err) { return cb(err); }
                        expect(allocated).to.be.true;
                        expect(instance_id).to.equal('foo');
                        cb();
                    });
                });
            });
        });
    });

    // check coverage
    // custom allocator
    // get jobs for an instance?
    // multi-process stress test

    after(function (cb)
    {
        ao.close(cb);
    });
});
