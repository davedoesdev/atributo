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
    it('many Atributos should be able to access the same database', function (cb)
    {
        this.timeout(10 * 60 * 1000);

        let timeout = {};

        let made_unavailable = false;

        let next = () =>
        {
            timeout.timeout = setTimeout(() =>
            {
                new Atributo(
                {
                    db_filename: path.join(__dirname, 'atributo.sqlite3')
                })
                .on('ready', function ()
                {
                    let instance = 'marker' + Math.floor(Math.random() * num_instances);
                    this.unavailable(instance, false, () =>
                    {
                        made_unavailable = true;
                        timeout.timeout = setTimeout(() =>
                        {
                            this.available(instance, () =>
                            {
                                this.close(next);
                            });
                        }, 500);
                    });
                })
                .on('error', cb);
            }, 1000);
        };

        let start = () =>
        {
            if (timeout.timeout === undefined)
            {
                next();
            }
        };

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
                    start();
                    cb(null, ao);
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
                                setTimeout(cb, 10 * 1000);
                            },
                            cb =>
                            {
                                ao.deallocate('allocation' + j, cb);
                            }

                        ], cb);
                    }, err => cb(err, ao));
                }
            ], cb);
        }, iferr(cb, () =>
        {
            expect(made_unavailable).to.be.true;
            clearTimeout(timeout.timeout);
            cb();
        }));
    });
});

// need to test destroying too, including waiting for it to have no jobs
// do single process first
// spawn a number of processes all allocating jobs
