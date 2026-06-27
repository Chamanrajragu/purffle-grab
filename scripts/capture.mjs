// Captures real UI screenshots for the README using Electron's offscreen renderer.
// Run with:  npx electron scripts/capture.mjs
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
process.env.PURFFLE_BIN = path.join(ROOT, 'bin');

const OUT = path.join(ROOT, 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const { port } = await startServer({
    publicDir: path.join(ROOT, 'public'),
    dataDir: path.join(ROOT, '.cap-data'),
    downloadsDir: path.join(ROOT, '.cap-dl'),
    port: 7812,
  });

  const win = new BrowserWindow({ width: 1240, height: 860, show: true, backgroundColor: '#0b0a12' });
  win.setMenuBarVisibility(false);
  await win.loadURL(`http://localhost:${port}`);
  await wait(1600);

  const shoot = async (name) => { const img = await win.webContents.capturePage(); fs.writeFileSync(path.join(OUT, name), img.toPNG()); console.log('saved', name); };

  await shoot('01-home-dark.png');

  // analyze a Spotify playlist to show the track picker + options
  await win.webContents.executeJavaScript(`document.querySelector('#urlInput').value='https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'; document.querySelector('#analyzeBtn').click(); true;`);
  await wait(7000);
  await win.webContents.executeJavaScript(`window.scrollTo(0, 280); true;`);
  await wait(600);
  await shoot('02-options-dark.png');

  // switch to light theme
  await win.webContents.executeJavaScript(`document.querySelector('#themeToggle').click(); window.scrollTo(0, 0); true;`);
  await wait(900);
  await shoot('03-options-light.png');

  // search view (light)
  await win.webContents.executeJavaScript(`document.querySelector('.side-btn[data-view="search"]').click(); document.querySelector('#searchInput').value='lofi hip hop'; document.querySelector('#searchBtn').click(); true;`);
  await wait(6000);
  await shoot('04-search-light.png');

  app.quit();
}).catch((e) => { console.error(e); app.quit(); });
