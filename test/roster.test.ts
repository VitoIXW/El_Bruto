import test from 'node:test';
import assert from 'node:assert/strict';

import {
  accountRunHasFailure,
  buildConfirmedBruteSettleDeadlines,
  hasStableNextBruteState,
  isConfirmedDifferentBrute,
  isSuccessfulNextBruteTransition,
  shouldDelayConfirmedBruteRestingAcceptance,
  selectPreferredSettledNextBruteState,
  shouldStopRosterCycle,
  summarizeAccountRun,
} from '../src/game/roster';

test('shouldStopRosterCycle returns true for an already visited brute', () => {
  const visited = new Set(['ExampleBrute', 'TargetBrute']);

  assert.equal(shouldStopRosterCycle(visited, 'ExampleBrute'), true);
  assert.equal(shouldStopRosterCycle(visited, 'OpponentBrute'), false);
});

test('summarizeAccountRun aggregates per-brute outcomes', () => {
  const summary = summarizeAccountRun(
    'ExampleBrute',
    [
      {
        bruteName: 'ExampleBrute',
        fightsCompleted: 2,
        wins: 1,
        losses: 1,
        finalStatus: 'resting',
        restingReached: true,
        levelUpDetected: false,
        errorsOccurred: false,
      },
      {
        bruteName: 'TargetBrute',
        fightsCompleted: 1,
        wins: 1,
        losses: 0,
        finalStatus: 'manual_intervention_required',
        restingReached: false,
        levelUpDetected: true,
        errorsOccurred: false,
      },
      {
        bruteName: 'OpponentBrute',
        fightsCompleted: 0,
        wins: 0,
        losses: 0,
        finalStatus: 'error',
        restingReached: false,
        levelUpDetected: false,
        errorsOccurred: true,
      },
    ],
    true,
    false,
  );

  assert.equal(summary.totalBrutesProcessed, 3);
  assert.equal(summary.totalFightsCompleted, 3);
  assert.equal(summary.totalWins, 2);
  assert.equal(summary.totalLosses, 1);
  assert.equal(summary.restingCount, 1);
  assert.equal(summary.manualInterventionCount, 1);
  assert.equal(summary.errorCount, 1);
  assert.equal(summary.cycleCompleted, true);
});

test('accountRunHasFailure returns true when the roster cycle is incomplete due to advance failure', () => {
  const summary = summarizeAccountRun(
    'ExampleBrute',
    [
      {
        bruteName: 'ExampleBrute',
        fightsCompleted: 2,
        wins: 2,
        losses: 0,
        finalStatus: 'resting',
        restingReached: true,
        levelUpDetected: false,
        errorsOccurred: false,
      },
    ],
    false,
    true,
    'Unable to advance to the next brute after ExampleBrute: missing next-brute control',
  );

  assert.equal(summary.advanceFailed, true);
  assert.equal(summary.failureReason?.includes('Unable to advance'), true);
  assert.equal(accountRunHasFailure(summary), true);
});

test('shouldStopRosterCycle does not close the roster for a newly reached brute on a special cell page', () => {
  const visited = new Set(['ExampleBrute']);
  const newlyResolvedBrute = 'TargetBrute';

  assert.equal(shouldStopRosterCycle(visited, newlyResolvedBrute), false);
});

test('isSuccessfulNextBruteTransition accepts a different brute on a stabilized cell page', () => {
  assert.equal(
    isSuccessfulNextBruteTransition('ExampleBrute', {
      state: 'level_up',
      url: 'https://brute.eternaltwin.org/TargetBrute/cell',
      bruteNameFromPage: 'TargetBrute',
      notes: ['level-up markers detected'],
    }),
    true,
  );
});

test('isConfirmedDifferentBrute confirms identity change before state trust', () => {
  assert.equal(
    isConfirmedDifferentBrute('ExampleBrute', {
      state: 'cell_resting',
      url: 'https://brute.eternaltwin.org/TargetBrute/cell',
      bruteNameFromPage: 'TargetBrute',
      notes: ['cell resting markers detected'],
    }),
    true,
  );

  assert.equal(
    isConfirmedDifferentBrute('ExampleBrute', {
      state: 'cell_ready',
      url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
      bruteNameFromPage: 'ExampleBrute',
      notes: ['cell ready markers detected'],
    }),
    false,
  );
});

