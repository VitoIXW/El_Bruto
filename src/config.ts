import path from 'node:path';

import type { CliOptions, RunConfig } from './types/run-types';

const DEFAULT_URL = 'https://brute.eternaltwin.org/ExampleBrute/cell';
const DEFAULT_LOGIN_TIMEOUT_MS = 180000;
const DEFAULT_STEP_TIMEOUT_MS = 15000;
const DEFAULT_MAX_ACTION_RETRIES = 2;

export function buildBootstrapUrl(targetUrl: string): string {
  const parsed = new URL(targetUrl);
  return `${parsed.origin}/`;
}

export function buildConfig(options: CliOptions): RunConfig {
  const targetUrl = options.url || DEFAULT_URL;
  return {
    targetUrl,
    bootstrapUrl: buildBootstrapUrl(targetUrl),
    profileDir: path.resolve(options.profileDir ?? 'playwright-profile'),
    artifactsDir: path.resolve(options.artifactsDir ?? 'artifacts'),
    logsDir: path.resolve(options.logsDir ?? 'logs'),
    headless: false,
    debug: options.debug,
    loginTimeoutMs: options.loginTimeoutMs ?? DEFAULT_LOGIN_TIMEOUT_MS,
    stepTimeoutMs: DEFAULT_STEP_TIMEOUT_MS,
    maxActionRetries: DEFAULT_MAX_ACTION_RETRIES,
  };
}
