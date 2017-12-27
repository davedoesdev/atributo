const path = require('path'),
      async = require('async'),
      expect = require('chai').expect,
      Atributo = require('..').Atributo,
      iferr = require('iferr'),
      num_instances = 5,
      num_allocations = 20,
      allocations_limit = 20;

describe('multi', function ()
{
    this.timeout(10 * 60 * 1000);

    it('many Atributos should be able to access the same database', function (cb)
    {
        async.times(num_instances, function (i, cb)
        {
            async.waterfall(
            [
                function (cb)
                {
                    new Atributo(
                    {
                        db_filename: path.join(__dirname, 'atributo.sqlite3')
                    })
                    .on('ready', function ()
                    {
                        cb(null, this);
                    })
                    .on('error', cb);
                },
                function (ao, cb)
                {
                    ao.available('marker' + i, err => cb(err, ao));
                },
                function (ao, cb)
                {
                    ao.allocate('marker' + i, iferr(cb, allocated =>
                    {
                        expect(allocated).to.be.true;
                        cb(null, ao);
                    }));
                },
                function (ao, cb)
                {
                    setTimeout(() => cb(null, ao), 5 * 1000);
                },
                function (ao, cb)
                {
                    async.times(num_instances, function (j, cb)
                    {
                        ao.allocate('marker' + j, iferr(cb, allocated =>
                        {
                            expect(allocated).to.be.false;
                            cb();
                        }));
                    }, err => cb(err, ao));
                },
                function (ao, cb)
                {
                    ao.close(cb);
                }
            ], cb);
        }, cb);
    });

    it('should be able to make unavailable while allocating', function (cb)
    {
        let timeout,
            made_unavailable = false;

        function next()
        {
            timeout = setTimeout(() =>
            {
                new Atributo(
                {
                    db_filename: path.join(__dirname, 'atributo.sqlite3')
                })
                .on('ready', function ()
                {
                    let instance = 'marker' + Math.floor(Math.random() * num_instances);
                    this.unavailable(instance, Math.random() < 0.5, iferr(cb, () =>
                    {
                        made_unavailable = true;
                        timeout = setTimeout(() =>
                        {
                            this.available(instance, iferr(cb, () =>
                            {
                                this.close(next);
                            }));
                        }, 500);
                    }));
                })
                .on('error', cb);
            }, 1000);
        };

        next();

        async.times(num_instances, function (i, cb)
        {
            async.waterfall(
            [
                function (cb)
                {
                    new Atributo(
                    {
                        db_filename: path.join(__dirname, 'atributo.sqlite3')
                    })
                    .on('ready', function ()
                    {
                        cb(null, this);
                    })
                    .on('error', cb);
                },
                function (ao, cb)
                {
                    async.timesLimit(num_allocations, allocations_limit, function (j, cb)
                    {
                        async.series(
                        [
                            cb =>
                            {
                                ao.allocate('allocation' + j, cb);
                            },
                            cb =>
                            {
                                setTimeout(cb, Math.floor(Math.random() * 10) * 1000);
                            },
                            cb =>
                            {
                                ao.deallocate('allocation' + j, cb);
                            }

                        ], cb);
                    }, err => cb(err, ao));
                },
                function (ao, cb)
                {
                    ao.close(cb);
                }
            ], cb);
        }, iferr(cb, () =>
        {
            expect(made_unavailable).to.be.true;
            clearTimeout(timeout);
            cb();
        }));
    });
});

// TODO: spawn a number of processes all allocating jobs
