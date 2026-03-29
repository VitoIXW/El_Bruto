import type { CliOptions } from './types/run-types';

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    runStyle: argv.length === 0 ? 'interactive' : 'automatic',
    mode: 'single',
    debug: false,
    headless: false,
    preClickDelay: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case '--interactive':
      case '--manual':
        options.runStyle = 'interactive';
        break;
      case '--url':
        if (!next) {
          throw new Error('Missing value for --url');
        }
        options.url = next;
        index += 1;
        break;
      case '--brute':
        if (!next) {
          throw new Error('Missing value for --brute');
        }
        options.brute = next;
        index += 1;
        break;
      case '--account':
        if (!next) {
          throw new Error('Missing value for --account');
        }
        options.account = next;
        index += 1;
        break;
      case '--debug':
        options.debug = true;
        break;
      case '--headless':
        options.headless = true;
        break;
      case '--no-pre-click-delay':
        options.preClickDelay = false;
        break;
      case '--mode':
        if (!next) {
          throw new Error('Missing value for --mode');
        }
        if (next !== 'single' && next !== 'all-brutes') {
          throw new Error('Invalid value for --mode. Expected "single" or "all-brutes".');
        }
        options.mode = next;
        index += 1;
        break;
      case '--profile-dir':
        if (!next) {
          throw new Error('Missing value for --profile-dir');
        }
        options.profileDir = next;
        index += 1;
        break;
      case '--artifacts-dir':
        if (!next) {
          throw new Error('Missing value for --artifacts-dir');
        }
        options.artifactsDir = next;
        index += 1;
        break;
      case '--logs-dir':
        if (!next) {
          throw new Error('Missing value for --logs-dir');
        }
        options.logsDir = next;
        index += 1;
        break;
      case '--login-timeout-ms':
        if (!next) {
          throw new Error('Missing value for --login-timeout-ms');
        }
        options.loginTimeoutMs = Number.parseInt(next, 10);
        if (Number.isNaN(options.loginTimeoutMs)) {
          throw new Error('Invalid numeric value for --login-timeout-ms');
        }
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}
