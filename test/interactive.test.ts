import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseMultiSelection,
  promptForAccountSelection,
  promptForRunSelection,
  type InteractivePrompter,
} from '../src/ui/interactive';

function createPrompter(answers: string[]) {
  const prompts: string[] = [];
  const writes: string[] = [];

  const prompter: InteractivePrompter = {
    async ask(question: string) {
      prompts.push(question);
      const answer = answers.shift();
      if (answer === undefined) {
        throw new Error(`No answer configured for prompt: ${question}`);
      }
      return answer;
    },
    write(message: string) {
      writes.push(message);
    },
    close() {},
  };

  return { prompter, prompts, writes };
}

test('promptForAccountSelection uses a saved account when chosen', async () => {
  const { prompter } = createPrompter(['1']);

  const result = await promptForAccountSelection([{
    label: 'Example Account',
    username: 'EXAMPLE_USERNAME',
    password: 'EXAMPLE_PASSWORD',
  }], prompter);

  assert.deepEqual(result, {
    credentials: {
      username: 'EXAMPLE_USERNAME',
      password: 'EXAMPLE_PASSWORD',
      source: 'saved-account',
    },
  });
});

test('promptForAccountSelection collects and optionally saves a new account', async () => {
  const { prompter } = createPrompter([
    'EXAMPLE_USERNAME',
    'EXAMPLE_PASSWORD',
    'y',
    'Example Account',
  ]);

  const result = await promptForAccountSelection([], prompter);

  assert.deepEqual(result, {
    credentials: {
      username: 'EXAMPLE_USERNAME',
      password: 'EXAMPLE_PASSWORD',
      source: 'interactive',
    },
    accountToSave: {
      label: 'Example Account',
      username: 'EXAMPLE_USERNAME',
      password: 'EXAMPLE_PASSWORD',
    },
  });
});

test('promptForRunSelection supports selected multiple brutes', async () => {
  const { prompter, writes } = createPrompter(['3', '1, 3']);

  const result = await promptForRunSelection(
    ['ExampleBrute', 'TargetBrute', 'OpponentBrute'],
    prompter,
  );

  assert.deepEqual(result, {
    executionMode: 'single',
    bruteNames: ['ExampleBrute', 'OpponentBrute'],
  });
  assert.deepEqual(writes.slice(0, 4), [
    'Run mode:',
    '1. Run all brutes',
    '2. Run one brute',
    '3. Run selected brutes',
  ]);
  assert.match(writes[4] ?? '', /Available brutes for multi-selection:/);
});

test('promptForRunSelection only shows brute numbering after choosing single-brute mode', async () => {
  const { prompter, writes } = createPrompter(['2', '2']);

  const result = await promptForRunSelection(
    ['ExampleBrute', 'TargetBrute', 'OpponentBrute'],
    prompter,
  );

  assert.deepEqual(result, {
    executionMode: 'single',
    bruteNames: ['TargetBrute'],
  });
  assert.deepEqual(writes.slice(0, 4), [
    'Run mode:',
    '1. Run all brutes',
    '2. Run one brute',
    '3. Run selected brutes',
  ]);
  assert.match(writes[4] ?? '', /Available brutes for single selection:/);
});

test('parseMultiSelection keeps valid unique brute selections in input order', () => {
  assert.deepEqual(
    parseMultiSelection('3, 1, 3, 9', ['ExampleBrute', 'TargetBrute', 'OpponentBrute']),
    ['OpponentBrute', 'ExampleBrute'],
  );
});
