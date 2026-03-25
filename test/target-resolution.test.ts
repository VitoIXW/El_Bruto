import test from 'node:test';
import assert from 'node:assert/strict';

import { extractTargetBruteName, isTargetBruteLoaded, isTransientState } from '../src/game/target-resolution';

test('extractTargetBruteName reads the configured brute from the target URL', () => {
  assert.equal(extractTargetBruteName('https://brute.eternaltwin.org/TargetBrute/cell'), 'TargetBrute');
});

test('isTargetBruteLoaded detects when the target brute is already loaded', () => {
  assert.equal(
    isTargetBruteLoaded('TargetBrute', {
      state: 'cell_ready',
      url: 'https://brute.eternaltwin.org/TargetBrute/cell',
      bruteNameFromPage: 'TargetBrute',
      notes: [],
    }),
    true,
  );

  assert.equal(
    isTargetBruteLoaded('TargetBrute', {
      state: 'cell_ready',
      url: 'https://brute.eternaltwin.org/OtherBrute/cell',
      bruteNameFromPage: 'OtherBrute',
      notes: [],
    }),
    false,
  );
});

test('isTransientState keeps login_form and authenticated_home actionable during login bootstrap', () => {
  assert.equal(isTransientState('login_form', 'login'), false);
  assert.equal(isTransientState('authenticated_home', 'login'), false);
  assert.equal(isTransientState('public_home', 'login'), true);
});

test('isTransientState matches the post-login transient states only', () => {
  assert.equal(isTransientState('login_required'), true);
  assert.equal(isTransientState('login_form'), true);
  assert.equal(isTransientState('authenticated_home'), true);
  assert.equal(isTransientState('unknown'), true);
  assert.equal(isTransientState('cell_ready'), false);
});
