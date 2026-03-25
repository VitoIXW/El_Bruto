import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBootstrapUrl, buildConfig } from '../src/config';

test('buildBootstrapUrl derives the stable site entrypoint from the target brute URL', () => {
  assert.equal(buildBootstrapUrl('https://brute.eternaltwin.org/ExampleBrute/cell'), 'https://brute.eternaltwin.org/');
});

test('buildConfig preserves execution mode', () => {
  const config = buildConfig({
    runStyle: 'automatic',
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    mode: 'all-brutes',
    debug: false,
    headless: false,
  });

  assert.equal(config.executionMode, 'all-brutes');
  assert.equal(config.targetUrl, 'https://brute.eternaltwin.org/');
});

test('buildConfig requires an explicit brute for automatic single mode', () => {
  assert.throws(
    () => buildConfig({
      runStyle: 'automatic',
      url: 'https://brute.eternaltwin.org/',
      mode: 'single',
      debug: false,
      headless: false,
    }),
    /requires --brute/,
  );
});

test('buildConfig uses the selected brute and headless setting for automatic single mode', () => {
  const config = buildConfig({
    runStyle: 'automatic',
    url: 'https://brute.eternaltwin.org/',
    mode: 'single',
    brute: 'TargetBrute',
    debug: false,
    headless: true,
  });

  assert.equal(config.targetBruteName, 'TargetBrute');
  assert.equal(config.targetUrl, 'https://brute.eternaltwin.org/TargetBrute/cell');
  assert.equal(config.headless, true);
});
