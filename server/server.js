// server.js — PurffleGrab backend. Exports startServer() so both the standalone
// runner and the Electron main process can launch it.

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { exec, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

import { isSpotifyUrl, getSpotifyData } from './spotify.js';
import {
  probeYoutube, probeYoutubePlaylist, searchYoutube, updateYtdlp,
  downloadYoutube, downloadSpotifyTrack,
} from './media.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startServer(opts = {}) {
  const PUBLIC = opts.publicDir || path.resolve(__dirname, '..', 'public');
  const DATA = opts.dataDir || process.env.PURFFLE_DATA || path.resolve(__dirname, '..', 'data');
  const DEFAULT_DOWNLOADS = opts.downloadsDir || process.env.PURFFLE_DOWNLOADS || path.resolve(__dirname, '..', 'downloads');
  fs.mkdirSync(DATA, { recursive: true });
  fs.mkdirSync(DEFAULT_DOWNLOADS, { recursive: true });

  const SETTINGS_FILE = path.join(DATA, 'settings.json');
  const HISTORY_FILE = path.join(DATA, 'history.json');
  const loadJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
  const saveJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2));

  let settings = loadJson(SETTINGS_FILE, {
    outputDir: DEFAULT_DOWNLOADS,
    theme: 'dark',
    concurrency: 2,
    notify: true,
    defaults: {
      contentType: 'video', resolution: '1080', audioFormat: 'mp3', audioBitrate: '',
      embedThumbnail: true, embedMetadata: true, saveThumbnail: false, normalize: false,
    },
  });
  const downloadsRoot = () => settings.outputDir || DEFAULT_DOWNLOADS;
  let history = loadJson(HISTORY_FILE, []);
  const addHistory = (rec) => { history.unshift(rec); history = history.slice(0, 300); saveJson(HISTORY_FILE, history); };

  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use(express.static(PUBLIC));

  const jobs = new Map();
  const listeners = new Map();
  const emit = (id) => {
    const job = jobs.get(id), set = listeners.get(id);
    if (!job || !set) return;
    const safe = { ...job, control: undefined };
    const payload = `data: ${JSON.stringify(safe)}\n\n`;
    for (const res of set) res.write(payload);
  };
  const setJob = (id, patch) => { const j = jobs.get(id); if (!j) return; Object.assign(j, patch); emit(id); };
  const recomputeOverall = (job) => {
    const n = job.items.length || 1;
    const sum = job.items.reduce((a, it) =>
      a + (['done', 'failed', 'cancelled'].includes(it.status) ? 100 : it.progress), 0);
    job.overall = Math.round(sum / n);
  };

  // ---- analyze ----
  async function analyzeLink(link) {
    if (isSpotifyUrl(link)) {
      const data = await getSpotifyData(link);
      return { url: link, source: 'spotify', kind: data.type, title: data.name, thumbnail: data.cover,
        count: data.tracks.length,
        tracks: data.tracks.map((t) => ({ title: t.title, artist: t.artist, duration: t.duration })),
        capabilities: { audio: true, video: false, subtitles: false } };
    }
    const pl = await probeYoutubePlaylist(link).catch(() => ({ isPlaylist: false }));
    if (pl.isPlaylist && pl.count > 1) {
      return { url: link, source: 'youtube', kind: 'playlist', title: pl.title, thumbnail: pl.thumbnail,
        count: pl.count, tracks: pl.entries.map((e) => ({ title: e.title, artist: '', duration: e.duration })),
        capabilities: { audio: true, video: true, subtitles: true } };
    }
    const info = await probeYoutube(link);
    return { url: link, source: 'youtube', kind: 'video', title: info.title, thumbnail: info.thumbnail,
      uploader: info.uploader, duration: info.duration, count: 1, heights: info.heights,
      subtitles: info.subtitles, autoSubtitles: info.autoSubtitles,
      capabilities: { audio: true, video: true, subtitles: true } };
  }
  app.post('/api/analyze', async (req, res) => {
    const link = String(req.body?.url || '').trim();
    if (!link) return res.status(400).json({ error: 'Please paste a link.' });
    try { res.json(await analyzeLink(link)); }
    catch (err) { res.status(400).json({ error: err.message || 'Could not analyze that link.' }); }
  });

  // ---- search ----
  app.post('/api/search', async (req, res) => {
    const query = String(req.body?.query || '').trim();
    if (!query) return res.status(400).json({ error: 'Enter something to search.' });
    try { res.json({ results: await searchYoutube(query, Math.min(Number(req.body?.count) || 24, 40)) }); }
    catch (err) { res.status(400).json({ error: err.message || 'Search failed.' }); }
  });

  // ---- build task list from sources ----
  async function buildTasks(sources) {
    const tasks = [];
    for (const src of sources) {
      const url = typeof src === 'string' ? src : src.url;
      const selected = (typeof src === 'object' && Array.isArray(src.selected)) ? src.selected : null;
      if (isSpotifyUrl(url)) {
        const data = await getSpotifyData(url);
        data.tracks.forEach((t, i) => {
          if (!selected || selected.includes(i))
            tasks.push({ kind: 'spotify', track: t, label: `${t.artist ? t.artist + ' - ' : ''}${t.title}` });
        });
      } else {
        const pl = await probeYoutubePlaylist(url).catch(() => ({ isPlaylist: false }));
        if (pl.isPlaylist && pl.count > 1) {
          pl.entries.forEach((e, i) => { if (!selected || selected.includes(i)) tasks.push({ kind: 'youtube', url: e.url, label: e.title }); });
        } else {
          const info = await probeYoutube(url).catch(() => null);
          tasks.push({ kind: 'youtube', url, label: info?.title || url });
        }
      }
    }
    return tasks;
  }

  // ---- start download ----
  app.post('/api/download', async (req, res) => {
    const list = Array.isArray(req.body?.sources) ? req.body.sources : [];
    if (!list.length) return res.status(400).json({ error: 'No links to download.' });
    const id = randomUUID().slice(0, 8);
    const folder = path.join(downloadsRoot(), `job-${id}`);
    fs.mkdirSync(folder, { recursive: true });
    const job = { id, status: 'starting', sources: list, folder, folderName: `job-${id}`,
      options: req.body.options || {}, items: [], overall: 0, error: null, title: '',
      speed: '', eta: '', startedAt: Date.now(), control: { cancelled: false, current: null, children: new Set() } };
    jobs.set(id, job);
    res.json({ jobId: id });
    runJob(id).catch((err) => { if (!err.cancelled) setJob(id, { status: 'error', error: err.message || String(err) }); });
  });

  async function runJob(id) {
    const job = jobs.get(id);
    const opts = job.options;
    setJob(id, { status: 'preparing' });
    const tasks = await buildTasks(job.sources);
    if (!tasks.length) { setJob(id, { status: 'error', error: 'Nothing to download.' }); return; }
    job.title = tasks.length === 1 ? tasks[0].label : `${tasks.length} items`;
    job.items = tasks.map((t) => ({ title: t.label, status: 'queued', progress: 0, file: null }));
    setJob(id, { status: 'downloading' });

    const limit = Math.max(1, Math.min(Number(settings.concurrency) || 2, 6));
    const worker = async (task, i) => {
      if (job.control.cancelled) { job.items[i].status = 'cancelled'; return; }
      job.items[i].status = 'downloading'; emit(id);
      const ctrl = { cancelled: false, current: null };
      job.control.children.add(ctrl);
      const onProg = (pct, info) => {
        if (pct != null) { job.items[i].progress = pct; job.speed = info?.speed || ''; job.eta = info?.eta || ''; recomputeOverall(job); emit(id); }
      };
      try {
        if (task.kind === 'spotify') {
          const f = await downloadSpotifyTrack(task.track, job.folder, opts, onProg, ctrl);
          job.items[i].file = path.basename(f);
        } else {
          const files = await downloadYoutube(task.url, job.folder, opts, onProg, ctrl);
          const media = files.find((f) => /\.(mp4|mkv|webm|mp3|m4a|wav|flac|opus)$/i.test(f)) || files[0];
          job.items[i].file = media ? path.basename(media) : null;
        }
        job.items[i].status = 'done'; job.items[i].progress = 100;
      } catch (err) {
        if (err.cancelled || job.control.cancelled) job.items[i].status = 'cancelled';
        else { job.items[i].status = 'failed'; job.items[i].error = err.message; }
      } finally {
        job.control.children.delete(ctrl);
        recomputeOverall(job); emit(id);
      }
    };

    // concurrency pool
    let next = 0;
    const runOne = async () => {
      while (true) {
        if (job.control.cancelled) return;
        const i = next++;
        if (i >= tasks.length) return;
        await worker(tasks[i], i);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, runOne));
    finishJob(id);
  }

  function finishJob(id) {
    const job = jobs.get(id);
    const done = job.items.filter((i) => i.status === 'done').length;
    const status = job.control.cancelled ? 'cancelled' : (done ? 'complete' : 'error');
    recomputeOverall(job);
    setJob(id, { status, speed: '', eta: '' });
    addHistory({ id: job.id, title: job.title, status, when: Date.now(), count: job.items.length, done,
      folder: job.folder, folderName: job.folderName, sources: job.sources, options: job.options,
      files: job.items.filter((i) => i.file).map((i) => i.file) });
  }

  app.post('/api/cancel/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    job.control.cancelled = true;
    for (const c of job.control.children) { c.cancelled = true; try { c.current?.kill(); } catch {} }
    setJob(job.id, { status: 'cancelling' });
    res.json({ ok: true });
  });

  app.get('/api/progress/:id', (req, res) => {
    const { id } = req.params;
    if (!jobs.has(id)) return res.status(404).end();
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders?.();
    if (!listeners.has(id)) listeners.set(id, new Set());
    listeners.get(id).add(res);
    res.write(`data: ${JSON.stringify({ ...jobs.get(id), control: undefined })}\n\n`);
    req.on('close', () => listeners.get(id)?.delete(res));
  });

  const folderFor = (id) => { const j = jobs.get(id); return j ? j.folder : history.find((h) => h.id === id)?.folder; };

  app.get('/api/file/:id/:name', (req, res) => {
    const folder = folderFor(req.params.id);
    if (!folder) return res.status(404).send('Not found');
    const target = path.join(folder, req.params.name);
    if (!target.startsWith(folder) || !fs.existsSync(target)) return res.status(404).send('File not found');
    res.download(target);
  });
  app.get('/api/zip/:id', (req, res) => {
    const folder = folderFor(req.params.id);
    if (!folder || !fs.existsSync(folder)) return res.status(404).send('Not found');
    const j = jobs.get(req.params.id);
    res.attachment(`${(j?.title || 'PurffleGrab').replace(/[^\w\- ]/g, '_')}.zip`);
    const a = archiver('zip', { zlib: { level: 5 } });
    a.on('error', () => res.status(500).end()); a.pipe(res); a.directory(folder, false); a.finalize();
  });
  app.post('/api/open-folder/:id', (req, res) => {
    const folder = folderFor(req.params.id);
    if (!folder) return res.status(404).json({ error: 'Not found' });
    exec(`explorer "${folder}"`); res.json({ ok: true });
  });
  app.post('/api/open-file/:id/:name', (req, res) => {
    const folder = folderFor(req.params.id);
    if (!folder) return res.status(404).json({ error: 'Not found' });
    const target = path.join(folder, req.params.name);
    if (!target.startsWith(folder) || !fs.existsSync(target)) return res.status(404).json({ error: 'Not found' });
    exec(`start "" "${target}"`); res.json({ ok: true });
  });
  app.post('/api/reveal/:id/:name', (req, res) => {
    const folder = folderFor(req.params.id);
    if (!folder) return res.status(404).json({ error: 'Not found' });
    const target = path.join(folder, req.params.name);
    exec(`explorer /select,"${target}"`); res.json({ ok: true });
  });

  app.get('/api/history', (_q, res) => res.json({ history }));
  app.post('/api/history/clear', (_q, res) => { history = []; saveJson(HISTORY_FILE, history); res.json({ ok: true }); });
  app.post('/api/history/delete/:id', (req, res) => { history = history.filter((h) => h.id !== req.params.id); saveJson(HISTORY_FILE, history); res.json({ ok: true }); });

  app.get('/api/settings', (_q, res) => res.json({ settings, defaultDir: DEFAULT_DOWNLOADS }));
  app.post('/api/settings', (req, res) => {
    const n = req.body || {};
    if (typeof n.outputDir === 'string' && n.outputDir.trim()) {
      try { fs.mkdirSync(n.outputDir, { recursive: true }); settings.outputDir = n.outputDir.trim(); }
      catch (e) { return res.status(400).json({ error: 'Could not use that folder: ' + e.message }); }
    }
    if (n.theme) settings.theme = n.theme;
    if (n.concurrency != null) settings.concurrency = Math.max(1, Math.min(Number(n.concurrency) || 2, 6));
    if (n.notify != null) settings.notify = !!n.notify;
    if (n.defaults && typeof n.defaults === 'object') settings.defaults = { ...settings.defaults, ...n.defaults };
    saveJson(SETTINGS_FILE, settings);
    res.json({ ok: true, settings });
  });
  app.post('/api/pick-folder', (_q, res) => {
    const ps = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }`;
    const child = spawn('powershell', ['-NoProfile', '-STA', '-Command', ps], { windowsHide: true });
    let out = ''; child.stdout.on('data', (d) => (out += d.toString()));
    child.on('close', () => res.json({ path: out.trim() || null }));
    child.on('error', () => res.json({ path: null }));
  });
  app.post('/api/update-engine', async (_q, res) => {
    try { const { stdout } = await updateYtdlp(); res.json({ ok: true, output: stdout.trim() }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });

  const PORT = opts.port || process.env.PORT || 7777;
  return new Promise((resolve) => {
    const server = app.listen(PORT, () => resolve({ server, port: PORT, settings, downloadsRoot }));
  });
}
