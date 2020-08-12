'use strict';

const path = require('path'),
      async = require('async'),
      expect = require('chai').expect,
      Atributo = require('..').Atributo,
      iferr = require('iferr'),
      { ao_options } = require('./db_type');

module.exports = function (num_allocations, allocations_limit)
{
    return function (i, cb)
    {
    console.log("ONE");
        async.waterfall(
        [
            function (cb)
            {
    console.log("TWO");
                new Atributo(ao_options).on('ready', function ()
                {
                    cb(null, this);
                })
                .on('error', cb);
            },
            function (ao, cb)
            {
    console.log("THREE");
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
                            setTimeout(cb, Math.floor(Math.random() * 5) * 1000);
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
    console.log("FOUR");
                ao.close(cb);
            }
        ], cb);
    };
};

if (require.main === module)
{
    let [i, num_allocations, allocations_limit] = JSON.parse(Buffer.from(process.argv[2], 'hex'));
    console.log("STARTING");
    module.exports(num_allocations, allocations_limit)(i, err =>
    {
        console.log("DONE", err);
        if (err)
        {
            throw err;
        }
    });
}

