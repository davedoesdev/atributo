'use strict';

const child_process = require('child_process'),
      setup = require('./multi');

setup('multi (separate processes)', (module, ...args) =>
{
    return (i, cb) => 
    {
        let cp = child_process.fork(module, [Buffer.from(JSON.stringify([i, ...args])).toString('hex')]);
        cp.on('error', cb);
        cp.on('exit', code => 
        {
            cb(code === 0 ? null : new Error('error in child'))
        });
    };
});
