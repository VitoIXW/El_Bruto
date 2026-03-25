import type { Locator, Page } from 'playwright';

import { selectors, buildCellHrefPattern, buildCellUrl, normalizeText } from './selectors';

interface HomeBruteEntryCandidate {
  index: number;
  x: number;
  y: number;
}

export function pickTopLeftHomeBruteEntry(
  candidates: HomeBruteEntryCandidate[],
): HomeBruteEntryCandidate | undefined {
  return [...candidates].sort((left, right) => {
    if (left.y !== right.y) {
      return left.y - right.y;
    }

    return left.x - right.x;
  })[0];
}

export function extractBruteNameFromUrl(url: string): string | undefined {
  const match = url.match(/brute\.eternaltwin\.org\/([^/]+)\/(cell|arena|fight|versus)/i);
  return match?.[1];
}

export async function extractBruteName(page: Page): Promise<string | undefined> {
  const bruteNameFromUrl = extractBruteNameFromUrl(page.url());
  if (page.url().endsWith('/cell') && bruteNameFromUrl) {
    return bruteNameFromUrl;
  }

  const heading = page.locator(selectors.cell.bruteNameHeading).first();
  if (await heading.count()) {
    const text = normalizeText(await heading.textContent());
    if (text) {
      return text.replace(/^Cell of\s+/i, '').trim();
    }
  }

  return bruteNameFromUrl;
}

export async function clickArena(page: Page): Promise<void> {
  await page.locator(selectors.cell.arenaLink).first().click();
}

export async function clickPublicLogin(page: Page): Promise<void> {
  await page.locator(selectors.login.loginButton).first().click();
}

export async function submitLoginForm(page: Page, username: string, password: string): Promise<void> {
  const form = page.locator(selectors.login.loginForm).first();
  await form.locator(selectors.login.usernameInput).first().fill(username);
  await form.locator(selectors.login.passwordInput).first().fill(password);
  await form.locator(selectors.login.submitButton).first().click();
}

export async function clickFirstHomeBrute(page: Page): Promise<void> {
  const bruteLinks = page.locator(selectors.home.rosterBruteEntries);
  const count = await bruteLinks.count();

  if (count === 0) {
    throw new Error('No brute roster links were found on the authenticated home page.');
  }

  const candidates: HomeBruteEntryCandidate[] = [];

  for (let index = 0; index < count; index += 1) {
    const link = bruteLinks.nth(index);
    const box = await link.boundingBox();
    if (!box) {
      continue;
    }

    candidates.push({
      index,
      x: box.x,
      y: box.y,
    });
  }

  const selectedCandidate = pickTopLeftHomeBruteEntry(candidates);
  if (!selectedCandidate) {
    throw new Error('No visible brute roster links were found on the authenticated home page.');
  }

  await bruteLinks.nth(selectedCandidate.index).click();
}

export async function clickNextBrute(page: Page): Promise<void> {
  await page.locator(selectors.cell.nextBruteControl).first().click();
}

export async function chooseFirstOpponent(page: Page): Promise<void> {
  const explicitFightControls = page.locator(selectors.arena.opponentLinks);
  const explicitCount = await explicitFightControls.count();
  if (explicitCount > 0) {
    await explicitFightControls.first().click();
    return;
  }

  const opponentCards = page.locator(selectors.arena.opponentCards);
  const cardCount = await opponentCards.count();
  if (cardCount === 0) {
    throw new Error('No arena opponent controls or rival cards were found.');
  }

  await opponentCards.first().click();
}

export async function startFight(page: Page): Promise<void> {
  const startControl = page.locator(selectors.preFight.startFightLink).first();
  await startControl.click();
}

export async function clickReturnToCurrentCell(page: Page, bruteName: string): Promise<void> {
  const hrefPattern = buildCellHrefPattern(bruteName);
  const links = page.locator(selectors.fight.returnToCellLinks);
  const count = await links.count();

  for (let index = 0; index < count; index += 1) {
    const link = links.nth(index);
    const href = await link.getAttribute('href');
    if (href?.includes(hrefPattern)) {
      await link.click();
      return;
    }
  }

  throw new Error(`Unable to find return link for brute ${bruteName}.`);
}

export async function waitForUrlSuffix(page: Page, suffix: string, timeoutMs: number): Promise<void> {
  await page.waitForURL((url) => url.pathname.endsWith(suffix), { timeout: timeoutMs });
}

export async function waitForDifferentBruteCell(
  page: Page,
  currentBruteName: string,
  timeoutMs: number,
): Promise<void> {
  const currentPattern = buildCellHrefPattern(currentBruteName);
  await page.waitForURL((url) => {
    const pathname = url.pathname;
    return pathname.endsWith('/cell') && !pathname.includes(currentPattern);
  }, { timeout: timeoutMs });
}

export function buildBruteCellUrl(baseUrl: string, bruteName: string): string {
  return buildCellUrl(new URL(baseUrl).origin, bruteName);
}

export async function hasVisible(locator: Locator): Promise<boolean> {
  try {
    return await locator.first().isVisible();
  } catch {
    return false;
  }
}
