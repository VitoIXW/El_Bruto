import test from 'node:test';
import assert from 'node:assert/strict';

import { formatSummary } from '../src/reporting/summary';

test('formatSummary includes artifact paths when present', () => {
  const text = formatSummary({
    bruteName: 'ExampleBrute',
    fightsCompleted: 2,
    finalStatus: 'resting',
    restingReached: true,
    levelUpDetected: false,
    errorsOccurred: false,
    artifacts: {
      screenshotPath: 'artifacts/example.png',
      htmlPath: 'artifacts/example.html',
    },
  });

  assert.match(text, /Brute name: ExampleBrute/);
  assert.match(text, /Screenshot: artifacts\/example\.png/);
  assert.match(text, /HTML snapshot: artifacts\/example\.html/);
});
