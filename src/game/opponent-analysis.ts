import { buildCellUrl, normalizeText, stripHtmlTags } from './selectors';

export interface PublicOpponentAnalysis {
  name: string;
  cellUrl: string;
  winRatePercentage?: number;
  error?: string;
}

type FetchLike = typeof fetch;

const WIN_RATE_LABEL_PATTERN =
  /(ratio de victoria|win\s*rate|victory\s*ratio|ratio of victory)/i;
const PERCENTAGE_PATTERN = /(\d+(?:[.,]\d+)?)\s*%/;
const GLOBAL_PERCENTAGE_PATTERN = /(\d+(?:[.,]\d+)?)\s*%/g;

export function extractWinRatePercentage(html: string): number | undefined {
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
      const winRatePercentage = extractWinRatePercentage(html);
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