test('isSuccessfulNextBruteTransition rejects transient or same-brute states', () => {
  assert.equal(
    isSuccessfulNextBruteTransition('ExampleBrute', {
      state: 'unknown',
      url: 'https://brute.eternaltwin.org/TargetBrute/cell',
      bruteNameFromPage: 'TargetBrute',
      notes: [],
    }),
    false,
  );

  assert.equal(
    isSuccessfulNextBruteTransition('ExampleBrute', {
      state: 'cell_ready',
      url: 'https://brute.eternaltwin.org/ExampleBrute/cell',
      bruteNameFromPage: 'ExampleBrute',
      notes: ['cell ready markers detected'],
    }),
    false,
  );
});

test('hasStableNextBruteState accepts a rechecked state for the same new brute after settle', () => {
  assert.equal(
    hasStableNextBruteState(
      'ExampleBrute',
      {
        state: 'cell_resting',
        url: 'https://brute.eternaltwin.org/TargetBrute/cell',
        bruteNameFromPage: 'TargetBrute',
        notes: ['cell resting markers detected'],
      },
      {
        state: 'cell_ready',
        url: 'https://brute.eternaltwin.org/TargetBrute/cell',
        bruteNameFromPage: 'TargetBrute',
        notes: ['cell ready markers detected'],
      },
    ),
    true,
  );
});

test('hasStableNextBruteState rejects a misleading first state if the recheck is not stable for the new brute', () => {
  assert.equal(
    hasStableNextBruteState(
      'ExampleBrute',
      {
        state: 'cell_resting',
        url: 'https://brute.eternaltwin.org/TargetBrute/cell',
        bruteNameFromPage: 'TargetBrute',
        notes: ['cell resting markers detected'],
      },
      {
        state: 'unknown',
        url: 'https://brute.eternaltwin.org/TargetBrute/cell',
        bruteNameFromPage: 'TargetBrute',
        notes: [],
      },
    ),
    false,
  );
});

test('selectPreferredSettledNextBruteState prefers cell_ready over early cell_resting for the same new brute', () => {
  const selected = selectPreferredSettledNextBruteState(
    'ExampleBrute',
    {
      state: 'cell_resting',
      url: 'https://brute.eternaltwin.org/TargetBrute/cell',
      bruteNameFromPage: 'TargetBrute',
      notes: ['cell resting markers detected'],
    },
    {
      state: 'cell_ready',
      url: 'https://brute.eternaltwin.org/TargetBrute/cell',
      bruteNameFromPage: 'TargetBrute',
      notes: ['cell ready markers detected'],
    },
  );

  assert.equal(selected.state, 'cell_ready');
});

test('selectPreferredSettledNextBruteState preserves true resting when the new brute remains resting', () => {
  const selected = selectPreferredSettledNextBruteState(
    'ExampleBrute',
    {
      state: 'cell_resting',
      url: 'https://brute.eternaltwin.org/TargetBrute/cell',
      bruteNameFromPage: 'TargetBrute',
      notes: ['cell resting markers detected'],
    },
    {
      state: 'cell_resting',
      url: 'https://brute.eternaltwin.org/TargetBrute/cell',
      bruteNameFromPage: 'TargetBrute',
      notes: ['cell resting markers detected'],
    },
  );

  assert.equal(selected.state, 'cell_resting');
});

test('shouldDelayConfirmedBruteRestingAcceptance delays resting but not ready states', () => {
  assert.equal(
    shouldDelayConfirmedBruteRestingAcceptance({
      state: 'cell_resting',
      url: 'https://brute.eternaltwin.org/TargetBrute/cell',
      bruteNameFromPage: 'TargetBrute',
      notes: ['cell resting markers detected'],
    }),
    true,
  );

  assert.equal(
    shouldDelayConfirmedBruteRestingAcceptance({
      state: 'cell_ready',
      url: 'https://brute.eternaltwin.org/TargetBrute/cell',
      bruteNameFromPage: 'TargetBrute',
      notes: ['cell ready markers detected'],
    }),
    false,
  );
});

test('buildConfirmedBruteSettleDeadlines gives resting acceptance real extra time after standard settle', () => {
  const deadlines = buildConfirmedBruteSettleDeadlines(1_000, 2_500, 5_000);

  assert.equal(deadlines.standardSettleDeadline, 3_500);
  assert.equal(deadlines.restingAcceptanceDeadline, 8_500);
});
