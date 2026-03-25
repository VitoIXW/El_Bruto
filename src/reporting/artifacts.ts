import fs from 'node:fs';
import path from 'node:path';

import type { Page } from 'playwright';

import type { Logger } from './logger';
import type { FailureArtifacts } from '../types/run-types';

function artifactStamp(label: string): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${label}`;
}

export async function captureFailureArtifacts(page: Page, artifactsDir: string, label: string): Promise<FailureArtifacts> {
  fs.mkdirSync(artifactsDir, { recursive: true });

  const baseName = artifactStamp(label);
  const screenshotPath = path.join(artifactsDir, `${baseName}.png`);
  const htmlPath = path.join(artifactsDir, `${baseName}.html`);

  await page.screenshot({ path: screenshotPath, fullPage: true });
  fs.writeFileSync(htmlPath, await page.content(), 'utf8');

  return { screenshotPath, htmlPath };
}

export async function captureFailureArtifactsSafely(
  page: Page,
  artifactsDir: string,
  label: string,
  logger: Logger,
): Promise<FailureArtifacts | undefined> {
  try {
    return await captureFailureArtifacts(page, artifactsDir, label);
  } catch (error) {
    logger.error(`Failed to capture ${label} artifacts: ${error instanceof Error ? error.stack : String(error)}`);
    return undefined;
  }
}
