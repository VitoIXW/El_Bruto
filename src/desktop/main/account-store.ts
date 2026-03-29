import crypto from 'node:crypto';
import fs from 'node:fs';

import { app, safeStorage } from 'electron';

import type { AccountDescriptor, SavedAccount } from '../../types/run-types';
import { normalizeText } from '../../game/selectors';

interface StoredAccountRecord {
  label: string;
  username: string;
  secret: string;
  encryption: 'safeStorage' | 'fallback-aes-256-gcm';
  iv?: string;
  tag?: string;
}

interface StoredAccountsFile {
  accounts: StoredAccountRecord[];
}

function sanitizeLabel(value: string): string {
  return normalizeText(value);
}

function sanitizeUsername(value: string): string {
  return normalizeText(value);
}

function createFallbackKey(): Buffer {
  const seed = `${app.getName()}::${app.getPath('userData')}::${process.env.USERNAME ?? process.env.USER ?? 'user'}`;
  return crypto.scryptSync(seed, 'el-bruto-control', 32);
}

function encryptSecret(plaintext: string): Pick<StoredAccountRecord, 'secret' | 'encryption' | 'iv' | 'tag'> {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      secret: safeStorage.encryptString(plaintext).toString('base64'),
      encryption: 'safeStorage',
    };
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', createFallbackKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    secret: encrypted.toString('base64'),
    encryption: 'fallback-aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decryptSecret(record: StoredAccountRecord): string {
  if (record.encryption === 'safeStorage') {
    return safeStorage.decryptString(Buffer.from(record.secret, 'base64'));
  }

  if (!record.iv || !record.tag) {
    throw new Error(`Stored account "${record.label}" is missing fallback encryption metadata.`);
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    createFallbackKey(),
    Buffer.from(record.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(record.secret, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function sanitizeAccount(account: SavedAccount): SavedAccount {
  const label = sanitizeLabel(account.label);
  const username = sanitizeUsername(account.username);
  const password = normalizeText(account.password);
  if (!label || !username || !password) {
    throw new Error('Saved accounts require label, username, and password.');
  }

  return { label, username, password };
}

export class DesktopAccountStore {
  constructor(private readonly filePath: string) {}

  list(): AccountDescriptor[] {
    return this.readFile()
      .accounts
      .map((account) => ({
        label: account.label,
        username: account.username,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  load(label: string): SavedAccount | undefined {
    const normalizedLabel = sanitizeLabel(label);
    if (!normalizedLabel) {
      return undefined;
    }

    const record = this.readFile().accounts.find((account) => account.label === normalizedLabel);
    if (!record) {
      return undefined;
    }

    return {
      label: record.label,
      username: record.username,
      password: decryptSecret(record),
    };
  }

  save(account: SavedAccount): AccountDescriptor[] {
    const normalized = sanitizeAccount(account);
    const file = this.readFile();
    const nextAccounts = file.accounts.filter((stored) => stored.label !== normalized.label);
    nextAccounts.push({
      label: normalized.label,
      username: normalized.username,
      ...encryptSecret(normalized.password),
    });
    this.writeFile({ accounts: nextAccounts });
    return this.list();
  }

  update(previousLabel: string, account: SavedAccount): AccountDescriptor[] {
    const file = this.readFile();
    const normalizedPreviousLabel = sanitizeLabel(previousLabel);
    const exists = file.accounts.some((stored) => stored.label === normalizedPreviousLabel);
    if (!exists) {
      throw new Error(`Saved account "${previousLabel}" was not found.`);
    }

    this.delete(previousLabel);
    return this.save(account);
  }

  delete(label: string): AccountDescriptor[] {
    const normalizedLabel = sanitizeLabel(label);
    const file = this.readFile();
    const nextAccounts = file.accounts.filter((stored) => stored.label !== normalizedLabel);
    this.writeFile({ accounts: nextAccounts });
    return this.list();
  }

  private readFile(): StoredAccountsFile {
    if (!fs.existsSync(this.filePath)) {
      return { accounts: [] };
    }

    return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as StoredAccountsFile;
  }

  private writeFile(file: StoredAccountsFile): void {
    fs.writeFileSync(this.filePath, JSON.stringify(file, null, 2), 'utf8');
  }
}

