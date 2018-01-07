'use strict';

const path = require('path');

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
                options.db_filename = path.join(__dirname, options.db_filename);
                super(options);
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
