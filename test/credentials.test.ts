import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadLoginCredentials, resolveCredentialsFilePath } from '../src/auth/credentials';

test('loadLoginCredentials prefers environment credentials', () => {
  const originalUsername = process.env.ET_USERNAME;
  const originalPassword = process.env.ET_PASSWORD;
  process.env.ET_USERNAME = 'EXAMPLE_USERNAME';
  process.env.ET_PASSWORD = 'EXAMPLE_PASSWORD';

  try {
    const credentials = loadLoginCredentials();
    assert.equal(credentials.username, 'EXAMPLE_USERNAME');
    assert.equal(credentials.password, 'EXAMPLE_PASSWORD');
    assert.equal(credentials.source, 'environment');
  } finally {
    process.env.ET_USERNAME = originalUsername;
    process.env.ET_PASSWORD = originalPassword;
  }
});

test('loadLoginCredentials falls back to the gitignored local file', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'el-bruto-creds-'));
  const filePath = resolveCredentialsFilePath(tempDir);
  const originalUsername = process.env.ET_USERNAME;
  const originalPassword = process.env.ET_PASSWORD;
  delete process.env.ET_USERNAME;
  delete process.env.ET_PASSWORD;
  fs.writeFileSync(
    filePath,
    JSON.stringify({ username: 'EXAMPLE_USERNAME', password: 'EXAMPLE_PASSWORD' }),
    'utf8',
  );

  try {
    const credentials = loadLoginCredentials(tempDir);
    assert.equal(credentials.username, 'EXAMPLE_USERNAME');
    assert.equal(credentials.password, 'EXAMPLE_PASSWORD');
    assert.equal(credentials.source, 'file');
  } finally {
    process.env.ET_USERNAME = originalUsername;
    process.env.ET_PASSWORD = originalPassword;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('loadLoginCredentials throws a clear error when no local credentials are available', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'el-bruto-creds-missing-'));
  const originalUsername = process.env.ET_USERNAME;
  const originalPassword = process.env.ET_PASSWORD;
  delete process.env.ET_USERNAME;
  delete process.env.ET_PASSWORD;

  try {
    assert.throws(
      () => loadLoginCredentials(tempDir),
      /Missing local login credentials/,
    );
  } finally {
    process.env.ET_USERNAME = originalUsername;
    process.env.ET_PASSWORD = originalPassword;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
