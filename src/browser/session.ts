import fs from 'node:fs';

import { chromium, type BrowserContext, type Page } from 'playwright';

import type { RunConfig } from '../types/run-types';

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
}

export async function launchPersistentSession(config: RunConfig): Promise<BrowserSession> {
  fs.mkdirSync(config.profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(config.profileDir, {
    executablePath: config.browserExecutablePath,
    headless: config.headless,
  });

  context.setDefaultTimeout(config.stepTimeoutMs);
  const page = context.pages()[0] ?? (await context.newPage());

  return { context, page };
}
