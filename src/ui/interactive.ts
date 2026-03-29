import readline from 'node:readline/promises';
import * as classicReadline from 'node:readline';
import type { Readable, Writable } from 'node:stream';

import { normalizeText } from '../game/selectors';
import type {
  ExecutionMode,
  InteractiveCompletionBehavior,
  LevelUpBehavior,
  LoginCredentials,
  SavedAccount,
} from '../types/run-types';

export interface InteractivePrompter {
  ask(question: string): Promise<string>;
  write(message: string): void;
  chooseOne?(message: string, options: string[]): Promise<number>;
  chooseMany?(message: string, options: string[]): Promise<number[]>;
  clearScreen?(): void;
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

export type InteractiveRunModeChoice = 'all-brutes' | 'one-brute' | 'selected-brutes';

const INTERACTIVE_HEADER_LINES = [
  '███████╗██╗         ██████╗ ██████╗ ██╗   ██╗████████╗ ██████╗ ',
  '██╔════╝██║         ██╔══██╗██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗',
  '█████╗  ██║         ██████╔╝██████╔╝██║   ██║   ██║   ██║   ██║',
  '██╔══╝  ██║         ██╔══██╗██╔══██╗██║   ██║   ██║   ██║   ██║',
  '███████╗███████╗    ██████╔╝██║  ██║╚██████╔╝   ██║   ╚██████╔╝',
  '╚══════╝╚══════╝    ╚═════╝ ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝ ',
];

interface TtyLikeInput extends Readable {
  isTTY?: boolean;
  setRawMode?(mode: boolean): void;
}

interface TtyLikeOutput extends Writable {
  isTTY?: boolean;
  getColorDepth?(): number;
}

const ANSI_RESET = '\u001B[0m';
const ANSI_ACTIVE_BLUE = '\u001B[38;5;39m';
const ANSI_ACTIVE_YELLOW = '\u001B[38;5;226m';
const ANSI_DIM = '\u001B[2m';
const ANSI_CLEAR_SCREEN = '\u001B[2J\u001B[3J\u001B[H';

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

export function writeInteractiveHeader(prompter: InteractivePrompter): void {
  INTERACTIVE_HEADER_LINES.forEach((line) => {
    prompter.write(line);
  });
  prompter.write('');
}

export async function promptForLevelUpBehavior(
  prompter: InteractivePrompter,
): Promise<LevelUpBehavior> {
  const options = [
    'Skip that brute and continue',
    'Wait for me to level it up manually in Chromium',
  ];

  if (prompter.chooseOne) {
    const choice = await prompter.chooseOne('When a brute levels up, what should happen?', options);
    return choice === 1 ? 'wait_for_manual_resume' : 'skip_brute';
  }

  prompter.write('Level-up handling:');
  prompter.write('1. Skip that brute and continue');
  prompter.write('2. Wait for me to level it up manually in Chromium');

  while (true) {
    const choice = parsePositiveIndex(
      normalizeText(await prompter.ask('Choose level-up handling: ')),
      2,
    );
    if (choice === 0) {
      return 'skip_brute';
    }

    if (choice === 1) {
      return 'wait_for_manual_resume';
    }

    prompter.write('Choose 1 or 2.');
  }
}

export async function promptForInteractiveCompletionBehavior(
  prompter: InteractivePrompter,
): Promise<InteractiveCompletionBehavior> {
  const options = [
    'Close the program and Chromium when the run finishes',
    'Keep Chromium open when the run finishes',
  ];

  if (prompter.chooseOne) {
    const choice = await prompter.chooseOne('What should happen when the run finishes?', options);
    return choice === 1 ? 'keep_browser_open' : 'close_program';
  }

  prompter.write('Run completion handling:');
  prompter.write('1. Close the program and Chromium when the run finishes');
  prompter.write('2. Keep Chromium open when the run finishes');

  while (true) {
    const choice = parsePositiveIndex(
      normalizeText(await prompter.ask('Choose completion handling: ')),
      2,
    );
    if (choice === 0) {
      return 'close_program';
    }

    if (choice === 1) {
      return 'keep_browser_open';
    }

    prompter.write('Choose 1 or 2.');
  }
}

export async function promptForRunModeChoice(
  prompter: InteractivePrompter,
): Promise<InteractiveRunModeChoice> {
  const options = [
    'Run all brutes',
    'Run one brute',
    'Run selected brutes',
  ];

  if (prompter.chooseOne) {
    const choice = await prompter.chooseOne('Choose how to run this account:', options);
    if (choice === 0) {
      return 'all-brutes';
    }

    if (choice === 1) {
      return 'one-brute';
    }

    return 'selected-brutes';
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
      return 'all-brutes';
    }

    if (modeChoice === 1) {
      return 'one-brute';
    }

    return 'selected-brutes';
  }
}

