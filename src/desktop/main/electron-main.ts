import path from 'node:path';

import { app, BrowserWindow, dialog } from 'electron';

import { resolveDesktopAppPaths } from './app-paths';
import { DesktopRuntimeController } from './controller';
import { registerDesktopIpc } from './ipc';

let mainWindow: BrowserWindow | undefined;
let controller: DesktopRuntimeController | undefined;
let isQuitting = false;

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    title: 'El Bruto Control',
    backgroundColor: '#1f1408',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (!controller) {
    controller = new DesktopRuntimeController(resolveDesktopAppPaths());
    registerDesktopIpc(controller);
  }
  controller.attachWindow(window);

  await window.loadFile(path.join(__dirname, '../renderer/index.html'));
  window.webContents.once('did-finish-load', () => {
    controller?.attachWindow(window);
  });

  window.on('close', async (event) => {
    if (isQuitting || !controller) {
      return;
    }

    const snapshot = controller.getSnapshot();
    if (snapshot.run.isRunning || snapshot.run.isPaused) {
      event.preventDefault();
      const response = await dialog.showMessageBox(window, {
        type: 'question',
        buttons: ['Cerrar y detener', 'Cancelar'],
        defaultId: 1,
        cancelId: 1,
        title: 'Cerrar El Bruto Control',
        message: 'Hay una ejecución en curso.',
        detail: 'Si cierras la app ahora se detendrá la ejecución y se cerrará Chromium correctamente.',
      });
      if (response.response !== 0) {
        return;
      }
    }

    event.preventDefault();
    isQuitting = true;
    await controller.shutdown(true);
    window.destroy();
  });

  mainWindow = window;
}

app.whenReady().then(async () => {
  await createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  if (isQuitting) {
    return;
  }

  event.preventDefault();
  isQuitting = true;
  await controller?.shutdown(true);
  app.exit(0);
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow();
  } else {
    mainWindow?.focus();
  }
});
