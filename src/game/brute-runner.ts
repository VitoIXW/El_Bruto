import type { Page } from 'playwright';

import { RunCancelledError, isRunCancelled, throwIfRunCancelled } from '../core/cancellation';
import { emitBruteUpdated, emitRunEvent, emitStateChanged } from '../core/events';
import type { Logger } from '../reporting/logger';
import type { FailureArtifacts, PageState, RunConfig, RunSummary, StateDetectionDetails } from '../types/run-types';
import { captureFailureArtifacts, captureFailureArtifactsSafely } from '../reporting/artifacts';
import { formatSummary } from '../reporting/summary';
import { launchFightFromPreFight, selectOpponent } from './arena';
import { detectState } from './detector';
import { clickArena, clickReturnToCurrentCell, readLatestCellFightOutcome, waitForUrlSuffix } from './navigation';
import { canRetryFromState } from './retry';
import { bootstrapIntoTargetBrute, waitForStableGameState } from './startup';
import { extractTargetBruteName } from './target-resolution';

async function executeStateSafeAction(
  page: Page,
  config: RunConfig,
  expectedSourceState: PageState,
  action: () => Promise<void>,
  retries: number,
  logger: Logger,
  label: string,
): Promise<void> {
  let attempt = 0;
  while (attempt <= retries) {
    throwIfRunCancelled(config);
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
  try {
    const state = await bootstrapIntoTargetBrute(page, config, logger);
    return runCurrentBrute(page, config, logger, state);
  } catch (error) {
    const artifacts = await captureFailureArtifactsSafely(page, config.artifactsDir, 'bootstrap-failure', logger);
    logger.error((error as Error).stack ?? String(error));
    let finalStatus: RunSummary['finalStatus'] = 'error';

    if ((error as Error).message.includes('Stable game state timeout [phase=login]')) {
      finalStatus = 'login_timeout';
    }

    if ((error as Error).message.includes('Stable game state timeout [phase=post_login]')) {
      finalStatus = 'stabilization_timeout';
    }

    return {
      bruteName: extractTargetBruteName(config.targetUrl) ?? 'unknown',
      fightsCompleted: 0,
      wins: 0,
      losses: 0,
      finalStatus,
      restingReached: false,
      levelUpDetected: false,
      errorsOccurred: true,
      artifacts,
    };
  }
}

export async function runCurrentBrute(
  page: Page,
  config: RunConfig,
  logger: Logger,
  initialState: StateDetectionDetails,
): Promise<RunSummary> {
  let bruteName = 'unknown';
  let fightsCompleted = 0;
  let wins = 0;
  let losses = 0;
  let restingReached = false;
  let levelUpDetected = false;
  let errorsOccurred = false;
  let finalStatus: RunSummary['finalStatus'] = 'error';
  let artifacts: FailureArtifacts | undefined;

  try {
    let state: StateDetectionDetails = initialState;
    bruteName = state.bruteNameFromPage ?? bruteName;
    emitRunEvent(config, 'brute_started', { bruteName });

    while (true) {
      logger.info(`Current state: ${state.state}`);
      bruteName = state.bruteNameFromPage ?? bruteName;
      emitStateChanged(config, bruteName, state);
      throwIfRunCancelled(config);

      switch (state.state) {
        case 'cell_resting':
          restingReached = true;
          finalStatus = 'resting';
          {
            const summary = {
              bruteName,
              fightsCompleted,
              wins,
              losses,
              finalStatus,
              restingReached,
              levelUpDetected,
              errorsOccurred,
              artifacts,
            };
            emitBruteUpdated(config, summary);
            return summary;
          }
        case 'cell_ready':
          await executeStateSafeAction(page, config, 'cell_ready', async () => {
            await clickArena(page);
            await waitForUrlSuffix(page, '/arena', config.stepTimeoutMs);
          }, config.maxActionRetries, logger, 'Navigate to arena');
          break;
        case 'arena_selection':
          await executeStateSafeAction(page, config, 'arena_selection', async () => {
            await selectOpponent(page, config.stepTimeoutMs, logger);
          }, config.maxActionRetries, logger, 'Select arena opponent');
          break;
        case 'pre_fight':
          await executeStateSafeAction(page, config, 'pre_fight', async () => {
            await launchFightFromPreFight(page, config.stepTimeoutMs);
          }, config.maxActionRetries, logger, 'Start fight from pre-fight');
          break;
        case 'fight':
          if (bruteName === 'unknown') {
            throw new Error('Unable to determine brute name before returning from fight.');
          }
          await executeStateSafeAction(page, config, 'fight', async () => {
            await clickReturnToCurrentCell(page, bruteName);
            await waitForUrlSuffix(page, '/cell', config.stepTimeoutMs);
          }, config.maxActionRetries, logger, 'Return to brute cell');

          await page.waitForLoadState('domcontentloaded');
          state = await waitForStableGameState(page, logger, config.stepTimeoutMs, 'post_login', config);
          bruteName = state.bruteNameFromPage ?? bruteName;

          const fightOutcome = await readLatestCellFightOutcome(
            page,
            Math.min(config.stepTimeoutMs, 2000),
          );
          fightsCompleted += 1;

          if (fightOutcome === 'win') {
            wins += 1;
          } else if (fightOutcome === 'loss') {
            losses += 1;
          } else {
            logger.warn('Could not determine the latest fight outcome from the cell event log.');
          }

          emitRunEvent(config, 'latest_fight_result_detected', {
            bruteName,
            outcome: fightOutcome ?? 'unknown',
          });
          emitRunEvent(config, 'fight_completed', {
            bruteName,
            fightsCompleted,
            wins,
            losses,
          });
          logger.info(`Fight completed. Total fights: ${fightsCompleted}`);
          continue;
        case 'level_up':
          levelUpDetected = true;
          emitRunEvent(config, 'level_up_detected', { bruteName });
          if (
            !config.headless &&
            config.interactiveLevelUpBehavior === 'wait_for_manual_resume' &&
            config.onInteractiveLevelUpReady
          ) {
            logger.info(`Level-up detected for ${bruteName}. Waiting for manual confirmation to continue.`);
            emitRunEvent(config, 'manual_pause_started', { bruteName });
            const action = await config.onInteractiveLevelUpReady(bruteName);
            if (action === 'cancel') {
              throw new RunCancelledError(`Run cancelled during level-up confirmation for ${bruteName}.`);
            }
            emitRunEvent(config, 'manual_pause_resumed', { bruteName });
            state = await waitForStableGameState(page, logger, config.stepTimeoutMs, 'post_login', config);
            bruteName = state.bruteNameFromPage ?? bruteName;
            continue;
          }

          finalStatus = 'manual_intervention_required';
          {
            const summary = {
              bruteName,
              fightsCompleted,
              wins,
              losses,
              finalStatus,
              restingReached,
              levelUpDetected,
              errorsOccurred,
              artifacts,
            };
            emitBruteUpdated(config, summary);
            return summary;
          }
        case 'public_home':
        case 'login_form':
        case 'authenticated_home':
        case 'login_required':
        case 'unknown':
          logger.warn(`Transient state ${state.state} detected at ${page.url()}. Waiting for stabilization.`);
          state = await waitForStableGameState(page, logger, config.stepTimeoutMs, 'post_login', config);
          bruteName = state.bruteNameFromPage ?? bruteName;
          continue;
        default:
          throw new Error(`Unknown state encountered at ${page.url()}.`);
      }

      await page.waitForLoadState('domcontentloaded');
      state = await detectState(page, logger);
    }
  } catch (error) {
    if (error instanceof RunCancelledError || isRunCancelled(config)) {
      finalStatus = 'cancelled';
      const summary = {
        bruteName,
        fightsCompleted,
        wins,
        losses,
        finalStatus,
        restingReached,
        levelUpDetected,
        errorsOccurred: false,
        artifacts,
      };
      emitBruteUpdated(config, summary);
      return summary;
    }

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
      wins,
      losses,
      finalStatus,
      restingReached,
      levelUpDetected,
      errorsOccurred,
      artifacts,
    }, { color: logger.supportsColor }));

    const summary = {
      bruteName,
      fightsCompleted,
      wins,
      losses,
      finalStatus,
      restingReached,
      levelUpDetected,
      errorsOccurred,
      artifacts,
    };
    emitBruteUpdated(config, summary);
    emitRunEvent(config, 'error', {
      bruteName,
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    return summary;
  }
}
