import type {
  AggregatedRunMetrics,
  ManagedRunResult,
  RunConfig,
  RunEvent,
  RunEventType,
  RunSummary,
  StateDetectionDetails,
} from '../types/run-types';

function timestamp(): string {
  return new Date().toISOString();
}

export function emitRunEvent<TPayload>(
  config: Pick<RunConfig, 'onRunEvent'>,
  type: RunEventType,
  payload?: TPayload,
): void {
  const event: RunEvent<TPayload> = {
    type,
    timestamp: timestamp(),
    payload,
  };

  config.onRunEvent?.(event);
}

export function emitStateChanged(
  config: Pick<RunConfig, 'onRunEvent'>,
  bruteName: string,
  state: StateDetectionDetails,
): void {
  emitRunEvent(config, 'state_changed', {
    bruteName,
    state: state.state,
    url: state.url,
    notes: state.notes,
  });
}

export function emitBruteUpdated(
  config: Pick<RunConfig, 'onRunEvent'>,
  summary: RunSummary,
): void {
  emitRunEvent(config, 'brute_updated', summary);
}

export function emitRunFinished(
  config: Pick<RunConfig, 'onRunEvent'>,
  result: ManagedRunResult,
): void {
  emitRunEvent(config, 'run_finished', result);
}

export function buildAggregatedMetrics(summaries: RunSummary[]): AggregatedRunMetrics {
  return {
    totalBrutesProcessed: summaries.length,
    totalFightsCompleted: summaries.reduce((total, brute) => total + brute.fightsCompleted, 0),
    totalWins: summaries.reduce((total, brute) => total + brute.wins, 0),
    totalLosses: summaries.reduce((total, brute) => total + brute.losses, 0),
    restingCount: summaries.filter((brute) => brute.restingReached).length,
    manualInterventionCount: summaries.filter((brute) => brute.finalStatus === 'manual_intervention_required').length,
    errorCount: summaries.filter((brute) => brute.errorsOccurred).length,
    cancelledCount: summaries.filter((brute) => brute.finalStatus === 'cancelled').length,
  };
}
