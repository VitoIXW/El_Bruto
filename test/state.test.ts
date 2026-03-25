import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyState } from '../src/game/state';

function baseSignals() {
  return {
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: false,
    hasSearchBruteInput: false,
    hasPublicBruteNotFoundText: false,
    hasAuthenticatedHomeMarker: false,
    hasUnknownBruteUrl: false,
    hasArenaLink: false,
    hasArenaWelcomeText: false,
    hasArenaSearchInput: false,
    hasArenaGoButton: false,
    hasOpponentLinks: false,
    hasPreFightControl: false,
    hasVersusText: false,
    hasFightReturnLinks: false,
    hasRestingText: false,
    hasLevelUpHeading: false,
    hasLevelUpChoiceText: false,
  };
}

test('classifyState detects public home', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/',
    hasPublicLoginButton: true,
    hasSearchBruteInput: true,
  });

  assert.equal(result.state, 'public_home');
});

test('classifyState detects login form', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/login',
    hasLoginForm: true,
    hasPasswordInput: true,
  });

  assert.equal(result.state, 'login_form');
});

test('classifyState detects authenticated home', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/',
    hasAuthenticatedHomeMarker: true,
  });

  assert.equal(result.state, 'authenticated_home');
});

test('classifyState detects ready cell', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    hasArenaLink: true,
    bruteNameFromPage: 'ExampleBrute',
  });

  assert.equal(result.state, 'cell_ready');
});

test('classifyState detects resting cell', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    hasRestingText: true,
    bruteNameFromPage: 'ExampleBrute',
  });

  assert.equal(result.state, 'cell_resting');
});

test('classifyState detects Spanish resting cell', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    hasRestingText: true,
    bruteNameFromPage: 'ExampleBrute',
  });

  assert.equal(result.state, 'cell_resting');
});

test('classifyState prioritizes level up', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    hasArenaLink: true,
    hasLevelUpHeading: true,
    hasLevelUpChoiceText: true,
    bruteNameFromPage: 'ExampleBrute',
  });

  assert.equal(result.state, 'level_up');
});

test('classifyState detects Spanish level-up page on cell route', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    hasLevelUpHeading: true,
    hasLevelUpChoiceText: true,
    bruteNameFromPage: 'ExampleBrute',
  });

  assert.equal(result.state, 'level_up');
});

test('classifyState does not misclassify a normal cell as level-up from ambiguous generic controls', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/TargetBrute/cell',
    hasArenaLink: true,
    hasLevelUpHeading: false,
    hasLevelUpChoiceText: true,
    bruteNameFromPage: 'TargetBrute',
  });

  assert.equal(result.state, 'cell_ready');
});

test('classifyState keeps pre-fight distinct from arena selection on fight URLs', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/fight/123',
    hasOpponentLinks: true,
    hasPreFightControl: true,
    hasVersusText: true,
    bruteNameFromPage: 'ExampleBrute',
  });

  assert.equal(result.state, 'pre_fight');
});

test('classifyState detects versus route as pre-fight when start-combat markers are present', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/TargetBrute/versus/OpponentBrute',
    hasPreFightControl: true,
    hasVersusText: true,
    bruteNameFromPage: 'TargetBrute',
  });

  assert.equal(result.state, 'pre_fight');
});

test('classifyState does not classify generic versus route as pre-fight without markers', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/TargetBrute/versus/OpponentBrute',
    bruteNameFromPage: 'TargetBrute',
  });

  assert.equal(result.state, 'unknown');
});

test('classifyState only detects arena selection on arena URLs', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/ExampleBrute/arena',
    hasOpponentLinks: true,
    bruteNameFromPage: 'ExampleBrute',
  });

  assert.equal(result.state, 'arena_selection');
});

test('classifyState detects English public logged-out landing as login required', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    hasPublicLoginButton: true,
    hasSearchBruteInput: true,
    bruteNameFromPage: undefined,
  });

  assert.equal(result.state, 'login_required');
});

test('classifyState detects Spanish public landing as public home', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/',
    hasPublicLoginButton: true,
    hasSearchBruteInput: true,
    hasLevelUpChoiceText: true,
    bruteNameFromPage: undefined,
  });

  assert.equal(result.state, 'public_home');
});

test('classifyState detects unknown-brute public landing as login required', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/unknown-brute',
    hasPublicLoginButton: true,
    hasSearchBruteInput: true,
    hasPublicBruteNotFoundText: true,
    hasUnknownBruteUrl: true,
    bruteNameFromPage: undefined,
  });

  assert.equal(result.state, 'login_required');
});

test('classifyState does not misclassify generic public text as authenticated home', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/',
    hasSearchBruteInput: true,
    hasLevelUpChoiceText: true,
    bruteNameFromPage: undefined,
  });

  assert.equal(result.state, 'public_home');
});

test('classifyState keeps partially rendered arena on arena_selection instead of unknown', () => {
  const result = classifyState({
    ...baseSignals(),
    url: 'https://brute.eternaltwin.org/TargetBrute/arena',
    hasArenaWelcomeText: true,
    hasArenaSearchInput: true,
    hasArenaGoButton: true,
    bruteNameFromPage: 'TargetBrute',
  });

  assert.equal(result.state, 'arena_selection');
});
