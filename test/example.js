const { Atributo } = require('atributo'),
      async = require('async'),
      assert = require('assert');

// Open the database file
new Atributo({ db_filename: 'atributo.sqlite3' }).on('ready', function () {
    async.waterfall([

        // Make instances available
        cb => this.available('instance0', cb),
        cb => this.available('instance1', cb),

        // List instances
        cb => this.instances(cb),
        (instances, cb) => {
            assert.deepStrictEqual(instances, [
                { id: 'instance0', available: true },
                { id: 'instance1', available: true }
            ]);
            cb();
        },

        // Allocate jobs
        cb => this.allocate('job0', cb),
        (instance_id, persisted, cb) => {
            assert(persisted); // <1>
            assert.strictEqual(instance_id, 'instance1');
            cb();
        },
        cb => this.allocate('job1', cb),
        (instance_id, persisted, cb) => {
            assert(persisted); // <1>
            assert.strictEqual(instance_id, 'instance0');
            cb();
        },

        // List jobs for each instance
        cb => this.jobs('instance0', cb),
        (jobs, cb) => {
            assert.deepStrictEqual(jobs, ['job1']);
            cb();
        },
        cb => this.jobs('instance1', cb),
        (jobs, cb) => {
            assert.deepStrictEqual(jobs, ['job0']);
            cb();
        },

        // Check if instance has jobs
        cb => this.has_jobs('instance0', cb),
        (has_jobs, cb) => {
            assert(has_jobs);
            cb();
        },

        // Get instance for job
        cb => this.instance('job1', cb),
        (instance_id, cb) => {
            assert.strictEqual(instance_id, 'instance0');
            cb();
        },

        // Make instance unavailable but don't remove it
        cb => this.unavailable('instance0', false, cb),

        // Check instance is unavailable
        cb => this.instances(cb),
        (instances, cb) => {
            assert.deepStrictEqual(instances, [
                { id: 'instance0', available: false },
                { id: 'instance1', available: true }
            ]);
            cb();
        },

        // Check existing allocation to unavailable instance
        cb => this.allocate('job1', cb),
        (instance_id, persisted, cb) => {
            assert(!persisted); // <2> 
            assert.strictEqual(instance_id, 'instance0');
            cb();
        },

        // Deallocate existing allocation
        cb => this.deallocate('job1', cb), // <3>

        // Re-allocate job
        cb => this.allocate('job1', cb),
        (instance_id, persisted, cb) => {
            assert(persisted); // <1>
            assert.strictEqual(instance_id, 'instance1');
            cb();
        },

        // Remove instance and its allocated jobs
        cb => this.unavailable('instance0', true, cb),

        // Check instance has been removed
        cb => this.instances(cb),
        (instances, cb) => {
            assert.deepStrictEqual(instances, [
                { id: 'instance1', available: true }
            ]);
            cb();
        },

        // Close database
        cb => this.close(cb)

    ], assert.ifError);
});
