import type { Locator, Page } from 'playwright';

import { selectors, buildCellHrefPattern, buildCellUrl, normalizeText } from './selectors';

export interface ArenaOpponentOption {
  name?: string;
  control: Locator;
}

const ARENA_NAME_BLACKLIST = new Set([
  'fight',
  'combate',
  'start fight',
  'comenzar el combate',
  'go!',
  'vs',
]);

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

export async function clickNextBrute(page: Page): Promise<void> {
  await page.locator(selectors.cell.nextBruteControl).first().click();
}

export function extractArenaOpponentName(text: string): string | undefined {
  const lines = text
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean);

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (ARENA_NAME_BLACKLIST.has(lowerLine)) {
      continue;
    }

    if (/\d+\s*%/.test(line) || /^vs\.?$/i.test(line)) {
      continue;
    }

    if (line.length < 2) {
      continue;
    }

    return line;
  }

  return undefined;
}

async function readArenaOpponentName(card: Locator): Promise<string | undefined> {
  const nameCandidates = card.locator(selectors.arena.opponentNameCandidates);
  const candidateCount = await nameCandidates.count();

  for (let index = 0; index < candidateCount; index += 1) {
    const candidate = nameCandidates.nth(index);
    const text = extractArenaOpponentName(await candidate.innerText().catch(() => ''));
    if (text) {
      return text;
    }

    const title = normalizeText(await candidate.getAttribute('title').catch(() => ''));
    if (title && !ARENA_NAME_BLACKLIST.has(title.toLowerCase())) {
      return title;
    }
  }

  return extractArenaOpponentName(await card.innerText().catch(() => ''));
}

export async function readVisibleArenaOpponents(page: Page): Promise<ArenaOpponentOption[]> {
  const opponentCards = page.locator(selectors.arena.opponentCards);
  const cardCount = await opponentCards.count();
  const cardOptions: ArenaOpponentOption[] = [];

  for (let index = 0; index < cardCount; index += 1) {
    const card = opponentCards.nth(index);
    if (!(await hasVisible(card))) {
      continue;
    }

    cardOptions.push({
      name: await readArenaOpponentName(card),
      control: card,
    });
  }

  if (cardOptions.length > 0) {
    return cardOptions;
  }

  const explicitFightControls = page.locator(selectors.arena.opponentLinks);
  const explicitCount = await explicitFightControls.count();
  const explicitOptions: ArenaOpponentOption[] = [];

  for (let index = 0; index < explicitCount; index += 1) {
    const control = explicitFightControls.nth(index);
    if (!(await hasVisible(control))) {
      continue;
    }

    explicitOptions.push({
      name: extractArenaOpponentName(await control.innerText().catch(() => '')),
      control,
    });
  }

  return explicitOptions;
}

export async function chooseNamedOpponent(page: Page, opponentName: string): Promise<boolean> {
  const opponents = await readVisibleArenaOpponents(page);
  const normalizedTarget = normalizeText(opponentName).toLowerCase();
  const match = opponents.find((opponent) => opponent.name?.toLowerCase() === normalizedTarget);
  if (!match) {
    return false;
  }

  await match.control.click();
  return true;
}

export async function chooseFirstOpponent(page: Page): Promise<void> {
  const opponents = await readVisibleArenaOpponents(page);
  if (opponents.length > 0) {
    await opponents[0].control.click();
    return;
  }

  throw new Error('No arena opponent controls or rival cards were found.');
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
