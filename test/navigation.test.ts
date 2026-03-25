import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractArenaOpponentName,
  extractBruteNameFromUrl,
  pickTopLeftHomeBruteEntry,
  submitLoginForm,
} from '../src/game/navigation';

test('extractBruteNameFromUrl resolves brute identity from a special cell route', () => {
  assert.equal(
    extractBruteNameFromUrl('https://brute.eternaltwin.org/TargetBrute/cell'),
    'TargetBrute',
  );
});

test('extractBruteNameFromUrl resolves brute identity from arena and versus routes', () => {
  assert.equal(
    extractBruteNameFromUrl('https://brute.eternaltwin.org/ExampleBrute/arena'),
    'ExampleBrute',
  );
  assert.equal(
    extractBruteNameFromUrl('https://brute.eternaltwin.org/TargetBrute/versus/OpponentBrute'),
    'TargetBrute',
  );
});

test('pickTopLeftHomeBruteEntry prefers the top-left roster candidate over later generic positions', () => {
  const selected = pickTopLeftHomeBruteEntry([
    { index: 0, x: 420, y: 120 },
    { index: 1, x: 48, y: 64 },
    { index: 2, x: 300, y: 64 },
  ]);

  assert.deepEqual(selected, { index: 1, x: 48, y: 64 });
});

test('pickTopLeftHomeBruteEntry returns undefined when no roster candidates are available', () => {
  assert.equal(pickTopLeftHomeBruteEntry([]), undefined);
});

test('extractArenaOpponentName skips generic arena labels and keeps the visible rival name', () => {
  assert.equal(
    extractArenaOpponentName('Fight\nOpponentBrute\n62%'),
    'OpponentBrute',
  );
  assert.equal(
    extractArenaOpponentName('Comenzar el combate\nTargetBrute\nRatio de Victoria 41%'),
    'TargetBrute',
  );
});

test('submitLoginForm waits for the submit control to become enabled before clicking', async () => {
  const operations: string[] = [];
  const submitControl = {
    first() {
      return this;
    },
    async waitFor(options: { state: string; timeout: number }) {
      operations.push(`submit.waitFor:${options.state}:${options.timeout}`);
    },
    async isEnabled() {
      operations.push('submit.isEnabled');
      return operations.filter((entry) => entry === 'submit.isEnabled').length > 1;
    },
    async click() {
      operations.push('submit.click');
    },
  };
  const form = {
    first() {
      return this;
    },
    locator(selector: string) {
      if (selector.includes('username')) {
        return {
          first() {
            return this;
          },
          async fill(value: string) {
            operations.push(`username.fill:${value}`);
          },
        };
      }

      if (selector === 'input[type="password"]') {
        return {
          first() {
            return this;
          },
          async fill(value: string) {
            operations.push(`password.fill:${value}`);
          },
        };
      }

      return submitControl;
    },
  };
  const page = {
    locator() {
      return form;
    },
    async waitForTimeout(timeoutMs: number) {
      operations.push(`page.waitForTimeout:${timeoutMs}`);
    },
  };

  await submitLoginForm(page as never, 'EXAMPLE_USERNAME', 'EXAMPLE_PASSWORD');

  assert.deepEqual(operations, [
    'username.fill:EXAMPLE_USERNAME',
    'password.fill:EXAMPLE_PASSWORD',
    'submit.waitFor:visible:3000',
    'submit.isEnabled',
    'page.waitForTimeout:100',
    'submit.isEnabled',
    'submit.click',
  ]);
});
