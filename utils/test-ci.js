/* eslint-env node */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const excluded = {
    'test/plugin/coreplugins/ExecutorPlugin/ExecutorPlugin.spec.js':
        'upstream example writes json to a Python 2 binary file and expects the retired executor worker lifecycle',
};
function specs(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const file = path.join(dir, e.name).replace(/\\/g, '/');
        return e.isDirectory() ? specs(file) : (e.name.endsWith('.spec.js') ? [file] : []);
    });
}
const roots = process.argv[2] === 'server' ? ['test/server'] :
    ['test/addon', 'test/bin', 'test/config', 'test/common', 'test/issue', 'test/plugin', 'test/seeds', 'test/client'];
const failed = [];
for (const file of roots.flatMap(specs)) {
    if (excluded[file]) { console.log('SKIP ' + file + ': ' + excluded[file]); continue; }
    console.log('SUITE ' + file);
    const result = spawnSync(process.execPath, [require.resolve('mocha/bin/_mocha'), '--exit',
        '--require', 'chai/register-should', '--timeout', '10000', '--reporter', 'dot', file], { stdio: 'inherit', timeout: 300000 });
    if (result.status !== 0) failed.push(file);
}
console.log('Failed suites: ' + JSON.stringify(failed));
process.exitCode = failed.length ? 1 : 0;
