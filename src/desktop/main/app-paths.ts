import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

export interface DesktopAppPaths {
  userDataDir: string;
  profileDir: string;
  logsDir: string;
  artifactsDir: string;
  accountsFile: string;
  preferencesFile: string;
}

export function resolveDesktopAppPaths(): DesktopAppPaths {
  const userDataDir = app.getPath('userData');
  const paths: DesktopAppPaths = {
    userDataDir,
    profileDir: path.join(userDataDir, 'playwright-profile'),
    logsDir: path.join(userDataDir, 'logs'),
    artifactsDir: path.join(userDataDir, 'artifacts'),
    accountsFile: path.join(userDataDir, 'accounts.secure.json'),
    preferencesFile: path.join(userDataDir, 'preferences.json'),
  };

  fs.mkdirSync(paths.userDataDir, { recursive: true });
  fs.mkdirSync(paths.logsDir, { recursive: true });
  fs.mkdirSync(paths.artifactsDir, { recursive: true });

  return paths;
}

