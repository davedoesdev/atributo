'use strict';

const setup = require('./multi');

setup('multi (same process)', (module, ...args) => require(module)(...args));
