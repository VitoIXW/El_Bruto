import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopApi } from '../shared/contracts';
import type { DesktopPreferences, RunEvent } from '../../types/run-types';

const api: DesktopApi = {
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    update: (request) => ipcRenderer.invoke('accounts:update', request),
    delete: (label) => ipcRenderer.invoke('accounts:delete', label),
  },
  auth: {
    login: (request) => ipcRenderer.invoke('auth:login', request),
  },
  run: {
    start: (options) => ipcRenderer.invoke('run:start', options),
    cancel: () => ipcRenderer.invoke('run:cancel'),
    continueAfterLevelUp: () => ipcRenderer.invoke('run:continue-after-level-up'),
    status: () => ipcRenderer.invoke('run:status'),
  },
  preferences: {
    load: () => ipcRenderer.invoke('preferences:load') as Promise<DesktopPreferences>,
    save: (preferences) => ipcRenderer.invoke('preferences:save', preferences) as Promise<DesktopPreferences>,
  },
  system: {
    openLogsFolder: () => ipcRenderer.invoke('logs:open-folder'),
    openArtifactsFolder: () => ipcRenderer.invoke('artifacts:open-folder'),
  },
  onRunEvent(listener) {
    const handler = (_event: Electron.IpcRendererEvent, runEvent: RunEvent<unknown>) => {
      listener(runEvent);
    };
    ipcRenderer.on('run:event', handler);
    return () => {
      ipcRenderer.removeListener('run:event', handler);
    };
  },
};

contextBridge.exposeInMainWorld('bruteControlApi', api);

