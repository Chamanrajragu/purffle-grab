// media.js — wrappers around the bundled yt-dlp.exe and ffmpeg.exe binaries.

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In the packaged app, Electron sets PURFFLE_BIN to the resources/bin folder.
// In dev, fall back to the sibling ../bin directory.
// Resolved lazily (at call time, not module-load time) so it always reflects the
// value Electron sets just before launching — ESM imports are hoisted and would
// otherwise read this before main.js runs.
const binDir = () => process.env.PURFFLE_BIN || path.resolve(__dirname, '..', 'bin');
export const YTDLP = () => path.join(binDir(), 'yt-dlp.exe');
export const FFMPEG = () => path.join(binDir(), 'ffmpeg.exe');
export const FFPROBE = () => path.join(binDir(), 'ffprobe.exe');

/**
 * Run a binary, streaming stdout lines to onLine. Resolves with full stdout.
 * `control` (optional) is an object the caller can use to cancel: the spawned
 * child is stored on control.current so it can be killed.
 */
export function run(bin, args, { onLine, control } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    if (control) control.current = child;
    let stdout = '';
    let stderr = '';
    let buf = '';

    const handle = (chunk) => {
      buf += chunk.toString();
      let idx;
      while ((idx = buf.search(/[\r\n]/)) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line.trim() && onLine) onLine(line.trim());
      }
    };

    child.stdout.on('data', (d) => { stdout += d.toString(); handle(d); });
    child.stderr.on('data', (d) => { stderr += d.toString(); handle(d); });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (control) control.current = null;
      if (buf.trim() && onLine) onLine(buf.trim());
      if (signal || (control && control.cancelled)) {
        const e = new Error('Cancelled');
        e.cancelled = true;
        return reject(e);
      }
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || stdout.trim() || `Process exited with code ${code}`));
    });
  });
}

const COMMON = () => ['--no-warnings', '--ignore-config', '--ffmpeg-location', binDir()];

/** Get metadata for a single YouTube (or other yt-dlp supported) URL. */
export async function probeYoutube(url) {
  const args = [...COMMON(), '--no-playlist', '-J', url];
  const { stdout } = await run(YTDLP(), args);
  const info = JSON.parse(stdout);

  const heights = new Set();
  for (const f of info.formats || []) {
    if (f.vcodec && f.vcodec !== 'none' && f.height) heights.add(f.height);
  }
  const subs = Object.keys(info.subtitles || {});
  const autoSubs = Object.keys(info.automatic_captions || {});

  return {
    id: info.id,
    title: info.title,
    uploader: info.uploader || info.channel || '',
    duration: info.duration || 0,
    thumbnail: info.thumbnail || '',
    isPlaylist: false,
    heights: [...heights].sort((a, b) => b - a),
    subtitles: subs,
    autoSubtitles: autoSubs,
    webpage_url: info.webpage_url || url,
  };
}

/** Detect whether a URL is a playlist; return entry count + list. */
export async function probeYoutubePlaylist(url) {
  const args = [...COMMON(), '--yes-playlist', '--flat-playlist', '-J', url];
  const { stdout } = await run(YTDLP(), args);
  const info = JSON.parse(stdout);
  if (info._type === 'playlist' && Array.isArray(info.entries)) {
    return {
      isPlaylist: true,
      title: info.title || 'YouTube Playlist',
      count: info.entries.length,
      thumbnail: info.thumbnails?.[0]?.url || '',
      entries: info.entries.map((e) => ({
        id: e.id,
        title: e.title || e.id,
        url: e.url || `https://www.youtube.com/watch?v=${e.id}`,
        duration: e.duration || 0,
      })),
      webpage_url: url,
    };
  }
  return { isPlaylist: false };
}

/** Search YouTube by keyword; returns up to n flat results. */
export async function searchYoutube(query, n = 20) {
  const args = [...COMMON(), '--flat-playlist', '-J', `ytsearch${n}:${query}`];
  const { stdout } = await run(YTDLP(), args);
  const info = JSON.parse(stdout);
  const entries = info.entries || [];
  return entries.map((e) => ({
    id: e.id,
    title: e.title || e.id,
    url: e.url || `https://www.youtube.com/watch?v=${e.id}`,
    uploader: e.uploader || e.channel || '',
    duration: e.duration || 0,
    thumbnail: e.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
  }));
}

/** Update the bundled yt-dlp binary in place. */
export async function updateYtdlp(onLine) {
  return run(YTDLP(), ['-U'], { onLine });
}

export function sanitize(name) {
  return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 150);
}

function hhmmss(t) {
  // accepts "1:23", "83", "01:02:03" -> seconds string for yt-dlp sections
  if (t == null || t === '') return '';
  if (/^\d+(\.\d+)?$/.test(String(t))) return String(t);
  return String(t);
}

