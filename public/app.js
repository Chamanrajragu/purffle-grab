// PurffleGrab front-end (v3.0) — premium edition.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let sources = [];
let activeJobId = null;
let activeES = null;
let searchSel = new Set();
let searchResults = [];
let downloadQueue = [];
let scheduledDownloads = [];
let prefs = { defaults: {}, theme: 'dark', notify: true, concurrency: 2, accentColor: '#8b5cf6' };
let downloadStartTime = null;

// ---- helpers ----
function setBtnLoading(btn, loading) { if (!btn) return; btn.disabled = loading; const l = btn.querySelector('.btn-label'); if (l) l.style.opacity = loading ? 0 : 1; const s = btn.querySelector('.spinner'); if (s) s.hidden = !loading; }
function fmtDur(s) { if (!s) return ''; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const x = Math.round(s % 60); if (h) return `${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`; return `${m}:${String(x).padStart(2, '0')}`; }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 3000); }
function showErr(sel, m) { const e = $(sel); e.textContent = m; e.hidden = false; }
function fmtBytes(b) { if (!b) return '0 B'; const u = ['B','KB','MB','GB','TB']; let i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return b.toFixed(i ? 1 : 0) + ' ' + u[i]; }
function fmtTime(sec) { if (!sec || sec < 0) return ''; sec = Math.round(sec); const m = Math.floor(sec / 60); const s = sec % 60; return m ? `${m}m ${s}s` : `${s}s`; }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function animateValue(el, start, end, dur) {
  const range = end - start;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / dur, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + range * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ---- nav ----
$$('.side-btn').forEach((b) => b.addEventListener('click', () => {
  $$('.side-btn').forEach((x) => x.classList.toggle('active', x === b));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${b.dataset.view}`));
  if (b.dataset.view === 'history') loadHistory();
  if (b.dataset.view === 'settings') loadSettings();
  if (b.dataset.view === 'stats') loadStats();
  if (b.dataset.view === 'queue') renderQueue();
  if (b.dataset.view === 'scheduler') renderSchedule();
}));
function goto(view) {
  $$('.side-btn').forEach((x) => x.classList.toggle('active', x.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
}

// ---- theme ----
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  prefs.theme = theme;
  const tog = $('#themeToggle');
  if (tog) { tog.querySelector('.tt-ic').textContent = theme === 'dark' ? '🌙' : '☀️'; tog.querySelector('.tt-label').textContent = theme === 'dark' ? 'Dark' : 'Light'; }
  try { localStorage.setItem('pg-theme', theme); } catch {}
}
$('#themeToggle').addEventListener('click', () => {
  const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: next }) });
});
try { const t = localStorage.getItem('pg-theme'); if (t) applyTheme(t); } catch {}

// ---- accent color ----
function applyAccent(color) {
  document.documentElement.style.setProperty('--brand', color);
  prefs.accentColor = color;
  $$('.swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
  try { localStorage.setItem('pg-accent', color); } catch {}
}
$$('.swatch').forEach(s => s.addEventListener('click', () => applyAccent(s.dataset.color)));
try { const c = localStorage.getItem('pg-accent'); if (c) applyAccent(c); } catch {}

// ---- keyboard shortcuts ----
$('#kbShortcuts').addEventListener('click', () => { $('#shortcutsModal').hidden = false; });
$$('[data-close]').forEach(b => b.addEventListener('click', () => { b.closest('.modal').hidden = true; }));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    $$('.modal').forEach(m => m.hidden = true);
    $('#tourOverlay').hidden = true;
    return;
  }
  const tag = e.target.tagName;
  const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    const active = $('.view.active');
    if (active?.id === 'view-download') { if (!$('#panel').hidden) $('#downloadBtn').click(); else $('#analyzeBtn').click(); }
    else if (active?.id === 'view-search') $('#searchBtn').click();
  }
  if (e.ctrlKey && e.key === 'd') { e.preventDefault(); $('#themeToggle').click(); }
  if (e.ctrlKey && e.key === 'q') { e.preventDefault(); goto('queue'); }
  if (e.ctrlKey && e.key === 's' && !isInput) { e.preventDefault(); goto('settings'); }
  if (e.ctrlKey && e.key === 'f' && !isInput) { e.preventDefault(); goto('search'); setTimeout(() => $('#searchInput').focus(), 100); }
  if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    const views = ['download','search','queue','history','stats','converter','scheduler','settings','about'];
    const idx = parseInt(e.key) - 1;
    if (views[idx]) goto(views[idx]);
  }
  if (e.key === '?' && !isInput) { e.preventDefault(); $('#shortcutsModal').hidden = false; }
});

// Close modal on background click
$$('.modal').forEach(m => m.addEventListener('click', (e) => { if (e.target === m) m.hidden = true; }));

// ---- onboarding tour ----
const TOUR_STEPS = [
  { title: 'Welcome to PurffleGrab! 🎉', desc: 'The cleanest way to download media from Spotify and YouTube. Let us show you around!' },
  { title: 'Paste & Download ⬇', desc: 'Just paste a Spotify or YouTube link in the box and hit Analyze. You can paste multiple links at once or import from a file!' },
  { title: 'Search YouTube 🔎', desc: 'No link? Use the Search tab to find videos and music directly by name. Select results and download them.' },
  { title: 'Queue System 📋', desc: 'Add items to the queue and download them all at once. Great for batch downloading!' },
  { title: 'Scheduler ⏰', desc: 'New! Schedule downloads for later. Set a date and time, and PurffleGrab will grab it automatically.' },
  { title: 'You\'re all set! ✅', desc: 'Explore Stats, Converter, and Settings for more power. Hit ? anytime for keyboard shortcuts.' },
];
let tourStep = 0;
function showTour() {
  try { if (localStorage.getItem('pg-toured-v3')) return; } catch {}
  tourStep = 0;
  renderTourStep();
  // Hide any modals first so tour is clearly on top
  $$('.modal').forEach(m => m.hidden = true);
  $('#tourOverlay').hidden = false;
}
function renderTourStep() {
  const s = TOUR_STEPS[tourStep];
  $('#tourTitle').textContent = s.title;
  $('#tourDesc').textContent = s.desc;
  $('#tourStepNum').textContent = tourStep + 1;
  $('#tourStepTotal').textContent = TOUR_STEPS.length;
  $('#tourNext').textContent = tourStep === TOUR_STEPS.length - 1 ? 'Get started!' : 'Next →';
}
$('#tourNext').addEventListener('click', () => {
  tourStep++;
  if (tourStep >= TOUR_STEPS.length) { $('#tourOverlay').hidden = true; try { localStorage.setItem('pg-toured-v3', '1'); } catch {} return; }
  renderTourStep();
});
$('#tourSkip').addEventListener('click', () => { $('#tourOverlay').hidden = true; try { localStorage.setItem('pg-toured-v3', '1'); } catch {} });
// Prevent clicks inside tour card from bubbling to overlay
$('#tourCard').addEventListener('click', (e) => e.stopPropagation());
// Click overlay background to dismiss tour
$('#tourOverlay').addEventListener('click', () => { $('#tourOverlay').hidden = true; try { localStorage.setItem('pg-toured-v3', '1'); } catch {} });

// ---- download: input helpers ----
const urlInput = $('#urlInput');
urlInput.addEventListener('input', () => { urlInput.style.height = 'auto'; urlInput.style.height = Math.min(urlInput.scrollHeight, 180) + 'px'; });
$('#clearBtn').addEventListener('click', () => { urlInput.value = ''; urlInput.style.height = 'auto'; urlInput.focus(); });
$('#pasteBtn').addEventListener('click', async () => {
  try { const t = await navigator.clipboard.readText(); if (t) { urlInput.value = (urlInput.value ? urlInput.value + '\n' : '') + t.trim(); urlInput.dispatchEvent(new Event('input')); toast('📋 Pasted from clipboard'); } }
  catch { toast('Clipboard not available — paste with Ctrl+V.'); }
});

// ---- import from file ----
$('#importBtn').addEventListener('click', () => $('#fileImport').click());
$('#fileImport').addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    const urls = text.match(/https?:\/\/\S+/g) || [];
    if (urls.length) {
      urlInput.value = (urlInput.value ? urlInput.value + '\n' : '') + urls.join('\n');
      urlInput.dispatchEvent(new Event('input'));
      toast(`📄 Imported ${urls.length} link${urls.length > 1 ? 's' : ''}`);
    } else { toast('No URLs found in that file.'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// drag & drop links anywhere
const dz = $('#dropzone');
['dragenter', 'dragover'].forEach((e) => document.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.add('drag'); }));
['dragleave', 'drop'].forEach((e) => document.addEventListener(e, (ev) => { ev.preventDefault(); if (e !== 'drop' && ev.relatedTarget) return; dz.classList.remove('drag'); }));
document.addEventListener('drop', (ev) => {
  const txt = ev.dataTransfer?.getData('text') || '';
  const urls = txt.match(/https?:\/\/\S+/g);
  if (urls) { urlInput.value = (urlInput.value ? urlInput.value + '\n' : '') + urls.join('\n'); urlInput.dispatchEvent(new Event('input')); goto('download'); toast(`Dropped ${urls.length} link${urls.length > 1 ? 's' : ''}`); }
  const files = ev.dataTransfer?.files;
  if (files?.length) {
    for (const file of files) {
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = () => {
          const u = reader.result.match(/https?:\/\/\S+/g) || [];
          if (u.length) { urlInput.value = (urlInput.value ? urlInput.value + '\n' : '') + u.join('\n'); urlInput.dispatchEvent(new Event('input')); toast(`📄 Imported ${u.length} links from ${file.name}`); }
        };
        reader.readAsText(file);
      }
    }
  }
});

// ---- analyze ----
async function analyze() {
  const links = urlInput.value.split('\n').map((s) => s.trim()).filter(Boolean);
  $('#analyzeError').hidden = true;
  if (!links.length) { showErr('#analyzeError', 'Please paste at least one link.'); return; }
  setBtnLoading($('#analyzeBtn'), true);
  $('#panel').hidden = true; $('#progress').hidden = true;
  sources = []; $('#sourceCards').innerHTML = '';
  let anyVideo = false, ok = 0;
  for (const link of links) {
    try {
      const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: link }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      const idx = sources.length;
      sources.push({ data, selected: data.count > 1 ? new Set(data.tracks.map((_, i) => i)) : null });
      renderSourceCard(idx);
      if (data.capabilities?.video) anyVideo = true; ok++;
    } catch (err) {
      const div = document.createElement('div'); div.className = 'source-card err';
      div.innerHTML = `<div class="sc-body"><b>Couldn't read</b><br><span class="meta-sub">${esc(link)}</span><br><span class="error-inline">${esc(err.message || 'failed')}</span></div>`;
      $('#sourceCards').appendChild(div);
    }
  }
  setBtnLoading($('#analyzeBtn'), false);
  if (!ok) return;
  $('#typeGroup').hidden = !anyVideo;
  setContentType(anyVideo ? (prefs.defaults?.contentType || 'video') : 'audio');
  applyDefaultsToForm(); updateDlCount();
  $('#panel').hidden = false;
  $('#panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderSourceCard(idx) {
  const { data, selected } = sources[idx];
  const card = document.createElement('div'); card.className = 'source-card'; card.dataset.idx = idx;
  const badge = data.source === 'spotify' ? '<span class="badge spotify">♫ Spotify</span>' : '<span class="badge youtube">▶ YouTube</span>';
  const sub = data.kind === 'video' ? [data.uploader, fmtDur(data.duration)].filter(Boolean).join(' · ') : `${data.count} ${data.count === 1 ? 'track' : 'tracks'}`;
  let tracksHtml = '';
  if (data.count > 1) {
    tracksHtml = `<div class="track-tools"><button class="mini" data-act="all">Select all</button><button class="mini" data-act="none">None</button><input type="text" class="track-search" placeholder="Filter tracks…" /><span class="sel-info"></span></div>
      <ul class="track-list">${data.tracks.map((t, i) => `<li><label class="trk" data-search="${esc((t.artist + ' ' + t.title).toLowerCase())}"><input type="checkbox" data-ti="${i}" ${selected.has(i) ? 'checked' : ''}/><span class="trk-n">${i + 1}.</span><span class="trk-t">${esc(t.artist ? t.artist + ' — ' : '')}${esc(t.title)}</span><span class="trk-d">${fmtDur(t.duration)}</span></label></li>`).join('')}</ul>`;
  }
  card.innerHTML = `<div class="sc-top"><img class="sc-thumb" src="${data.thumbnail || ''}" alt="${esc(data.title || '')}" onerror="this.style.visibility='hidden'" loading="lazy"/><div class="sc-body">${badge}<h4 class="sc-title">${esc(data.title || 'Untitled')}</h4><p class="meta-sub">${esc(sub)}</p></div><button class="sc-remove" title="Remove">✕</button></div>${tracksHtml}`;
  card.querySelector('.sc-remove').addEventListener('click', () => { sources[idx] = null; card.remove(); updateDlCount(); if (!sources.some(Boolean)) $('#panel').hidden = true; });
  card.querySelectorAll('input[data-ti]').forEach((cb) => cb.addEventListener('change', () => { const i = Number(cb.dataset.ti); cb.checked ? selected.add(i) : selected.delete(i); updateSelInfo(card, selected, data.count); updateDlCount(); }));
  card.querySelectorAll('.mini').forEach((btn) => btn.addEventListener('click', () => {
    if (btn.dataset.act === 'all') data.tracks.forEach((_, i) => selected.add(i)); else selected.clear();
    card.querySelectorAll('input[data-ti]').forEach((cb) => (cb.checked = selected.has(Number(cb.dataset.ti))));
    updateSelInfo(card, selected, data.count); updateDlCount();
  }));
  const trackSearch = card.querySelector('.track-search');
  if (trackSearch) {
    trackSearch.addEventListener('input', debounce(() => {
      const q = trackSearch.value.toLowerCase().trim();
      card.querySelectorAll('.trk').forEach(trk => {
        const match = !q || (trk.dataset.search || '').includes(q);
        trk.classList.toggle('hidden', !match);
      });
    }, 200));
  }
  $('#sourceCards').appendChild(card);
  if (data.count > 1) updateSelInfo(card, selected, data.count);
}
function updateSelInfo(card, selected, total) { const el = card.querySelector('.sel-info'); if (el) el.textContent = `${selected.size}/${total} selected`; }

// ---- content type + presets ----
function setContentType(type) {
  $$('#contentTypeSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
  const v = type === 'video';
  $('#resGroup').hidden = !v; $('#audioGroup').hidden = v; $('#bitrateGroup').hidden = v;
}
$$('#contentTypeSeg .seg-btn').forEach((b) => b.addEventListener('click', () => { setContentType(b.dataset.type); clearPreset(); }));
function clearPreset() { $$('.preset').forEach((p) => p.classList.remove('active')); }
const PRESETS = {
  video4k: { type: 'video', resolution: '2160' },
  video1080: { type: 'video', resolution: '1080' },
  mp3hq: { type: 'audio', audioFormat: 'mp3', audioBitrate: '320' },
  phone: { type: 'video', resolution: '720' },
  flac: { type: 'audio', audioFormat: 'flac', audioBitrate: '' },
  podcast: { type: 'audio', audioFormat: 'mp3', audioBitrate: '128' },
  ringtone: { type: 'audio', audioFormat: 'm4a', audioBitrate: '256' },
  audiobook: { type: 'audio', audioFormat: 'mp3', audioBitrate: '64' },
};
$$('.preset').forEach((p) => p.addEventListener('click', () => {
  const c = PRESETS[p.dataset.preset]; if (!c) return;
  clearPreset(); p.classList.add('active');
  setContentType(c.type);
  if (c.resolution) $('#resolution').value = c.resolution;
  if (c.audioFormat) $('#audioFormat').value = c.audioFormat;
  if (c.audioBitrate !== undefined) $('#audioBitrate').value = c.audioBitrate;
}));

function updateDlCount() { let n = 0; for (const s of sources) { if (!s) continue; n += s.selected ? s.selected.size : 1; } $('#dlCount').textContent = n > 1 ? `(${n} items)` : ''; }

function gatherOptions() {
  const type = $('#contentTypeSeg .seg-btn.active')?.dataset.type || 'video';
  return { contentType: type, resolution: $('#resolution').value, audioFormat: $('#audioFormat').value, audioBitrate: $('#audioBitrate').value,
    embedThumbnail: $('#embedThumb').checked, embedMetadata: $('#embedMeta').checked, saveThumbnail: $('#saveThumb').checked,
    embedChapters: $('#embedChapters').checked, sponsorblock: $('#sponsorblock').checked, normalize: $('#normalize').checked,
    splitChapters: $('#splitChapters')?.checked || false,
    speedLimit: $('#speedLimit')?.value?.trim() || '',
    filenameTemplate: $('#filenameTemplate')?.value?.trim() || '',
    subtitles: { enabled: $('#subsEnabled').checked, langs: $('#subsLangs').value || 'en', auto: $('#subsAuto').checked, embed: $('#subsEmbed').checked },
    clip: { start: $('#clipStart').value.trim(), end: $('#clipEnd').value.trim() } };
}
function gatherSources() { return sources.filter(Boolean).map((s) => ({ url: s.data.url, selected: s.selected ? [...s.selected] : null })); }

// ---- queue system ----
function addToQueue(srcList, options) {
  const items = srcList.map(s => ({ id: Date.now() + Math.random().toString(36).slice(2,6), source: s, options, status: 'queued', addedAt: Date.now() }));
  downloadQueue.push(...items);
  saveQueue();
  renderQueue();
  updateQueueBadge();
  toast(`📋 Added ${items.length} item${items.length > 1 ? 's' : ''} to queue`);
}
function saveQueue() { try { localStorage.setItem('pg-queue', JSON.stringify(downloadQueue)); } catch {} }
function loadQueue() { try { downloadQueue = JSON.parse(localStorage.getItem('pg-queue') || '[]'); } catch { downloadQueue = []; } updateQueueBadge(); }
function updateQueueBadge() {
  const badge = $('#queueBadge');
  const count = downloadQueue.filter(q => q.status === 'queued').length;
  badge.textContent = count;
  badge.hidden = count === 0;
}
function renderQueue() {
  const list = $('#queueList');
  const toolbar = { start: $('#queueStartAll'), pause: $('#queuePauseAll'), clear: $('#queueClearAll'), stats: $('#queueStats') };
  if (!downloadQueue.length) {
    list.innerHTML = '<p class="hint center">Queue is empty. Add items from Download or Search.</p>';
    toolbar.start.disabled = toolbar.pause.disabled = toolbar.clear.disabled = true;
    toolbar.stats.textContent = '';
    return;
  }
  const queued = downloadQueue.filter(q => q.status === 'queued').length;
  toolbar.start.disabled = queued === 0;
  toolbar.clear.disabled = false;
  toolbar.stats.textContent = `${queued} queued · ${downloadQueue.length} total`;

  list.innerHTML = downloadQueue.map((q, i) => `
    <div class="queue-item" data-qi="${i}">
      <span class="qi-handle">⋮⋮</span>
      <div class="qi-info">
        <div class="qi-title">${esc(q.source.url)}</div>
        <div class="qi-meta">${q.options?.contentType || 'video'} · ${q.status} · ${new Date(q.addedAt).toLocaleTimeString()}</div>
      </div>
      <span class="st ${q.status}">${q.status}</span>
      <div class="qi-actions">
        ${q.status === 'queued' ? `<button class="mini" data-qact="start">▶</button>` : ''}
        <button class="mini danger" data-qact="remove">✕</button>
      </div>
    </div>`).join('');

  $$('.queue-item').forEach(el => {
    const i = Number(el.dataset.qi);
    el.querySelector('[data-qact="remove"]')?.addEventListener('click', () => { downloadQueue.splice(i, 1); saveQueue(); renderQueue(); updateQueueBadge(); });
    el.querySelector('[data-qact="start"]')?.addEventListener('click', () => {
      const q = downloadQueue[i];
      q.status = 'downloading';
      saveQueue(); renderQueue(); updateQueueBadge();
      startDownload([q.source], q.options);
    });
  });
}
$('#queueStartAll')?.addEventListener('click', () => {
  const queued = downloadQueue.filter(q => q.status === 'queued');
  if (!queued.length) return;
  const srcList = queued.map(q => q.source);
  const opts = queued[0].options;
  queued.forEach(q => q.status = 'downloading');
  saveQueue(); renderQueue(); updateQueueBadge();
  startDownload(srcList, opts);
});
$('#queueClearAll')?.addEventListener('click', () => { downloadQueue = []; saveQueue(); renderQueue(); updateQueueBadge(); toast('Queue cleared'); });

async function startDownload(srcList, options) {
  const opts = options || gatherOptions();
  const list = srcList || gatherSources();
  if (!list.length) { toast('Nothing selected.'); return; }

  if ($('#addToQueue')?.checked && !options) {
    addToQueue(list, opts);
    return;
  }

  setBtnLoading($('#downloadBtn'), true);
  try {
    const res = await fetch('/api/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sources: list, options: opts }) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error);
    activeJobId = data.jobId; downloadStartTime = Date.now(); goto('download'); openProgress(); listenProgress(data.jobId);
  } catch (err) { toast(err.message); } finally { setBtnLoading($('#downloadBtn'), false); }
}

function openProgress() {
  $('#panel').hidden = true; $('#progress').hidden = false; $('#doneActions').hidden = true; $('#cancelBtn').hidden = false;
  $('#itemList').innerHTML = ''; $('#progBar').style.width = '0%'; $('#progPct').textContent = '0%'; $('#progMeta').textContent = ''; $('#progTitle').textContent = 'Preparing…';
  $('#progTimeInfo').textContent = '';
  $('#progress').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function listenProgress(id) {
  if (activeES) activeES.close();
  activeES = new EventSource(`/api/progress/${id}`);
  activeES.onmessage = (ev) => { const job = JSON.parse(ev.data); renderProgress(job); if (['complete', 'error', 'cancelled'].includes(job.status)) { activeES.close(); finishProgress(job); } };
  activeES.onerror = () => activeES.close();
}
const ST = { queued: 'Queued', downloading: '↓', done: '✓', failed: '✕', cancelled: '—' };
function renderProgress(job) {
  const pct = job.overall || 0;
  $('#progBar').style.width = pct + '%'; $('#progPct').textContent = pct + '%';
  $('#progMeta').textContent = [job.speed, job.eta ? 'ETA ' + job.eta : ''].filter(Boolean).join(' · ');
  if (job.title) $('#progTitle').textContent = ['complete', 'cancelled', 'error'].includes(job.status) ? job.title : `Downloading ${job.title}…`;

  if (downloadStartTime) {
    const elapsed = Math.round((Date.now() - downloadStartTime) / 1000);
    $('#progTimeInfo').textContent = `Elapsed: ${fmtTime(elapsed)}`;
  }

  document.title = pct < 100 ? `(${pct}%) Downloading — PurffleGrab` : 'PurffleGrab';

  $('#itemList').innerHTML = job.items.map((it, i) => {
    const label = it.status === 'downloading' ? `${Math.round(it.progress)}%` : (ST[it.status] || it.status);
    const acts = (it.status === 'done' && it.file) ? `<span class="item-acts"><button class="mini" data-open="${esc(it.file)}">Open</button><button class="mini" data-reveal="${esc(it.file)}">Folder</button></span>` : '';
    return `<li class="item"><span class="ix">${job.items.length > 1 ? i + 1 : ''}</span><span class="nm" title="${esc(it.title)}">${esc(it.title)}</span>${acts}<span class="st ${it.status}">${label}</span></li>`;
  }).join('');
  $$('#itemList [data-open]').forEach((b) => b.onclick = () => fetch(`/api/open-file/${job.id}/${encodeURIComponent(b.dataset.open)}`, { method: 'POST' }));
  $$('#itemList [data-reveal]').forEach((b) => b.onclick = () => fetch(`/api/reveal/${job.id}/${encodeURIComponent(b.dataset.reveal)}`, { method: 'POST' }));
}
let lastDoneJob = null;
function finishProgress(job) {
  document.title = 'PurffleGrab';
  $('#cancelBtn').hidden = true;
  const done = job.items.filter((i) => i.status === 'done').length;
  const failed = job.items.filter((i) => i.status === 'failed').length;
  const elapsed = downloadStartTime ? fmtTime(Math.round((Date.now() - downloadStartTime) / 1000)) : '';
  $('#progTitle').textContent = job.status === 'cancelled' ? 'Cancelled' : job.status === 'complete' ? `Done — ${done} ${done === 1 ? 'file' : 'files'} saved${failed ? `, ${failed} failed` : ''}${elapsed ? ` in ${elapsed}` : ''}` : `Failed${job.error ? ': ' + job.error : ''}`;
  $('#progPct').textContent = '100%'; $('#progBar').style.width = '100%'; $('#progMeta').textContent = '';
  const actions = $('#doneActions'); actions.hidden = false;
  const doneItems = job.items.filter((i) => i.status === 'done' && i.file);
  const zipBtn = $('#zipBtn'); zipBtn.hidden = false;
  if (doneItems.length === 1) { zipBtn.textContent = '⬇ Save to my computer'; zipBtn.onclick = () => (window.location = `/api/file/${job.id}/${encodeURIComponent(doneItems[0].file)}`); }
  else if (doneItems.length > 1) { zipBtn.textContent = '⬇ Download all (.zip)'; zipBtn.onclick = () => (window.location = `/api/zip/${job.id}`); }
  else zipBtn.hidden = true;
  $('#folderBtn').onclick = () => fetch(`/api/open-folder/${job.id}`, { method: 'POST' });
  $('#againBtn').onclick = () => { $('#progress').hidden = true; urlInput.value = ''; urlInput.focus(); };
  $('#convertDoneBtn').onclick = () => goto('converter');
  $('#shareDoneBtn').onclick = () => {
    const text = `I just downloaded "${job.title}" with PurffleGrab! https://github.com/Chamanrajragu/purffle-grab`;
    if (navigator.share) { navigator.share({ title: 'PurffleGrab', text }).catch(() => {}); }
    else { navigator.clipboard?.writeText(text).then(() => toast('📋 Copied share text!')); }
  };
  if (job.status === 'complete' && lastDoneJob !== job.id) { lastDoneJob = job.id; notifyDone(done); saveDownloadStats(job); }
  downloadStartTime = null;
}
function notifyDone(n) {
  if (!prefs.notify) return;
  try { if (Notification.permission === 'granted') new Notification('PurffleGrab', { body: `Done — ${n} ${n === 1 ? 'file' : 'files'} saved.`, icon: '/favicon.svg' }); else if (Notification.permission !== 'denied') Notification.requestPermission(); } catch {}
}
$('#cancelBtn').addEventListener('click', () => { if (activeJobId) fetch(`/api/cancel/${activeJobId}`, { method: 'POST' }); });

// ---- download stats tracking ----
function saveDownloadStats(job) {
  try {
    const stats = JSON.parse(localStorage.getItem('pg-stats') || '{}');
    if (!stats.downloads) stats.downloads = [];
    const opts = job.options || {};
    const doneCount = job.items.filter(i => i.status === 'done').length;
    stats.downloads.push({
      date: new Date().toISOString().slice(0, 10),
      count: doneCount,
      failed: job.items.filter(i => i.status === 'failed').length,
      format: opts.contentType === 'audio' ? (opts.audioFormat || 'mp3') : 'mp4',
      source: job.sources?.[0]?.url?.includes('spotify') ? 'spotify' : 'youtube',
    });
    // Track total size (estimate)
    if (!stats.totalSize) stats.totalSize = 0;
    stats.totalSize += doneCount * 5 * 1024 * 1024; // rough 5MB estimate per file
    if (stats.downloads.length > 1000) stats.downloads = stats.downloads.slice(-1000);
    localStorage.setItem('pg-stats', JSON.stringify(stats));
  } catch {}
}

// ---- stats view ----
function loadStats() {
  try {
    const stats = JSON.parse(localStorage.getItem('pg-stats') || '{}');
    const dl = stats.downloads || [];
    const total = dl.reduce((a, d) => a + d.count, 0);
    const failed = dl.reduce((a, d) => a + (d.failed || 0), 0);
    const audio = dl.filter(d => d.format !== 'mp4').reduce((a, d) => a + d.count, 0);
    const video = dl.filter(d => d.format === 'mp4').reduce((a, d) => a + d.count, 0);
    const spotify = dl.filter(d => d.source === 'spotify').reduce((a, d) => a + d.count, 0);
    const youtube = dl.filter(d => d.source === 'youtube').reduce((a, d) => a + d.count, 0);

    // Animate stat values
    animateValue($('#statTotal'), 0, total, 800);
    animateValue($('#statSuccess'), 0, total - failed, 800);
    animateValue($('#statAudio'), 0, audio, 800);
    animateValue($('#statVideo'), 0, video, 800);
    animateValue($('#statSpotify'), 0, spotify, 800);
    animateValue($('#statYoutube'), 0, youtube, 800);
    $('#statSize').textContent = fmtBytes(stats.totalSize || 0);

    // Calculate streak
    const today = new Date().toISOString().slice(0, 10);
    const uniqueDates = [...new Set(dl.map(d => d.date))].sort().reverse();
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const key = d.toISOString().slice(0, 10);
      if (uniqueDates.includes(key)) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    animateValue($('#statStreak'), 0, streak, 600);

    // Activity chart - last 14 days
    const chart = $('#statsChart');
    const days = {};
    for (let i = 13; i >= 0; i--) {
      const dd = new Date(); dd.setDate(dd.getDate() - i);
      const key = dd.toISOString().slice(0, 10);
      days[key] = 0;
    }
    dl.forEach(d => { if (days[d.date] !== undefined) days[d.date] += d.count; });
    const maxVal = Math.max(1, ...Object.values(days));
    chart.innerHTML = Object.entries(days).map(([date, count]) => {
      const h = Math.max(4, (count / maxVal) * 180);
      const label = date.slice(5);
      return `<div class="chart-bar" style="height:${h}px" data-label="${label}" data-value="${count}" title="${date}: ${count} downloads"></div>`;
    }).join('');

    // Format breakdown
    const formats = {};
    dl.forEach(d => { formats[d.format] = (formats[d.format] || 0) + d.count; });
    const fmtChart = $('#formatChart');
    const fmtMax = Math.max(1, ...Object.values(formats));
    fmtChart.innerHTML = Object.entries(formats).sort((a, b) => b[1] - a[1]).map(([fmt, count]) => {
      return `<div class="format-item"><span class="format-label">${fmt.toUpperCase()}</span><div class="format-bar" style="width:${Math.max(24, (count / fmtMax) * 140)}px"></div><span class="format-count">${count}</span></div>`;
    }).join('') || '<p class="hint">No data yet. Start downloading to see stats!</p>';
  } catch {
    $('#statTotal').textContent = '0';
  }
}

// ---- search ----
async function doSearch() {
  const query = $('#searchInput').value.trim(); $('#searchError').hidden = true; if (!query) return;
  setBtnLoading($('#searchBtn'), true); $('#searchResults').innerHTML = ''; $('#searchActions').hidden = true; searchSel = new Set();
  try { const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); searchResults = data.results; renderSearch(data.results); }
  catch (err) { showErr('#searchError', err.message); } finally { setBtnLoading($('#searchBtn'), false); }
}
function renderSearch(results) {
  $('#resultCount').textContent = results.length ? `${results.length} results` : '';
  if (!results.length) { $('#searchResults').innerHTML = '<p class="hint center">No results found. Try different keywords.</p>'; return; }
  $('#searchResults').innerHTML = results.map((r) => `<div class="result" data-url="${esc(r.url)}"><div class="res-thumb"><img src="${r.thumbnail}" alt="${esc(r.title)}" onerror="this.style.opacity=0" loading="lazy"/><span class="res-dur">${fmtDur(r.duration)}</span><span class="res-check">✓</span></div><div class="res-info"><p class="res-title">${esc(r.title)}</p><p class="res-up">${esc(r.uploader)}${r.duration ? ' · ' + fmtDur(r.duration) : ''}</p></div></div>`).join('');
  $$('#searchResults .result').forEach((el) => el.addEventListener('click', () => { const u = el.dataset.url; searchSel.has(u) ? searchSel.delete(u) : searchSel.add(u); el.classList.toggle('sel', searchSel.has(u)); $('#selCount').textContent = `${searchSel.size} selected`; $('#searchActions').hidden = searchSel.size === 0; }));
}

$('#searchSort')?.addEventListener('change', () => {
  const sort = $('#searchSort').value;
  let sorted = [...searchResults];
  if (sort === 'duration') sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
  else if (sort === 'date') sorted.reverse();
  renderSearch(sorted);
});

$$('.filter-chip').forEach(c => c.addEventListener('click', () => {
  $$('.filter-chip').forEach(x => x.classList.toggle('active', x === c));
  renderSearch(searchResults);
}));

$('#searchSelectAll')?.addEventListener('click', () => {
  searchResults.forEach(r => searchSel.add(r.url));
  $$('#searchResults .result').forEach(el => el.classList.add('sel'));
  $('#selCount').textContent = `${searchSel.size} selected`;
  $('#searchActions').hidden = searchSel.size === 0;
});
$('#searchClearSel')?.addEventListener('click', () => {
  searchSel.clear();
  $$('#searchResults .result').forEach(el => el.classList.remove('sel'));
  $('#selCount').textContent = '0 selected';
  $('#searchActions').hidden = true;
});

$('#searchDownloadBtn').addEventListener('click', () => { const list = [...searchSel].map((url) => ({ url, selected: null })); applyDefaultsToForm(); startDownload(list); });
$('#searchQueueBtn')?.addEventListener('click', () => {
  const list = [...searchSel].map((url) => ({ url, selected: null }));
  addToQueue(list, gatherOptions());
  searchSel.clear();
  $$('#searchResults .result').forEach(el => el.classList.remove('sel'));
  $('#searchActions').hidden = true;
});

// ---- history ----
let historyPage = 0;
const HISTORY_PAGE_SIZE = 20;
async function loadHistory() {
  const res = await fetch('/api/history'); const { history } = await res.json(); const wrap = $('#historyList');
  if (!history.length) { wrap.innerHTML = '<p class="hint center">No downloads yet. Start grabbing!</p>'; $('#historyPagination').hidden = true; return; }

  const filterStatus = $('#historyFilter')?.value || 'all';
  const filterText = ($('#historySearch')?.value || '').toLowerCase().trim();
  let filtered = history;
  if (filterStatus !== 'all') filtered = filtered.filter(h => h.status === filterStatus);
  if (filterText) filtered = filtered.filter(h => (h.title || '').toLowerCase().includes(filterText));

  const totalPages = Math.ceil(filtered.length / HISTORY_PAGE_SIZE);
  historyPage = Math.min(historyPage, totalPages - 1);
  const page = filtered.slice(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE);

  wrap.innerHTML = page.map((h) => { const d = new Date(h.when); const cls = h.status === 'complete' ? 'done' : h.status === 'cancelled' ? 'cancelled' : 'failed';
    return `<div class="hist" data-id="${h.id}"><div class="hist-main"><span class="st ${cls}">${h.status}</span><div><p class="hist-title">${esc(h.title)}</p><p class="meta-sub">${h.done}/${h.count} files · ${d.toLocaleString()}</p></div></div><div class="hist-actions"><button class="mini" data-act="folder">📂 Folder</button><button class="mini" data-act="zip">⬇ Zip</button><button class="mini" data-act="regrab">↺ Re-grab</button><button class="mini danger" data-act="del">🗑</button></div></div>`; }).join('');
  $$('#historyList .hist').forEach((el) => { const id = el.dataset.id; const h = history.find((x) => x.id === id);
    el.querySelector('[data-act="folder"]').onclick = () => fetch(`/api/open-folder/${id}`, { method: 'POST' });
    el.querySelector('[data-act="zip"]').onclick = () => (window.location = `/api/zip/${id}`);
    el.querySelector('[data-act="del"]').onclick = async () => { await fetch(`/api/history/delete/${id}`, { method: 'POST' }); loadHistory(); };
    el.querySelector('[data-act="regrab"]').onclick = () => { if (h) startDownload(h.sources, h.options); };
  });

  const pagEl = $('#historyPagination');
  if (totalPages > 1) {
    pagEl.hidden = false;
    pagEl.innerHTML = Array.from({ length: totalPages }, (_, i) => `<button class="page-btn ${i === historyPage ? 'active' : ''}" data-page="${i}">${i + 1}</button>`).join('');
    $$('.page-btn').forEach(b => b.addEventListener('click', () => { historyPage = Number(b.dataset.page); loadHistory(); }));
  } else { pagEl.hidden = true; }
}
$('#refreshHistory').addEventListener('click', loadHistory);
$('#clearHistory').addEventListener('click', async () => { await fetch('/api/history/clear', { method: 'POST' }); loadHistory(); });
$('#historyFilter')?.addEventListener('change', () => { historyPage = 0; loadHistory(); });
$('#historySearch')?.addEventListener('input', debounce(() => { historyPage = 0; loadHistory(); }, 300));

$('#exportHistory')?.addEventListener('click', async () => {
  const res = await fetch('/api/history');
  const { history } = await res.json();
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `purfflegrab-history-${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(url);
  toast('📤 History exported!');
});

// ---- converter ----
const converterDrop = $('#converterDrop');
const converterFile = $('#converterFile');
converterDrop?.addEventListener('click', () => converterFile.click());
converterDrop?.addEventListener('dragover', e => { e.preventDefault(); converterDrop.style.borderColor = 'var(--brand)'; });
converterDrop?.addEventListener('dragleave', () => { converterDrop.style.borderColor = ''; });
converterDrop?.addEventListener('drop', e => {
  e.preventDefault(); converterDrop.style.borderColor = '';
  if (e.dataTransfer.files.length) handleConverterFile(e.dataTransfer.files[0]);
});
converterFile?.addEventListener('change', e => { if (e.target.files[0]) handleConverterFile(e.target.files[0]); });

let converterSelectedFile = null;
function handleConverterFile(file) {
  converterSelectedFile = file;
  $('#converterFileName').textContent = `📁 ${file.name} (${fmtBytes(file.size)})`;
  $('#converterInfo').hidden = false;
  $('#convertResult').hidden = true;
}
$('#convertBtn')?.addEventListener('click', async () => {
  if (!converterSelectedFile) { toast('Select a file first'); return; }
  const format = $('#convertFormat').value;
  const quality = $('#convertQuality').value;
  setBtnLoading($('#convertBtn'), true);
  $('#convertProgress').hidden = false;
  $('#convertBar').style.width = '50%';

  const formData = new FormData();
  formData.append('file', converterSelectedFile);
  formData.append('format', format);
  formData.append('quality', quality);

  try {
    const res = await fetch('/api/convert', { method: 'POST', body: formData });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Conversion failed'); }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const name = converterSelectedFile.name.replace(/\.[^.]+$/, '') + '.' + format;
    $('#convertBar').style.width = '100%';
    $('#convertResult').hidden = false;
    $('#convertResult').innerHTML = `<div class="done-actions"><a href="${url}" download="${esc(name)}" class="btn-primary">⬇ Download ${esc(name)}</a></div>`;
    toast('✅ Conversion complete!');
  } catch (err) {
    toast(err.message);
    $('#convertResult').hidden = false;
    $('#convertResult').innerHTML = `<p class="error-msg">${esc(err.message)}</p>`;
  } finally {
    setBtnLoading($('#convertBtn'), false);
  }
});

// ---- scheduler ----
function loadSchedule() { try { scheduledDownloads = JSON.parse(localStorage.getItem('pg-schedule') || '[]'); } catch { scheduledDownloads = []; } }
function saveSchedule() { try { localStorage.setItem('pg-schedule', JSON.stringify(scheduledDownloads)); } catch {} }
function renderSchedule() {
  const list = $('#scheduleList');
  if (!scheduledDownloads.length) {
    list.innerHTML = '<p class="hint center">No scheduled downloads yet. Schedule one above!</p>';
    return;
  }
  list.innerHTML = scheduledDownloads.map((s, i) => {
    const dt = new Date(s.datetime);
    const isPast = dt < new Date();
    return `<div class="queue-item" data-si="${i}">
      <div class="qi-info">
        <div class="qi-title">${esc(s.url)}</div>
        <div class="qi-meta">${dt.toLocaleString()} · ${s.repeat} ${isPast ? '· <b style="color:var(--amber)">past</b>' : ''}</div>
      </div>
      <span class="st ${isPast ? 'done' : 'queued'}">${isPast ? 'past' : 'scheduled'}</span>
      <div class="qi-actions">
        ${!isPast ? `<button class="mini" data-sact="now">▶ Now</button>` : ''}
        <button class="mini danger" data-sact="remove">✕</button>
      </div>
    </div>`;
  }).join('');

  $$('#scheduleList .queue-item').forEach(el => {
    const i = Number(el.dataset.si);
    el.querySelector('[data-sact="remove"]')?.addEventListener('click', () => { scheduledDownloads.splice(i, 1); saveSchedule(); renderSchedule(); });
    el.querySelector('[data-sact="now"]')?.addEventListener('click', () => {
      const s = scheduledDownloads[i];
      urlInput.value = s.url;
      goto('download');
      analyze();
    });
  });
}
$('#scheduleAddBtn')?.addEventListener('click', () => {
  const url = $('#scheduleUrl')?.value?.trim();
  const date = $('#scheduleDate')?.value;
  const time = $('#scheduleTime')?.value;
  const repeat = $('#scheduleRepeat')?.value || 'once';
  if (!url) { toast('Please enter a URL'); return; }
  if (!date || !time) { toast('Please set date and time'); return; }
  const datetime = new Date(`${date}T${time}`).toISOString();
  scheduledDownloads.push({ url, datetime, repeat, status: 'scheduled', addedAt: Date.now() });
  saveSchedule();
  renderSchedule();
  $('#scheduleUrl').value = '';
  toast('⏰ Download scheduled!');
});

// Check for scheduled downloads every minute
setInterval(() => {
  const now = new Date();
  scheduledDownloads.forEach(s => {
    if (s.status !== 'scheduled') return;
    const dt = new Date(s.datetime);
    if (dt <= now) {
      s.status = 'started';
      saveSchedule();
      urlInput.value = s.url;
      analyze();
      toast(`⏰ Scheduled download started: ${s.url.slice(0, 40)}…`);
    }
  });
}, 60000);

// ---- settings ----
async function loadSettings() {
  try {
    const res = await fetch('/api/settings'); const { settings, defaultDir } = await res.json(); prefs = settings;
    applyTheme(settings.theme || document.body.dataset.theme || 'dark');
    if (settings.accentColor) applyAccent(settings.accentColor);
    $('#outputDir').value = settings.outputDir || ''; $('#dirHint').textContent = `Default folder: ${defaultDir}`;
    const d = settings.defaults || {};
    $('#defType').value = d.contentType || 'video'; $('#defRes').value = d.resolution || '1080'; $('#defFmt').value = d.audioFormat || 'mp3';
    $('#defConc').value = String(settings.concurrency || 2); $('#defNotify').checked = settings.notify !== false;
  } catch {}
}
function applyDefaultsToForm() { const d = prefs.defaults || {}; if (d.resolution) $('#resolution').value = d.resolution; if (d.audioFormat) $('#audioFormat').value = d.audioFormat; }
$('#pickFolder').addEventListener('click', async () => { const res = await fetch('/api/pick-folder', { method: 'POST' }); const { path } = await res.json(); if (path) $('#outputDir').value = path; });
$('#saveSettings').addEventListener('click', async () => {
  const body = { outputDir: $('#outputDir').value, theme: document.body.dataset.theme, accentColor: prefs.accentColor, concurrency: Number($('#defConc').value), notify: $('#defNotify').checked,
    defaults: { contentType: $('#defType').value, resolution: $('#defRes').value, audioFormat: $('#defFmt').value } };
  const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (res.ok) { prefs = data.settings; const m = $('#settingsSaved'); m.hidden = false; setTimeout(() => (m.hidden = true), 2000); toast('💾 Settings saved!'); } else toast(data.error);
});
$('#updateEngine').addEventListener('click', async () => { const out = $('#engineOut'); out.hidden = false; out.textContent = 'Updating…'; try { const res = await fetch('/api/update-engine', { method: 'POST' }); const data = await res.json(); out.textContent = res.ok ? (data.output || 'Up to date.') : ('Error: ' + data.error); } catch (e) { out.textContent = 'Error: ' + e.message; } });
$('#checkEngine')?.addEventListener('click', async () => { const out = $('#engineOut'); out.hidden = false; out.textContent = 'Checking…'; try { const res = await fetch('/api/check-engine', { method: 'POST' }); const data = await res.json(); out.textContent = res.ok ? (data.output || 'Check complete.') : ('Error: ' + data.error); } catch (e) { out.textContent = 'Error: ' + e.message; } });

$('#exportSettings')?.addEventListener('click', async () => {
  const res = await fetch('/api/settings'); const { settings } = await res.json();
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'purfflegrab-settings.json'; a.click();
  URL.revokeObjectURL(url);
  toast('📤 Settings exported!');
});
$('#importSettings')?.addEventListener('click', () => $('#settingsImportFile').click());
$('#settingsImportFile')?.addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const settings = JSON.parse(reader.result);
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      if (res.ok) { toast('📥 Settings imported!'); loadSettings(); } else toast('Import failed');
    } catch { toast('Invalid settings file'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});
$('#resetSettings')?.addEventListener('click', async () => {
  if (!confirm('Reset all settings to defaults?')) return;
  const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: true }) });
  if (res.ok) { toast('Settings reset!'); loadSettings(); }
});

// ---- wire up ----
$('#analyzeBtn').addEventListener('click', analyze);
$('#downloadBtn').addEventListener('click', () => startDownload());
$('#searchBtn').addEventListener('click', doSearch);
$('#searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
$$('.chip').forEach((c) => c.addEventListener('click', () => { urlInput.value = c.dataset.url; analyze(); }));

// ---- init ----
loadSettings();
loadQueue();
loadSchedule();
try { if (Notification.permission === 'default') Notification.requestPermission(); } catch {}
setTimeout(showTour, 600);
