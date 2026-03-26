import type { Locator, Page } from 'playwright';

import type { Logger } from '../reporting/logger';
import { selectors, buildCellHrefPattern, buildCellUrl, normalizeText } from './selectors';

interface HomeBruteEntryCandidate {
  index: number;
  x: number;
  y: number;
  name?: string;
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
const LOGIN_SUBMIT_READY_TIMEOUT_MS = 3000;
const LOGIN_SUBMIT_READY_POLL_MS = 100;
const HALL_ROSTER_READY_TIMEOUT_MS = 5000;
const HALL_ROSTER_RETRY_POLL_MS = 250;
const HALL_ENTRY_BLACKLIST = new Set([
  'hall',
  'ranking',
  'rankings',
  'brutes',
  'view',
  'open',
  'details',
  'see more',
  'tournaments',
  'tournament',
  'history',
  'event history',
  'historial de eventos',
  'sacrifice',
  'sacrificar',
  'reset',
  'reiniciar',
]);
const HALL_NAME_MIN_LENGTH = 3;
const HALL_REJECTION_SAMPLE_LIMIT = 3;
const HALL_REPEATED_ENTRY_THRESHOLD = 2;

interface HallCandidateInspection {
  accepted: boolean;
  bruteName?: string;
  summary: string;
  hasStructuralEvidence: boolean;
  reason: string;
}

interface HallContainerInspection {
  index: number;
  strategy: 'direct' | 'descendant';
  entryCount: number;
  repeatedEntryCount: number;
  acceptedEntryCount: number;
  extractedNameCount: number;
  rejectedSummaries: string[];
  rosterEntries: Locator;
}

interface NormalizedHallEntries {
  count: number;
  nth(index: number): Locator;
}

interface HallContainerScan {
  containerCount: number;
  inspections: HallContainerInspection[];
  selected?: HallContainerInspection;
}

export type FightOutcome = 'win' | 'loss';

function logHallDiscovery(logger: Logger | undefined, message: string): void {
  logger?.info(`[hall] ${message}`);
}

function isLikelyHallDescription(line: string): boolean {
  const lowerLine = line.toLowerCase();
  return (
    /^(level|nivel)\b/i.test(line)
    || /\b(brute|fighter|bonus|bonuses|pet|pets|weapon|weapons|skill|skills)\b/i.test(line)
    || /\b(hp|xp|str|agi|speed|rank)\b/i.test(line)
    || /^\d+$/.test(line)
    || /^\d+\s*\/\s*\d+$/.test(line)
    || /^\d+\s*-\s*\d+$/.test(line)
    || lowerLine.includes(':')
    || /\b(history|historial|tournament|torneo|sacrifice|sacrificar|reset|reiniciar)\b/i.test(line)
  );
}

function isLikelyHallBruteName(line: string): boolean {
  if (line.length < HALL_NAME_MIN_LENGTH) {
    return false;
  }

  if (HALL_ENTRY_BLACKLIST.has(line.toLowerCase())) {
    return false;
  }

  if (/^\d+(?:[.,]\d+)?\s*%$/.test(line)) {
    return false;
  }

  if (isLikelyHallDescription(line)) {
    return false;
  }

  return true;
}

function dedupeBruteNames(bruteNames: Array<string | undefined>): string[] {
  return Array.from(new Set(bruteNames.map((name) => normalizeText(name)).filter(Boolean)));
}

export function extractLatestCellFightOutcomeFromImageSources(
  imageSources: Array<string | null | undefined>,
): FightOutcome | undefined {
  for (const source of imageSources) {
    if (typeof source !== 'string') {
      continue;
    }

    if (source.includes('/images/log/win.webp')) {
      return 'win';
    }

    if (source.includes('/images/log/lose.webp')) {
      return 'loss';
    }
  }

  return undefined;
}

export function extractHomeBruteNameFromHref(href: string | null | undefined): string | undefined {
  const match = href?.match(/\/([^/]+)\/cell(?:[/?#]|$)/i);
  if (!match?.[1]) {
    return undefined;
  }

  return decodeURIComponent(match[1]);
}

export function extractHallBruteName(text: string): string | undefined {
  const lines = text
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean);

  for (const line of lines) {
    if (isLikelyHallBruteName(line)) {
      return line;
    }
  }

  return undefined;
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

export async function readLatestCellFightOutcome(
  page: Page,
  timeoutMs = 2000,
): Promise<FightOutcome | undefined> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const fightLogEntries = page.locator(selectors.cell.fightLogEntries);
    if (await fightLogEntries.count()) {
      const latestFightEntry = fightLogEntries.first();
      const latestFightIcons = latestFightEntry.locator(selectors.cell.eventLogOutcomeIcons);
      const latestFightIconCount = await latestFightIcons.count();
      const latestFightSources: Array<string | null> = [];

      for (let index = 0; index < latestFightIconCount; index += 1) {
        latestFightSources.push(await latestFightIcons.nth(index).getAttribute('src').catch(() => null));
      }

      const latestFightOutcome = extractLatestCellFightOutcomeFromImageSources(latestFightSources);
      if (latestFightOutcome) {
        return latestFightOutcome;
      }
    }

    const outcomeIcons = page.locator(selectors.cell.eventLogOutcomeIcons);
    const iconCount = await outcomeIcons.count();
    if (iconCount > 0) {
      const imageSources: Array<string | null> = [];

      for (let index = 0; index < iconCount; index += 1) {
        imageSources.push(await outcomeIcons.nth(index).getAttribute('src').catch(() => null));
      }

      const fallbackOutcome = extractLatestCellFightOutcomeFromImageSources(imageSources);
      if (fallbackOutcome) {
        return fallbackOutcome;
      }
    }

    await page.waitForTimeout(100);
  }

  return undefined;
}

export async function clickPublicLogin(page: Page): Promise<void> {
  await page.locator(selectors.login.loginButton).first().click();
}

export async function submitLoginForm(page: Page, username: string, password: string): Promise<void> {
  const form = page.locator(selectors.login.loginForm).first();
  await form.locator(selectors.login.usernameInput).first().fill(username);
  await form.locator(selectors.login.passwordInput).first().fill(password);
  const submitControl = form.locator(selectors.login.submitButton).first();
  await submitControl.waitFor({ state: 'visible', timeout: LOGIN_SUBMIT_READY_TIMEOUT_MS });

  const deadline = Date.now() + LOGIN_SUBMIT_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await submitControl.isEnabled()) {
      await submitControl.click();
      return;
    }

    await page.waitForTimeout(LOGIN_SUBMIT_READY_POLL_MS);
  }

