const path = require('path'),
      async = require('async'),
      expect = require('chai').expect,
      Atributo = require('..').Atributo,
      iferr = require('iferr'),
      num = 5;

describe('multi', function ()
{
    it('many Atributos should be able to access the same database', function (cb)
    {
        this.timeout(60 * 1000);

        async.times(num, function (i, cb)
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
                    async.times(num, function (j, cb)
                    {
                        ao.allocate('marker' + j, iferr(cb, allocated =>
                        {
                            expect(allocated).to.be.false;
                            cb();
                        }));
                    }, cb);
                }
            ], cb);
//then do the random job generation etc
        }, cb);
    });
});

// do single process first
// spawn a number of processes all allocating jobs
// we could also randomly make instances unavailable / destroy them
// how do we ensure all used same db?
// each process should have a prefix it adds to instances and jobs,
// check there are some for each at end (make sure we don't remove all
// instances and jobs)
// just leave one created by each? have some way to see all are visbible
// by the others?
