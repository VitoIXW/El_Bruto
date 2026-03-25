import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { parseCliArgs } from '../src/cli';
import { selectors } from '../src/game/selectors';

test('parseCliArgs uses defaults', () => {
  const options = parseCliArgs([]);
  assert.equal(options.url, 'https://brute.eternaltwin.org/ExampleBrute/cell');
  assert.equal(options.mode, 'single');
  assert.equal(options.debug, false);
});

test('parseCliArgs reads supported flags', () => {
  const options = parseCliArgs([
    '--mode',
    'all-brutes',
    '--url',
    'https://brute.eternaltwin.org/ExampleBrute/cell',
    '--debug',
    '--login-timeout-ms',
    '5000',
  ]);

  assert.equal(options.mode, 'all-brutes');
  assert.equal(options.debug, true);
  assert.equal(options.loginTimeoutMs, 5000);
});

test('package start script points at the compiled CLI entrypoint', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
    scripts: { start: string };
  };

  assert.equal(packageJson.scripts.start, 'node dist/src/main.js');
});

test('next brute selector supports aria-label based controls', () => {
  assert.match(selectors.cell.nextBruteControl, /aria-label="Next Brute"/);
  assert.match(selectors.cell.nextBruteControl, /aria-label="Siguiente Bruto"/);
});
