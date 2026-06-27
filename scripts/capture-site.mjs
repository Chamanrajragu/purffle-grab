import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1240, height: 900, show: true, backgroundColor: '#0b0a12' });
  await win.loadURL('http://localhost:7780/');
  await wait(2000);
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, '..', 'docs', '_preview-site.png'), img.toPNG());
  console.log('captured');
  app.quit();
}).catch((e) => { console.error(e); app.quit(); });
