import type { LoginCredentials } from '../types/run-types';
import { resolveSavedAccountCredentials } from './accounts';

function normalizeCredentialValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function loadLoginCredentials(baseDir = process.cwd(), preferredAccountLabel?: string): LoginCredentials {
  const environmentUsername = normalizeCredentialValue(process.env.ET_USERNAME);
  const environmentPassword = normalizeCredentialValue(process.env.ET_PASSWORD);

  if (environmentUsername && environmentPassword) {
    return {
      username: environmentUsername,
      password: environmentPassword,
      source: 'environment',
    };
  }

  const savedAccountCredentials = resolveSavedAccountCredentials(baseDir, preferredAccountLabel);
  if (savedAccountCredentials) {
    return savedAccountCredentials;
  }

  throw new Error(
    'Missing local login credentials. Set ET_USERNAME and ET_PASSWORD or create .accounts.local.json.',
  );
}
