const { Atributo } = require('atributo'),
      async = require('async'),
      assert = require('assert');

class ExampleAtributo extends Atributo
{
    available(instance_id, cb) {
        // Remember out instance ID
        this._instance_id = instance_id;
        super.available(instance_id, cb);
    }

    allocate(job_id, cb) {
        super.allocate(job_id, (err, instance_id, persisted) => {
            if (persisted) {
                // first allocation on our instance so start job
            }
            cb(err, instance_id, persisted);
        });
    }

    _allocate(job_id, instance_ids, cb) {
        super._allocate(job_id, instance_ids, (err, instance_id, persist) => {
            if (instance_id !== this._instance_id) {
                // Don't persist if not our instance
                persist = false;                
            }
            cb(err, instance_id, persist);
        });
    }
}

async.times(2, (i, cb) => {
    new ExampleAtributo({
        db_filename: 'atributo.sqlite3',
        instance_id: `instance${i}`
    }).on('ready', function () {
        cb(null, this);
    });
}, (err, [ao0, ao1]) => {
    assert.ifError(err);
    async.waterfall([

        // Make instances available
        cb => ao0.available('instance0', cb),
        cb => ao1.available('instance1', cb),

        // List instances on both Atributos
        cb => ao0.instances(cb),
        (instances, cb) => {
            instances.sort((x, y) => x.id > y.id ? 1 : x.id < y.id ? -1 : 0);
            assert.deepStrictEqual(instances, [
                { id: 'instance0', available: true },
                { id: 'instance1', available: true }
            ]);
            cb();
        },
        cb => ao1.instances(cb),
        (instances, cb) => {
            instances.sort((x, y) => x.id > y.id ? 1 : x.id < y.id ? -1 : 0);
            assert.deepStrictEqual(instances, [
                { id: 'instance0', available: true },
                { id: 'instance1', available: true }
            ]);
            cb();
        },

        // Job allocated on instance0 to instance1 should not be persisted
        cb => ao0.allocate('job0', cb),
        (instance_id, persisted, cb) => {
            assert(!persisted);
            assert.strictEqual(instance_id, 'instance1');
            cb();
        },
        cb => ao1.jobs('instance1', cb),
        (jobs, cb) => {
            assert.deepStrictEqual(jobs, []);
            cb();
        },

        // Job allocated on instance1 to instance1 should be persisted
        cb => ao1.allocate('job0', cb),
        (instance_id, persisted, cb) => {
            assert(persisted);
            assert.strictEqual(instance_id, 'instance1');
            cb();
        },
        cb => ao1.jobs('instance1', cb),
        (jobs, cb) => {
            assert.deepStrictEqual(jobs, ['job0']);
            cb();
        },

        // Job allocated on instance1 to instance0 should not be persisted
        cb => ao1.allocate('job1', cb),
        (instance_id, persisted, cb) => {
            assert(!persisted);
            assert.strictEqual(instance_id, 'instance0');
            cb();
        },
        cb => ao1.jobs('instance0', cb),
        (jobs, cb) => {
            assert.deepStrictEqual(jobs, []);
            cb();
        },

        // Job allocated on instance0 to instance0 should be persisted
        cb => ao0.allocate('job1', cb),
        (instance_id, persisted, cb) => {
            assert(persisted);
            assert.strictEqual(instance_id, 'instance0');
            cb();
        },
        cb => ao1.jobs('instance0', cb),
        (jobs, cb) => {
            assert.deepStrictEqual(jobs, ['job1']);
            cb();
        },

        // Jobs should only be persisted once
        cb => ao1.allocate('job0', cb),
        (instance_id, persisted, cb) => {
            assert(!persisted);
            assert.strictEqual(instance_id, 'instance1');
            cb();
        },
        cb => ao0.allocate('job1', cb),
        (instance_id, persisted, cb) => {
            assert(!persisted);
            assert.strictEqual(instance_id, 'instance0');
            cb();
        },

        // Close database
        cb => ao0.close(cb),
        cb => ao1.close(cb)

    ], assert.ifError);
});
