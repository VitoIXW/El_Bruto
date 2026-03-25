import type { Page } from 'playwright';

import type { Logger } from '../reporting/logger';
import type { AccountRunSummary, RunConfig, RunSummary } from '../types/run-types';
import { captureFailureArtifactsSafely } from '../reporting/artifacts';
import { formatSummary } from '../reporting/summary';
import { runCurrentBrute } from './brute-runner';
import { detectState } from './detector';
import { buildBruteCellUrl, clickNextBrute } from './navigation';
import {
  buildConfirmedBruteSettleDeadlines,
  isConfirmedDifferentBrute,
  isSuccessfulNextBruteTransition,
  shouldDelayConfirmedBruteRestingAcceptance,
  selectPreferredSettledNextBruteState,
  shouldStopRosterCycle,
  summarizeAccountRun,
} from './roster';
import { bootstrapIntoTargetBrute, waitForStableGameState } from './startup';
import { extractTargetBruteName } from './target-resolution';

const NEXT_BRUTE_SETTLE_DELAY_MS = 750;
const NEXT_BRUTE_SETTLE_WINDOW_MS = 2500;
const NEXT_BRUTE_RESTING_ACCEPTANCE_DELAY_MS = 5000;

async function moveToCurrentBruteCell(page: Page, config: RunConfig, logger: Logger, bruteName: string) {
  const cellUrl = buildBruteCellUrl(config.targetUrl, bruteName);
  logger.info(`Recovering brute cell before moving on: ${cellUrl}`);
  await page.goto(cellUrl, { waitUntil: 'domcontentloaded' });
  return waitForStableGameState(page, logger, config.stepTimeoutMs, 'post_login');
}

async function waitForDifferentBruteIdentity(
  page: Page,
  logger: Logger,
  currentBruteName: string,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const observedState = await detectState(page, logger);
    if (isConfirmedDifferentBrute(currentBruteName, observedState)) {
      return observedState;
    }
    await page.waitForTimeout(500);
  }

  throw new Error(`Timed out waiting for brute identity change after ${currentBruteName}.`);
}

async function settleConfirmedBruteState(
  page: Page,
  logger: Logger,
  currentBruteName: string,
  firstObservedState: Awaited<ReturnType<typeof detectState>>,
  timeoutMs: number,
) {
  let settledState = firstObservedState;
  const { standardSettleDeadline, restingAcceptanceDeadline } = buildConfirmedBruteSettleDeadlines(
    Date.now(),
    timeoutMs,
    NEXT_BRUTE_RESTING_ACCEPTANCE_DELAY_MS,
  );

  while (Date.now() < standardSettleDeadline) {
    await page.waitForTimeout(NEXT_BRUTE_SETTLE_DELAY_MS);
    const recheckedState = await detectState(page, logger);
    settledState = selectPreferredSettledNextBruteState(
      currentBruteName,
      settledState,
      recheckedState,
    );

    if (settledState.state === 'cell_ready') {
      return settledState;
    }
  }

  while (
    shouldDelayConfirmedBruteRestingAcceptance(settledState) &&
    Date.now() < restingAcceptanceDeadline
  ) {
    await page.waitForTimeout(NEXT_BRUTE_SETTLE_DELAY_MS);
    const recheckedState = await detectState(page, logger);
    settledState = selectPreferredSettledNextBruteState(
      currentBruteName,
      settledState,
      recheckedState,
    );

    if (settledState.state === 'cell_ready') {
      return settledState;
    }
  }

  return settledState;
}

async function moveToNextBrute(
  page: Page,
  config: RunConfig,
  logger: Logger,
  currentBruteName: string,
) {
  let state = await detectState(page, logger);
  const currentCellUrl = buildBruteCellUrl(config.targetUrl, currentBruteName);

  if (page.url() !== currentCellUrl) {
    state = await moveToCurrentBruteCell(page, config, logger, currentBruteName);
  }

  if (state.bruteNameFromPage !== currentBruteName) {
    throw new Error(`Unable to stabilize on brute ${currentBruteName} before moving to the next brute.`);
  }

  logger.info(`Advancing from brute ${currentBruteName} to the next brute in the roster.`);
  await clickNextBrute(page);
  const firstObservedState = await waitForDifferentBruteIdentity(page, logger, currentBruteName, config.stepTimeoutMs);

  return settleConfirmedBruteState(
    page,
    logger,
    currentBruteName,
    firstObservedState,
    Math.min(config.stepTimeoutMs, NEXT_BRUTE_SETTLE_WINDOW_MS),
  );
}

function normalizeBruteSummary(summary: RunSummary, fallbackBruteName: string): RunSummary {
  if (summary.bruteName !== 'unknown') {
    return summary;
  }

  return {
    ...summary,
    bruteName: fallbackBruteName,
  };
}

export async function runAllBrutes(page: Page, config: RunConfig, logger: Logger): Promise<AccountRunSummary> {
  let state;
  const startedBruteName = extractTargetBruteName(config.targetUrl) ?? 'unknown';

  try {
    state = await bootstrapIntoTargetBrute(page, config, logger);
  } catch (error) {
    const artifacts = await captureFailureArtifactsSafely(page, config.artifactsDir, 'bootstrap-failure', logger);
    logger.error((error as Error).stack ?? String(error));

    const artifactDetails = [
      artifacts?.screenshotPath ? `Screenshot: ${artifacts.screenshotPath}` : undefined,
      artifacts?.htmlPath ? `HTML snapshot: ${artifacts.htmlPath}` : undefined,
    ]
      .filter((detail): detail is string => Boolean(detail))
      .join(' | ');
    const failureReason = [
      `Bootstrap failed before roster processing: ${String(error)}`,
      artifactDetails,
    ]
      .filter(Boolean)
      .join(' | ');

    return summarizeAccountRun(startedBruteName, [], false, true, failureReason);
  }

  const bootstrapBruteName = state.bruteNameFromPage ?? startedBruteName;
  const visitedBrutes = new Set<string>();
  const bruteResults: RunSummary[] = [];
  let cycleCompleted = false;
  let advanceFailed = false;
  let failureReason: string | undefined;

  while (true) {
    const currentBruteName = state.bruteNameFromPage ?? bootstrapBruteName;
    if (shouldStopRosterCycle(visitedBrutes, currentBruteName)) {
      cycleCompleted = true;
      break;
    }

    logger.info(`Processing brute ${currentBruteName} in all-brutes mode.`);
    const bruteSummary = normalizeBruteSummary(
      await runCurrentBrute(page, config, logger, state),
      currentBruteName,
    );

    bruteResults.push(bruteSummary);
    visitedBrutes.add(bruteSummary.bruteName);
    logger.info(formatSummary(bruteSummary));

    try {
      state = await moveToNextBrute(page, config, logger, bruteSummary.bruteName);
    } catch (error) {
      advanceFailed = true;
      failureReason = `Unable to advance to the next brute after ${bruteSummary.bruteName}: ${String(error)}`;
      logger.error(failureReason);
      break;
    }
  }

  return summarizeAccountRun(bootstrapBruteName, bruteResults, cycleCompleted, advanceFailed, failureReason);
}
