import test from 'node:test';
import assert from 'node:assert/strict';

import { extractArenaOpponentName, extractBruteNameFromUrl } from '../src/game/navigation';

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

test('extractArenaOpponentName skips generic arena labels and keeps the visible rival name', () => {
  assert.equal(
    extractArenaOpponentName('Fight\nOpponentBrute\n62%'),
    'OpponentBrute',
  );
  assert.equal(
    extractArenaOpponentName('Comenzar el combate\nTargetBrute\nRatio de Victoria 41%'),
    'TargetBrute',
  );
});
