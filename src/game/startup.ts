import type { Page } from 'playwright';

import type { Logger } from '../reporting/logger';
import type { RunConfig, StateDetectionDetails } from '../types/run-types';
import { detectState } from './detector';
import { extractTargetBruteName, isTargetBruteLoaded, isTransientState } from './target-resolution';

export type StableStatePhase = 'login' | 'post_login';

export async function waitForStableGameState(
  page: Page,
  logger: Logger,
  timeoutMs: number,
  phase: StableStatePhase,
): Promise<StateDetectionDetails> {
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

export async function resolveTargetBruteAfterLogin(
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

export async function bootstrapIntoTargetBrute(
  page: Page,
  config: RunConfig,
  logger: Logger,
): Promise<StateDetectionDetails> {
  logger.info(`Opening bootstrap entrypoint ${config.bootstrapUrl}`);
  await page.goto(config.bootstrapUrl, { waitUntil: 'domcontentloaded' });
  let state = await detectState(page, logger);

  if (state.state === 'login_required') {
    logger.info(`Login required. Complete login in the browser window within ${config.loginTimeoutMs}ms.`);
    state = await waitForStableGameState(page, logger, config.loginTimeoutMs, 'login');
  }

  return resolveTargetBruteAfterLogin(page, config, logger, state);
}
