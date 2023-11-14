Node.js module for managing allocation of job IDs across a variable
number of instance IDs.

A typical use would be to allocate work across a number of worker
processes. Job allocations are stored in a SQLite or PostgreSQL database
which any worker (instance) can access.

You can add a new instance ID and jobs will start to be allocated to it.
You can mark an instance ID as unavailable and no further jobs will be
allocated to it. You can then wait until an instance ID has no jobs
allocated to it before removing it.

This is useful if your jobs are *sticky*, i.e. a job must remain
attached to the instance which started it. A job ID remains allocated to
an instance ID even if a new instance ID is added which would otherwise
have been allocated the job ID. You have to deallocate the job ID
explicitly to get it reassigned.

API documentation is available
[here](http://rawgit.davedoesdev.com/davedoesdev/atributo/master/docs/index.html).

# Example

``` javascript
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
            instances.sort((x, y) => x.id > y.id ? 1 : x.id < y.id ? -1 : 0);
            assert.deepStrictEqual(instances, [
                { id: 'instance0', available: true },
                { id: 'instance1', available: true }
            ]);
            cb();
        },

        // Allocate jobs
        cb => this.allocate('job0', cb),
        (instance_id, persisted, cb) => {
            assert(persisted); // 
            assert.strictEqual(instance_id, 'instance1');
            cb();
        },
        cb => this.allocate('job1', cb),
        (instance_id, persisted, cb) => {
            assert(persisted); // 
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
            instances.sort((x, y) => x.id > y.id ? 1 : x.id < y.id ? -1 : 0);
            assert.deepStrictEqual(instances, [
                { id: 'instance0', available: false },
                { id: 'instance1', available: true }
            ]);
            cb();
        },

        // Check existing allocation to unavailable instance
        cb => this.allocate('job1', cb),
        (instance_id, persisted, cb) => {
            assert(!persisted); // 
            assert.strictEqual(instance_id, 'instance0');
            cb();
        },

        // Deallocate existing allocation
        cb => this.deallocate('job1', cb), // 

        // Re-allocate job
        cb => this.allocate('job1', cb),
        (instance_id, persisted, cb) => {
            assert(persisted); // 
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
```

-   This is a new allocation persisted to the database in this call.

-   This is an allocation which already existed in the database before
    the instance was made unavailable.

-   The allocation is removed from the database.

# Allocator

The default algorithm for allocating a job to an instance is to hash the
job ID, treat the resulting digest as a 32 bit integer and use that as
an index into the list of available instances.

You can change the default algorithm by overriding the
[`_allocate`](http://rawgit.davedoesdev.com/davedoesdev/atributo/master/docs/index.html#atributo_allocate)
method.

Here’s an example which knows the ID of the instance on which it’s
running and only persists an allocation to the database if it’s for that
instance.

Since `_allocate` is only called when the allocation doesn’t already
exist in the database, if you call
[`allocate`](http://rawgit.davedoesdev.com/davedoesdev/atributo/master/docs/index.html#atributoallocate)
for each job on every instance, this example can start a job on its
instance when first allocated.

``` javascript
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
        (instance_id, allocated, cb) => {
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
```

# Installation

``` bash
npm install atributo
```

## SQLite

In the top-level directory you’ll find a file called
`atributo.empty.sqlite3`. This contains an empty copy of the database
`atributo` needs to store instance availablity and job allocations.

You should use a *copy* of this file in your application and pass its
location as `db_filename` when constructing
[`Atributo`](http://rawgit.davedoesdev.com/davedoesdev/atributo/master/docs/index.html#atributo)
objects.

## PostgreSQL

Pass `pg` as `db_type` and the [`node-postgres`
configuration](https://node-postgres.com/api/client) as `db` when
constructing
[`Atributo`](http://rawgit.davedoesdev.com/davedoesdev/atributo/master/docs/index.html#atributo)
objects.

# Licence

[MIT](LICENCE)

# Test

``` bash
grunt test
```

# Lint

``` bash
grunt lint
```

# Coverage

``` bash
grunt coverage
```

[c8](https://github.com/bcoe/c8) results are available
[here](http://rawgit.davedoesdev.com/davedoesdev/atributo/master/coverage/lcov-report/index.html).

Coveralls page is [here](https://coveralls.io/r/davedoesdev/atributo).
