import type { Page } from 'playwright';

import type { Logger } from '../reporting/logger';
import type { StateDetectionDetails } from '../types/run-types';
import { selectors } from './selectors';
import { extractBruteName } from './navigation';
import { classifyState, type StateSignals } from './state';

async function locatorCount(page: Page, selector: string): Promise<number> {
  return page.locator(selector).count();
}

export async function detectState(page: Page, logger?: Logger): Promise<StateDetectionDetails> {
  const signals: StateSignals = {
    url: page.url(),
    hasLoginForm: (await locatorCount(page, selectors.login.loginForm)) > 0,
    hasPasswordInput: (await locatorCount(page, selectors.login.passwordInput)) > 0,
    hasPublicLoginButton: (await locatorCount(page, selectors.login.loginButton)) > 0,
    hasSearchBruteInput: (await locatorCount(page, selectors.login.searchBruteInput)) > 0,
    hasPublicBruteNotFoundText: (await locatorCount(page, selectors.login.bruteNotFoundText)) > 0,
    hasUnknownBruteUrl: page.url().includes('unknown-brute'),
    hasArenaLink: (await locatorCount(page, selectors.cell.arenaLink)) > 0,
    hasArenaWelcomeText: (await locatorCount(page, selectors.arena.welcomeText)) > 0,
    hasArenaSearchInput: (await locatorCount(page, selectors.arena.searchInput)) > 0,
    hasArenaGoButton: (await locatorCount(page, selectors.arena.goButton)) > 0,
    hasOpponentLinks: (await locatorCount(page, selectors.arena.opponentLinks)) > 0,
    hasPreFightControl: (await locatorCount(page, selectors.preFight.startFightLink)) > 0,
    hasVersusText: (await locatorCount(page, selectors.preFight.versusText)) > 0,
    hasFightReturnLinks: (await locatorCount(page, selectors.fight.returnToCellLinks)) > 0,
    hasRestingText: (await locatorCount(page, selectors.cell.restingText)) > 0,
    hasLevelUpHeading: (await locatorCount(page, selectors.levelUp.levelUpHeading)) > 0,
    hasLevelUpChoiceText: (await locatorCount(page, selectors.levelUp.levelUpChoiceText)) > 0,
    bruteNameFromPage: await extractBruteName(page),
  };

  const details = classifyState(signals);
  logger?.debug(`State detected: ${details.state} at ${details.url}`);
  return details;
}
