import type { Page } from 'playwright';

import { loadLoginCredentials } from '../auth/credentials';
import type { Logger } from '../reporting/logger';
import type { RunConfig, StateDetectionDetails } from '../types/run-types';
import { detectState } from './detector';
import { clickFirstHomeBrute, clickPublicLogin, submitLoginForm } from './navigation';
import { isTransientState } from './target-resolution';

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

export async function bootstrapIntoTargetBrute(
  page: Page,
  config: RunConfig,
  logger: Logger,
): Promise<StateDetectionDetails> {
  logger.info(`Opening bootstrap entrypoint ${config.bootstrapUrl}`);
  await page.goto(config.bootstrapUrl, { waitUntil: 'domcontentloaded' });
  let state = await detectState(page, logger);

  while (true) {
    switch (state.state) {
      case 'public_home':
        logger.info('Public home detected. Opening the login form.');
        await clickPublicLogin(page);
        state = await waitForStableGameState(page, logger, config.stepTimeoutMs, 'login');
        continue;
      case 'login_form': {
        const credentials = loadLoginCredentials();
        logger.info(`Login form detected. Submitting credentials from ${credentials.source}.`);
        await submitLoginForm(page, credentials.username, credentials.password);
        state = await waitForStableGameState(page, logger, config.loginTimeoutMs, 'login');
        continue;
      }
      case 'authenticated_home':
        logger.info('Authenticated home detected. Opening the first brute from the roster.');
        await clickFirstHomeBrute(page);
        return waitForStableGameState(page, logger, config.stepTimeoutMs, 'post_login');
      case 'login_required':
      case 'unknown':
        logger.info(`Waiting for startup state to stabilize from ${state.state}.`);
        state = await waitForStableGameState(page, logger, config.stepTimeoutMs, 'login');
        continue;
      default:
        return state;
    }
  }
}
