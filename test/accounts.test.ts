import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadSavedAccounts, resolveAccountsFilePath, saveAccount } from '../src/auth/accounts';

test('loadSavedAccounts returns an empty list when no local account file exists', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'el-bruto-accounts-empty-'));

  try {
    assert.deepEqual(loadSavedAccounts(tempDir), []);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('saveAccount persists local-only saved accounts and replaces matching labels', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'el-bruto-accounts-save-'));

  try {
    saveAccount({
      label: 'Example Account',
      username: 'EXAMPLE_USERNAME',
      password: 'EXAMPLE_PASSWORD',
    }, tempDir);
    saveAccount({
      label: 'Example Account',
      username: 'EXAMPLE_USERNAME_2',
      password: 'EXAMPLE_PASSWORD_2',
    }, tempDir);

    const storedAccounts = loadSavedAccounts(tempDir);
    assert.deepEqual(storedAccounts, [{
      label: 'Example Account',
      username: 'EXAMPLE_USERNAME_2',
      password: 'EXAMPLE_PASSWORD_2',
    }]);

    const rawFile = fs.readFileSync(resolveAccountsFilePath(tempDir), 'utf8');
    assert.match(rawFile, /EXAMPLE_USERNAME_2/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
