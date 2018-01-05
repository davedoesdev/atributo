'use strict';

const path = require('path');

it('example should pass', function (done)
{
    const atributo = require('atributo'),
          OrigAtributo = atributo.Atributo;

    class NewAtributo extends OrigAtributo
    {
        constructor(options)
        {
            options.db_filename = path.join(__dirname, options.db_filename);
            super(options);
        }

        close(cb)
        {
            this.once('close', done);
            super.close(cb);
        }
    }

    atributo.Atributo = NewAtributo;
    require('./example');
});
