import type { Page } from 'playwright';

import { loadLoginCredentials } from '../auth/credentials';
import type { Logger } from '../reporting/logger';
import type { LoginCredentials, RunConfig, StateDetectionDetails } from '../types/run-types';
import { detectState } from './detector';
import { clickFirstHomeBrute, clickPublicLogin, submitLoginForm } from './navigation';
import { extractTargetBruteName, isTargetBruteLoaded, isTransientState } from './target-resolution';

export type StableStatePhase = 'login' | 'post_login';

function isActionablePostSubmitState(state: StateDetectionDetails): boolean {
  return state.state !== 'login_form' && !isTransientState(state.state, 'login');
}

function resolveLoginCredentials(config: RunConfig): LoginCredentials {
  return config.loginCredentials ?? loadLoginCredentials();
}

async function navigateToTargetBrute(page: Page, config: RunConfig, logger: Logger) {
  logger.info(`Opening configured brute ${config.targetUrl}`);
  await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded' });
  return waitForStableGameState(page, logger, config.stepTimeoutMs, 'post_login');
}

export async function continueToConfiguredBrute(
  page: Page,
  config: RunConfig,
  logger: Logger,
): Promise<StateDetectionDetails> {
  if (!config.targetBruteName && !extractTargetBruteName(config.targetUrl)) {
    throw new Error('Direct brute continuation requires an explicit target brute.');
  }

  return navigateToTargetBrute(page, config, logger);
}

export async function waitForLoginSubmitTransition(
  page: Page,
  logger: Logger,
  timeoutMs: number,
): Promise<StateDetectionDetails> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await detectState(page, logger);
    if (isActionablePostSubmitState(state)) {
      return state;
    }
    await page.waitForTimeout(1000);
  }

  throw new Error(`Login submit transition timeout waiting for an actionable state after ${timeoutMs}ms.`);
}

export async function waitForStableGameState(
  page: Page,
  logger: Logger,
  timeoutMs: number,
  phase: StableStatePhase,
): Promise<StateDetectionDetails> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await detectState(page, logger);
    if (!isTransientState(state.state, phase)) {
      return state;
    }
    await page.waitForTimeout(1000);
  }

  throw new Error(`Stable game state timeout [phase=${phase}] reached after ${timeoutMs}ms.`);
}

export async function bootstrapToAuthenticatedHome(
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
        const credentials = resolveLoginCredentials(config);
        logger.info(`Login form detected. Submitting credentials from ${credentials.source}.`);
        await submitLoginForm(page, credentials.username, credentials.password);
        state = await waitForLoginSubmitTransition(page, logger, config.loginTimeoutMs);
        continue;
      }
      case 'authenticated_home':
        return state;
      case 'login_required':
      case 'unknown':
        logger.info(`Waiting for startup state to stabilize from ${state.state}.`);
        state = await waitForStableGameState(page, logger, config.stepTimeoutMs, 'login');
        continue;
      default:
        logger.info(`Authenticated state ${state.state} detected before home. Re-opening the account home.`);
        await page.goto(config.bootstrapUrl, { waitUntil: 'domcontentloaded' });
        state = await waitForStableGameState(page, logger, config.stepTimeoutMs, 'login');
        if (state.state !== 'authenticated_home') {
          throw new Error(`Unable to reach the authenticated home page from ${state.state}.`);
        }
        return state;
    }
  }
}

export async function bootstrapIntoTargetBrute(
  page: Page,
  config: RunConfig,
  logger: Logger,
): Promise<StateDetectionDetails> {
  const targetBruteName = config.targetBruteName ?? extractTargetBruteName(config.targetUrl);

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
        const credentials = resolveLoginCredentials(config);
        logger.info(`Login form detected. Submitting credentials from ${credentials.source}.`);
        await submitLoginForm(page, credentials.username, credentials.password);
        state = await waitForLoginSubmitTransition(page, logger, config.loginTimeoutMs);
        continue;
      }
      case 'authenticated_home':
        if (config.executionMode === 'all-brutes') {
          logger.info('Authenticated home detected. Opening the first brute from the roster.');
          await clickFirstHomeBrute(page);
          return waitForStableGameState(page, logger, config.stepTimeoutMs, 'post_login');
        }

        if (!targetBruteName) {
          throw new Error('Automatic single mode requires an explicit target brute.');
        }

        return navigateToTargetBrute(page, config, logger);
      case 'login_required':
      case 'unknown':
        logger.info(`Waiting for startup state to stabilize from ${state.state}.`);
        state = await waitForStableGameState(page, logger, config.stepTimeoutMs, 'login');
        continue;
      default:
        if (config.executionMode === 'single' && targetBruteName && !isTargetBruteLoaded(targetBruteName, state)) {
          return navigateToTargetBrute(page, config, logger);
        }
        return state;
    }
  }
}
