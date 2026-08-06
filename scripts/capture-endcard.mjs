// Render endcard.html at 1920x1080 and save as PNG.
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const HTML  = process.env.ENDCARD_HTML;
const OUT   = process.env.ENDCARD_OUT;
if (!HTML || !OUT) { console.error('Set ENDCARD_HTML and ENDCARD_OUT'); process.exit(2); }

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1920, height: 1080,
    useContentSize: true,
    show: true, frame: false, autoHideMenuBar: true,
    backgroundColor: '#0b0a12',
  });
  await win.loadURL(pathToFileURL(path.resolve(HTML)).toString());
  await new Promise(r => setTimeout(r, 900));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(OUT, img.toPNG());
  console.log('endcard saved to', OUT);
  app.quit();
});
