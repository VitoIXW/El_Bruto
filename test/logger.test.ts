import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createLogger } from '../src/reporting/logger';

test('createLogger always writes debug lines to the file while keeping console quieter without --debug', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'el-bruto-logger-'));
  const originalConsoleLog = console.log;
  const consoleLines: string[] = [];
  console.log = (message?: unknown) => {
    consoleLines.push(String(message));
  };

  try {
    const logger = createLogger(tempDir, false);
    logger.debug('debug detail');
    logger.info('info detail');

    const logContent = fs.readFileSync(logger.logFilePath, 'utf8');
    assert.match(logContent, /\[DEBUG\] debug detail/);
    assert.match(logContent, /\[INFO\] info detail/);
    assert.equal(consoleLines.some((line) => line.includes('debug detail')), false);
    assert.equal(consoleLines.some((line) => line.includes('info detail')), true);
    assert.equal(typeof logger.supportsColor, 'boolean');
  } finally {
    console.log = originalConsoleLog;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
