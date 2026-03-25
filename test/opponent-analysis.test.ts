import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzePublicOpponentWinRates,
  chooseLowestWinRateOpponent,
  extractWinRatePercentage,
} from '../src/game/opponent-analysis';

test('extractWinRatePercentage parses Spanish public cell markup', () => {
  const html = `
    <section>
      <h4>Ratio de Victoria</h4>
      <div>41,5%</div>
    </section>
  `;

  assert.equal(extractWinRatePercentage(html), 41.5);
});

test('extractWinRatePercentage parses English public cell markup', () => {
  const html = `
    <section>
      <span>Win Rate</span>
      <strong>18%</strong>
    </section>
  `;

  assert.equal(extractWinRatePercentage(html), 18);
});

test('extractWinRatePercentage parses public brute JSON payload victories and losses', () => {
  const payload = JSON.stringify({
    name: 'OpponentBrute',
    victories: 45,
    losses: 55,
  });

  assert.equal(extractWinRatePercentage(payload), 45);
});

test('extractWinRatePercentage is deterministic across repeated sequential calls', () => {
  const spanishHtml = `
    <section>
      <h4>Ratio de Victoria</h4>
      <div>41,5%</div>
    </section>
  `;
  const englishHtml = `
    <section>
      <span>Win Rate</span>
      <strong>18%</strong>
    </section>
  `;

  assert.equal(extractWinRatePercentage(spanishHtml), 41.5);
  assert.equal(extractWinRatePercentage(englishHtml), 18);
  assert.equal(extractWinRatePercentage(spanishHtml), 41.5);
  assert.equal(extractWinRatePercentage(englishHtml), 18);
});

test('chooseLowestWinRateOpponent ignores incomplete analyses and picks the lowest parsed rate', () => {
  const result = chooseLowestWinRateOpponent([
    { name: 'ExampleBrute', cellUrl: 'https://brute.eternaltwin.org/ExampleBrute/cell', winRatePercentage: 33 },
    { name: 'TargetBrute', cellUrl: 'https://brute.eternaltwin.org/TargetBrute/cell', error: 'HTTP 500' },
    { name: 'OpponentBrute', cellUrl: 'https://brute.eternaltwin.org/OpponentBrute/cell', winRatePercentage: 14 },
  ]);

  assert.equal(result?.name, 'OpponentBrute');
  assert.equal(result?.winRatePercentage, 14);
});

test('chooseLowestWinRateOpponent returns undefined when no public win rates are available', () => {
  const result = chooseLowestWinRateOpponent([
    { name: 'ExampleBrute', cellUrl: 'https://brute.eternaltwin.org/ExampleBrute/cell', error: 'timeout' },
    { name: 'TargetBrute', cellUrl: 'https://brute.eternaltwin.org/TargetBrute/cell', error: 'parse failed' },
  ]);

  assert.equal(result, undefined);
});

test('analyzePublicOpponentWinRates keeps successful and failed public analyses side by side', async () => {
  const fetchCalls: string[] = [];
  const analyses = await analyzePublicOpponentWinRates(
    'https://brute.eternaltwin.org',
    ['ExampleBrute', 'TargetBrute', 'OpponentBrute'],
    async (input) => {
      const url = String(input);
      fetchCalls.push(url);

      if (url.endsWith('/ExampleBrute/cell')) {
        return new Response('<div>Ratio de Victoria</div><div>54%</div>', { status: 200 });
      }

      if (url.endsWith('/TargetBrute/cell')) {
        return new Response('<div>Win Rate</div><div>12%</div>', { status: 200 });
      }

      return new Response('not found', { status: 404 });
    },
  );

  assert.deepEqual(fetchCalls.sort(), [
    'https://brute.eternaltwin.org/ExampleBrute/cell',
    'https://brute.eternaltwin.org/OpponentBrute/cell',
    'https://brute.eternaltwin.org/TargetBrute/cell',
  ]);
  assert.equal(analyses.find((analysis) => analysis.name === 'ExampleBrute')?.winRatePercentage, 54);
  assert.equal(analyses.find((analysis) => analysis.name === 'TargetBrute')?.winRatePercentage, 12);
  assert.match(
    analyses.find((analysis) => analysis.name === 'OpponentBrute')?.error ?? '',
    /404/,
  );
});

test('analyzePublicOpponentWinRates falls back from SPA shell HTML to public brute JSON data', async () => {
  const fetchCalls: string[] = [];
  const apiHeaders: Array<Record<string, string>> = [];
  const analyses = await analyzePublicOpponentWinRates(
    'https://brute.eternaltwin.org',
    ['ExampleBrute', 'TargetBrute'],
    async (input, init) => {
      const url = String(input);
      fetchCalls.push(url);

      if (url.endsWith('/api/csrf')) {
        return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
          status: 200,
          headers: {
            'set-cookie': 'csrfToken=csrf-token; Path=/; HttpOnly',
          },
        });
      }

      if (url.endsWith('/ExampleBrute/cell') || url.endsWith('/TargetBrute/cell')) {
        return new Response(
          '<!doctype html><html><body><div id="root"></div><script src="/static/js/main.js"></script></body></html>',
          { status: 200 },
        );
      }

      if (url.endsWith('/api/brute/ExampleBrute/for-hook')) {
        apiHeaders.push(init?.headers as Record<string, string>);
        return new Response(JSON.stringify({ victories: 54, losses: 46 }), { status: 200 });
      }

      if (url.endsWith('/api/brute/TargetBrute/for-hook')) {
        apiHeaders.push(init?.headers as Record<string, string>);
        return new Response(JSON.stringify({ victories: 12, losses: 88 }), { status: 200 });
      }

      return new Response('not found', { status: 404 });
    },
  );

  assert.equal(fetchCalls.filter((url) => url.endsWith('/api/csrf')).length, 1);
  assert.equal(analyses.find((analysis) => analysis.name === 'ExampleBrute')?.winRatePercentage, 54);
  assert.equal(analyses.find((analysis) => analysis.name === 'TargetBrute')?.winRatePercentage, 12);
  assert.deepEqual(apiHeaders, [
    {
      accept: 'application/json',
      cookie: 'csrfToken=csrf-token',
      'x-csrf-token': 'csrf-token',
    },
    {
      accept: 'application/json',
      cookie: 'csrfToken=csrf-token',
      'x-csrf-token': 'csrf-token',
    },
  ]);
});

test('analyzePublicOpponentWinRates keeps ranking inputs stable across sequential runs', async () => {
  const fetchImpl = async (input: string | URL | Request) => {
    const url = String(input);

    if (url.endsWith('/ExampleBrute/cell')) {
      return new Response('<div>Ratio de Victoria</div><div>54%</div>', { status: 200 });
    }

    if (url.endsWith('/TargetBrute/cell')) {
      return new Response('<div>Win Rate</div><div>12%</div>', { status: 200 });
    }

    return new Response('<div>Win Rate</div><div>27%</div>', { status: 200 });
  };

  const firstRun = await analyzePublicOpponentWinRates(
    'https://brute.eternaltwin.org',
    ['ExampleBrute', 'TargetBrute', 'OpponentBrute'],
    fetchImpl,
  );
  const secondRun = await analyzePublicOpponentWinRates(
    'https://brute.eternaltwin.org',
    ['ExampleBrute', 'TargetBrute', 'OpponentBrute'],
    fetchImpl,
  );

  assert.equal(chooseLowestWinRateOpponent(firstRun)?.name, 'TargetBrute');
  assert.equal(chooseLowestWinRateOpponent(secondRun)?.name, 'TargetBrute');
});
