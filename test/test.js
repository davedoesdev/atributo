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
        ao.has_no_jobs('foo', function (err, v)
        {
            if (err) { return cb(err); }
            expect(v).to.be.true;
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

    it('should allocate to same instance', function (cb)
    {
        async.parallel(
        [



        ], cb);
    });

    // allocate to same instance

    after(function (cb)
    {
        ao.close(cb);
    });
});