  throw new Error('Login submit control did not become enabled after credentials were filled.');
}

export async function clickFirstHomeBrute(page: Page): Promise<void> {
  const bruteLinks = page.locator(selectors.home.rosterBruteEntries);
  const candidates = await readVisibleHomeBruteEntries(page);

  const selectedCandidate = pickTopLeftHomeBruteEntry(candidates);
  if (!selectedCandidate) {
    throw new Error('No visible brute roster links were found on the authenticated home page.');
  }

  await bruteLinks.nth(selectedCandidate.index).click();
}

async function readHomeBruteName(link: Locator): Promise<string | undefined> {
  const hrefName = extractHomeBruteNameFromHref(await link.getAttribute('href').catch(() => null));
  if (hrefName) {
    return hrefName;
  }

  const title = normalizeText(await link.getAttribute('title').catch(() => ''));
  if (title) {
    return title;
  }

  return normalizeText(await link.innerText().catch(() => '')) || undefined;
}

async function readHallBruteName(entry: Locator): Promise<string | undefined> {
  const nameNodes = entry.locator(selectors.hall.entryName);
  const nameNodeCount = await nameNodes.count().catch(() => 0);

  for (let index = 0; index < nameNodeCount; index += 1) {
    const node = nameNodes.nth(index);
    const text = extractHallBruteName(await node.innerText().catch(() => ''));
    if (text) {
      return text;
    }
  }

  const entryAriaLabel = extractHallBruteName(
    normalizeText(await entry.getAttribute('aria-label').catch(() => '')),
  );
  if (entryAriaLabel) {
    return entryAriaLabel;
  }

  const entryTitle = extractHallBruteName(
    normalizeText(await entry.getAttribute('title').catch(() => '')),
  );
  if (entryTitle) {
    return entryTitle;
  }

  return extractHallBruteName(await entry.innerText().catch(() => ''));
}

