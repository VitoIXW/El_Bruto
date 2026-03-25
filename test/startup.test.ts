import test from 'node:test';
import assert from 'node:assert/strict';

import type { Logger } from '../src/reporting/logger';
import type { RunConfig, StateDetectionDetails } from '../src/types/run-types';

const startup = require('../src/game/startup') as typeof import('../src/game/startup');
const detector = require('../src/game/detector') as typeof import('../src/game/detector');
const navigation = require('../src/game/navigation') as typeof import('../src/game/navigation');
const credentials = require('../src/auth/credentials') as typeof import('../src/auth/credentials');

function createLogger(): Logger {
  return {
    info() {},
    warn() {},
    error() {},
    debug() {},
    logFilePath: '/tmp/test.log',
  };
}

function createConfig(): RunConfig {
  return {
    targetUrl: 'https://brute.eternaltwin.org/TargetBrute/cell',
    bootstrapUrl: 'https://brute.eternaltwin.org',
    executionMode: 'single',
    profileDir: '/tmp/profile',
    artifactsDir: '/tmp/artifacts',
    logsDir: '/tmp/logs',
    headless: false,
    debug: false,
    loginTimeoutMs: 5000,
    stepTimeoutMs: 5000,
    maxActionRetries: 0,
  };
}

test('waitForStableGameState returns login_form during login bootstrap', { concurrency: false }, async () => {
  const originalDetectState = detector.detectState;
  const page = {
    waitForTimeoutCalls: [] as number[],
    async waitForTimeout(timeoutMs: number) {
      this.waitForTimeoutCalls.push(timeoutMs);
    },
  };
  const states: StateDetectionDetails[] = [
    { state: 'public_home', url: 'https://brute.eternaltwin.org', notes: [] },
    { state: 'login_form', url: 'https://brute.eternaltwin.org/login', notes: [] },
  ];

  detector.detectState = async () => {
    const nextState = states.shift();
    if (!nextState) {
      throw new Error('No more states configured for detectState.');
    }
    return nextState;
  };

  try {
    const result = await startup.waitForStableGameState(page as never, createLogger(), 5000, 'login');
    assert.equal(result.state, 'login_form');
    assert.deepEqual(page.waitForTimeoutCalls, [1000]);
  } finally {
    detector.detectState = originalDetectState;
  }
});

test(
  'bootstrapIntoTargetBrute submits credentials after the login form becomes actionable',
  { concurrency: false },
  async () => {
  const originalDetectState = detector.detectState;
  const originalClickPublicLogin = navigation.clickPublicLogin;
  const originalSubmitLoginForm = navigation.submitLoginForm;
  const originalClickFirstHomeBrute = navigation.clickFirstHomeBrute;
  const originalLoadLoginCredentials = credentials.loadLoginCredentials;

  const events: string[] = [];
  const page = {
    visitedUrls: [] as string[],
    waitForTimeoutCalls: [] as number[],
    async goto(url: string) {
      this.visitedUrls.push(url);
    },
    async waitForTimeout(timeoutMs: number) {
      this.waitForTimeoutCalls.push(timeoutMs);
    },
  };
  const states: StateDetectionDetails[] = [
    { state: 'public_home', url: 'https://brute.eternaltwin.org', notes: [] },
    { state: 'public_home', url: 'https://brute.eternaltwin.org', notes: [] },
    { state: 'login_form', url: 'https://brute.eternaltwin.org/login', notes: [] },
    { state: 'login_required', url: 'https://brute.eternaltwin.org/login', notes: [] },
    { state: 'authenticated_home', url: 'https://brute.eternaltwin.org/home', notes: [] },
    {
      state: 'cell_ready',
      url: 'https://brute.eternaltwin.org/TargetBrute/cell',
      bruteNameFromPage: 'TargetBrute',
      notes: [],
    },
  ];

  detector.detectState = async () => {
    const nextState = states.shift();
    if (!nextState) {
      throw new Error('No more states configured for detectState.');
    }
    return nextState;
  };
  navigation.clickPublicLogin = async () => {
    events.push('clickPublicLogin');
  };
  navigation.submitLoginForm = async (_page, username, password) => {
    events.push(`submitLoginForm:${username}:${password}`);
  };
  navigation.clickFirstHomeBrute = async () => {
    events.push('clickFirstHomeBrute');
  };
  credentials.loadLoginCredentials = () => ({
    username: 'EXAMPLE_USERNAME',
    password: 'EXAMPLE_PASSWORD',
    source: 'environment',
  });

  try {
    const result = await startup.bootstrapIntoTargetBrute(page as never, createConfig(), createLogger());

    assert.equal(result.state, 'cell_ready');
    assert.equal(result.bruteNameFromPage, 'TargetBrute');
    assert.deepEqual(events, [
      'clickPublicLogin',
      'submitLoginForm:EXAMPLE_USERNAME:EXAMPLE_PASSWORD',
      'clickFirstHomeBrute',
    ]);
    assert.deepEqual(page.visitedUrls, ['https://brute.eternaltwin.org']);
    assert.deepEqual(page.waitForTimeoutCalls, [1000, 1000]);
  } finally {
    detector.detectState = originalDetectState;
    navigation.clickPublicLogin = originalClickPublicLogin;
    navigation.submitLoginForm = originalSubmitLoginForm;
    navigation.clickFirstHomeBrute = originalClickFirstHomeBrute;
    credentials.loadLoginCredentials = originalLoadLoginCredentials;
  }
  },
);
