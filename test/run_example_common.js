'use strict';

const path = require('path'),
      { ao_options } = require('./db_type');

module.exports = function (name, file)
{
    it(name, function (done)
    {
        this.timeout(10000);

        const atributo = require('atributo'),
              OrigAtributo = atributo.Atributo;

        let count = 0;

        class NewAtributo extends OrigAtributo
        {
            constructor(options)
            {
                count += 1;
                super(Object.assign(options, ao_options));
            }

            close(cb)
            {
                atributo.Atributo = OrigAtributo;
                this.once('close', () => {
                    count -= 1;
                    if (count === 0)
                    {
                        done();
                    }
                });
                super.close(cb);
            }
        }

        atributo.Atributo = NewAtributo;
        require(file);
    });
};
