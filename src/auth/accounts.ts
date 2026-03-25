import fs from 'node:fs';
import path from 'node:path';

import type { LoginCredentials, SavedAccount } from '../types/run-types';
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

export function findSavedAccount(label: string, baseDir = process.cwd()): SavedAccount | undefined {
  const normalizedLabel = normalizeText(label);
  if (!normalizedLabel) {
    return undefined;
  }

  return loadSavedAccounts(baseDir).find((account) => account.label === normalizedLabel);
}

export function resolveSavedAccountCredentials(
  baseDir = process.cwd(),
  preferredLabel?: string,
): LoginCredentials | undefined {
  const accounts = loadSavedAccounts(baseDir);
  if (accounts.length === 0) {
    return undefined;
  }

  if (preferredLabel) {
    const matchedAccount = findSavedAccount(preferredLabel, baseDir);
    if (!matchedAccount) {
      throw new Error(`Saved account "${preferredLabel}" was not found in ${ACCOUNTS_FILE_NAME}.`);
    }

    return {
      username: matchedAccount.username,
      password: matchedAccount.password,
      source: 'saved-account',
    };
  }

  if (accounts.length === 1) {
    return {
      username: accounts[0].username,
      password: accounts[0].password,
      source: 'saved-account',
    };
  }

  throw new Error(
    `Multiple saved accounts were found in ${ACCOUNTS_FILE_NAME}. Use --account <label> or set ET_USERNAME and ET_PASSWORD explicitly.`,
  );
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
