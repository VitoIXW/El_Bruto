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
    preClickDelay: true,
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

test('waitForLoginSubmitTransition ignores transient post-submit states until login reaches an actionable state', { concurrency: false }, async () => {
  const originalDetectState = detector.detectState;
  const page = {
    waitForTimeoutCalls: [] as number[],
    async waitForTimeout(timeoutMs: number) {
      this.waitForTimeoutCalls.push(timeoutMs);
    },
  };
  const states: StateDetectionDetails[] = [
    { state: 'login_form', url: 'https://brute.eternaltwin.org/login', notes: [] },
    { state: 'public_home', url: 'https://brute.eternaltwin.org', notes: [] },
    { state: 'unknown', url: 'https://brute.eternaltwin.org/loading', notes: [] },
    { state: 'authenticated_home', url: 'https://brute.eternaltwin.org/home', notes: [] },
  ];

  detector.detectState = async () => {
    const nextState = states.shift();
    if (!nextState) {
      throw new Error('No more states configured for detectState.');
    }
    return nextState;
  };

  try {
    const result = await startup.waitForLoginSubmitTransition(page as never, createLogger(), 5000);
    assert.equal(result.state, 'authenticated_home');
    assert.deepEqual(page.waitForTimeoutCalls, [1000, 1000, 1000]);
  } finally {
    detector.detectState = originalDetectState;
  }
});

test('bootstrapToAuthenticatedHome reopens the account home when login lands on a brute cell first', { concurrency: false }, async () => {
  const originalDetectState = detector.detectState;
  const originalClickPublicLogin = navigation.clickPublicLogin;
  const originalSubmitLoginForm = navigation.submitLoginForm;
  const originalLoadLoginCredentials = credentials.loadLoginCredentials;

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
    { state: 'login_form', url: 'https://brute.eternaltwin.org/login', notes: [] },
    {
      state: 'cell_ready',
      url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
      bruteNameFromPage: 'ExampleBrute',
      notes: [],
    },
    { state: 'authenticated_home', url: 'https://brute.eternaltwin.org/', notes: [] },
  ];

  detector.detectState = async () => {
    const nextState = states.shift();
    if (!nextState) {
      throw new Error('No more states configured for detectState.');
    }
    return nextState;
  };
  navigation.clickPublicLogin = async () => {};
  navigation.submitLoginForm = async () => {};
  credentials.loadLoginCredentials = () => ({
    username: 'EXAMPLE_USERNAME',
    password: 'EXAMPLE_PASSWORD',
    source: 'environment',
  });

  try {
    const result = await startup.bootstrapToAuthenticatedHome(page as never, createConfig(), createLogger());

    assert.equal(result.state, 'authenticated_home');
    assert.deepEqual(page.visitedUrls, [
      'https://brute.eternaltwin.org',
      'https://brute.eternaltwin.org',
    ]);
  } finally {
    detector.detectState = originalDetectState;
    navigation.clickPublicLogin = originalClickPublicLogin;
    navigation.submitLoginForm = originalSubmitLoginForm;
    credentials.loadLoginCredentials = originalLoadLoginCredentials;
  }
});

test(
  'bootstrapIntoTargetBrute does not re-submit credentials while the first login submit is resolving',
  { concurrency: false },
  async () => {
  const originalDetectState = detector.detectState;
  const originalClickPublicLogin = navigation.clickPublicLogin;
  const originalSubmitLoginForm = navigation.submitLoginForm;
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
    { state: 'login_form', url: 'https://brute.eternaltwin.org/login', notes: [] },
    { state: 'public_home', url: 'https://brute.eternaltwin.org', notes: [] },
    { state: 'unknown', url: 'https://brute.eternaltwin.org/loading', notes: [] },
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
    ]);
    assert.deepEqual(page.visitedUrls, [
      'https://brute.eternaltwin.org',
      'https://brute.eternaltwin.org/TargetBrute/cell',
    ]);
    assert.deepEqual(page.waitForTimeoutCalls, [1000, 1000, 1000, 1000]);
  } finally {
    detector.detectState = originalDetectState;
    navigation.clickPublicLogin = originalClickPublicLogin;
    navigation.submitLoginForm = originalSubmitLoginForm;
    credentials.loadLoginCredentials = originalLoadLoginCredentials;
  }
  },
);

test('continueToConfiguredBrute navigates directly to the chosen brute cell without revisiting bootstrap home', { concurrency: false }, async () => {
  const originalDetectState = detector.detectState;
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
    { state: 'authenticated_home', url: 'https://brute.eternaltwin.org/', notes: [] },
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

  try {
    const result = await startup.continueToConfiguredBrute(page as never, createConfig(), createLogger());

    assert.equal(result.state, 'cell_ready');
    assert.equal(result.bruteNameFromPage, 'TargetBrute');
    assert.deepEqual(page.visitedUrls, ['https://brute.eternaltwin.org/TargetBrute/cell']);
    assert.deepEqual(page.waitForTimeoutCalls, [1000]);
  } finally {
    detector.detectState = originalDetectState;
  }
});