export async function waitForManualLevelUpConfirmation(
  bruteName: string,
  prompter: InteractivePrompter,
): Promise<void> {
  prompter.write('');
  prompter.write('========================================');
  prompter.write(`${ANSI_ACTIVE_YELLOW}LEVEL UP${ANSI_RESET} required for ${bruteName}`);
  prompter.write('Chromium will stay open so you can choose the level-up manually.');
  prompter.write(`Press ${ANSI_ACTIVE_YELLOW}ENTER${ANSI_RESET} when you are done and want to continue.`);
  prompter.write('========================================');
  prompter.write('');
  await prompter.ask(`Press ${ANSI_ACTIVE_YELLOW}ENTER${ANSI_RESET} when you are done and want to continue: `);
}

export async function waitForInteractiveCompletionConfirmation(
  prompter: InteractivePrompter,
): Promise<void> {
  prompter.write('');
  prompter.write(`${ANSI_ACTIVE_BLUE}================ RUN FINISHED ================${ANSI_RESET}`);
  prompter.write('Chromium will stay open so you can manage anything else while still logged in.');
  await prompter.ask(
    `Press ${ANSI_ACTIVE_YELLOW}ENTER${ANSI_RESET} when you want to close Chromium and exit: `,
  );
}

export function createConsolePrompter(
  input: Readable = process.stdin,
  output: Writable = process.stdout,
  options: { allowScreenClears?: boolean } = {},
): InteractivePrompter {
  const rl = readline.createInterface({ input, output });
  const ttyInput = input as TtyLikeInput;
  const ttyOutput = output as TtyLikeOutput;
  const supportsInteractiveSelection =
    ttyInput.isTTY === true
    && ttyOutput.isTTY === true
    && typeof ttyInput.setRawMode === 'function';
  const supportsColor = ttyOutput.isTTY === true && (ttyOutput.getColorDepth?.() ?? 0) >= 8;
  const allowScreenClears = options.allowScreenClears !== false;

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
          const line = `${pointer} ${marker}${option}`;
          if (index !== cursorIndex || !supportsColor) {
            return line;
          }
          return `${ANSI_ACTIVE_BLUE}${line}${ANSI_RESET}`;
        }),
        supportsColor ? `${ANSI_DIM}${instructionLine}${ANSI_RESET}` : instructionLine,
      ];

      output.write(`${lines.join('\n')}\n`);
      renderedLineCount = lines.length;
    };

    return new Promise<number[]>((resolve, reject) => {
      const cleanup = () => {
        ttyInput.setRawMode?.(false);
        ttyInput.off('keypress', onKeypress);
        ttyInput.pause();
        if (allowScreenClears) {
          output.write(ANSI_CLEAR_SCREEN);
        } else {
          output.write('\n');
        }
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
    clearScreen() {
      if (!supportsInteractiveSelection || !allowScreenClears) {
        return;
      }
      output.write(ANSI_CLEAR_SCREEN);
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

export async function promptForBruteSelection(
  bruteNames: string[],
  prompter: InteractivePrompter,
  runModeChoice: Exclude<InteractiveRunModeChoice, 'all-brutes'>,
): Promise<InteractiveRunSelection> {
  if (bruteNames.length === 0) {
    throw new Error('No available brutes were found for interactive selection.');
  }

  if (runModeChoice === 'one-brute') {
    if (!prompter.chooseOne) {
      prompter.write('Available brutes for single selection:');
      bruteNames.forEach((bruteName, index) => {
        prompter.write(`${index + 1}. ${bruteName}`);
      });
    }

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

  while (true) {
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

export async function promptForRunSelection(
  bruteNames: string[],
  prompter: InteractivePrompter,
): Promise<InteractiveRunSelection> {
  if (bruteNames.length === 0) {
    throw new Error('No available brutes were found for interactive selection.');
  }

  const runModeChoice = await promptForRunModeChoice(prompter);

  if (runModeChoice === 'all-brutes') {
    return {
      executionMode: 'all-brutes',
      bruteNames: [...bruteNames],
    };
  }

  return promptForBruteSelection(bruteNames, prompter, runModeChoice);
}
