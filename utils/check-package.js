/* eslint-env node */
'use strict';
const assert = require('assert');
const { execFileSync } = require('child_process');
const packed = JSON.parse(execFileSync(process.execPath, [require.resolve('npm/bin/npm-cli.js'), 'pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8' }))[0];
const files = packed.files.map(f => f.path);
assert(files.includes('LICENSE'));
assert(files.includes('dist/webgme.classes.build.js'));
assert(files.includes('src/common/lib/chance/chance.js'));
assert(!files.some(f => /^(test|test-karma|docs)\//.test(f) || /EXAMPLE_.*KEY|\.(pem|key|crt)$/.test(f)));
console.log('Runtime distribution verified: ' + files.length + ' files, no tests/docs/keys');
