import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyState } from '../src/game/state';

test('classifyState detects ready cell', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: false,
    hasSearchBruteInput: false,
    hasPublicBruteNotFoundText: false,
    hasUnknownBruteUrl: false,
    hasArenaLink: true,
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
    bruteNameFromPage: 'ExampleBrute',
  });

  assert.equal(result.state, 'cell_ready');
});

test('classifyState detects resting cell', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: false,
    hasSearchBruteInput: false,
    hasPublicBruteNotFoundText: false,
    hasUnknownBruteUrl: false,
    hasArenaLink: false,
    hasArenaWelcomeText: false,
    hasArenaSearchInput: false,
    hasArenaGoButton: false,
    hasOpponentLinks: false,
    hasPreFightControl: false,
    hasVersusText: false,
    hasFightReturnLinks: false,
    hasRestingText: true,
    hasLevelUpHeading: false,
    hasLevelUpChoiceText: false,
    bruteNameFromPage: 'ExampleBrute',
  });

  assert.equal(result.state, 'cell_resting');
});

test('classifyState detects Spanish resting cell', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: false,
    hasSearchBruteInput: false,
    hasPublicBruteNotFoundText: false,
    hasUnknownBruteUrl: false,
    hasArenaLink: false,
    hasArenaWelcomeText: false,
    hasArenaSearchInput: false,
    hasArenaGoButton: false,
    hasOpponentLinks: false,
    hasPreFightControl: false,
    hasVersusText: false,
    hasFightReturnLinks: false,
    hasRestingText: true,
    hasLevelUpHeading: false,
    hasLevelUpChoiceText: false,
    bruteNameFromPage: 'ExampleBrute',
  });

  assert.equal(result.state, 'cell_resting');
});

test('classifyState prioritizes level up', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: false,
    hasSearchBruteInput: false,
    hasPublicBruteNotFoundText: false,
    hasUnknownBruteUrl: false,
    hasArenaLink: true,
    hasArenaWelcomeText: false,
    hasArenaSearchInput: false,
    hasArenaGoButton: false,
    hasOpponentLinks: false,
    hasPreFightControl: false,
    hasVersusText: false,
    hasFightReturnLinks: false,
    hasRestingText: false,
    hasLevelUpHeading: true,
    hasLevelUpChoiceText: true,
    bruteNameFromPage: 'ExampleBrute',
  });

  assert.equal(result.state, 'level_up');
});

test('classifyState detects Spanish level-up page on cell route', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: false,
    hasSearchBruteInput: false,
    hasPublicBruteNotFoundText: false,
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
    hasLevelUpHeading: true,
    hasLevelUpChoiceText: true,
    bruteNameFromPage: 'ExampleBrute',
  });

  assert.equal(result.state, 'level_up');
});

test('classifyState does not misclassify a normal cell as level-up from ambiguous generic controls', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/TargetBrute/cell',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: false,
    hasSearchBruteInput: false,
    hasPublicBruteNotFoundText: false,
    hasUnknownBruteUrl: false,
    hasArenaLink: true,
    hasArenaWelcomeText: false,
    hasArenaSearchInput: false,
    hasArenaGoButton: false,
    hasOpponentLinks: false,
    hasPreFightControl: false,
    hasVersusText: false,
    hasFightReturnLinks: false,
    hasRestingText: false,
    hasLevelUpHeading: false,
    hasLevelUpChoiceText: true,
    bruteNameFromPage: 'TargetBrute',
  });

  assert.equal(result.state, 'cell_ready');
});

test('classifyState keeps pre-fight distinct from arena selection on fight URLs', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/fight/123',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: false,
    hasSearchBruteInput: false,
    hasPublicBruteNotFoundText: false,
    hasUnknownBruteUrl: false,
    hasArenaLink: false,
    hasArenaWelcomeText: false,
    hasArenaSearchInput: false,
    hasArenaGoButton: false,
    hasOpponentLinks: true,
    hasPreFightControl: true,
    hasVersusText: true,
    hasFightReturnLinks: false,
    hasRestingText: false,
    hasLevelUpHeading: false,
    hasLevelUpChoiceText: false,
    bruteNameFromPage: 'ExampleBrute',
  });

  assert.equal(result.state, 'pre_fight');
});

