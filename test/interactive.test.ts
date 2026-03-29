import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseMultiSelection,
  promptForAccountSelection,
  promptForBruteSelection,
  promptForInteractiveCompletionBehavior,
  promptForLevelUpBehavior,
  promptForRunModeChoice,
  promptForRunSelection,
  waitForInteractiveCompletionConfirmation,
  waitForManualLevelUpConfirmation,
  writeInteractiveHeader,
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

function createSelectablePrompter(oneChoices: number[], manyChoices: number[][] = []) {
  const prompts: string[] = [];
  const writes: string[] = [];

  const prompter: InteractivePrompter = {
    async ask(question: string) {
      prompts.push(question);
      throw new Error(`Unexpected textual prompt: ${question}`);
    },
    write(message: string) {
      writes.push(message);
    },
    async chooseOne(message: string, options: string[]) {
      prompts.push(`${message} :: ${options.join(' | ')}`);
      const choice = oneChoices.shift();
      if (choice === undefined) {
        throw new Error(`No choice configured for selector: ${message}`);
      }
      return choice;
    },
    async chooseMany(message: string, options: string[]) {
      prompts.push(`${message} :: ${options.join(' | ')}`);
      const choice = manyChoices.shift();
      if (choice === undefined) {
        throw new Error(`No multi-choice configured for selector: ${message}`);
      }
      return choice;
    },
    close() {},
  };

  return { prompter, prompts, writes };
}

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
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

test('promptForRunModeChoice supports textual selection', async () => {
  const { prompter, writes } = createPrompter(['3']);

  const result = await promptForRunModeChoice(prompter);

  assert.equal(result, 'selected-brutes');
  assert.deepEqual(writes.slice(0, 4), [
    'Run mode:',
    '1. Run all brutes',
    '2. Run one brute',
    '3. Run selected brutes',
  ]);
});

test('promptForRunModeChoice supports arrow-style selection', async () => {
  const { prompter } = createSelectablePrompter([1]);

  const result = await promptForRunModeChoice(prompter);

  assert.equal(result, 'one-brute');
});