async function summarizeHallCandidate(entry: Locator): Promise<string> {
  const ownAriaLabel = normalizeText(await entry.getAttribute('aria-label').catch(() => ''));
  const ownTitle = normalizeText(await entry.getAttribute('title').catch(() => ''));
  const text = normalizeText(await entry.innerText().catch(() => ''));

  return [ownAriaLabel, ownTitle, text]
    .filter(Boolean)
    .join(' | ')
    .slice(0, 160);
}

async function hasHallStructuralEvidence(entry: Locator): Promise<boolean> {
  const entryText = normalizeText(await entry.innerText().catch(() => ''));
  const hasLevelLine = /\bNivel\s+\d+\b/i.test(entryText);
  const statIconCount = await entry.locator(selectors.hall.entryStatIcons).count().catch(() => 0);
  const fightAvailabilityCount = await entry.locator(selectors.hall.entryFightAvailability).count().catch(() => 0);

  return (hasLevelLine || statIconCount >= 2) && (statIconCount >= 2 || fightAvailabilityCount > 0);
}

async function inspectHallCandidate(entry: Locator): Promise<HallCandidateInspection> {
  const bruteName = await readHallBruteName(entry);
  const summary = await summarizeHallCandidate(entry);
  const hasStructuralEvidence = await hasHallStructuralEvidence(entry);
  const hasBlockedAction =
    /\b(torneos|tournament|historial de eventos|history|sacrificar|sacrifice|reiniciar|reset)\b/i
      .test(summary);

  if (!hasStructuralEvidence || hasBlockedAction) {
    return {
      accepted: false,
      summary,
      hasStructuralEvidence,
      reason: hasBlockedAction ? 'blocked-action' : 'missing-structural-evidence',
    };
  }

  if (!bruteName) {
    return {
      accepted: false,
      summary,
      hasStructuralEvidence,
      reason: 'missing-brute-name',
    };
  }

  return {
    accepted: true,
    bruteName,
    summary,
    hasStructuralEvidence,
    reason: 'accepted',
  };
}

async function inspectHallContainerEntries(
  rosterEntries: Locator,
  index: number,
  strategy: 'direct' | 'descendant',
): Promise<HallContainerInspection> {
  const originalEntryCount = await rosterEntries.count().catch(() => 0);
  const normalizedEntries = await normalizeHallRosterEntries(rosterEntries, strategy);
  const entryCount = normalizedEntries.count;
  const repeatedEntryCount = entryCount >= HALL_REPEATED_ENTRY_THRESHOLD ? entryCount : 0;
  const rejectedSummaries: string[] = [];
  let acceptedEntryCount = 0;
  let extractedNameCount = 0;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    const inspection = await inspectHallCandidate(normalizedEntries.nth(entryIndex));
    if (inspection.hasStructuralEvidence) {
      acceptedEntryCount += 1;
    }
    if (inspection.bruteName) {
      extractedNameCount += 1;
    }
    if (!inspection.accepted && inspection.summary) {
      rejectedSummaries.push(inspection.summary);
    }
  }

  return {
    index,
    strategy,
    entryCount,
    repeatedEntryCount,
    acceptedEntryCount,
    extractedNameCount,
    rejectedSummaries,
    rosterEntries: {
      first() {
        if (entryCount === originalEntryCount && typeof rosterEntries.first === 'function') {
          return rosterEntries.first();
        }
        const firstEntry = normalizedEntries.nth(0);
        return {
          waitFor(options: { state: string; timeout: number }) {
            if (typeof firstEntry.waitFor === 'function') {
              return firstEntry.waitFor(options as Parameters<Locator['waitFor']>[0]);
            }
            return Promise.resolve();
          },
        } as Locator;
      },
      nth(entryIndex: number) {
        return normalizedEntries.nth(entryIndex);
      },
    } as Locator,
  };
}

