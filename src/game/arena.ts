import type { Page } from 'playwright';

import { analyzePublicOpponentWinRates, chooseLowestWinRateOpponent } from './opponent-analysis';
import type { Logger } from '../reporting/logger';
import { selectors } from './selectors';
import { chooseFirstOpponent, chooseNamedOpponent, readVisibleArenaOpponents, startFight } from './navigation';

export interface ArenaReadinessSignals {
  hasWelcomeText: boolean;
  hasSearchInput: boolean;
  hasGoButton: boolean;
  opponentControlCount: number;
  opponentCardCount: number;
}

export function describeArenaReadiness(signals: ArenaReadinessSignals): {
  isArenaShell: boolean;
  isReady: boolean;
  reason: string;
} {
  const isArenaShell = signals.hasWelcomeText || signals.hasSearchInput || signals.hasGoButton;
  if (signals.opponentControlCount > 0 || signals.opponentCardCount > 0) {
    const availableTargets = signals.opponentControlCount + signals.opponentCardCount;
    return {
      isArenaShell,
      isReady: true,
      reason: `Arena ready with ${availableTargets} selectable rival target(s).`,
    };
  }

  if (isArenaShell) {
    return {
      isArenaShell,
      isReady: false,
      reason: 'Arena shell detected, but no selectable opponents are available yet.',
    };
  }

  return {
    isArenaShell,
    isReady: false,
    reason: 'Arena shell markers are missing on the /arena page.',
  };
}

async function readArenaReadinessSignals(page: Page): Promise<ArenaReadinessSignals> {
  return {
    hasWelcomeText: (await page.locator(selectors.arena.welcomeText).count()) > 0,
    hasSearchInput: (await page.locator(selectors.arena.searchInput).count()) > 0,
    hasGoButton: (await page.locator(selectors.arena.goButton).count()) > 0,
    opponentControlCount: await page.locator(selectors.arena.opponentLinks).count(),
    opponentCardCount: await page.locator(selectors.arena.opponentCards).count(),
  };
}

export async function waitForArenaReady(page: Page, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastReason = 'Arena readiness has not been evaluated yet.';

  while (Date.now() < deadline) {
    const readiness = describeArenaReadiness(await readArenaReadinessSignals(page));
    lastReason = readiness.reason;

    if (readiness.isReady) {
      return;
    }

    await page.waitForTimeout(500);
  }

  throw new Error(`Arena did not become ready before timeout. ${lastReason}`);
}

function logOpponentAnalyses(logger: Logger, analyses: Awaited<ReturnType<typeof analyzePublicOpponentWinRates>>): void {
  for (const analysis of analyses) {
    if (typeof analysis.winRatePercentage === 'number') {
      logger.info(
        `Arena rival public win-rate: ${analysis.name} -> ${analysis.winRatePercentage}% (${analysis.cellUrl})`,
      );
      continue;
    }

    logger.warn(
      `Arena rival analysis failed for ${analysis.name}: ${analysis.error ?? 'Unknown analysis error.'} (${analysis.cellUrl})`,
    );
  }
}

export async function selectOpponent(page: Page, timeoutMs: number, logger: Logger): Promise<void> {
  await waitForArenaReady(page, timeoutMs);
  const visibleOpponents = await readVisibleArenaOpponents(page);
  const namedOpponents = visibleOpponents
    .map((opponent) => opponent.name)
    .filter((name): name is string => Boolean(name));
  const unnamedOpponentCount = visibleOpponents.length - namedOpponents.length;

  if (namedOpponents.length > 0) {
    logger.info(`Visible arena rivals: ${namedOpponents.join(', ')}`);
  } else {
    logger.warn('Visible arena rivals did not expose any names.');
  }

  if (unnamedOpponentCount > 0) {
    logger.warn(`Arena rival cards without parsed names: ${unnamedOpponentCount}.`);
  }

  if (namedOpponents.length > 0) {
    const analyses = await analyzePublicOpponentWinRates(new URL(page.url()).origin, namedOpponents);
    logOpponentAnalyses(logger, analyses);
    const preferredOpponent = chooseLowestWinRateOpponent(analyses);

    if (preferredOpponent) {
      logger.info(
        `Preferred arena rival by public win rate: ${preferredOpponent.name} (${preferredOpponent.winRatePercentage}%).`,
      );

      if (await chooseNamedOpponent(page, preferredOpponent.name)) {
        await page.waitForURL((url) => !url.pathname.endsWith('/arena'), { timeout: timeoutMs });
        return;
      }

      logger.warn(`Falling back to the first visible arena rival because ${preferredOpponent.name} could not be clicked by name.`);
    } else {
      logger.warn('Falling back to the first visible arena rival because no public win-rate analysis succeeded.');
    }
  } else {
    logger.warn('Falling back to the first visible arena rival because no visible rival names were available for analysis.');
  }

  await chooseFirstOpponent(page);
  await page.waitForURL((url) => !url.pathname.endsWith('/arena'), { timeout: timeoutMs });
}

export async function launchFightFromPreFight(page: Page, timeoutMs: number): Promise<void> {
  await startFight(page);
  await page.waitForURL((url) => !url.pathname.includes('/versus/'), { timeout: timeoutMs });
  await page.waitForLoadState('domcontentloaded');
}

export async function runArenaSequence(page: Page, timeoutMs: number, logger: Logger): Promise<void> {
  await selectOpponent(page, timeoutMs, logger);
  await launchFightFromPreFight(page, timeoutMs);
}
