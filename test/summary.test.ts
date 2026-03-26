import test from 'node:test';
import assert from 'node:assert/strict';

import { formatAccountSummary, formatSummary } from '../src/reporting/summary';

test('formatSummary includes artifact paths when present', () => {
  const text = formatSummary({
    bruteName: 'ExampleBrute',
    fightsCompleted: 2,
    wins: 1,
    losses: 1,
    finalStatus: 'resting',
    restingReached: true,
    levelUpDetected: false,
    errorsOccurred: false,
    artifacts: {
      screenshotPath: 'artifacts/example.png',
      htmlPath: 'artifacts/example.html',
    },
  });

  assert.match(text, /Brute: ExampleBrute/);
  assert.match(text, /Status: resting/);
  assert.match(text, /Wins: 1/);
  assert.match(text, /Losses: 1/);
  assert.match(text, /Screenshot: artifacts\/example\.png/);
  assert.match(text, /HTML snapshot: artifacts\/example\.html/);
});

test('formatSummary makes level-up manual intervention explicit', () => {
  const text = formatSummary({
    bruteName: 'ExampleBrute',
    fightsCompleted: 4,
    wins: 3,
    losses: 1,
    finalStatus: 'manual_intervention_required',
    restingReached: false,
    levelUpDetected: true,
    errorsOccurred: false,
  });

  assert.match(text, /Status: manual intervention required/);
  assert.match(text, /Level-up: yes/);
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
    totalWins: 3,
    totalLosses: 2,
    restingCount: 1,
    manualInterventionCount: 1,
    errorCount: 0,
    brutes: [
      {
        bruteName: 'ExampleBrute',
        fightsCompleted: 3,
        wins: 2,
        losses: 1,
        finalStatus: 'resting',
        restingReached: true,
        levelUpDetected: false,
        errorsOccurred: false,
      },
      {
        bruteName: 'TargetBrute',
        fightsCompleted: 2,
        wins: 1,
        losses: 1,
        finalStatus: 'manual_intervention_required',
        restingReached: false,
        levelUpDetected: true,
        errorsOccurred: false,
      },
    ],
  });

  assert.match(text, /Account Run Summary/);
  assert.match(text, /Outcome: COMPLETE/);
  assert.match(text, /Brutes processed: 2/);
  assert.match(text, /Total fights: 5/);
  assert.match(text, /Total wins: 3/);
  assert.match(text, /Total losses: 2/);
  assert.match(text, /Manual intervention: 1/);
  assert.match(text, /- ExampleBrute \| status=resting \| fights=3 \| wins=2 \| losses=1/);
  assert.match(text, /- TargetBrute \| status=manual intervention required \| fights=2 \| wins=1 \| losses=1/);
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
    totalWins: 2,
    totalLosses: 1,
    restingCount: 1,
    manualInterventionCount: 0,
    errorCount: 0,
    brutes: [
      {
        bruteName: 'ExampleBrute',
        fightsCompleted: 3,
        wins: 2,
        losses: 1,
        finalStatus: 'resting',
        restingReached: true,
        levelUpDetected: false,
        errorsOccurred: false,
      },
    ],
  });

  assert.match(text, /Outcome: INCOMPLETE/);
  assert.match(text, /Failure reason: Unable to advance to the next brute after ExampleBrute: missing next-brute control/);
});
