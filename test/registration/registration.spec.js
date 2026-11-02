/* eslint-env node, mocha */
'use strict';

/**
 * The engine's storage registry: built-in types, registered types, the
 * validator, and that the engine never reaches into application code.
 * No database needed.
 */

const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

const ROOT = path.join(__dirname, '..', '..');
const ENGINE = ROOT;
const registry = require('../../src/server/storage/registry');

function jsFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return ['node_modules', 'test', 'dist'].includes(e.name) ? [] : jsFiles(p);
        return e.name.endsWith('.js') ? [p] : [];
    });
}

describe('engine storage registry', function () {
    afterEach(function () {
        registry._resetForTests();
    });

    it('knows the built-in types without any registration', function () {
        registry._resetForTests();
        expect(registry.knownTypes()).to.deep.equal(['mongo', 'redis', 'memory']);
        expect(registry.isKnownType('Mongo')).to.equal(true);
        expect(registry.isKnownType('dynamodb')).to.equal(false);
    });

    it('creates a registered adapter and applies its auth patch', function () {
        registry._resetForTests();
        const calls = [];
        registry.registerDatabaseAdapter('FakeDB', (logger, cfg) => ({ fake: true, cfg }));
        registry.registerAuthPatch('fakedb', (auth, cfg) => calls.push([auth, cfg]));
        const cfg = { storage: { database: { type: 'fakedb', options: {} } } };
        const db = registry.createDatabase({}, cfg);
        expect(db).to.deep.equal({ fake: true, cfg });
        const auth = {};
        registry.applyAuthPatch(auth, cfg);
        expect(calls).to.deep.equal([[auth, cfg]]);
        expect(registry.knownTypes()).to.include('fakedb');
    });

    it('an unregistered type throws and names registerDatabaseAdapter', function () {
        registry._resetForTests();
        expect(() => registry.createDatabase({}, { storage: { database: { type: 'dynamodb' } } }))
            .to.throw(/not registered.*registerDatabaseAdapter/);
    });

    it('built-in types cannot be replaced', function () {
        expect(() => registry.registerDatabaseAdapter('mongo', () => ({}))).to.throw(/built in/);
    });

    it('a type without an auth patch leaves gmeAuth untouched', function () {
        const auth = { untouched: true };
        registry.applyAuthPatch(auth, { storage: { database: { type: 'mongo' } } });
        expect(auth).to.deep.equal({ untouched: true });
    });

    it('the validator accepts a registered type and rejects an unknown one', function () {
        const validator = require('../../config/validator');
        const base = require('../../config/config.default');
        const cfg = JSON.parse(JSON.stringify(base));
        registry.registerDatabaseAdapter('dynamodb', () => ({}));
        cfg.storage.database.type = 'dynamodb';
        expect(() => validator.validateConfig(cfg)).to.not.throw();
        cfg.storage.database.type = 'nosuchdb';
        expect(() => validator.validateConfig(cfg)).to.throw(/storage\.database\.type must be one of/);
    });

    it('the engine exports the registration functions', function () {
        // Read the source rather than loading the whole engine in a unit test.
        const src = fs.readFileSync(path.join(ENGINE, 'index.js'), 'utf8');
        expect(src).to.match(/exports\.registerDatabaseAdapter = storageRegistry\.registerDatabaseAdapter/);
        expect(src).to.match(/exports\.registerAuthPatch = storageRegistry\.registerAuthPatch/);
    });

    it('no engine source requires application storage code', function () {
        const offenders = jsFiles(ENGINE).filter((f) => {
            const src = fs.readFileSync(f, 'utf8');
            return /require\([^)]*(src\/storage|'storage',\s*'dynamo|dynamoadapter|dynamoauth)/.test(src);
        }).map(f => path.relative(ROOT, f));
        expect(offenders).to.deep.equal([]);
    });

    it('gmeauth exposes setCollections and no longer _setCollections', function () {
        const src = fs.readFileSync(path.join(ENGINE, 'src', 'server', 'middleware', 'auth', 'gmeauth.js'), 'utf8');
        expect(src).to.include('this.setCollections = function (collections)');
        expect(src).to.not.include('_setCollections');
    });
});
