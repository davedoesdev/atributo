'use strict';

const path = require('path'),
      async = require('async'),
      expect = require('chai').expect,
      Atributo = require('..').Atributo,
      iferr = require('iferr'),
      { ao_options } = require('./db_type');

module.exports = function (num_tasks)
{
    return function (i, cb)
    {
        async.waterfall(
        [
            function (cb)
            {
                new Atributo(ao_options).on('ready', function ()
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
                ao.allocate('marker' + i, iferr(cb, (instance_id, persisted) =>
                {
                    expect(persisted).to.be.true;
                    cb(null, ao);
                }));
            },
            function (ao, cb)
            {
                setTimeout(() => cb(null, ao), 10 * 1000);
            },
            function (ao, cb)
            {
                async.times(num_tasks, function (j, cb)
                {
                    ao.allocate('marker' + j, iferr(cb, (instance_id, persisted) =>
                    {
                        expect(persisted).to.be.false;
                        cb();
                    }));
                }, err => cb(err, ao));
            },
            function (ao, cb)
            {
                ao.close(cb);
            }
        ], cb);
    };
};

if (require.main === module)
{
    let [i, num_tasks] = JSON.parse(Buffer.from(process.argv[2], 'hex'));
    module.exports(num_tasks)(i, err =>
    {
        if (err)
        {
            throw err;
        }
    });
}
