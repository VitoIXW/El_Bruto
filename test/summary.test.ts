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

test('formatSummary makes level-up manual intervention explicit', () => {
  const text = formatSummary({
    bruteName: 'ExampleBrute',
    fightsCompleted: 4,
    finalStatus: 'manual_intervention_required',
    restingReached: false,
    levelUpDetected: true,
    errorsOccurred: false,
  });

  assert.match(text, /Final status: manual_intervention_required/);
  assert.match(text, /Level-up detected: true/);
  assert.match(
    text,
    /Reason: The brute leveled up and requires a manual upgrade choice before continuing\./,
  );
});