async function normalizeHallRosterEntries(
  rosterEntries: Locator,
  strategy: 'direct' | 'descendant',
): Promise<NormalizedHallEntries> {
  const entryCount = await rosterEntries.count().catch(() => 0);
  if (strategy !== 'descendant' || entryCount < 2) {
    return {
      count: entryCount,
      nth(index: number) {
        return rosterEntries.nth(index);
      },
    };
  }

  const candidates = await Promise.all(
    Array.from({ length: entryCount }, async (_value, index) => {
      const entry = rosterEntries.nth(index);
      const box = typeof entry.boundingBox === 'function'
        ? await entry.boundingBox().catch(() => null)
        : null;
      return { index, entry, box };
    }),
  );

  const retained = candidates.filter((candidate) => {
    const candidateBox = candidate.box;
    if (!candidateBox) {
      return true;
    }

    return !candidates.some((other) => {
      if (other.index === candidate.index || !other.box) {
        return false;
      }

      const containsCandidate =
        other.box.x <= candidateBox.x
        && other.box.y <= candidateBox.y
        && other.box.x + other.box.width >= candidateBox.x + candidateBox.width
        && other.box.y + other.box.height >= candidateBox.y + candidateBox.height;
      const isStrictlyLarger =
        other.box.width * other.box.height > candidateBox.width * candidateBox.height;

      return containsCandidate && isStrictlyLarger;
    });
  });

  return {
    count: retained.length,
    nth(index: number) {
      return retained[index]?.entry ?? rosterEntries.nth(index);
    },
  };
}

async function inspectHallContainer(
  container: Locator,
  index: number,
): Promise<HallContainerInspection> {
  const directEntries = container.locator(selectors.hall.rosterEntries);
  const directInspection = await inspectHallContainerEntries(directEntries, index, 'direct');
  const descendantEntries = container.locator(selectors.hall.descendantRosterEntries);
  const descendantInspection = await inspectHallContainerEntries(descendantEntries, index, 'descendant');

  const strategies = [directInspection, descendantInspection].sort((left, right) => {
    if (left.acceptedEntryCount !== right.acceptedEntryCount) {
      return right.acceptedEntryCount - left.acceptedEntryCount;
    }
    if (left.extractedNameCount !== right.extractedNameCount) {
      return right.extractedNameCount - left.extractedNameCount;
    }
    if (left.repeatedEntryCount !== right.repeatedEntryCount) {
      return right.repeatedEntryCount - left.repeatedEntryCount;
    }
    if (left.entryCount !== right.entryCount) {
      return right.entryCount - left.entryCount;
    }
    return left.strategy === 'direct' ? -1 : 1;
  });

  return strategies[0];
}

function selectHallContainer(inspections: HallContainerInspection[]): HallContainerInspection | undefined {
  return inspections
    .filter((inspection) =>
      inspection.acceptedEntryCount > 0 || inspection.repeatedEntryCount >= HALL_REPEATED_ENTRY_THRESHOLD)
    .sort((left, right) => {
      if ((left.acceptedEntryCount > 0) !== (right.acceptedEntryCount > 0)) {
        return left.acceptedEntryCount > 0 ? -1 : 1;
      }
      if (left.acceptedEntryCount !== right.acceptedEntryCount) {
        return right.acceptedEntryCount - left.acceptedEntryCount;
      }
      if (left.extractedNameCount !== right.extractedNameCount) {
        return right.extractedNameCount - left.extractedNameCount;
      }
      if (left.repeatedEntryCount !== right.repeatedEntryCount) {
        return right.repeatedEntryCount - left.repeatedEntryCount;
      }
      if (left.entryCount !== right.entryCount) {
        return right.entryCount - left.entryCount;
      }
      return left.index - right.index;
    })[0];
}

