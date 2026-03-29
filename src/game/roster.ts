import type {
  AccountRunSummary,
  AggregatedRunMetrics,
  RunSummary,
  StateDetectionDetails,
} from '../types/run-types';

export function shouldStopRosterCycle(visitedBrutes: Set<string>, bruteName: string): boolean {
  return visitedBrutes.has(bruteName);
}

export function isSuccessfulNextBruteTransition(
  currentBruteName: string,
  state: StateDetectionDetails,
): boolean {
  return (
    state.url.endsWith('/cell') &&
    state.state !== 'login_required' &&
    state.state !== 'unknown' &&
    typeof state.bruteNameFromPage === 'string' &&
    state.bruteNameFromPage.length > 0 &&
    state.bruteNameFromPage !== currentBruteName
  );
}

export function isConfirmedDifferentBrute(
  currentBruteName: string,
  state: StateDetectionDetails,
): boolean {
  return (
    state.url.endsWith('/cell') &&
    typeof state.bruteNameFromPage === 'string' &&
    state.bruteNameFromPage.length > 0 &&
    state.bruteNameFromPage !== currentBruteName
  );
}

export function hasStableNextBruteState(
  currentBruteName: string,
  firstObservedState: StateDetectionDetails,
  recheckedState: StateDetectionDetails,
): boolean {
  return (
    isConfirmedDifferentBrute(currentBruteName, firstObservedState) &&
    isSuccessfulNextBruteTransition(currentBruteName, firstObservedState) &&
    isConfirmedDifferentBrute(currentBruteName, recheckedState) &&
    isSuccessfulNextBruteTransition(currentBruteName, recheckedState) &&
    firstObservedState.bruteNameFromPage === recheckedState.bruteNameFromPage
  );
}

export function selectPreferredSettledNextBruteState(
  currentBruteName: string,
  currentCandidate: StateDetectionDetails,
  nextObservation: StateDetectionDetails,
): StateDetectionDetails {
  if (
    !hasStableNextBruteState(currentBruteName, currentCandidate, nextObservation)
  ) {
    return currentCandidate;
  }

  if (currentCandidate.state === 'cell_resting' && nextObservation.state === 'cell_ready') {
    return nextObservation;
  }

  return nextObservation;
}

export function shouldDelayConfirmedBruteRestingAcceptance(state: StateDetectionDetails): boolean {
  return state.state === 'cell_resting';
}

export function buildConfirmedBruteSettleDeadlines(
  startTimeMs: number,
  standardSettleWindowMs: number,
  restingAcceptanceDelayMs: number,
): {
  standardSettleDeadline: number;
  restingAcceptanceDeadline: number;
} {
  const standardSettleDeadline = startTimeMs + standardSettleWindowMs;
  return {
    standardSettleDeadline,
    restingAcceptanceDeadline: standardSettleDeadline + restingAcceptanceDelayMs,
  };
}

export function summarizeAccountRun(
  startedBruteName: string,
  brutes: RunSummary[],
  cycleCompleted: boolean,
  advanceFailed = false,
  failureReason?: string,
): AccountRunSummary {
  return {
    mode: 'all-brutes',
    startedBruteName,
    cycleCompleted,
    advanceFailed,
    failureReason,
    totalBrutesProcessed: brutes.length,
    totalFightsCompleted: brutes.reduce((total, brute) => total + brute.fightsCompleted, 0),
    totalWins: brutes.reduce((total, brute) => total + brute.wins, 0),
    totalLosses: brutes.reduce((total, brute) => total + brute.losses, 0),
    restingCount: brutes.filter((brute) => brute.restingReached).length,
    manualInterventionCount: brutes.filter((brute) => brute.finalStatus === 'manual_intervention_required').length,
    errorCount: brutes.filter((brute) => brute.errorsOccurred).length,
    brutes,
  };
}

export function accountRunHasFailure(summary: AccountRunSummary): boolean {
  return summary.errorCount > 0 || summary.advanceFailed || !summary.cycleCompleted;
}

export function aggregateRunSummaries(brutes: RunSummary[]): AggregatedRunMetrics {
  return {
    totalBrutesProcessed: brutes.length,
    totalFightsCompleted: brutes.reduce((total, brute) => total + brute.fightsCompleted, 0),
    totalWins: brutes.reduce((total, brute) => total + brute.wins, 0),
    totalLosses: brutes.reduce((total, brute) => total + brute.losses, 0),
    restingCount: brutes.filter((brute) => brute.restingReached).length,
    manualInterventionCount: brutes.filter((brute) => brute.finalStatus === 'manual_intervention_required').length,
    errorCount: brutes.filter((brute) => brute.errorsOccurred).length,
    cancelledCount: brutes.filter((brute) => brute.finalStatus === 'cancelled').length,
  };
}
