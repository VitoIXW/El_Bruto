import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBootstrapUrl, buildConfig } from '../src/config';

test('buildBootstrapUrl derives the stable site entrypoint from the target brute URL', () => {
  assert.equal(buildBootstrapUrl('https://brute.eternaltwin.org/ExampleBrute/cell'), 'https://brute.eternaltwin.org/');
});

test('buildConfig preserves execution mode', () => {
  const config = buildConfig({
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    mode: 'all-brutes',
    debug: false,
  });

  assert.equal(config.executionMode, 'all-brutes');
});