test('classifyState detects versus route as pre-fight when start-combat markers are present', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/TargetBrute/versus/OpponentBrute',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: false,
    hasSearchBruteInput: false,
    hasPublicBruteNotFoundText: false,
    hasUnknownBruteUrl: false,
    hasArenaLink: false,
    hasArenaWelcomeText: false,
    hasArenaSearchInput: false,
    hasArenaGoButton: false,
    hasOpponentLinks: false,
    hasPreFightControl: true,
    hasVersusText: true,
    hasFightReturnLinks: false,
    hasRestingText: false,
    hasLevelUpHeading: false,
    hasLevelUpChoiceText: false,
    bruteNameFromPage: 'TargetBrute',
  });

  assert.equal(result.state, 'pre_fight');
});

test('classifyState does not classify generic versus route as pre-fight without markers', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/TargetBrute/versus/OpponentBrute',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: false,
    hasSearchBruteInput: false,
    hasPublicBruteNotFoundText: false,
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
    bruteNameFromPage: 'TargetBrute',
  });

  assert.equal(result.state, 'unknown');
});

test('classifyState only detects arena selection on arena URLs', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/ExampleBrute/arena',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: false,
    hasSearchBruteInput: false,
    hasPublicBruteNotFoundText: false,
    hasUnknownBruteUrl: false,
    hasArenaLink: false,
    hasArenaWelcomeText: false,
    hasArenaSearchInput: false,
    hasArenaGoButton: false,
    hasOpponentLinks: true,
    hasPreFightControl: false,
    hasVersusText: false,
    hasFightReturnLinks: false,
    hasRestingText: false,
    hasLevelUpHeading: false,
    hasLevelUpChoiceText: false,
    bruteNameFromPage: 'ExampleBrute',
  });

  assert.equal(result.state, 'arena_selection');
});

test('classifyState detects English public logged-out landing as login required', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: true,
    hasSearchBruteInput: true,
    hasPublicBruteNotFoundText: false,
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
    bruteNameFromPage: undefined,
  });

  assert.equal(result.state, 'login_required');
});

test('classifyState detects Spanish public landing as login required', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: true,
    hasSearchBruteInput: true,
    hasPublicBruteNotFoundText: false,
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
    hasLevelUpChoiceText: true,
    bruteNameFromPage: undefined,
  });

  assert.equal(result.state, 'login_required');
});

test('classifyState detects unknown-brute public landing as login required', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/unknown-brute',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: true,
    hasSearchBruteInput: true,
    hasPublicBruteNotFoundText: true,
    hasUnknownBruteUrl: true,
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
    bruteNameFromPage: undefined,
  });

  assert.equal(result.state, 'login_required');
});

test('classifyState does not misclassify generic public text as level up', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: false,
    hasSearchBruteInput: true,
    hasPublicBruteNotFoundText: false,
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
    hasLevelUpChoiceText: true,
    bruteNameFromPage: undefined,
  });

  assert.equal(result.state, 'unknown');
});

test('classifyState keeps partially rendered arena on arena_selection instead of unknown', () => {
  const result = classifyState({
    url: 'https://brute.eternaltwin.org/TargetBrute/arena',
    hasLoginForm: false,
    hasPasswordInput: false,
    hasPublicLoginButton: false,
    hasSearchBruteInput: false,
    hasPublicBruteNotFoundText: false,
    hasUnknownBruteUrl: false,
    hasArenaLink: false,
    hasArenaWelcomeText: true,
    hasArenaSearchInput: true,
    hasArenaGoButton: true,
    hasOpponentLinks: false,
    hasPreFightControl: false,
    hasVersusText: false,
    hasFightReturnLinks: false,
    hasRestingText: false,
    hasLevelUpHeading: false,
    hasLevelUpChoiceText: false,
    bruteNameFromPage: 'TargetBrute',
  });

  assert.equal(result.state, 'arena_selection');
});
