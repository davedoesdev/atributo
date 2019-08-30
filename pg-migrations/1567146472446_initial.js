'use strict';
exports.up = pgm => {
    pgm.createTable('instances', {
        id: {
            type: 'text',
            primaryKey: true
        },
        available: {
            type: 'boolean'
        }
    });
    pgm.createTable('allocations', {
        job: {
            type: 'text',
            primaryKey: true
        },
        instance: {
            type: 'text',
            references: 'instances(id)'
        }
    });
    pgm.createIndex('allocations', 'instance', {
        name: 'by_instance'
    });
};

exports.down = pgm => {
    pgm.dropTable('instances');
    pgm.dropTable('allocations');
};
