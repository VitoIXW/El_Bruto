import readline from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';

import { normalizeText } from '../game/selectors';
import type { ExecutionMode, LoginCredentials, SavedAccount } from '../types/run-types';

export interface InteractivePrompter {
  ask(question: string): Promise<string>;
  write(message: string): void;
  close(): Promise<void> | void;
}

export interface InteractiveAccountChoice {
  credentials: LoginCredentials;
  accountToSave?: SavedAccount;
}

export interface InteractiveRunSelection {
  executionMode: ExecutionMode;
  bruteNames: string[];
}

function parsePositiveIndex(input: string, maxValue: number): number | undefined {
  const numericValue = Number.parseInt(input, 10);
  if (Number.isNaN(numericValue) || numericValue < 1 || numericValue > maxValue) {
    return undefined;
  }

  return numericValue - 1;
}

export function parseMultiSelection(input: string, availableItems: string[]): string[] {
  const selectedIndexes = input
    .split(',')
    .map((part) => parsePositiveIndex(normalizeText(part), availableItems.length))
    .filter((value): value is number => value !== undefined);

  return Array.from(new Set(selectedIndexes)).map((index) => availableItems[index]);
}

export function createConsolePrompter(
  input: Readable = process.stdin,
  output: Writable = process.stdout,
): InteractivePrompter {
  const rl = readline.createInterface({ input, output });

  return {
    ask(question: string) {
      return rl.question(question);
    },
    write(message: string) {
      output.write(`${message}\n`);
    },
    close() {
      rl.close();
    },
  };
}

async function askRequiredValue(prompter: InteractivePrompter, label: string): Promise<string> {
  while (true) {
    const value = normalizeText(await prompter.ask(label));
    if (value) {
      return value;
    }

    prompter.write('A value is required.');
  }
}

async function promptForNewAccount(prompter: InteractivePrompter): Promise<InteractiveAccountChoice> {
  const username = await askRequiredValue(prompter, 'Username: ');
  const password = await askRequiredValue(prompter, 'Password: ');
  const saveAnswer = normalizeText(await prompter.ask('Save this account locally? [y/N]: ')).toLowerCase();

  if (saveAnswer !== 'y' && saveAnswer !== 'yes') {
    return {
      credentials: {
        username,
        password,
        source: 'interactive',
      },
    };
  }

  const labelInput = normalizeText(await prompter.ask(`Account label [${username}]: `));
  const label = labelInput || username;

  return {
    credentials: {
      username,
      password,
      source: 'interactive',
    },
    accountToSave: {
      label,
      username,
      password,
    },
  };
}

export async function promptForAccountSelection(
  accounts: SavedAccount[],
  prompter: InteractivePrompter,
): Promise<InteractiveAccountChoice> {
  if (accounts.length === 0) {
    prompter.write('No saved accounts were found. Enter a new account.');
    return promptForNewAccount(prompter);
  }

  prompter.write('Available accounts:');
  accounts.forEach((account, index) => {
    prompter.write(`${index + 1}. ${account.label} (${account.username})`);
  });
  prompter.write(`${accounts.length + 1}. Enter a new account`);

  while (true) {
    const choice = parsePositiveIndex(
      normalizeText(await prompter.ask('Choose an account: ')),
      accounts.length + 1,
    );
    if (choice === undefined) {
      prompter.write('Choose a valid option number.');
      continue;
    }

    if (choice === accounts.length) {
      return promptForNewAccount(prompter);
    }

    const account = accounts[choice];
    return {
      credentials: {
        username: account.username,
        password: account.password,
        source: 'saved-account',
      },
    };
  }
}

async function promptForSingleBruteChoice(
  bruteNames: string[],
  prompter: InteractivePrompter,
): Promise<string> {
  while (true) {
    const choice = parsePositiveIndex(
      normalizeText(await prompter.ask('Choose a brute by number: ')),
      bruteNames.length,
    );
    if (choice !== undefined) {
      return bruteNames[choice];
    }

    prompter.write('Choose a valid brute number.');
  }
}

export async function promptForRunSelection(
  bruteNames: string[],
  prompter: InteractivePrompter,
): Promise<InteractiveRunSelection> {
  if (bruteNames.length === 0) {
    throw new Error('No available brutes were found for interactive selection.');
  }

  prompter.write('Run mode:');
  prompter.write('1. Run all brutes');
  prompter.write('2. Run one brute');
  prompter.write('3. Run selected brutes');

  while (true) {
    const modeChoice = parsePositiveIndex(
      normalizeText(await prompter.ask('Choose how to run this account: ')),
      3,
    );
    if (modeChoice === undefined) {
      prompter.write('Choose 1, 2, or 3.');
      continue;
    }

    if (modeChoice === 0) {
      return {
        executionMode: 'all-brutes',
        bruteNames: [...bruteNames],
      };
    }

    if (modeChoice === 1) {
      prompter.write('Available brutes for single selection:');
      bruteNames.forEach((bruteName, index) => {
        prompter.write(`${index + 1}. ${bruteName}`);
      });
      return {
        executionMode: 'single',
        bruteNames: [await promptForSingleBruteChoice(bruteNames, prompter)],
      };
    }

    prompter.write('Available brutes for multi-selection:');
    bruteNames.forEach((bruteName, index) => {
      prompter.write(`${index + 1}. ${bruteName}`);
    });
    const selectedBrutes = parseMultiSelection(
      await prompter.ask('Enter brute numbers separated by commas: '),
      bruteNames,
    );
    if (selectedBrutes.length > 0) {
      return {
        executionMode: 'single',
        bruteNames: selectedBrutes,
      };
    }

    prompter.write('Choose at least one valid brute number.');
  }
}
