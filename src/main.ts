import { parseCliArgs } from './cli';
import { buildConfig } from './config';
import { launchPersistentSession } from './browser/session';
import { accountRunHasFailure } from './game/roster';
import { createLogger } from './reporting/logger';
import { formatAccountSummary, formatSummary } from './reporting/summary';
import { runAllBrutes } from './game/account-runner';
import { runBrute } from './game/brute-runner';

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const config = buildConfig(options);
  const logger = createLogger(config.logsDir, config.debug);
  logger.info(`Launching persistent browser in ${config.executionMode} mode for ${config.targetUrl}`);

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
