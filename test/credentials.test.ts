import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveAccountsFilePath } from '../src/auth/accounts';
import { loadLoginCredentials } from '../src/auth/credentials';

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

test('loadLoginCredentials uses the only saved account when accounts file exists', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'el-bruto-creds-account-single-'));
  const accountsFilePath = resolveAccountsFilePath(tempDir);
  const originalUsername = process.env.ET_USERNAME;
  const originalPassword = process.env.ET_PASSWORD;
  delete process.env.ET_USERNAME;
  delete process.env.ET_PASSWORD;
  fs.writeFileSync(
    accountsFilePath,
    JSON.stringify({
      accounts: [{
        label: 'Example Account',
        username: 'EXAMPLE_USERNAME',
        password: 'EXAMPLE_PASSWORD',
      }],
    }),
    'utf8',
  );

  try {
    const credentials = loadLoginCredentials(tempDir);
    assert.equal(credentials.username, 'EXAMPLE_USERNAME');
    assert.equal(credentials.password, 'EXAMPLE_PASSWORD');
    assert.equal(credentials.source, 'saved-account');
  } finally {
    process.env.ET_USERNAME = originalUsername;
    process.env.ET_PASSWORD = originalPassword;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('loadLoginCredentials selects a saved account explicitly by label', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'el-bruto-creds-account-select-'));
  const accountsFilePath = resolveAccountsFilePath(tempDir);
  const originalUsername = process.env.ET_USERNAME;
  const originalPassword = process.env.ET_PASSWORD;
  delete process.env.ET_USERNAME;
  delete process.env.ET_PASSWORD;
  fs.writeFileSync(
    accountsFilePath,
    JSON.stringify({
      accounts: [
        { label: 'Example One', username: 'EXAMPLE_USERNAME_1', password: 'EXAMPLE_PASSWORD_1' },
        { label: 'Example Two', username: 'EXAMPLE_USERNAME_2', password: 'EXAMPLE_PASSWORD_2' },
      ],
    }),
    'utf8',
  );

  try {
    const credentials = loadLoginCredentials(tempDir, 'Example Two');
    assert.equal(credentials.username, 'EXAMPLE_USERNAME_2');
    assert.equal(credentials.password, 'EXAMPLE_PASSWORD_2');
    assert.equal(credentials.source, 'saved-account');
  } finally {
    process.env.ET_USERNAME = originalUsername;
    process.env.ET_PASSWORD = originalPassword;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('loadLoginCredentials throws clearly when multiple saved accounts exist without an explicit choice', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'el-bruto-creds-account-multi-'));
  const accountsFilePath = resolveAccountsFilePath(tempDir);
  const originalUsername = process.env.ET_USERNAME;
  const originalPassword = process.env.ET_PASSWORD;
  delete process.env.ET_USERNAME;
  delete process.env.ET_PASSWORD;
  fs.writeFileSync(
    accountsFilePath,
    JSON.stringify({
      accounts: [
        { label: 'Example One', username: 'EXAMPLE_USERNAME_1', password: 'EXAMPLE_PASSWORD_1' },
        { label: 'Example Two', username: 'EXAMPLE_USERNAME_2', password: 'EXAMPLE_PASSWORD_2' },
      ],
    }),
    'utf8',
  );

  try {
    assert.throws(
      () => loadLoginCredentials(tempDir),
      /Multiple saved accounts were found/,
    );
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