test('promptForBruteSelection supports single textual selection after mode choice', async () => {
  const { prompter, writes } = createPrompter(['2']);

  const result = await promptForBruteSelection(
    ['ExampleBrute', 'TargetBrute', 'OpponentBrute'],
    prompter,
    'one-brute',
  );

  assert.deepEqual(result, {
    executionMode: 'single',
    bruteNames: ['TargetBrute'],
  });
  assert.match(writes[0] ?? '', /Available brutes for single selection:/);
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

test('promptForAccountSelection supports arrow-style single-choice selection', async () => {
  const { prompter, writes } = createSelectablePrompter([1]);

  const result = await promptForAccountSelection([{
    label: 'Example Account',
    username: 'EXAMPLE_USERNAME',
    password: 'EXAMPLE_PASSWORD',
  }, {
    label: 'Target Account',
    username: 'TARGET_USERNAME',
    password: 'TARGET_PASSWORD',
  }], prompter);

  assert.deepEqual(result, {
    credentials: {
      username: 'TARGET_USERNAME',
      password: 'TARGET_PASSWORD',
      source: 'saved-account',
    },
  });
  assert.deepEqual(writes, []);
});

test('promptForRunSelection supports arrow-style single brute selection', async () => {
  const { prompter } = createSelectablePrompter([1, 2]);

  const result = await promptForRunSelection(
    ['ExampleBrute', 'TargetBrute', 'OpponentBrute'],
    prompter,
  );

  assert.deepEqual(result, {
    executionMode: 'single',
    bruteNames: ['OpponentBrute'],
  });
});

test('promptForRunSelection supports arrow-style multi brute selection', async () => {
  const { prompter } = createSelectablePrompter([2], [[0, 2]]);

  const result = await promptForRunSelection(
    ['ExampleBrute', 'TargetBrute', 'OpponentBrute'],
    prompter,
  );

  assert.deepEqual(result, {
    executionMode: 'single',
    bruteNames: ['ExampleBrute', 'OpponentBrute'],
  });
});

test('promptForBruteSelection supports arrow-style multi brute selection after mode choice', async () => {
  const { prompter } = createSelectablePrompter([], [[0, 2]]);

  const result = await promptForBruteSelection(
    ['ExampleBrute', 'TargetBrute', 'OpponentBrute'],
    prompter,
    'selected-brutes',
  );

  assert.deepEqual(result, {
    executionMode: 'single',
    bruteNames: ['ExampleBrute', 'OpponentBrute'],
  });
});

test('promptForLevelUpBehavior supports textual selection', async () => {
  const { prompter, writes } = createPrompter(['2']);

  const result = await promptForLevelUpBehavior(prompter);

  assert.equal(result, 'wait_for_manual_resume');
  assert.deepEqual(writes.slice(0, 3), [
    'Level-up handling:',
    '1. Skip that brute and continue',
    '2. Wait for me to level it up manually in Chromium',
  ]);
});

test('promptForLevelUpBehavior supports arrow-style selection', async () => {
  const { prompter } = createSelectablePrompter([1]);

  const result = await promptForLevelUpBehavior(prompter);

  assert.equal(result, 'wait_for_manual_resume');
});

test('promptForInteractiveCompletionBehavior supports textual selection', async () => {
  const { prompter, writes } = createPrompter(['2']);

  const result = await promptForInteractiveCompletionBehavior(prompter);

  assert.equal(result, 'keep_browser_open');
  assert.deepEqual(writes.slice(0, 3), [
    'Run completion handling:',
    '1. Close the program and Chromium when the run finishes',
    '2. Keep Chromium open when the run finishes',
  ]);
});

test('promptForInteractiveCompletionBehavior supports arrow-style selection', async () => {
  const { prompter } = createSelectablePrompter([1]);

  const result = await promptForInteractiveCompletionBehavior(prompter);

  assert.equal(result, 'keep_browser_open');
});

test('waitForManualLevelUpConfirmation pauses for terminal confirmation', async () => {
  const { prompter, prompts, writes } = createPrompter(['']);

  await waitForManualLevelUpConfirmation('ExampleBrute', prompter);

  assert.equal(writes.length, 7);
  assert.equal(writes[0], '');
  assert.match(writes[1] ?? '', /^=+/);
  assert.match(writes[2] ?? '', /LEVEL UP/);
  assert.match(writes[2] ?? '', /ExampleBrute/);
  assert.match(writes[3] ?? '', /Chromium will stay open/);
  assert.match(writes[4] ?? '', /ENTER/);
  assert.equal(writes[5], '========================================');
  assert.equal(writes[6], '');
  assert.equal(prompts.length, 1);
  assert.match(prompts[0] ?? '', /Press .*ENTER.* when you are done and want to continue: /);
});

test('waitForInteractiveCompletionConfirmation pauses before closing Chromium', async () => {
  const { prompter, prompts, writes } = createPrompter(['']);

  await waitForInteractiveCompletionConfirmation(prompter);

  assert.deepEqual(writes.map(stripAnsi), [
    '',
    '================ RUN FINISHED ================',
    'Chromium will stay open so you can manage anything else while still logged in.',
  ]);
  assert.deepEqual(prompts, [
    'Press \u001B[38;5;226mENTER\u001B[0m when you want to close Chromium and exit: ',
  ]);
});

test('parseMultiSelection keeps valid unique brute selections in input order', () => {
  assert.deepEqual(
    parseMultiSelection('3, 1, 3, 9', ['ExampleBrute', 'TargetBrute', 'OpponentBrute']),
    ['OpponentBrute', 'ExampleBrute'],
  );
});

test('writeInteractiveHeader prints the EL BRUTO banner', () => {
  const { prompter, writes } = createPrompter([]);

  writeInteractiveHeader(prompter);

  assert.equal(writes.length, 7);
  assert.match(writes[0] ?? '', /███████╗██╗/);
  assert.equal(writes[6], '');
});
