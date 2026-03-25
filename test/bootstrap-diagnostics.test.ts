import test from 'node:test';
import assert from 'node:assert/strict';

import type { Logger } from '../src/reporting/logger';
import type { FailureArtifacts, RunConfig } from '../src/types/run-types';

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
