// Capture the animated PurffleGrab demo frame-by-frame at 1920x1080 / 30fps.
//
//   TIMELINE=<path/timeline.json> FRAMES_OUT=<dir> npx electron scripts/capture-motion.mjs
//
// Every frame is produced by __demo.frame(sceneId, t, dur) -- a pure function of time --
// so capture can run far slower than real time and still yield perfectly even motion.
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
process.env.PURFFLE_BIN = path.join(ROOT, 'bin');

const TIMELINE = process.env.TIMELINE;
const OUT = process.env.FRAMES_OUT;
const ONLY = process.env.ONLY_SCENE || '';          // optional: capture one scene
const JPEG_Q = parseInt(process.env.JPEG_Q || '92', 10);

if (!TIMELINE || !OUT) {
  console.error('Set TIMELINE and FRAMES_OUT');
  process.exit(2);
}

const timeline = JSON.parse(fs.readFileSync(TIMELINE, 'utf-8'));
const FPS = timeline.fps;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const { port } = await startServer({
    publicDir: path.join(ROOT, 'public'),
    dataDir: path.join(ROOT, '.cap-data'),
    downloadsDir: path.join(ROOT, '.cap-dl'),
    port: 7814,
  });

  const win = new BrowserWindow({
    width: 1920, height: 1080,
    useContentSize: true,
    show: true, frame: false, autoHideMenuBar: true,
    backgroundColor: '#0b0a12',
  });
  win.setMenuBarVisibility(false);
  await win.loadURL('http://localhost:' + port);
  await wait(1600);

  // Inject the animation driver and prove it initialised.
  const anim = fs.readFileSync(path.join(__dirname, 'demo-anim.js'), 'utf-8');
  await win.webContents.executeJavaScript(anim + '\n;true;');
  const ok = await win.webContents.executeJavaScript('__demo.init()');
  if (ok !== true) throw new Error('__demo.init() did not return true');

  // Confirm the capture surface really is 1920x1080 before spending minutes on it.
  const probe = await win.webContents.capturePage();
  const size = probe.getSize();
  console.log(`capture surface: ${size.width}x${size.height}`);
  if (size.width !== 1920 || size.height !== 1080) {
    throw new Error(`expected a 1920x1080 surface, got ${size.width}x${size.height}`);
  }

  const scenes = timeline.scenes.filter((s) => !ONLY || s.id === ONLY);
  const total = scenes.reduce((a, s) => a + s.frames, 0);
  let written = 0;
  const t0 = Date.now();

  for (const scene of scenes) {
    const dir = path.join(OUT, scene.id);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));

    await win.webContents.executeJavaScript('__demo.newScene()');

    for (let i = 0; i < scene.frames; i++) {
      const t = i / FPS;
      await win.webContents.executeJavaScript(
        `__demo.frame(${JSON.stringify(scene.id)},${t.toFixed(4)},${scene.duration})`
      );
      const img = await win.webContents.capturePage();
      fs.writeFileSync(
        path.join(dir, 'f' + String(i).padStart(5, '0') + '.jpg'),
        img.toJPEG(JPEG_Q)
      );
      written++;
      if (written % 60 === 0 || i === scene.frames - 1) {
        const el = (Date.now() - t0) / 1000;
        const rate = written / el;
        const eta = (total - written) / Math.max(rate, 0.01);
        console.log(
          `[${String(written).padStart(4)}/${total}] ${scene.id} ` +
          `frame ${i + 1}/${scene.frames}  ${rate.toFixed(1)} fps  eta ${eta.toFixed(0)}s`
        );
      }
    }
    console.log(`scene done: ${scene.id} (${scene.frames} frames)`);
  }

  console.log(`ALL DONE — ${written} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${OUT}`);
  app.quit();
}).catch((e) => { console.error('FATAL', e); app.exit(1); });
