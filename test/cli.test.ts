import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { parseCliArgs } from '../src/cli';

test('parseCliArgs uses defaults', () => {
  const options = parseCliArgs([]);
  assert.equal(options.url, 'https://brute.eternaltwin.org/ExampleBrute/cell');
  assert.equal(options.debug, false);
});

test('parseCliArgs reads supported flags', () => {
  const options = parseCliArgs([
    '--url',
    'https://brute.eternaltwin.org/ExampleBrute/cell',
    '--debug',
    '--login-timeout-ms',
    '5000',
  ]);

  assert.equal(options.debug, true);
  assert.equal(options.loginTimeoutMs, 5000);
});

test('package start script points at the compiled CLI entrypoint', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
    scripts: { start: string };
  };

  assert.equal(packageJson.scripts.start, 'node dist/src/main.js');
});
