import fs from 'node:fs';

import { saveAccount, loadSavedAccounts } from './auth/accounts';
import { parseCliArgs } from './cli';
import { buildConfig } from './config';
import { authenticateAndDiscoverBrutes, executeRunSelection, managedRunHasFailure } from './core/run-session';
import { launchPersistentSession } from './browser/session';
import { accountRunHasFailure } from './game/roster';
import { createLogger } from './reporting/logger';
import { formatAccountSummary, formatSummary } from './reporting/summary';
import { registerGracefulShutdown } from './shutdown';
import { runAllBrutes } from './game/account-runner';
import { runBrute } from './game/brute-runner';
import { setPreClickDelayEnabled } from './game/navigation';
import {
  createConsolePrompter,
  promptForAccountSelection,
  promptForBruteSelection,
  promptForInteractiveCompletionBehavior,
  promptForLevelUpBehavior,
  promptForRunModeChoice,
  waitForInteractiveCompletionConfirmation,
  waitForManualLevelUpConfirmation,
  writeInteractiveHeader,
} from './ui/interactive';
import type { RunConfig, RunSummary } from './types/run-types';

async function runInteractiveMode(baseConfig: RunConfig, logger: ReturnType<typeof createLogger>): Promise<void> {
  const prompter = createConsolePrompter(process.stdin, process.stdout, {
    allowScreenClears: !baseConfig.debug,
  });
  try {
    prompter.clearScreen?.();
    writeInteractiveHeader(prompter);
    const savedAccounts = loadSavedAccounts();
    const accountChoice = await promptForAccountSelection(savedAccounts, prompter);
    prompter.clearScreen?.();

    if (accountChoice.accountToSave) {
      saveAccount(accountChoice.accountToSave);
      logger.info(`Saved interactive account ${accountChoice.accountToSave.label} locally.`);
    }

    const interactiveConfig: RunConfig = {
      ...baseConfig,
      targetUrl: baseConfig.bootstrapUrl,
      targetBruteName: undefined,
      loginCredentials: accountChoice.credentials,
    };
    const runModeChoice = await promptForRunModeChoice(prompter);
    const levelUpBehavior = interactiveConfig.headless
      ? 'skip_brute'
      : await promptForLevelUpBehavior(prompter);
    const completionBehavior = interactiveConfig.headless
      ? 'close_program'
      : await promptForInteractiveCompletionBehavior(prompter);
    prompter.clearScreen?.();

    const { context, page } = await launchPersistentSession(interactiveConfig);
    const unregisterShutdown = registerGracefulShutdown(async () => {
      await prompter.close();
      await context.close();
      fs.rmSync(interactiveConfig.profileDir, { recursive: true, force: true });
      logger.warn(`Removed persisted browser profile after interrupt: ${interactiveConfig.profileDir}`);
    }, logger);

    try {
      const { bruteNames } = await authenticateAndDiscoverBrutes(page, interactiveConfig, logger);
      const selection = runModeChoice === 'all-brutes'
        ? {
            executionMode: 'all-brutes' as const,
            bruteNames: [...bruteNames],
          }
        : await promptForBruteSelection(
            bruteNames,
            prompter,
            runModeChoice,
          );
      prompter.clearScreen?.();

      const executionConfig: RunConfig = {
        ...interactiveConfig,
        interactiveLevelUpBehavior: levelUpBehavior,
        interactiveCompletionBehavior: completionBehavior,
        onInteractiveLevelUpReady:
          !interactiveConfig.headless && levelUpBehavior === 'wait_for_manual_resume'
            ? async (bruteName: string) => {
              await waitForManualLevelUpConfirmation(bruteName, prompter);
              return 'continue';
            }
            : undefined,
      };

      const result = await executeRunSelection(page, executionConfig, logger, {
        mode: selection.executionMode === 'all-brutes'
          ? 'all-brutes'
          : selection.bruteNames.length === 1
            ? 'single'
            : 'selected',
        bruteNames: selection.bruteNames,
      });

      if (result.accountSummary) {
        logger.info(formatAccountSummary(result.accountSummary, { color: logger.supportsColor }));
      } else {
        result.summaries.forEach((summary: RunSummary) => {
          logger.info(formatSummary(summary, { color: logger.supportsColor }));
        });
      }
      process.exitCode = managedRunHasFailure(result) ? 1 : 0;

      if (completionBehavior === 'keep_browser_open') {
        await waitForInteractiveCompletionConfirmation(prompter);
      }
    } finally {
      unregisterShutdown();
      await context.close();
    }
  } finally {
    await prompter.close();
  }
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const config = buildConfig(options);
  setPreClickDelayEnabled(config.preClickDelay);
  const logger = createLogger(config.logsDir, config.debug);
  logger.info(`Launching persistent browser in ${config.executionMode} mode for ${config.targetUrl}`);

  if (options.runStyle === 'interactive') {
    await runInteractiveMode(config, logger);
    return;
  }

  const { context, page } = await launchPersistentSession(config);
  const unregisterShutdown = registerGracefulShutdown(async () => {
    await context.close();
    fs.rmSync(config.profileDir, { recursive: true, force: true });
    logger.warn(`Removed persisted browser profile after interrupt: ${config.profileDir}`);
  }, logger);

  try {
    if (config.executionMode === 'all-brutes') {
      const summary = await runAllBrutes(page, config, logger);
      logger.info(formatAccountSummary(summary, { color: logger.supportsColor }));
      process.exitCode = accountRunHasFailure(summary) ? 1 : 0;
      return;
    }

    const summary = await runBrute(page, config, logger);
    logger.info(formatSummary(summary, { color: logger.supportsColor }));
    process.exitCode = summary.errorsOccurred ? 1 : 0;
  } finally {
    unregisterShutdown();
    await context.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
