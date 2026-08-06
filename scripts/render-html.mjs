// Render any local HTML file to a PNG at an exact pixel size.
//   RENDER_HTML=path/in.html RENDER_OUT=path/out.png RENDER_W=1280 RENDER_H=720 \
//   npx electron scripts/render-html.mjs
//
// Uses the DevTools protocol (Emulation.setDeviceMetricsOverride +
// Page.captureScreenshot with captureBeyondViewport) rather than
// webContents.capturePage(). capturePage is bound to the real window, and Windows
// clamps a BrowserWindow to the display size -- so a 1080x1920 portrait frame on a
// 1080p monitor silently comes back as 1080x1080. The CDP path is not display-bound.
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const HTML = process.env.RENDER_HTML;
const OUT  = process.env.RENDER_OUT;
const W    = parseInt(process.env.RENDER_W || '1280', 10);
const H    = parseInt(process.env.RENDER_H || '720', 10);
const WAIT = parseInt(process.env.RENDER_WAIT || '900', 10);

if (!HTML || !OUT) {
  console.error('Set RENDER_HTML and RENDER_OUT (optional: RENDER_W, RENDER_H, RENDER_WAIT)');
  process.exit(2);
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  // Keep the real window small enough to fit any display; the CDP override decides
  // the captured size. The window must be *visible* -- a hidden, non-offscreen window
  // never composites a frame, and Page.captureScreenshot then blocks forever.
  const win = new BrowserWindow({
    width: Math.min(W, 1200),
    height: Math.min(H, 860),
    useContentSize: true,
    show: true,
    frame: false,
    backgroundColor: '#0b0a12',
  });

  await win.loadURL(pathToFileURL(path.resolve(HTML)).toString());
  await new Promise((r) => setTimeout(r, WAIT));

  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });

  let wrote = false;
  try {
    const dbg = win.webContents.debugger;
    dbg.attach('1.3');
    await dbg.sendCommand('Page.enable');
    await dbg.sendCommand('Emulation.setDeviceMetricsOverride', {
      width: W,
      height: H,
      deviceScaleFactor: 1,
      mobile: false,
    });
    // let layout settle at the emulated size
    await new Promise((r) => setTimeout(r, 500));
    // Never let a stuck compositor hang the build -- fall back instead.
    const shot = await Promise.race([
      dbg.sendCommand('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: W, height: H, scale: 1 },
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('captureScreenshot timed out after 25s')), 25000)),
    ]);
    fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
    wrote = true;
    console.log(`rendered ${HTML} -> ${OUT} (${W}x${H} via CDP)`);
    dbg.detach();
  } catch (e) {
    console.error('CDP capture failed, falling back to capturePage:', e.message);
  }

  if (!wrote) {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(OUT, img.toPNG());
    const { width, height } = img.getSize();
    console.log(`rendered ${HTML} -> ${OUT} (${width}x${height} via capturePage)`);
  }

  app.quit();
}).catch((e) => { console.error('FATAL', e); app.quit(); });
