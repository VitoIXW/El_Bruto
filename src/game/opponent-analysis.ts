import { buildCellUrl, normalizeText, stripHtmlTags } from './selectors';

export interface PublicOpponentAnalysis {
  name: string;
  cellUrl: string;
  winRatePercentage?: number;
  error?: string;
}

type FetchLike = typeof fetch;
type FetchInput = string | URL | globalThis.Request;
type FetchInit = globalThis.RequestInit | undefined;
type PublicApiSession = {
  csrfToken: string;
  cookieHeader: string;
};

const WIN_RATE_LABEL_PATTERN =
  /(ratio de victoria|win\s*rate|victory\s*ratio|ratio of victory)/i;
const PERCENTAGE_PATTERN = /(\d+(?:[.,]\d+)?)\s*%/;
const GLOBAL_PERCENTAGE_PATTERN = /(\d+(?:[.,]\d+)?)\s*%/g;
const SPA_ROOT_PATTERN = /<div[^>]+id=["']root["'][^>]*>\s*<\/div>/i;

function parseNumericField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseWinRateFromJsonPayload(content: string): number | undefined {
  try {
    const payload = JSON.parse(content) as Record<string, unknown>;
    const directWinRate =
      parseNumericField(payload.winRatePercentage) ??
      parseNumericField(payload.winRate) ??
      parseNumericField(payload.publicWinRatePercentage);
    if (directWinRate !== undefined) {
      return directWinRate;
    }

    const victories = parseNumericField(payload.victories);
    const losses = parseNumericField(payload.losses);
    if (victories === undefined || losses === undefined) {
      return undefined;
    }

    const totalFights = victories + losses;
    if (totalFights <= 0) {
      return undefined;
    }

    return (victories / totalFights) * 100;
  } catch {
    return undefined;
  }
}

function isSpaShellHtml(content: string): boolean {
  return SPA_ROOT_PATTERN.test(content);
}

function buildPublicBruteApiUrl(origin: string, bruteName: string): string {
  return `${origin}/api/brute/${encodeURIComponent(bruteName)}/for-hook`;
}

function getSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') {
    return getSetCookie.call(headers);
  }

  const singleHeader = headers.get('set-cookie');
  return singleHeader ? [singleHeader] : [];
}

function buildCookieHeader(setCookieHeaders: string[]): string {
  return setCookieHeaders
    .map((value) => value.split(';', 1)[0]?.trim() ?? '')
    .filter(Boolean)
    .join('; ');
}

async function fetchPublicApiSession(
  origin: string,
  fetchImpl: (input: FetchInput, init?: FetchInit) => ReturnType<FetchLike>,
): Promise<PublicApiSession | undefined> {
  try {
    const csrfResponse = await fetchImpl(`${origin}/api/csrf`);
    if (!csrfResponse.ok) {
      return undefined;
    }

    const csrfPayload = JSON.parse(await csrfResponse.text()) as { csrfToken?: unknown };
    const csrfToken =
      typeof csrfPayload.csrfToken === 'string' ? normalizeText(csrfPayload.csrfToken) : '';
    const cookieHeader = buildCookieHeader(getSetCookieHeaders(csrfResponse.headers));
    if (!csrfToken || !cookieHeader) {
      return undefined;
    }

    return {
      csrfToken,
      cookieHeader,
    };
  } catch {
    return undefined;
  }
}

async function fetchPublicWinRatePercentage(
  origin: string,
  bruteName: string,
  session: Promise<PublicApiSession | undefined>,
  fetchImpl: (input: FetchInput, init?: FetchInit) => ReturnType<FetchLike>,
): Promise<number | undefined> {
  const publicApiSession = await session;
  if (!publicApiSession) {
    return undefined;
  }

  const response = await fetchImpl(buildPublicBruteApiUrl(origin, bruteName), {
    headers: {
      accept: 'application/json',
      cookie: publicApiSession.cookieHeader,
      'x-csrf-token': publicApiSession.csrfToken,
    },
  });
  if (!response.ok) {
    return undefined;
  }

  return extractWinRatePercentage(await response.text());
}

export function extractWinRatePercentage(html: string): number | undefined {
  const jsonWinRate = parseWinRateFromJsonPayload(html);
  if (jsonWinRate !== undefined) {
    return jsonWinRate;
  }

  const text = stripHtmlTags(html);
  const labelMatch = WIN_RATE_LABEL_PATTERN.exec(text);
  if (!labelMatch) {
    return undefined;
  }

  const textAfterLabel = text.slice(labelMatch.index + labelMatch[0].length);
  const nearbyPercentage = PERCENTAGE_PATTERN.exec(textAfterLabel.slice(0, 160));
  if (nearbyPercentage) {
    return Number.parseFloat(nearbyPercentage[1].replace(',', '.'));
  }

  const allPercentages = Array.from(text.matchAll(GLOBAL_PERCENTAGE_PATTERN));
  if (allPercentages.length === 1) {
    return Number.parseFloat(allPercentages[0][1].replace(',', '.'));
  }

  return undefined;
}

export function chooseLowestWinRateOpponent(
  analyses: PublicOpponentAnalysis[],
): PublicOpponentAnalysis | undefined {
  const ranked = analyses.filter(
    (analysis): analysis is PublicOpponentAnalysis & { winRatePercentage: number } =>
      typeof analysis.winRatePercentage === 'number' && Number.isFinite(analysis.winRatePercentage),
  );

  ranked.sort((left, right) => {
    if (left.winRatePercentage !== right.winRatePercentage) {
      return left.winRatePercentage - right.winRatePercentage;
    }

    return left.name.localeCompare(right.name);
  });

  return ranked[0];
}

export async function analyzePublicOpponentWinRates(
  origin: string,
  opponentNames: string[],
  fetchImpl: FetchLike = fetch,
): Promise<PublicOpponentAnalysis[]> {
  const uniqueNames = Array.from(
    new Set(opponentNames.map((name) => normalizeText(name)).filter(Boolean)),
  );
  let publicApiSession: Promise<PublicApiSession | undefined> | undefined;

  return Promise.all(uniqueNames.map(async (name) => {
    const cellUrl = buildCellUrl(origin, name);

    try {
      const response = await fetchImpl(cellUrl);
      if (!response.ok) {
        return {
          name,
          cellUrl,
          error: `Unable to fetch public cell page (${response.status}).`,
        };
      }

      const html = await response.text();
      const winRatePercentage = extractWinRatePercentage(html)
        ?? (isSpaShellHtml(html)
          ? await fetchPublicWinRatePercentage(
            origin,
            name,
            (publicApiSession ??= fetchPublicApiSession(origin, fetchImpl)),
            fetchImpl,
          )
          : undefined);
      if (winRatePercentage === undefined) {
        return {
          name,
          cellUrl,
          error: 'Unable to parse public win-rate percentage.',
        };
      }

      return {
        name,
        cellUrl,
        winRatePercentage,
      };
    } catch (error) {
      return {
        name,
        cellUrl,
        error: normalizeText((error as Error).message) || 'Unable to fetch public cell page.',
      };
    }
  }));
}
