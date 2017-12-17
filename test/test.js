const path = require('path'),
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

    after(function (cb)
    {
        ao.close(cb);
    });
});
