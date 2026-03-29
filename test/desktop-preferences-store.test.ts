import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultDesktopPreferences,
  DesktopPreferencesStore,
} from '../src/desktop/main/preferences-store';

test('DesktopPreferencesStore returns defaults when file does not exist', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brute-desktop-prefs-'));
  const store = new DesktopPreferencesStore(path.join(tempDir, 'preferences.json'));

  assert.deepEqual(store.load(), createDefaultDesktopPreferences());
});

test('DesktopPreferencesStore merges saved values with defaults', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brute-desktop-prefs-'));
  const filePath = path.join(tempDir, 'preferences.json');
  fs.writeFileSync(filePath, JSON.stringify({
    runMode: 'selected',
    showDetailedLogs: true,
  }), 'utf8');

  const store = new DesktopPreferencesStore(filePath);
  const loaded = store.load();

  assert.equal(loaded.runMode, 'selected');
  assert.equal(loaded.showDetailedLogs, true);
  assert.equal(loaded.levelUpBehavior, 'skip_brute');
  assert.equal(loaded.preClickDelayEnabled, true);
});

test('DesktopPreferencesStore persists normalized preferences', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brute-desktop-prefs-'));
  const filePath = path.join(tempDir, 'preferences.json');
  const store = new DesktopPreferencesStore(filePath);

  const saved = store.save({
    ...createDefaultDesktopPreferences(),
    completionBehavior: 'keep_browser_open',
    maxPreClickDelaySeconds: 2.5,
  });

  assert.equal(saved.completionBehavior, 'keep_browser_open');
  assert.equal(saved.maxPreClickDelaySeconds, 2.5);
  assert.deepEqual(store.load(), saved);
});

