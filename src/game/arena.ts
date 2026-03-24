import type { Page } from 'playwright';

import { selectors } from './selectors';
import { chooseFirstOpponent, startFight } from './navigation';

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

export async function selectOpponent(page: Page, timeoutMs: number): Promise<void> {
  await waitForArenaReady(page, timeoutMs);
  await chooseFirstOpponent(page);
  await page.waitForURL((url) => !url.pathname.endsWith('/arena'), { timeout: timeoutMs });
}

export async function launchFightFromPreFight(page: Page, timeoutMs: number): Promise<void> {
  await startFight(page);
  await page.waitForURL((url) => !url.pathname.includes('/versus/'), { timeout: timeoutMs });
  await page.waitForLoadState('domcontentloaded');
}

export async function runArenaSequence(page: Page, timeoutMs: number): Promise<void> {
  await selectOpponent(page, timeoutMs);
  await launchFightFromPreFight(page, timeoutMs);
}