async function scanHallContainers(page: Page): Promise<HallContainerScan> {
  const rosterContainers = page.locator(selectors.hall.rosterContainer);
  const containerCount = await rosterContainers.count().catch(() => 0);

  const inspections: HallContainerInspection[] = [];
  for (let index = 0; index < containerCount; index += 1) {
    const container = rosterContainers.nth(index);
    const inspection = await inspectHallContainer(container, index);
    inspections.push(inspection);
  }

  return {
    containerCount,
    inspections,
    selected: selectHallContainer(inspections),
  };
}

async function readVisibleHomeBruteEntries(page: Page): Promise<HomeBruteEntryCandidate[]> {
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
      name: await readHomeBruteName(link),
    });
  }

  return candidates;
}

export async function listVisibleHomeBrutes(page: Page): Promise<string[]> {
  return dedupeBruteNames((await readVisibleHomeBruteEntries(page)).map((entry) => entry.name));
}

export async function listHallRosterBrutes(
  page: Page,
  bootstrapUrl: string,
  logger?: Logger,
): Promise<string[]> {
  const hallUrl = new URL('/hall', bootstrapUrl).toString();
  logHallDiscovery(logger, `Opening hall roster page ${hallUrl}`);
  await page.goto(hallUrl, { waitUntil: 'domcontentloaded' });

  let hallScan = await scanHallContainers(page);
  if (hallScan.containerCount === 0) {
    logHallDiscovery(
      logger,
      `No roster container candidates matched selector "${selectors.hall.rosterContainer}" on ${hallUrl}`,
    );
    throw new Error(`Hall roster container candidates were not found on ${hallUrl}.`);
  }
  logHallDiscovery(logger, `Found ${hallScan.containerCount} hall roster container candidate(s).`);

  const hallRetryDeadline = Date.now() + HALL_ROSTER_READY_TIMEOUT_MS;
  while (
    (!hallScan.selected || hallScan.selected.acceptedEntryCount === 0)
    && Date.now() < hallRetryDeadline
  ) {
    if (typeof page.waitForTimeout !== 'function') {
      break;
    }
    await page.waitForTimeout(HALL_ROSTER_RETRY_POLL_MS);
    const rescannedHall = await scanHallContainers(page);
    if (rescannedHall.containerCount > 0) {
      hallScan = rescannedHall;
    }
  }

  const { inspections: containerInspections, selected: selectedContainer, containerCount } = hallScan;

  if (!selectedContainer) {
    logHallDiscovery(
      logger,
      `Rejected ${containerCount} candidate(s): none met the repeated-entry threshold of ${HALL_REPEATED_ENTRY_THRESHOLD}.`,
    );
    throw new Error(`Hall container candidates were found on ${hallUrl}, but none contained repeated roster entries.`);
  }

  logHallDiscovery(
    logger,
    `Selected hall roster candidate #${selectedContainer.index} using ${selectedContainer.strategy} entry discovery with ${selectedContainer.entryCount} entries, ${selectedContainer.acceptedEntryCount} structurally valid, ${selectedContainer.extractedNameCount} extracted names.`,
  );

  if (selectedContainer.acceptedEntryCount === 0) {
    const rejectedSample = selectedContainer.rejectedSummaries
      .slice(0, HALL_REJECTION_SAMPLE_LIMIT)
      .join(' || ');
    logHallDiscovery(
      logger,
      `Selected candidate #${selectedContainer.index} had no structurally valid roster entries. Sample: ${rejectedSample}`,
    );
    throw new Error(
      `Hall container candidates were found on ${hallUrl}, but none matched the roster-card structure. Sample: ${rejectedSample}`,
    );
  }

  await selectedContainer.rosterEntries.first().waitFor({
    state: 'visible',
    timeout: HALL_ROSTER_READY_TIMEOUT_MS,
  });

  const bruteNames: string[] = [];
  const acceptedSummaries: string[] = [];
  const rejectedSummaries: string[] = [];
  let structurallyValidEntries = 0;
  let entriesWithoutNames = 0;
  for (let index = 0; index < selectedContainer.entryCount; index += 1) {
    const inspection = await inspectHallCandidate(selectedContainer.rosterEntries.nth(index));
    if (inspection.accepted && inspection.bruteName) {
      bruteNames.push(inspection.bruteName);
      acceptedSummaries.push(`#${index}:${inspection.bruteName}`);
      continue;
    }

    if (inspection.hasStructuralEvidence) {
      structurallyValidEntries += 1;
      if (!inspection.bruteName) {
        entriesWithoutNames += 1;
      }
    }

    if (inspection.summary) {
      rejectedSummaries.push(`#${index}:${inspection.reason}:${inspection.summary}`);
    }
  }

  const dedupedNames = dedupeBruteNames(bruteNames);
  if (dedupedNames.length === 0) {
    const rejectedSample = rejectedSummaries
      .slice(0, HALL_REJECTION_SAMPLE_LIMIT)
      .join(' || ');
    const failureMessage = structurallyValidEntries === 0
      ? `Selected candidate #${selectedContainer.index} had no structurally valid roster entries.`
      : entriesWithoutNames > 0
        ? `Selected candidate #${selectedContainer.index} had ${entriesWithoutNames} structurally valid entries without extractable names.`
        : `Selected candidate #${selectedContainer.index} rejected all roster entries after inspection.`;
    logHallDiscovery(logger, `${failureMessage} Sample: ${rejectedSample}`);
    throw new Error(
      structurallyValidEntries === 0
        ? `Hall roster entries were found on ${hallUrl}, but none matched the roster-card structure. Sample: ${rejectedSample}`
        : entriesWithoutNames > 0
          ? `Hall roster entries were found on ${hallUrl}, but no brute names could be extracted from ${entriesWithoutNames} structurally valid entries. Sample: ${rejectedSample}`
          : `Hall roster entries were found on ${hallUrl}, but all candidates were rejected. Sample: ${rejectedSample}`
    );
  }

  if (acceptedSummaries.length > 0) {
    logHallDiscovery(
      logger,
      `Accepted hall entries (${acceptedSummaries.length}/${selectedContainer.entryCount}): ${acceptedSummaries.slice(0, HALL_REJECTION_SAMPLE_LIMIT).join(' || ')}`,
    );
  }
  if (rejectedSummaries.length > 0) {
    logHallDiscovery(
      logger,
      `Rejected hall entries (${rejectedSummaries.length}/${selectedContainer.entryCount}): ${rejectedSummaries.slice(0, HALL_REJECTION_SAMPLE_LIMIT).join(' || ')}`,
    );
  }
  logHallDiscovery(logger, `Resolved ${dedupedNames.length} hall brute name(s): ${dedupedNames.join(', ')}`);
  return dedupedNames;
}

export async function clickHomeBrute(page: Page, bruteName: string): Promise<void> {
  const bruteLinks = page.locator(selectors.home.rosterBruteEntries);
  const targetBruteName = normalizeText(bruteName).toLowerCase();
  const candidates = await readVisibleHomeBruteEntries(page);
  const matchingCandidate = candidates.find(
    (candidate) => candidate.name?.toLowerCase() === targetBruteName,
  );

  if (!matchingCandidate) {
    const visibleBrutes = candidates
      .map((candidate) => normalizeText(candidate.name))
      .filter(Boolean)
      .join(', ');
    throw new Error(
      visibleBrutes
        ? `Unable to find brute ${bruteName} on the authenticated home page. Visible brutes: ${visibleBrutes}.`
        : `Unable to find brute ${bruteName} on the authenticated home page.`,
    );
  }

  await bruteLinks.nth(matchingCandidate.index).click();
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