/** Build yt-dlp args for a download from the options object. */
function buildDownloadArgs(url, outTemplate, opts) {
  const args = [...COMMON(), '--newline', '--no-playlist', '-o', outTemplate];

  if (opts.contentType === 'audio') {
    const q = opts.audioBitrate ? `${opts.audioBitrate}K` : '0';
    args.push('-f', 'bestaudio/best', '-x', '--audio-format', opts.audioFormat || 'mp3', '--audio-quality', q);
    if (opts.normalize)
      args.push('--postprocessor-args', 'FFmpegExtractAudio:-af loudnorm=I=-16:LRA=11:TP=-1.5');
  } else {
    const cap = opts.resolution && opts.resolution !== 'best' ? `[height<=${opts.resolution}]` : '';
    args.push(
      '-f',
      `bv*${cap}[vcodec^=avc1]+ba[acodec^=mp4a]/bv*${cap}[ext=mp4]+ba[ext=m4a]/bv*${cap}+ba/b${cap}/bv*+ba/b`
    );
    args.push('--merge-output-format', 'mp4');
  }

  if (opts.embedThumbnail) args.push('--embed-thumbnail');
  if (opts.embedMetadata !== false) args.push('--embed-metadata');
  if (opts.saveThumbnail) args.push('--write-thumbnail');
  if (opts.embedChapters) args.push('--embed-chapters');

  // Subtitles (YouTube)
  if (opts.subtitles?.enabled) {
    const langs = opts.subtitles.langs || 'en';
    args.push('--sub-langs', langs);
    args.push('--write-subs');
    if (opts.subtitles.auto) args.push('--write-auto-subs');
    if (opts.contentType !== 'audio' && opts.subtitles.embed) args.push('--embed-subs');
    args.push('--convert-subs', 'srt');
  }

  // SponsorBlock — strip sponsor/self-promo segments
  if (opts.sponsorblock) args.push('--sponsorblock-remove', 'sponsor,selfpromo,interaction,intro,outro');

  // Clip / trim a time range
  if (opts.clip && (opts.clip.start || opts.clip.end)) {
    const s = hhmmss(opts.clip.start) || '0';
    const e = hhmmss(opts.clip.end) || 'inf';
    args.push('--download-sections', `*${s}-${e}`, '--force-keyframes-at-cuts');
  }

  args.push(url);
  return args;
}

function parseProgress(line) {
  const pct = line.match(/\[download\]\s+([\d.]+)%/);
  if (!pct) return null;
  const speed = line.match(/at\s+([\d.]+\s*[KMG]?i?B\/s)/);
  const eta = line.match(/ETA\s+([\d:]+)/);
  return { pct: parseFloat(pct[1]), speed: speed?.[1] || '', eta: eta?.[1] || '' };
}

/**
 * Download a single yt-dlp URL into destDir.
 * onProgress(pct:number|null, info:{speed,eta})
 * Returns array of produced file paths.
 */
export async function downloadYoutube(url, destDir, opts, onProgress, control) {
  fs.mkdirSync(destDir, { recursive: true });
  const outTemplate = path.join(destDir, '%(title)s.%(ext)s');
  const args = buildDownloadArgs(url, outTemplate, opts);

  const before = new Set(fs.readdirSync(destDir));
  await run(YTDLP(), args, {
    control,
    onLine: (line) => {
      const p = parseProgress(line);
      if (p && onProgress) onProgress(p.pct, { speed: p.speed, eta: p.eta });
    },
  });

  const after = fs.readdirSync(destDir);
  return after.filter((f) => !before.has(f)).map((f) => path.join(destDir, f));
}

/**
 * Download one Spotify track by searching YouTube for the best audio match,
 * then writing clean ID3 tags + cover art from the Spotify metadata.
 */
export async function downloadSpotifyTrack(track, destDir, opts, onProgress, control) {
  fs.mkdirSync(destDir, { recursive: true });
  const fmt = opts.audioFormat || 'mp3';
  const base = sanitize(`${track.artist} - ${track.title}`) || sanitize(track.title) || 'track';
  const query = `${track.artist} ${track.title}`.trim();
  const q = opts.audioBitrate ? `${opts.audioBitrate}K` : '0';

  const tmpTemplate = path.join(destDir, `${base}.%(ext)s`);
  const args = [
    ...COMMON(), '--newline', '--default-search', 'ytsearch',
    '-f', 'bestaudio/best', '-x', '--audio-format', fmt, '--audio-quality', q,
  ];
  if (opts.normalize) args.push('--postprocessor-args', 'FFmpegExtractAudio:-af loudnorm=I=-16:LRA=11:TP=-1.5');
  args.push('-o', tmpTemplate, `ytsearch1:${query} audio`);

  await run(YTDLP(), args, {
    control,
    onLine: (line) => {
      const p = parseProgress(line);
      if (p && onProgress) onProgress(p.pct, { speed: p.speed, eta: p.eta });
    },
  });

  let audioPath = path.join(destDir, `${base}.${fmt}`);
  if (!fs.existsSync(audioPath)) {
    const found = fs.readdirSync(destDir).find((f) => f.startsWith(base));
    if (!found) throw new Error(`No match found on YouTube for "${query}".`);
    audioPath = path.join(destDir, found);
  }

  // Write clean tags + embed cover art (best-effort).
  const canCover = fmt === 'mp3' || fmt === 'flac' || fmt === 'm4a';
  try {
    let coverPath = null;
    if (track.cover && canCover) {
      const cres = await fetch(track.cover);
      if (cres.ok) {
        coverPath = path.join(destDir, `${base}.cover.jpg`);
        fs.writeFileSync(coverPath, Buffer.from(await cres.arrayBuffer()));
      }
    }
    const taggedPath = path.join(destDir, `${base}.tagged.${fmt}`);
    const ff = ['-y', '-i', audioPath];
    if (coverPath) ff.push('-i', coverPath);
    ff.push('-map', '0:a');
    if (coverPath) ff.push('-map', '1:0', '-disposition:v', 'attached_pic',
      '-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)');
    ff.push('-c', 'copy', '-id3v2_version', '3',
      '-metadata', `title=${track.title}`, '-metadata', `artist=${track.artist}`);
    if (track.album) ff.push('-metadata', `album=${track.album}`);
    ff.push(taggedPath);
    await run(FFMPEG(), ff);
    fs.renameSync(taggedPath, audioPath);
    if (coverPath) fs.unlinkSync(coverPath);
  } catch {
    /* keep plain audio if tagging fails */
  }

  if (onProgress) onProgress(100, { speed: '', eta: '' });
  return audioPath;
}
