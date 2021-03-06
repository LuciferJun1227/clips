import { startAutoUpdater } from './auto-updater';
import { storeService } from '../services/electron-store';
import { BrowserWindow } from 'electron';
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib';
import path from 'path';

declare const __static: string;

const appSettings = storeService.getAppSettings();

const storeFlags = appSettings
  ? ((display) =>
      display.type === 'maintain'
        ? {
            width: display.width,
            height: display.height,
            x: display.position.x,
            y: display.position.y,
          }
        : { width: display.width, height: display.height })(
      appSettings.system.display
    )
  : {};

const flags = {
  width: 820,
  height: 410,
  minWidth: 640,
  minHeight: 360,
  webPreferences: {
    // Use pluginOptions.nodeIntegration, leave this alone
    // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
    nodeIntegration: true,
    //  (process.env.ELECTRON_NODE_INTEGRATION as unknown) as boolean,
  },
  frame: false,
  show: true,
  resizable: true,
  skipTaskbar: true,
  icon: path.join(__static, 'icon.png'),
  setSkipTaskbar: true,
};

let win: BrowserWindow | null = null;

function create(): BrowserWindow {
  win = new BrowserWindow({ ...flags, ...storeFlags });
  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    win.loadURL(process.env.WEBPACK_DEV_SERVER_URL as string);
    if (!process.env.IS_TEST) win.webContents.openDevTools();
  } else {
    createProtocol('app');
    // Load the index.html when not in development
    win.loadURL('app://./index.html');
    // Start auto-updater
    startAutoUpdater();
  }
  win.on('closed', () => {
    win = null;
  });
  return win;
}

export const mainWindow = {
  get instance(): BrowserWindow | null {
    return win;
  },
  create,
};
