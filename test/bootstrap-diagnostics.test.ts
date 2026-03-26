import test from 'node:test';
import assert from 'node:assert/strict';

import type { Logger } from '../src/reporting/logger';
import type { FailureArtifacts, RunConfig, StateDetectionDetails } from '../src/types/run-types';

const bruteRunner = require('../src/game/brute-runner') as typeof import('../src/game/brute-runner');
const accountRunner = require('../src/game/account-runner') as typeof import('../src/game/account-runner');
const startup = require('../src/game/startup') as typeof import('../src/game/startup');
const artifacts = require('../src/reporting/artifacts') as typeof import('../src/reporting/artifacts');

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

test('runBrute captures bootstrap failure artifacts and returns an error summary', { concurrency: false }, async () => {
  const originalBootstrapIntoTargetBrute = startup.bootstrapIntoTargetBrute;
  const originalCaptureFailureArtifactsSafely = artifacts.captureFailureArtifactsSafely;

  startup.bootstrapIntoTargetBrute = async () => {
    throw new Error('submit lookup timed out');
  };
  artifacts.captureFailureArtifactsSafely = async () => ({
    screenshotPath: '/tmp/artifacts/bootstrap-failure.png',
    htmlPath: '/tmp/artifacts/bootstrap-failure.html',
  });

  try {
    const result = await bruteRunner.runBrute({} as never, createConfig(), createLogger());

    assert.equal(result.bruteName, 'TargetBrute');
    assert.equal(result.finalStatus, 'error');
    assert.equal(result.errorsOccurred, true);
    assert.deepEqual(result.artifacts, {
      screenshotPath: '/tmp/artifacts/bootstrap-failure.png',
      htmlPath: '/tmp/artifacts/bootstrap-failure.html',
    });
  } finally {
    startup.bootstrapIntoTargetBrute = originalBootstrapIntoTargetBrute;
    artifacts.captureFailureArtifactsSafely = originalCaptureFailureArtifactsSafely;
  }
});

test('runAllBrutes reports bootstrap artifact paths in the failure reason', { concurrency: false }, async () => {
  const originalBootstrapIntoTargetBrute = startup.bootstrapIntoTargetBrute;
  const originalCaptureFailureArtifactsSafely = artifacts.captureFailureArtifactsSafely;
  const messages: string[] = [];
  const capturedArtifacts: FailureArtifacts = {
    screenshotPath: '/tmp/artifacts/bootstrap-failure.png',
    htmlPath: '/tmp/artifacts/bootstrap-failure.html',
  };

  startup.bootstrapIntoTargetBrute = async () => {
    throw new Error('login submit control not found');
  };
  artifacts.captureFailureArtifactsSafely = async () => capturedArtifacts;

  try {
    const summary = await accountRunner.runAllBrutes({} as never, createConfig(), createLogger(messages));

    assert.equal(summary.startedBruteName, 'TargetBrute');
    assert.equal(summary.advanceFailed, true);
    assert.equal(summary.cycleCompleted, false);
    assert.match(summary.failureReason ?? '', /Bootstrap failed before roster processing/);
    assert.match(summary.failureReason ?? '', /bootstrap-failure\.png/);
    assert.match(summary.failureReason ?? '', /bootstrap-failure\.html/);
    assert.equal(summary.totalBrutesProcessed, 0);
  } finally {
    startup.bootstrapIntoTargetBrute = originalBootstrapIntoTargetBrute;
    artifacts.captureFailureArtifactsSafely = originalCaptureFailureArtifactsSafely;
  }
});

test('runAllBrutes skips bootstrap when an initial brute state is already provided', { concurrency: false }, async () => {
  const originalBootstrapIntoTargetBrute = startup.bootstrapIntoTargetBrute;
  const originalRunCurrentBrute = bruteRunner.runCurrentBrute;

  const initialState: StateDetectionDetails = {
    state: 'cell_resting',
    url: 'https://brute.eternaltwin.org/TargetBrute/cell',
    bruteNameFromPage: 'TargetBrute',
    notes: ['cell resting markers detected'],
  };

  startup.bootstrapIntoTargetBrute = async () => {
    throw new Error('bootstrap should not run when interactive all-brutes already selected a brute');
  };
  bruteRunner.runCurrentBrute = async () => ({
    bruteName: 'TargetBrute',
    fightsCompleted: 0,
    wins: 0,
    losses: 0,
    finalStatus: 'resting',
    restingReached: true,
    levelUpDetected: false,
    errorsOccurred: false,
  });

  try {
    const summary = await accountRunner.runAllBrutes(
      {} as never,
      { ...createConfig(), executionMode: 'all-brutes' },
      createLogger(),
      initialState,
    );

    assert.equal(summary.startedBruteName, 'TargetBrute');
    assert.equal(summary.totalBrutesProcessed, 1);
    assert.equal(summary.brutes[0]?.bruteName, 'TargetBrute');
  } finally {
    startup.bootstrapIntoTargetBrute = originalBootstrapIntoTargetBrute;
    bruteRunner.runCurrentBrute = originalRunCurrentBrute;
  }
});

test('runAllBrutes can continue through an explicit interactive brute order without using next-brute controls', { concurrency: false }, async () => {
  const originalBootstrapIntoTargetBrute = startup.bootstrapIntoTargetBrute;
  const originalRunCurrentBrute = bruteRunner.runCurrentBrute;
  const originalWaitForStableGameState = startup.waitForStableGameState;

  const visitedUrls: string[] = [];
  let currentBruteName = 'ExampleBrute';

  const initialState: StateDetectionDetails = {
    state: 'cell_resting',
    url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
    bruteNameFromPage: 'ExampleBrute',
    notes: ['cell resting markers detected'],
  };

  startup.bootstrapIntoTargetBrute = async () => {
    throw new Error('bootstrap should not run when an interactive brute order is provided');
  };
  bruteRunner.runCurrentBrute = async () => ({
    bruteName: currentBruteName,
    fightsCompleted: 0,
    wins: 0,
    losses: 0,
    finalStatus: 'resting',
    restingReached: true,
    levelUpDetected: false,
    errorsOccurred: false,
  });
  startup.waitForStableGameState = async () => ({
    state: 'cell_resting',
    url: `https://brute.eternaltwin.org/${currentBruteName}/cell`,
    bruteNameFromPage: currentBruteName,
    notes: ['cell resting markers detected'],
  });

  const page = {
    async goto(url: string) {
      visitedUrls.push(url);
      const match = url.match(/\/([^/]+)\/cell$/);
      currentBruteName = match?.[1] ?? currentBruteName;
    },
  };

  try {
    const summary = await accountRunner.runAllBrutes(
      page as never,
      { ...createConfig(), executionMode: 'all-brutes' },
      createLogger(),
      initialState,
      ['ExampleBrute', 'TargetBrute', 'OpponentBrute'],
    );

    assert.equal(summary.cycleCompleted, true);
    assert.equal(summary.totalBrutesProcessed, 3);
    assert.deepEqual(summary.brutes.map((brute) => brute.bruteName), [
      'ExampleBrute',
      'TargetBrute',
      'OpponentBrute',
    ]);
    assert.deepEqual(visitedUrls, [
      'https://brute.eternaltwin.org/TargetBrute/cell',
      'https://brute.eternaltwin.org/OpponentBrute/cell',
    ]);
  } finally {
    startup.bootstrapIntoTargetBrute = originalBootstrapIntoTargetBrute;
    bruteRunner.runCurrentBrute = originalRunCurrentBrute;
    startup.waitForStableGameState = originalWaitForStableGameState;
  }
});
