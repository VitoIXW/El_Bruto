import path from 'node:path';

import type { CliOptions, RunConfig } from './types/run-types';
import { buildCellUrl, normalizeText } from './game/selectors';

const DEFAULT_URL = 'https://brute.eternaltwin.org/';
const DEFAULT_LOGIN_TIMEOUT_MS = 180000;
const DEFAULT_STEP_TIMEOUT_MS = 15000;
const DEFAULT_MAX_ACTION_RETRIES = 2;

export function buildBootstrapUrl(targetUrl: string): string {
  const parsed = new URL(targetUrl);
  return `${parsed.origin}/`;
}

function resolveTargetBruteName(options: CliOptions): string | undefined {
  const bruteName = normalizeText(options.brute);
  return bruteName || undefined;
}

function resolveAccountLabel(options: CliOptions): string | undefined {
  const accountLabel = normalizeText(options.account);
  return accountLabel || undefined;
}

export function buildConfig(options: CliOptions): RunConfig {
  const bootstrapUrl = buildBootstrapUrl(options.url || DEFAULT_URL);
  const siteOrigin = new URL(bootstrapUrl).origin;
  const targetBruteName = resolveTargetBruteName(options);
  const accountLabel = resolveAccountLabel(options);

  if (options.runStyle === 'automatic' && options.mode === 'single' && !targetBruteName) {
    throw new Error('Automatic single mode requires --brute <name>.');
  }

  const targetUrl = targetBruteName
    ? buildCellUrl(siteOrigin, targetBruteName)
    : bootstrapUrl;

  return {
    targetUrl,
    targetBruteName,
    accountLabel,
    bootstrapUrl,
    executionMode: options.mode,
    profileDir: path.resolve(options.profileDir ?? 'playwright-profile'),
    artifactsDir: path.resolve(options.artifactsDir ?? 'artifacts'),
    logsDir: path.resolve(options.logsDir ?? 'logs'),
    headless: options.headless,
    debug: options.debug,
    preClickDelay: options.preClickDelay,
    loginTimeoutMs: options.loginTimeoutMs ?? DEFAULT_LOGIN_TIMEOUT_MS,
    stepTimeoutMs: DEFAULT_STEP_TIMEOUT_MS,
    maxActionRetries: DEFAULT_MAX_ACTION_RETRIES,
  };
}
