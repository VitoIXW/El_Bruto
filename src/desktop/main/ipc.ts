import { ipcMain } from 'electron';

import type {
  DesktopAccountUpdateRequest,
  DesktopLoginRequest,
  DesktopRunOptions,
} from '../shared/contracts';
import type { DesktopRuntimeController } from './controller';

export function registerDesktopIpc(controller: DesktopRuntimeController): void {
  ipcMain.handle('accounts:list', async () => controller.listAccounts());
  ipcMain.handle('accounts:update', async (_event, request: DesktopAccountUpdateRequest) =>
    controller.updateAccount(request.previousLabel, request.form));
  ipcMain.handle('accounts:delete', async (_event, label: string) => controller.deleteAccount(label));
  ipcMain.handle('auth:login', async (_event, request: DesktopLoginRequest) => controller.login(request));
  ipcMain.handle('run:start', async (_event, options: DesktopRunOptions) => controller.startRun(options));
  ipcMain.handle('run:cancel', async () => controller.cancelRun());
  ipcMain.handle('run:continue-after-level-up', async () => controller.continueAfterLevelUp());
  ipcMain.handle('run:status', async () => controller.getSnapshot());
  ipcMain.handle('preferences:load', async () => controller.loadPreferences());
  ipcMain.handle('preferences:save', async (_event, preferences) => controller.savePreferences(preferences));
  ipcMain.handle('logs:open-folder', async () => controller.openLogsFolder());
  ipcMain.handle('artifacts:open-folder', async () => controller.openArtifactsFolder());
}

