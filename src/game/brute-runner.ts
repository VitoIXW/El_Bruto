import type { Page } from 'playwright';

import type { Logger } from '../reporting/logger';
import type { FailureArtifacts, PageState, RunConfig, RunSummary, StateDetectionDetails } from '../types/run-types';
import { captureFailureArtifacts } from '../reporting/artifacts';
import { formatSummary } from '../reporting/summary';
import { launchFightFromPreFight, selectOpponent } from './arena';
import { detectState } from './detector';
import { clickArena, clickReturnToCurrentCell, waitForUrlSuffix } from './navigation';
import { canRetryFromState } from './retry';
import { extractTargetBruteName, isTargetBruteLoaded, isTransientState } from './target-resolution';

type StableStatePhase = 'login' | 'post_login';

async function waitForStableGameState(
  page: Page,
  logger: Logger,
  timeoutMs: number,
  phase: StableStatePhase,
): Promise<Awaited<ReturnType<typeof detectState>>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await detectState(page, logger);
    if (!isTransientState(state.state)) {
      return state;
    }
    await page.waitForTimeout(1000);
  }

  throw new Error(`Stable game state timeout [phase=${phase}] reached after ${timeoutMs}ms.`);
}

async function resolveTargetBruteAfterLogin(
  page: Page,
  config: RunConfig,
  logger: Logger,
  initialState: StateDetectionDetails,
): Promise<StateDetectionDetails> {
  const targetBruteName = extractTargetBruteName(config.targetUrl);
  let state = initialState;

  if (isTransientState(state.state)) {
    state = await waitForStableGameState(page, logger, config.stepTimeoutMs, 'post_login');
  }

  if (isTargetBruteLoaded(targetBruteName, state)) {
    logger.info(`Target brute ${targetBruteName} is already loaded. Skipping redundant navigation.`);
    return state;
  }

  logger.info(`Navigating to target brute ${config.targetUrl}`);
  await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded' });
  return waitForStableGameState(page, logger, config.stepTimeoutMs, 'post_login');
}

async function executeStateSafeAction(
  page: Page,
  expectedSourceState: PageState,
  action: () => Promise<void>,
  retries: number,
  logger: Logger,
  label: string,
): Promise<void> {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      await action();
      return;
    } catch (error) {
      const currentState = await detectState(page, logger);
      if (!canRetryFromState(expectedSourceState, currentState.state)) {
        logger.warn(
          `${label} changed state from ${expectedSourceState} to ${currentState.state} after a failure. ` +
            'Not retrying the action.',
        );
        return;
      }

      attempt += 1;
      if (attempt > retries) {
        throw error;
      }
      logger.warn(`${label} failed on attempt ${attempt}. Retrying.`);
    }
  }
}

export async function runBrute(page: Page, config: RunConfig, logger: Logger): Promise<RunSummary> {
  let bruteName = 'unknown';
  let fightsCompleted = 0;
  let restingReached = false;
  let levelUpDetected = false;
  let errorsOccurred = false;
  let finalStatus: RunSummary['finalStatus'] = 'error';
  let artifacts: FailureArtifacts | undefined;

  try {
    logger.info(`Opening bootstrap entrypoint ${config.bootstrapUrl}`);
    await page.goto(config.bootstrapUrl, { waitUntil: 'domcontentloaded' });
    let state: StateDetectionDetails = await detectState(page, logger);

    if (state.state === 'login_required') {
      logger.info(`Login required. Complete login in the browser window within ${config.loginTimeoutMs}ms.`);
      state = await waitForStableGameState(page, logger, config.loginTimeoutMs, 'login');
    }

    state = await resolveTargetBruteAfterLogin(page, config, logger, state);
    bruteName = state.bruteNameFromPage ?? bruteName;

    while (true) {
      logger.info(`Current state: ${state.state}`);
      bruteName = state.bruteNameFromPage ?? bruteName;

      switch (state.state) {
        case 'cell_resting':
          restingReached = true;
          finalStatus = 'resting';
          return {
            bruteName,
            fightsCompleted,
            finalStatus,
            restingReached,
            levelUpDetected,
            errorsOccurred,
            artifacts,
          };
        case 'cell_ready':
          await executeStateSafeAction(page, 'cell_ready', async () => {
            await clickArena(page);
            await waitForUrlSuffix(page, '/arena', config.stepTimeoutMs);
          }, config.maxActionRetries, logger, 'Navigate to arena');
          break;
        case 'arena_selection':
          await executeStateSafeAction(page, 'arena_selection', async () => {
            await selectOpponent(page, config.stepTimeoutMs);
          }, config.maxActionRetries, logger, 'Select arena opponent');
          break;
        case 'pre_fight':
          await executeStateSafeAction(page, 'pre_fight', async () => {
            await launchFightFromPreFight(page, config.stepTimeoutMs);
          }, config.maxActionRetries, logger, 'Start fight from pre-fight');
          break;
        case 'fight':
          if (bruteName === 'unknown') {
            throw new Error('Unable to determine brute name before returning from fight.');
          }
          await executeStateSafeAction(page, 'fight', async () => {
            await clickReturnToCurrentCell(page, bruteName);
            await waitForUrlSuffix(page, '/cell', config.stepTimeoutMs);
          }, config.maxActionRetries, logger, 'Return to brute cell');
          fightsCompleted += 1;
          logger.info(`Fight completed. Total fights: ${fightsCompleted}`);
          break;
        case 'level_up':
          levelUpDetected = true;
          finalStatus = 'manual_intervention_required';
          return {
            bruteName,
            fightsCompleted,
            finalStatus,
            restingReached,
            levelUpDetected,
            errorsOccurred,
            artifacts,
          };
        case 'login_required':
        case 'unknown':
          logger.warn(`Transient state ${state.state} detected at ${page.url()}. Waiting for stabilization.`);
          state = await waitForStableGameState(page, logger, config.stepTimeoutMs, 'post_login');
          bruteName = state.bruteNameFromPage ?? bruteName;
          continue;
        default:
          throw new Error(`Unknown state encountered at ${page.url()}.`);
      }

      await page.waitForLoadState('domcontentloaded');
      state = await detectState(page, logger);
    }
  } catch (error) {
    errorsOccurred = true;

    if ((error as Error).message.includes('Stable game state timeout [phase=login]')) {
      finalStatus = 'login_timeout';
    }

    if ((error as Error).message.includes('Stable game state timeout [phase=post_login]')) {
      finalStatus = 'stabilization_timeout';
    }

    artifacts = await captureFailureArtifacts(page, config.artifactsDir, 'unexpected-error');
    logger.error((error as Error).stack ?? String(error));
    logger.error(formatSummary({
      bruteName,
      fightsCompleted,
      finalStatus,
      restingReached,
      levelUpDetected,
      errorsOccurred,
      artifacts,
    }));

    return {
      bruteName,
      fightsCompleted,
      finalStatus,
      restingReached,
      levelUpDetected,
      errorsOccurred,
      artifacts,
    };
  }
}
