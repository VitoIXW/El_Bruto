import test from 'node:test';
import assert from 'node:assert/strict';

import { formatAccountSummary, formatSummary } from '../src/reporting/summary';

test('formatSummary includes artifact paths when present', () => {
  const text = formatSummary({
    bruteName: 'ExampleBrute',
    fightsCompleted: 2,
    finalStatus: 'resting',
    restingReached: true,
    levelUpDetected: false,
    errorsOccurred: false,
    artifacts: {
      screenshotPath: 'artifacts/example.png',
      htmlPath: 'artifacts/example.html',
    },
  });

  assert.match(text, /Brute name: ExampleBrute/);
  assert.match(text, /Screenshot: artifacts\/example\.png/);
  assert.match(text, /HTML snapshot: artifacts\/example\.html/);
});

test('formatSummary makes level-up manual intervention explicit', () => {
  const text = formatSummary({
    bruteName: 'ExampleBrute',
    fightsCompleted: 4,
    finalStatus: 'manual_intervention_required',
    restingReached: false,
    levelUpDetected: true,
    errorsOccurred: false,
  });

  assert.match(text, /Final status: manual_intervention_required/);
  assert.match(text, /Level-up detected: true/);
  assert.match(
    text,
    /Reason: The brute leveled up and requires a manual upgrade choice before continuing\./,
  );
});

test('formatAccountSummary includes aggregate counts and per-brute results', () => {
  const text = formatAccountSummary({
    mode: 'all-brutes',
    startedBruteName: 'ExampleBrute',
    cycleCompleted: true,
    advanceFailed: false,
    totalBrutesProcessed: 2,
    totalFightsCompleted: 5,
    restingCount: 1,
    manualInterventionCount: 1,
    errorCount: 0,
    brutes: [
      {
        bruteName: 'ExampleBrute',
        fightsCompleted: 3,
        finalStatus: 'resting',
        restingReached: true,
        levelUpDetected: false,
        errorsOccurred: false,
      },
      {
        bruteName: 'TargetBrute',
        fightsCompleted: 2,
        finalStatus: 'manual_intervention_required',
        restingReached: false,
        levelUpDetected: true,
        errorsOccurred: false,
      },
    ],
  });

  assert.match(text, /Account run summary/);
  assert.match(text, /Brutes processed: 2/);
  assert.match(text, /Advance failed: false/);
  assert.match(text, /Total fights completed: 5/);
  assert.match(text, /Manual intervention required: 1/);
  assert.match(text, /- ExampleBrute \| fights=3 \| status=resting/);
  assert.match(text, /- TargetBrute \| fights=2 \| status=manual_intervention_required/);
});

test('formatAccountSummary makes incomplete-cycle advance failure explicit', () => {
  const text = formatAccountSummary({
    mode: 'all-brutes',
    startedBruteName: 'ExampleBrute',
    cycleCompleted: false,
    advanceFailed: true,
    failureReason: 'Unable to advance to the next brute after ExampleBrute: missing next-brute control',
    totalBrutesProcessed: 1,
    totalFightsCompleted: 3,
    restingCount: 1,
    manualInterventionCount: 0,
    errorCount: 0,
    brutes: [
      {
        bruteName: 'ExampleBrute',
        fightsCompleted: 3,
        finalStatus: 'resting',
        restingReached: true,
        levelUpDetected: false,
        errorsOccurred: false,
      },
    ],
  });

  assert.match(text, /Cycle completed: false/);
  assert.match(text, /Advance failed: true/);
  assert.match(text, /Failure reason: Unable to advance to the next brute after ExampleBrute: missing next-brute control/);
});
