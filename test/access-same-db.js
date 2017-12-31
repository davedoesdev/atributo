'use strict';

const path = require('path'),
      async = require('async'),
      expect = require('chai').expect,
      Atributo = require('..').Atributo,
      iferr = require('iferr');

module.exports = function (num_tasks)
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
                ao.available('marker' + i, err => cb(err, ao));
            },
            function (ao, cb)
            {
                ao.allocate('marker' + i, iferr(cb, persisted =>
                {
                    expect(persisted).to.be.true;
                    cb(null, ao);
                }));
            },
            function (ao, cb)
            {
                setTimeout(() => cb(null, ao), 5 * 1000);
            },
            function (ao, cb)
            {
                async.times(num_tasks, function (j, cb)
                {
                    ao.allocate('marker' + j, iferr(cb, persisted =>
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
