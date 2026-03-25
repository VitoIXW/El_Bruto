import { saveAccount, loadSavedAccounts } from './auth/accounts';
import { parseCliArgs } from './cli';
import { buildConfig } from './config';
import { launchPersistentSession } from './browser/session';
import { accountRunHasFailure } from './game/roster';
import { createLogger } from './reporting/logger';
import { formatAccountSummary, formatSummary } from './reporting/summary';
import { runAllBrutes } from './game/account-runner';
import { runBrute } from './game/brute-runner';
import { listHallRosterBrutes } from './game/navigation';
import { bootstrapToAuthenticatedHome } from './game/startup';
import { createConsolePrompter, promptForAccountSelection, promptForRunSelection } from './ui/interactive';
import type { RunConfig, RunSummary } from './types/run-types';

function buildBruteRunConfig(baseConfig: RunConfig, bruteName: string): RunConfig {
  return {
    ...baseConfig,
    executionMode: 'single',
    targetBruteName: bruteName,
    targetUrl: `${baseConfig.bootstrapUrl.replace(/\/$/, '')}/${encodeURIComponent(bruteName)}/cell`,
  };
}

async function runInteractiveMode(baseConfig: RunConfig, logger: ReturnType<typeof createLogger>): Promise<void> {
  const prompter = createConsolePrompter();
  try {
    const savedAccounts = loadSavedAccounts();
    const accountChoice = await promptForAccountSelection(savedAccounts, prompter);

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

    const { context, page } = await launchPersistentSession(interactiveConfig);

    try {
      await bootstrapToAuthenticatedHome(page, interactiveConfig, logger);
      logger.info('Authenticated home detected. Opening /hall to discover account brutes.');
      const bruteNames = await listHallRosterBrutes(page, interactiveConfig.bootstrapUrl, logger);
      const selection = await promptForRunSelection(bruteNames, prompter);

      if (selection.executionMode === 'all-brutes') {
        const summary = await runAllBrutes(page, { ...interactiveConfig, executionMode: 'all-brutes' }, logger);
        logger.info(formatAccountSummary(summary));
        process.exitCode = accountRunHasFailure(summary) ? 1 : 0;
        return;
      }

      const summaries: RunSummary[] = [];
      for (const bruteName of selection.bruteNames) {
        const summary = await runBrute(page, buildBruteRunConfig(interactiveConfig, bruteName), logger);
        summaries.push(summary);
        logger.info(formatSummary(summary));
      }

      process.exitCode = summaries.some((summary) => summary.errorsOccurred) ? 1 : 0;
    } finally {
      await context.close();
    }
  } finally {
    await prompter.close();
  }
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const config = buildConfig(options);
  const logger = createLogger(config.logsDir, config.debug);
  logger.info(`Launching persistent browser in ${config.executionMode} mode for ${config.targetUrl}`);

  if (options.runStyle === 'interactive') {
    await runInteractiveMode(config, logger);
    return;
  }

  const { context, page } = await launchPersistentSession(config);

  try {
    if (config.executionMode === 'all-brutes') {
      const summary = await runAllBrutes(page, config, logger);
      logger.info(formatAccountSummary(summary));
      process.exitCode = accountRunHasFailure(summary) ? 1 : 0;
      return;
    }

    const summary = await runBrute(page, config, logger);
    logger.info(formatSummary(summary));
    process.exitCode = summary.errorsOccurred ? 1 : 0;
  } finally {
    await context.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
