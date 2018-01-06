'use strict'

const sqlite3 = require('sqlite3'),
      async = require('async'),
      db_filename = 'atributo.empty.sqlite3';

function with_db(f, cb)
{
    let db = new sqlite3.Database(db_filename);
    db.on('error', cb);
    db.on('open', f);
}

module.exports.description = 'initial version';

module.exports.up = function (next)
{
    with_db(function ()
    {
        async.series(
        [
            cb =>
            {
                this.run('CREATE TABLE instances (' +
                         '  id TEXT PRIMARY KEY,' +
                         '  available BOOLEAN);',
                         cb);
            },
            cb =>
            {
                this.run('CREATE TABLE allocations (' +
                         '  job TEXT PRIMARY KEY,' +
                         '  instance TEXT,' +
                         '  FOREIGN KEY(instance) REFERENCES instances(id));',
                         cb);
            },
            cb =>
            {
                this.run('CREATE INDEX by_instance ON allocations (instance);',
                         cb);
            }
        ], next);
    }, next);
};

module.exports.down = function (next)
{
    with_db(function ()
    {
        async.series(
        [
            cb =>
            {
                this.run('DROP TABLE instances;', cb);
            },
            cb =>
            {
                this.run('DROP TABLE allocations;', cb);
            }
        ], next);
    }, next);
};
