import test from 'node:test';
import assert from 'node:assert/strict';

import { extractBruteNameFromUrl } from '../src/game/navigation';

test('extractBruteNameFromUrl resolves brute identity from a special cell route', () => {
  assert.equal(
    extractBruteNameFromUrl('https://brute.eternaltwin.org/TargetBrute/cell'),
    'TargetBrute',
  );
});

test('extractBruteNameFromUrl resolves brute identity from arena and versus routes', () => {
  assert.equal(
    extractBruteNameFromUrl('https://brute.eternaltwin.org/ExampleBrute/arena'),
    'ExampleBrute',
  );
  assert.equal(
    extractBruteNameFromUrl('https://brute.eternaltwin.org/TargetBrute/versus/OpponentBrute'),
    'TargetBrute',
  );
});
