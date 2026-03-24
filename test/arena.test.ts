import test from 'node:test';
import assert from 'node:assert/strict';

import { describeArenaReadiness } from '../src/game/arena';

test('describeArenaReadiness treats shell-only arena as not ready yet', () => {
  const result = describeArenaReadiness({
    hasWelcomeText: true,
    hasSearchInput: true,
    hasGoButton: true,
    opponentControlCount: 0,
    opponentCardCount: 0,
  });

  assert.equal(result.isArenaShell, true);
  assert.equal(result.isReady, false);
  assert.match(result.reason, /no selectable opponents/i);
});

test('describeArenaReadiness treats arena as ready when opponent controls appear', () => {
  const result = describeArenaReadiness({
    hasWelcomeText: true,
    hasSearchInput: true,
    hasGoButton: true,
    opponentControlCount: 3,
    opponentCardCount: 0,
  });

  assert.equal(result.isArenaShell, true);
  assert.equal(result.isReady, true);
  assert.match(result.reason, /3 selectable rival target/);
});

test('describeArenaReadiness treats rival cards as selectable targets', () => {
  const result = describeArenaReadiness({
    hasWelcomeText: true,
    hasSearchInput: true,
    hasGoButton: true,
    opponentControlCount: 0,
    opponentCardCount: 4,
  });

  assert.equal(result.isArenaShell, true);
  assert.equal(result.isReady, true);
  assert.match(result.reason, /4 selectable rival target/);
});
