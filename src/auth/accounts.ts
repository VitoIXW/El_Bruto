import fs from 'node:fs';
import path from 'node:path';

import type { SavedAccount } from '../types/run-types';
import { normalizeText } from '../game/selectors';

const ACCOUNTS_FILE_NAME = '.accounts.local.json';

interface StoredAccountsFile {
  accounts?: Array<Partial<SavedAccount>>;
}

function sanitizeAccount(account: Partial<SavedAccount>): SavedAccount | undefined {
  const label = normalizeText(account.label);
  const username = normalizeText(account.username);
  const password = normalizeText(account.password);

  if (!label || !username || !password) {
    return undefined;
  }

  return { label, username, password };
}

function readAccountsFile(filePath: string): StoredAccountsFile | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as StoredAccountsFile;
}

export function resolveAccountsFilePath(baseDir = process.cwd()): string {
  return path.resolve(baseDir, ACCOUNTS_FILE_NAME);
}

export function loadSavedAccounts(baseDir = process.cwd()): SavedAccount[] {
  const filePath = resolveAccountsFilePath(baseDir);
  const storedAccounts = readAccountsFile(filePath)?.accounts ?? [];

  return storedAccounts
    .map(sanitizeAccount)
    .filter((account): account is SavedAccount => Boolean(account));
}

export function saveAccount(account: SavedAccount, baseDir = process.cwd()): SavedAccount[] {
  const normalizedAccount = sanitizeAccount(account);
  if (!normalizedAccount) {
    throw new Error('Saved accounts require label, username, and password.');
  }

  const existingAccounts = loadSavedAccounts(baseDir).filter(
    (storedAccount) => storedAccount.label !== normalizedAccount.label,
  );
  const nextAccounts = [...existingAccounts, normalizedAccount].sort((left, right) =>
    left.label.localeCompare(right.label),
  );

  fs.writeFileSync(
    resolveAccountsFilePath(baseDir),
    JSON.stringify({ accounts: nextAccounts }, null, 2),
    'utf8',
  );

  return nextAccounts;
}
