import { parseCliArgs } from './cli';
import { buildConfig } from './config';
import { launchPersistentSession } from './browser/session';
import { createLogger } from './reporting/logger';
import { formatSummary } from './reporting/summary';
import { runBrute } from './game/brute-runner';

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const config = buildConfig(options);
  const logger = createLogger(config.logsDir, config.debug);
  logger.info(`Launching persistent browser for ${config.targetUrl}`);

  const { context, page } = await launchPersistentSession(config);

  try {
    const summary = await runBrute(page, config, logger);
    const summaryText = formatSummary(summary);
    logger.info(summaryText);

    process.exitCode = summary.errorsOccurred ? 1 : 0;
  } finally {
    await context.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
