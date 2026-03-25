import fs from 'node:fs';
import path from 'node:path';

import type { LoginCredentials } from '../types/run-types';

const CREDENTIALS_FILE_NAME = '.credentials.local.json';

interface StoredCredentials {
  username?: string;
  password?: string;
}

function normalizeCredentialValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseCredentialsFile(filePath: string): StoredCredentials | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as StoredCredentials;
}

export function resolveCredentialsFilePath(baseDir = process.cwd()): string {
  return path.resolve(baseDir, CREDENTIALS_FILE_NAME);
}

export function loadLoginCredentials(baseDir = process.cwd()): LoginCredentials {
  const environmentUsername = normalizeCredentialValue(process.env.ET_USERNAME);
  const environmentPassword = normalizeCredentialValue(process.env.ET_PASSWORD);

  if (environmentUsername && environmentPassword) {
    return {
      username: environmentUsername,
      password: environmentPassword,
      source: 'environment',
    };
  }

  const filePath = resolveCredentialsFilePath(baseDir);
  const fileCredentials = parseCredentialsFile(filePath);
  const fileUsername = normalizeCredentialValue(fileCredentials?.username);
  const filePassword = normalizeCredentialValue(fileCredentials?.password);

  if (fileUsername && filePassword) {
    return {
      username: fileUsername,
      password: filePassword,
      source: 'file',
    };
  }

  throw new Error(
    'Missing local login credentials. Set ET_USERNAME and ET_PASSWORD, or create ' +
      `${CREDENTIALS_FILE_NAME} with {"username":"EXAMPLE_USERNAME","password":"EXAMPLE_PASSWORD"}.`,
  );
}
