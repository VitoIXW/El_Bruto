import fs from 'node:fs';

import type { DesktopPreferences } from '../../types/run-types';

const DEFAULT_PREFERENCES: DesktopPreferences = {
  runMode: 'all-brutes',
  levelUpBehavior: 'skip_brute',
  completionBehavior: 'close_program',
  preClickDelayEnabled: true,
  maxPreClickDelaySeconds: 1.2,
  showDetailedLogs: false,
};

export class DesktopPreferencesStore {
  constructor(private readonly filePath: string) {}

  load(): DesktopPreferences {
    if (!fs.existsSync(this.filePath)) {
      return { ...DEFAULT_PREFERENCES };
    }

    const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<DesktopPreferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...raw,
    };
  }

  save(preferences: DesktopPreferences): DesktopPreferences {
    const merged = {
      ...DEFAULT_PREFERENCES,
      ...preferences,
    };

    fs.writeFileSync(this.filePath, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  }
}

export function createDefaultDesktopPreferences(): DesktopPreferences {
  return { ...DEFAULT_PREFERENCES };
}

