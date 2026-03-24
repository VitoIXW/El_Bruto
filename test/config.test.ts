import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBootstrapUrl } from '../src/config';

test('buildBootstrapUrl derives the stable site entrypoint from the target brute URL', () => {
  assert.equal(buildBootstrapUrl('https://brute.eternaltwin.org/ExampleBrute/cell'), 'https://brute.eternaltwin.org/');
});
