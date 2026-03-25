import test from 'node:test';
import assert from 'node:assert/strict';

import { describeArenaReadiness } from '../src/game/arena';
import type { Logger } from '../src/reporting/logger';

const arena = require('../src/game/arena') as typeof import('../src/game/arena');
const navigation = require('../src/game/navigation') as typeof import('../src/game/navigation');
const analysis = require('../src/game/opponent-analysis') as typeof import('../src/game/opponent-analysis');

function createLogger(messages: string[] = []): Logger {
  return {
    info(message) {
      messages.push(`info:${message}`);
    },
    warn(message) {
      messages.push(`warn:${message}`);
    },
    error(message) {
      messages.push(`error:${message}`);
    },
    debug(message) {
      messages.push(`debug:${message}`);
    },
    logFilePath: '/tmp/test.log',
  };
}

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

test('selectOpponent logs visible rivals, per-rival public win rates, and the preferred rival', { concurrency: false }, async () => {
  const originalReadVisibleArenaOpponents = navigation.readVisibleArenaOpponents;
  const originalAnalyzePublicOpponentWinRates = analysis.analyzePublicOpponentWinRates;
  const originalChooseNamedOpponent = navigation.chooseNamedOpponent;

  const messages: string[] = [];
  const page = {
    url() {
      return 'https://brute.eternaltwin.org/TargetBrute/arena';
    },
    locator() {
      return {
        async count() {
          return 1;
        },
      };
    },
    async waitForURL() {},
  };

  navigation.readVisibleArenaOpponents = async () => [
    { name: 'ExampleBrute', control: {} as never },
    { name: 'OpponentBrute', control: {} as never },
  ];
  analysis.analyzePublicOpponentWinRates = async () => [
    {
      name: 'ExampleBrute',
      cellUrl: 'https://brute.eternaltwin.org/ExampleBrute/cell',
      winRatePercentage: 54,
    },
    {
      name: 'OpponentBrute',
      cellUrl: 'https://brute.eternaltwin.org/OpponentBrute/cell',
      winRatePercentage: 12,
    },
  ];
  navigation.chooseNamedOpponent = async (_page, name) => name === 'OpponentBrute';

  try {
    await arena.selectOpponent(page as never, 5000, createLogger(messages));

    assert.match(messages.join('\n'), /Visible arena rivals: ExampleBrute, OpponentBrute/);
    assert.match(messages.join('\n'), /Arena rival public win-rate: ExampleBrute -> 54%/);
    assert.match(messages.join('\n'), /Arena rival public win-rate: OpponentBrute -> 12%/);
    assert.match(messages.join('\n'), /Preferred arena rival by public win rate: OpponentBrute \(12%\)/);
  } finally {
    navigation.readVisibleArenaOpponents = originalReadVisibleArenaOpponents;
    analysis.analyzePublicOpponentWinRates = originalAnalyzePublicOpponentWinRates;
    navigation.chooseNamedOpponent = originalChooseNamedOpponent;
  }
});

test('selectOpponent logs fallback reason when public analysis does not produce a preferred rival', { concurrency: false }, async () => {
  const originalReadVisibleArenaOpponents = navigation.readVisibleArenaOpponents;
  const originalAnalyzePublicOpponentWinRates = analysis.analyzePublicOpponentWinRates;
  const originalChooseFirstOpponent = navigation.chooseFirstOpponent;

  const messages: string[] = [];
  const page = {
    url() {
      return 'https://brute.eternaltwin.org/TargetBrute/arena';
    },
    locator() {
      return {
        async count() {
          return 1;
        },
      };
    },
    async waitForURL() {},
  };

  navigation.readVisibleArenaOpponents = async () => [
    { name: 'ExampleBrute', control: {} as never },
    { name: 'OpponentBrute', control: {} as never },
  ];
  analysis.analyzePublicOpponentWinRates = async () => [
    {
      name: 'ExampleBrute',
      cellUrl: 'https://brute.eternaltwin.org/ExampleBrute/cell',
      error: 'Unable to parse public win-rate percentage.',
    },
    {
      name: 'OpponentBrute',
      cellUrl: 'https://brute.eternaltwin.org/OpponentBrute/cell',
      error: 'Unable to fetch public cell page (404).',
    },
  ];
  navigation.chooseFirstOpponent = async () => {
    messages.push('fallback:first-opponent');
  };

  try {
    await arena.selectOpponent(page as never, 5000, createLogger(messages));

    assert.match(messages.join('\n'), /Arena rival analysis failed for ExampleBrute/);
    assert.match(messages.join('\n'), /Arena rival analysis failed for OpponentBrute/);
    assert.match(messages.join('\n'), /Falling back to the first visible arena rival because no public win-rate analysis succeeded/);
    assert.match(messages.join('\n'), /fallback:first-opponent/);
  } finally {
    navigation.readVisibleArenaOpponents = originalReadVisibleArenaOpponents;
    analysis.analyzePublicOpponentWinRates = originalAnalyzePublicOpponentWinRates;
    navigation.chooseFirstOpponent = originalChooseFirstOpponent;
  }
});
