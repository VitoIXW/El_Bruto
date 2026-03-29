import type { Page } from 'playwright';

import type { Logger } from '../reporting/logger';
import type {
  ManagedRunResult,
  RunConfig,
  RunSelection,
  RunSummary,
  StateDetectionDetails,
} from '../types/run-types';
import { emitRunEvent, emitRunFinished } from './events';
import { runAllBrutes } from '../game/account-runner';
import { runCurrentBrute } from '../game/brute-runner';
import { listHallRosterBrutes } from '../game/navigation';
import { aggregateRunSummaries, accountRunHasFailure } from '../game/roster';
import { bootstrapToAuthenticatedHome, continueToConfiguredBrute } from '../game/startup';

function buildBruteRunConfig(baseConfig: RunConfig, bruteName: string): RunConfig {
  return {
    ...baseConfig,
    executionMode: 'single',
    targetBruteName: bruteName,
    targetUrl: `${baseConfig.bootstrapUrl.replace(/\/$/, '')}/${encodeURIComponent(bruteName)}/cell`,
  };
}

function buildAllBrutesRunConfig(baseConfig: RunConfig, bruteName: string): RunConfig {
  return {
    ...buildBruteRunConfig(baseConfig, bruteName),
    executionMode: 'all-brutes',
  };
}

export async function authenticateAndDiscoverBrutes(
  page: Page,
  config: RunConfig,
  logger: Logger,
): Promise<{ state: StateDetectionDetails; bruteNames: string[] }> {
  const state = await bootstrapToAuthenticatedHome(page, {
    ...config,
    targetUrl: config.bootstrapUrl,
    targetBruteName: undefined,
  }, logger);

  logger.info('Authenticated home detected. Opening /hall to discover account brutes.');
  const bruteNames = await listHallRosterBrutes(page, config.bootstrapUrl, logger);
  emitRunEvent(config, 'brutes_loaded', { bruteNames });
  return { state, bruteNames };
}

export async function executeRunSelection(
  page: Page,
  baseConfig: RunConfig,
  logger: Logger,
  selection: RunSelection,
): Promise<ManagedRunResult> {
  emitRunEvent(baseConfig, 'run_started', {
    selection,
    accountLabel: baseConfig.accountLabel,
  });

  if (selection.mode === 'all-brutes') {
    const firstBruteName = selection.bruteNames[0];
    const runConfig = buildAllBrutesRunConfig(baseConfig, firstBruteName);
    logger.info(`Continuing all-brutes cycle directly from ${runConfig.targetUrl}.`);
    const state = await continueToConfiguredBrute(page, runConfig, logger);
    const accountSummary = await runAllBrutes(page, runConfig, logger, state, selection.bruteNames);
    const result: ManagedRunResult = {
      selection,
      summaries: accountSummary.brutes,
      accountSummary,
      metrics: aggregateRunSummaries(accountSummary.brutes),
      cycleCompleted: accountSummary.cycleCompleted,
      advanceFailed: accountSummary.advanceFailed,
      failureReason: accountSummary.failureReason,
    };
    emitRunFinished(baseConfig, result);
    return result;
  }

  const summaries: RunSummary[] = [];
  for (const bruteName of selection.bruteNames) {
    const bruteConfig = buildBruteRunConfig(baseConfig, bruteName);
    logger.info(`Continuing selection directly to ${bruteConfig.targetUrl}.`);
    const state = await continueToConfiguredBrute(page, bruteConfig, logger);
    const summary = await runCurrentBrute(page, bruteConfig, logger, state);
    summaries.push(summary);
    if (summary.finalStatus === 'cancelled') {
      break;
    }
  }

  const result: ManagedRunResult = {
    selection,
    summaries,
    metrics: aggregateRunSummaries(summaries),
  };
  emitRunFinished(baseConfig, result);
  return result;
}

export function managedRunHasFailure(result: ManagedRunResult): boolean {
  if (result.accountSummary) {
    return accountRunHasFailure(result.accountSummary);
  }

  return result.summaries.some((summary) => summary.errorsOccurred);
}
