'use strict';

/**
 Ready event. Emitted when the `Atributo` object has opened the database file.

 @event ready
 @memberof Atributo
 */
exports._ready_event = function () {};

/**
 Close event. Emitted when the `Atributo` object has closed the database file.

 @event close
 @memberof Atributo
 */
exports._close_event = function () {};

/**
 Callback type for closing the database file.

 @callback closeCallback
 @param {?Error} err - Error, if one occurred.
 */
exports._closeCallback = function (err) {};

/**
 Callback type for making an instance available.

 @callback availableCallback
 @param {?Error} err - Error, if one occurred.
 */
exports._availableCallback = function (err) {};

/**
 Callback type for making an instance unavailable.

 @callback unavailableCallback
 @param {?Error} err - Error, if one occurred.
 */
exports._unavailableCallback = function (err) {};

/**
 Callback type for listing instances.

 @callback instancesCallback
 @param {?Error} err - Error, if one occurred.
 @param {Object.<string, boolean>} instances - Map of instance ID to availability.
 */
exports._instancesCallback = function (err, instances) {};

/**
 Callback type for job allocation.

 @callback allocateCallback
 @param {?Error} err - Error, if one occurred.
 @param {string} instance_id - The ID of the instance to which the job was allocated.
 @param {boolean} persisted - Whether the allocation was persisted to the database _in this call_. If the job was already allocated to an instance in the database, `persisted` will be `false`.
 */
exports._allocateCallback = function (err, instance_id, persisted) {};

/**
 Callback type for job deallocation.

 @callback deallocateCallback
 @param {?Error} err - Error, if one occurred.
 */
exports._deallocateCallback = function (err) {};

/**
 Callback type for getting whether an instance has jobs allocated to it.

 @callback has_jobsCallback
 @param {?Error} err - Error, if one occurred.
 @param {boolean} has_jobs - Whether the instance has jobs allocated to it.
 */
exports._has_jobsCallback = function (err, has_jobs) {};

/**
 Callback type for getting the jobs allocated to an instance.

 @callback jobsCallback
 @param {?Error} err - Error, if one occurred.
 @param {string[]} job_ids - The IDs of the jobs allocated to the instance. 
 */
exports._jobsCallback = function (err, job_ids) {};

/**
 Callback type for getting the instance to which a job is allocated.

 @callback instanceCallback
 @param {?Error} err - Error, if one occurred.
 @param {?string} instance_id - The ID of the instance to which the job is allocated, or `null` if it hasn't been allocated to an instance.
 */
exports._instanceCallback = function (err, instance_id) {};

/**
 Callback type for the job allocator algorithm.
 This is passed to and called by [`_allocate`](#atributo_allocate).
 If you override [`_allocate`](#atributo_allocate), make sure you call it.

 @callback _allocateCallback
 @param {?Error} err - Error, if one occurred.
 @param {string} instance_id - The instance ID to which the job should be allocated.
 @param {boolean} persist - Whether the allocation should be persisted to the database.
 */
exports.__allocateCallback = function (err, instance_id, persist) {};
