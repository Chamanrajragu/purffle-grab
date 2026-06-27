// main.js — Electron entry. Boots the embedded server and opens the app window.
import { app, BrowserWindow, shell, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Resolve where the bundled binaries, user data and downloads live.
const binDir = app.isPackaged ? path.join(process.resourcesPath, 'bin') : path.join(ROOT, 'bin');
process.env.PURFFLE_BIN = binDir;

const dataDir = path.join(app.getPath('userData'), 'data');
let downloadsDir;
try { downloadsDir = path.join(app.getPath('music'), 'PurffleGrab'); }
catch { downloadsDir = path.join(app.getPath('downloads'), 'PurffleGrab'); }
fs.mkdirSync(downloadsDir, { recursive: true });

let win;
let serverPort = 7777;

async function boot() {
  const { port } = await startServer({
    publicDir: path.join(ROOT, 'public'),
    dataDir,
    downloadsDir,
    port: 7799, // fixed app port (kept distinct from the dev server's 7777)
  });
  serverPort = port;
  createWindow();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: '#0b0a12',
    title: 'PurffleGrab',
    icon: path.join(ROOT, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  Menu.setApplicationMenu(null);
  win.loadURL(`http://localhost:${serverPort}`);

  // Open external links (e.g. http links) in the user's real browser, not the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(boot);
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}
