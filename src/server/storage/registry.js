/*eslint-env node*/
/**
 * Registry of database adapters, keyed by gmeConfig.storage.database.type.
 *
 * 'mongo', 'redis' and 'memory' are built in. An application adds its own
 * types (for example 'dynamodb') before validating its config or starting the
 * server:
 *
 *   webgme.registerDatabaseAdapter('dynamodb', function (logger, gmeConfig) {
 *       return new DynamoAdapter(logger, gmeConfig);
 *   });
 *   webgme.registerAuthPatch('dynamodb', function (gmeAuth, gmeConfig) {
 *       // wire the type's user/project collections into gmeAuth
 *   });
 *
 * The engine looks the adapter up here (standalone.js, index.js getStorage and
 * getGmeAuth, config/validator.js) and never requires application code.
 *
 * This file has no dependencies, so the config validator can load it.
 */

'use strict';

var BUILT_IN = {
    mongo: function (logger, gmeConfig) {
        var MongoAdapter = require('./mongo');
        return new MongoAdapter(logger, gmeConfig);
    },
    redis: function (logger, gmeConfig) {
        var RedisAdapter = require('./datastores/redisadapter');
        return new RedisAdapter(logger, gmeConfig);
    },
    memory: function (logger, gmeConfig) {
        var MemoryAdapter = require('./memory');
        return new MemoryAdapter(logger, gmeConfig);
    }
};

var adapters = {};
var authPatches = {};

function key(type) {
    if (typeof type !== 'string' || type.length === 0) {
        throw new Error('database type must be a non-empty string, got: ' + type);
    }
    return type.toLowerCase();
}

function typeOf(gmeConfig) {
    return key(gmeConfig.storage.database.type);
}

/**
 * @param {string} type - value of gmeConfig.storage.database.type (case-insensitive)
 * @param {function(logger, gmeConfig): object} factory - returns a database adapter
 *   with the interface of ./mongo.js
 */
function registerDatabaseAdapter(type, factory) {
    var k = key(type);
    if (BUILT_IN.hasOwnProperty(k)) {
        throw new Error('database type "' + k + '" is built in and cannot be replaced');
    }
    if (typeof factory !== 'function') {
        throw new Error('registerDatabaseAdapter("' + k + '") needs a factory function');
    }
    adapters[k] = factory;
}

/**
 * @param {string} type
 * @param {function(gmeAuth, gmeConfig)} fn - called right after GMEAuth is
 *   constructed and before it connects; adapts it to the type's user store.
 */
function registerAuthPatch(type, fn) {
    var k = key(type);
    if (typeof fn !== 'function') {
        throw new Error('registerAuthPatch("' + k + '") needs a function');
    }
    authPatches[k] = fn;
}

/** Every type the validator accepts: the built-ins plus registered ones. */
function knownTypes() {
    return Object.keys(BUILT_IN).concat(Object.keys(adapters));
}

function isKnownType(type) {
    var k = key(type);
    return BUILT_IN.hasOwnProperty(k) || adapters.hasOwnProperty(k);
}

function notRegistered(type) {
    return new Error('storage.database.type "' + type + '" is not registered. Built in: ' +
        Object.keys(BUILT_IN).join(', ') + '. Register other types with ' +
        'webgme.registerDatabaseAdapter(type, factory) before starting the server.');
}

/** The database adapter for gmeConfig.storage.database.type. */
function createDatabase(logger, gmeConfig) {
    var k = typeOf(gmeConfig);
    var factory = BUILT_IN[k] || adapters[k];
    if (!factory) {
        throw notRegistered(k);
    }
    return factory(logger, gmeConfig);
}

/** Apply the registered auth patch for the configured type, if there is one. */
function applyAuthPatch(gmeAuth, gmeConfig) {
    var fn = authPatches[typeOf(gmeConfig)];
    if (fn) {
        fn(gmeAuth, gmeConfig);
    }
    return gmeAuth;
}

/** Forget registered types (tests only). */
function _resetForTests() {
    adapters = {};
    authPatches = {};
}

module.exports = {
    registerDatabaseAdapter: registerDatabaseAdapter,
    registerAuthPatch: registerAuthPatch,
    knownTypes: knownTypes,
    isKnownType: isKnownType,
    createDatabase: createDatabase,
    applyAuthPatch: applyAuthPatch,
    _resetForTests: _resetForTests
};
