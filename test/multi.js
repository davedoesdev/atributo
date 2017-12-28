'use strict';

const path = require('path'),
      async = require('async'),
      expect = require('chai').expect,
      Atributo = require('..').Atributo,
      iferr = require('iferr'),
      num_tasks = 5,
      num_allocations = 20,
      allocations_limit = 20;

module.exports = function(name, make_launch_task)
{

describe(name, function ()
{
    this.timeout(10 * 60 * 1000);

    it('many Atributos should be able to access the same database', function (cb)
    {
        let launch = make_launch_task(path.join(__dirname, 'access-same-db'),
                                      num_tasks);
        async.times(num_tasks, launch, cb);
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
                    let instance = 'marker' + Math.floor(Math.random() * num_tasks);
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

        let launch = make_launch_task(path.join(__dirname, 'unavailable-while-allocating'),
                                      num_allocations,
                                      allocations_limit);
        async.times(num_tasks, launch, iferr(cb, () =>
        {
            expect(made_unavailable).to.be.true;
            clearTimeout(timeout);
            cb();
        }));
    });
});

};
