import test from 'node:test';
import assert from 'node:assert/strict';

import { extractBruteNameFromUrl, pickTopLeftHomeBruteEntry } from '../src/game/navigation';

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

test('pickTopLeftHomeBruteEntry prefers the top-left roster candidate over later generic positions', () => {
  const selected = pickTopLeftHomeBruteEntry([
    { index: 0, x: 420, y: 120 },
    { index: 1, x: 48, y: 64 },
    { index: 2, x: 300, y: 64 },
  ]);

  assert.deepEqual(selected, { index: 1, x: 48, y: 64 });
});

test('pickTopLeftHomeBruteEntry returns undefined when no roster candidates are available', () => {
  assert.equal(pickTopLeftHomeBruteEntry([]), undefined);
});
