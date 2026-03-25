import readline from 'node:readline/promises';
import * as classicReadline from 'node:readline';
import type { Readable, Writable } from 'node:stream';

import { normalizeText } from '../game/selectors';
import type { ExecutionMode, LoginCredentials, SavedAccount } from '../types/run-types';

export interface InteractivePrompter {
  ask(question: string): Promise<string>;
  write(message: string): void;
  chooseOne?(message: string, options: string[]): Promise<number>;
  chooseMany?(message: string, options: string[]): Promise<number[]>;
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

interface TtyLikeInput extends Readable {
  isTTY?: boolean;
  setRawMode?(mode: boolean): void;
}

interface TtyLikeOutput extends Writable {
  isTTY?: boolean;
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
  const ttyInput = input as TtyLikeInput;
  const ttyOutput = output as TtyLikeOutput;
  const supportsInteractiveSelection =
    ttyInput.isTTY === true
    && ttyOutput.isTTY === true
    && typeof ttyInput.setRawMode === 'function';

  async function chooseFromList(message: string, options: string[], allowMultiple: boolean): Promise<number[]> {
    if (!supportsInteractiveSelection) {
      throw new Error('Interactive selector is unavailable without a TTY.');
    }

    rl.pause();
    classicReadline.emitKeypressEvents(ttyInput);

    let cursorIndex = 0;
    const selectedIndexes = new Set<number>();
    if (!allowMultiple && options.length > 0) {
      selectedIndexes.add(0);
    }

    const instructionLine = allowMultiple
      ? 'Use arrow keys to move, space to toggle, and Enter to confirm.'
      : 'Use arrow keys to move and Enter to confirm.';
    let renderedLineCount = 0;

    const render = () => {
      if (renderedLineCount > 0) {
        classicReadline.moveCursor(output, 0, -renderedLineCount);
        classicReadline.clearScreenDown(output);
      }

      const lines = [
        message,
        ...options.map((option, index) => {
          const pointer = index === cursorIndex ? '>' : ' ';
          const marker = allowMultiple ? `[${selectedIndexes.has(index) ? 'x' : ' '}] ` : '';
          return `${pointer} ${marker}${option}`;
        }),
        instructionLine,
      ];

      output.write(`${lines.join('\n')}\n`);
      renderedLineCount = lines.length;
    };

    return new Promise<number[]>((resolve, reject) => {
      const cleanup = () => {
        ttyInput.setRawMode?.(false);
        ttyInput.off('keypress', onKeypress);
        ttyInput.pause();
        output.write('\n');
        rl.resume();
      };

      const finish = (indexes: number[]) => {
        cleanup();
        resolve(indexes);
      };

      const onKeypress = (_chunk: string, key: { name?: string; sequence?: string; ctrl?: boolean }) => {
        if (key.ctrl && key.name === 'c') {
          cleanup();
          reject(new Error('Interactive prompt cancelled.'));
          return;
        }

        if (key.name === 'up') {
          cursorIndex = cursorIndex === 0 ? options.length - 1 : cursorIndex - 1;
          if (!allowMultiple) {
            selectedIndexes.clear();
            selectedIndexes.add(cursorIndex);
          }
          render();
          return;
        }

        if (key.name === 'down') {
          cursorIndex = cursorIndex === options.length - 1 ? 0 : cursorIndex + 1;
          if (!allowMultiple) {
            selectedIndexes.clear();
            selectedIndexes.add(cursorIndex);
          }
          render();
          return;
        }

        if (allowMultiple && key.name === 'space') {
          if (selectedIndexes.has(cursorIndex)) {
            selectedIndexes.delete(cursorIndex);
          } else {
            selectedIndexes.add(cursorIndex);
          }
          render();
          return;
        }

        if (key.name === 'return') {
          if (allowMultiple) {
            const indexes = [...selectedIndexes].sort((left, right) => left - right);
            if (indexes.length > 0) {
              finish(indexes);
            }
          } else {
            finish([cursorIndex]);
          }
        }
      };

      ttyInput.setRawMode?.(true);
      ttyInput.resume();
      ttyInput.on('keypress', onKeypress);
      render();
    });
  }

  return {
    ask(question: string) {
      return rl.question(question);
    },
    write(message: string) {
      output.write(`${message}\n`);
    },
    async chooseOne(message: string, options: string[]) {
      const [selectedIndex] = await chooseFromList(message, options, false);
      return selectedIndex;
    },
    async chooseMany(message: string, options: string[]) {
      return chooseFromList(message, options, true);
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

  const options = [
    ...accounts.map((account) => `${account.label} (${account.username})`),
    'Enter a new account',
  ];

  if (prompter.chooseOne) {
    const choice = await prompter.chooseOne('Choose an account:', options);
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

  prompter.write('Available accounts:');
  options.forEach((option, index) => {
    prompter.write(`${index + 1}. ${option}`);
  });

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
  if (prompter.chooseOne) {
    const choice = await prompter.chooseOne('Choose a brute:', bruteNames);
    return bruteNames[choice];
  }

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

  if (prompter.chooseOne) {
    const modeChoice = await prompter.chooseOne('Choose how to run this account:', [
      'Run all brutes',
      'Run one brute',
      'Run selected brutes',
    ]);

    if (modeChoice === 0) {
      return {
        executionMode: 'all-brutes',
        bruteNames: [...bruteNames],
      };
    }

    if (modeChoice === 1) {
      return {
        executionMode: 'single',
        bruteNames: [await promptForSingleBruteChoice(bruteNames, prompter)],
      };
    }

    if (prompter.chooseMany) {
      const selectedIndexes = await prompter.chooseMany('Choose brutes to run:', bruteNames);
      return {
        executionMode: 'single',
        bruteNames: selectedIndexes.map((index) => bruteNames[index]),
      };
    }
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
