'use strict';

const path = require('path'),
      async = require('async'),
      expect = require('chai').expect,
      Atributo = require('..').Atributo,
      iferr = require('iferr');

module.exports = function (num_allocations, allocations_limit)
{
    return function (i, cb)
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
    };
};

