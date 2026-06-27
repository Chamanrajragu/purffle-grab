// PurffleGrab front-end (v2).
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let sources = [];
let activeJobId = null;
let activeES = null;
let searchSel = new Set();
let prefs = { defaults: {}, theme: 'dark', notify: true, concurrency: 2 };

// ---- helpers ----
function setBtnLoading(btn, loading) { btn.disabled = loading; const l = btn.querySelector('.btn-label'); if (l) l.style.opacity = loading ? 0 : 1; const s = btn.querySelector('.spinner'); if (s) s.hidden = !loading; }
function fmtDur(s) { if (!s) return ''; const m = Math.floor(s / 60), x = Math.round(s % 60); return `${m}:${String(x).padStart(2, '0')}`; }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 2600); }
function showErr(sel, m) { const e = $(sel); e.textContent = m; e.hidden = false; }

// ---- nav ----
$$('.side-btn').forEach((b) => b.addEventListener('click', () => {
  $$('.side-btn').forEach((x) => x.classList.toggle('active', x === b));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${b.dataset.view}`));
  if (b.dataset.view === 'history') loadHistory();
  if (b.dataset.view === 'settings') loadSettings();
}));
function goto(view) { $$('.side-btn').forEach((x) => x.classList.toggle('active', x.dataset.view === view)); $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`)); }

// ---- theme ----
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  prefs.theme = theme;
  $('#themeToggle .tt-ic').textContent = theme === 'dark' ? '🌙' : '☀️';
  $('#themeToggle .tt-label').textContent = theme === 'dark' ? 'Dark' : 'Light';
  try { localStorage.setItem('pg-theme', theme); } catch {}
}
$('#themeToggle').addEventListener('click', () => {
  const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: next }) });
});
try { const t = localStorage.getItem('pg-theme'); if (t) applyTheme(t); } catch {}

// ---- download: input helpers ----
const urlInput = $('#urlInput');
urlInput.addEventListener('input', () => { urlInput.style.height = 'auto'; urlInput.style.height = Math.min(urlInput.scrollHeight, 160) + 'px'; });
$('#clearBtn').addEventListener('click', () => { urlInput.value = ''; urlInput.style.height = 'auto'; urlInput.focus(); });
$('#pasteBtn').addEventListener('click', async () => {
  try { const t = await navigator.clipboard.readText(); if (t) { urlInput.value = (urlInput.value ? urlInput.value + '\n' : '') + t.trim(); urlInput.dispatchEvent(new Event('input')); } }
  catch { toast('Clipboard not available — paste with Ctrl+V.'); }
});
// drag & drop links anywhere
const dz = $('#dropzone');
['dragenter', 'dragover'].forEach((e) => document.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.add('drag'); }));
['dragleave', 'drop'].forEach((e) => document.addEventListener(e, (ev) => { ev.preventDefault(); if (e !== 'drop' && ev.relatedTarget) return; dz.classList.remove('drag'); }));
document.addEventListener('drop', (ev) => {
  const txt = ev.dataTransfer?.getData('text') || '';
  const urls = txt.match(/https?:\/\/\S+/g);
  if (urls) { urlInput.value = (urlInput.value ? urlInput.value + '\n' : '') + urls.join('\n'); urlInput.dispatchEvent(new Event('input')); goto('download'); }
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
    tracksHtml = `<div class="track-tools"><button class="mini" data-act="all">Select all</button><button class="mini" data-act="none">None</button><span class="sel-info"></span></div>
      <ul class="track-list">${data.tracks.map((t, i) => `<li><label class="trk"><input type="checkbox" data-ti="${i}" ${selected.has(i) ? 'checked' : ''}/><span class="trk-n">${i + 1}.</span><span class="trk-t">${esc(t.artist ? t.artist + ' — ' : '')}${esc(t.title)}</span><span class="trk-d">${fmtDur(t.duration)}</span></label></li>`).join('')}</ul>`;
  }
  card.innerHTML = `<div class="sc-top"><img class="sc-thumb" src="${data.thumbnail || ''}" alt="" onerror="this.style.visibility='hidden'"/><div class="sc-body">${badge}<h4 class="sc-title">${esc(data.title || 'Untitled')}</h4><p class="meta-sub">${esc(sub)}</p></div><button class="sc-remove" title="Remove">✕</button></div>${tracksHtml}`;
  card.querySelector('.sc-remove').addEventListener('click', () => { sources[idx] = null; card.remove(); updateDlCount(); if (!sources.some(Boolean)) $('#panel').hidden = true; });
  card.querySelectorAll('input[data-ti]').forEach((cb) => cb.addEventListener('change', () => { const i = Number(cb.dataset.ti); cb.checked ? selected.add(i) : selected.delete(i); updateSelInfo(card, selected, data.count); updateDlCount(); }));
  card.querySelectorAll('.mini').forEach((btn) => btn.addEventListener('click', () => {
    if (btn.dataset.act === 'all') data.tracks.forEach((_, i) => selected.add(i)); else selected.clear();
    card.querySelectorAll('input[data-ti]').forEach((cb) => (cb.checked = selected.has(Number(cb.dataset.ti))));
    updateSelInfo(card, selected, data.count); updateDlCount();
  }));
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
  const type = $('#contentTypeSeg .seg-btn.active').dataset.type;
  return { contentType: type, resolution: $('#resolution').value, audioFormat: $('#audioFormat').value, audioBitrate: $('#audioBitrate').value,
    embedThumbnail: $('#embedThumb').checked, embedMetadata: $('#embedMeta').checked, saveThumbnail: $('#saveThumb').checked,
    embedChapters: $('#embedChapters').checked, sponsorblock: $('#sponsorblock').checked, normalize: $('#normalize').checked,
    subtitles: { enabled: $('#subsEnabled').checked, langs: $('#subsLangs').value || 'en', auto: $('#subsAuto').checked, embed: $('#subsEmbed').checked },
    clip: { start: $('#clipStart').value.trim(), end: $('#clipEnd').value.trim() } };
}
function gatherSources() { return sources.filter(Boolean).map((s) => ({ url: s.data.url, selected: s.selected ? [...s.selected] : null })); }

async function startDownload(srcList, options) {
  const opts = options || gatherOptions();
  const list = srcList || gatherSources();
  if (!list.length) { toast('Nothing selected.'); return; }
  setBtnLoading($('#downloadBtn'), true);
  try {
    const res = await fetch('/api/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sources: list, options: opts }) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error);
    activeJobId = data.jobId; goto('download'); openProgress(); listenProgress(data.jobId);
  } catch (err) { toast(err.message); } finally { setBtnLoading($('#downloadBtn'), false); }
}

function openProgress() {
  $('#panel').hidden = true; $('#progress').hidden = false; $('#doneActions').hidden = true; $('#cancelBtn').hidden = false;
  $('#itemList').innerHTML = ''; $('#progBar').style.width = '0%'; $('#progPct').textContent = '0%'; $('#progMeta').textContent = ''; $('#progTitle').textContent = 'Preparing…';
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
  $('#progBar').style.width = (job.overall || 0) + '%'; $('#progPct').textContent = (job.overall || 0) + '%';
  $('#progMeta').textContent = [job.speed, job.eta ? 'ETA ' + job.eta : ''].filter(Boolean).join(' · ');
  if (job.title) $('#progTitle').textContent = ['complete', 'cancelled', 'error'].includes(job.status) ? job.title : `Downloading ${job.title}…`;
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
  $('#cancelBtn').hidden = true;
  const done = job.items.filter((i) => i.status === 'done').length;
  const failed = job.items.filter((i) => i.status === 'failed').length;
  $('#progTitle').textContent = job.status === 'cancelled' ? 'Cancelled' : job.status === 'complete' ? `Done — ${done} ${done === 1 ? 'file' : 'files'} saved${failed ? `, ${failed} failed` : ''}` : `Failed${job.error ? ': ' + job.error : ''}`;
  $('#progPct').textContent = '100%'; $('#progBar').style.width = '100%'; $('#progMeta').textContent = '';
  const actions = $('#doneActions'); actions.hidden = false;
  const doneItems = job.items.filter((i) => i.status === 'done' && i.file);
  const zipBtn = $('#zipBtn'); zipBtn.hidden = false;
  if (doneItems.length === 1) { zipBtn.textContent = '⬇ Save to my computer'; zipBtn.onclick = () => (window.location = `/api/file/${job.id}/${encodeURIComponent(doneItems[0].file)}`); }
  else if (doneItems.length > 1) { zipBtn.textContent = '⬇ Download all (.zip)'; zipBtn.onclick = () => (window.location = `/api/zip/${job.id}`); }
  else zipBtn.hidden = true;
  $('#folderBtn').onclick = () => fetch(`/api/open-folder/${job.id}`, { method: 'POST' });
  $('#againBtn').onclick = () => { $('#progress').hidden = true; urlInput.value = ''; urlInput.focus(); };
  if (job.status === 'complete' && lastDoneJob !== job.id) { lastDoneJob = job.id; notifyDone(done); }
}
function notifyDone(n) {
  if (!prefs.notify) return;
  try { if (Notification.permission === 'granted') new Notification('PurffleGrab', { body: `Done — ${n} ${n === 1 ? 'file' : 'files'} saved.` }); else if (Notification.permission !== 'denied') Notification.requestPermission(); } catch {}
}
$('#cancelBtn').addEventListener('click', () => { if (activeJobId) fetch(`/api/cancel/${activeJobId}`, { method: 'POST' }); });

// ---- search ----
async function doSearch() {
  const query = $('#searchInput').value.trim(); $('#searchError').hidden = true; if (!query) return;
  setBtnLoading($('#searchBtn'), true); $('#searchResults').innerHTML = ''; $('#searchActions').hidden = true; searchSel = new Set();
  try { const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); renderSearch(data.results); }
  catch (err) { showErr('#searchError', err.message); } finally { setBtnLoading($('#searchBtn'), false); }
}
function renderSearch(results) {
  if (!results.length) { $('#searchResults').innerHTML = '<p class="hint center">No results.</p>'; return; }
  $('#searchResults').innerHTML = results.map((r) => `<div class="result" data-url="${esc(r.url)}"><div class="res-thumb"><img src="${r.thumbnail}" alt="" onerror="this.style.opacity=0"/><span class="res-dur">${fmtDur(r.duration)}</span><span class="res-check">✓</span></div><div class="res-info"><p class="res-title">${esc(r.title)}</p><p class="res-up">${esc(r.uploader)}</p></div></div>`).join('');
  $$('#searchResults .result').forEach((el) => el.addEventListener('click', () => { const u = el.dataset.url; searchSel.has(u) ? searchSel.delete(u) : searchSel.add(u); el.classList.toggle('sel', searchSel.has(u)); $('#selCount').textContent = `${searchSel.size} selected`; $('#searchActions').hidden = searchSel.size === 0; }));
}
$('#searchDownloadBtn').addEventListener('click', () => { const list = [...searchSel].map((url) => ({ url, selected: null })); applyDefaultsToForm(); startDownload(list); });

// ---- history ----
async function loadHistory() {
  const res = await fetch('/api/history'); const { history } = await res.json(); const wrap = $('#historyList');
  if (!history.length) { wrap.innerHTML = '<p class="hint center">No downloads yet.</p>'; return; }
  wrap.innerHTML = history.map((h) => { const d = new Date(h.when); const cls = h.status === 'complete' ? 'done' : h.status === 'cancelled' ? 'cancelled' : 'failed';
    return `<div class="hist" data-id="${h.id}"><div class="hist-main"><span class="st ${cls}">${h.status}</span><div><p class="hist-title">${esc(h.title)}</p><p class="meta-sub">${h.done}/${h.count} files · ${d.toLocaleString()}</p></div></div><div class="hist-actions"><button class="mini" data-act="folder">📂 Folder</button><button class="mini" data-act="zip">⬇ Zip</button><button class="mini" data-act="regrab">↺ Re-grab</button><button class="mini danger" data-act="del">🗑</button></div></div>`; }).join('');
  $$('#historyList .hist').forEach((el) => { const id = el.dataset.id; const h = history.find((x) => x.id === id);
    el.querySelector('[data-act="folder"]').onclick = () => fetch(`/api/open-folder/${id}`, { method: 'POST' });
    el.querySelector('[data-act="zip"]').onclick = () => (window.location = `/api/zip/${id}`);
    el.querySelector('[data-act="del"]').onclick = async () => { await fetch(`/api/history/delete/${id}`, { method: 'POST' }); loadHistory(); };
    el.querySelector('[data-act="regrab"]').onclick = () => startDownload(h.sources, h.options);
  });
}
$('#refreshHistory').addEventListener('click', loadHistory);
$('#clearHistory').addEventListener('click', async () => { await fetch('/api/history/clear', { method: 'POST' }); loadHistory(); });

// ---- settings ----
async function loadSettings() {
  const res = await fetch('/api/settings'); const { settings, defaultDir } = await res.json(); prefs = settings;
  applyTheme(settings.theme || document.body.dataset.theme || 'dark');
  $('#outputDir').value = settings.outputDir || ''; $('#dirHint').textContent = `Default folder: ${defaultDir}`;
  const d = settings.defaults || {};
  $('#defType').value = d.contentType || 'video'; $('#defRes').value = d.resolution || '1080'; $('#defFmt').value = d.audioFormat || 'mp3';
  $('#defConc').value = String(settings.concurrency || 2); $('#defNotify').checked = settings.notify !== false;
}
function applyDefaultsToForm() { const d = prefs.defaults || {}; if (d.resolution) $('#resolution').value = d.resolution; if (d.audioFormat) $('#audioFormat').value = d.audioFormat; }
$('#pickFolder').addEventListener('click', async () => { const res = await fetch('/api/pick-folder', { method: 'POST' }); const { path } = await res.json(); if (path) $('#outputDir').value = path; });
$('#saveSettings').addEventListener('click', async () => {
  const body = { outputDir: $('#outputDir').value, theme: document.body.dataset.theme, concurrency: Number($('#defConc').value), notify: $('#defNotify').checked,
    defaults: { contentType: $('#defType').value, resolution: $('#defRes').value, audioFormat: $('#defFmt').value } };
  const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (res.ok) { prefs = data.settings; const m = $('#settingsSaved'); m.hidden = false; setTimeout(() => (m.hidden = true), 1800); } else toast(data.error);
});
$('#updateEngine').addEventListener('click', async () => { const out = $('#engineOut'); out.hidden = false; out.textContent = 'Updating…'; try { const res = await fetch('/api/update-engine', { method: 'POST' }); const data = await res.json(); out.textContent = res.ok ? (data.output || 'Up to date.') : ('Error: ' + data.error); } catch (e) { out.textContent = 'Error: ' + e.message; } });

// ---- wire up ----
$('#analyzeBtn').addEventListener('click', analyze);
$('#downloadBtn').addEventListener('click', () => startDownload());
$('#searchBtn').addEventListener('click', doSearch);
$('#searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
$$('.chip').forEach((c) => c.addEventListener('click', () => { urlInput.value = c.dataset.url; analyze(); }));
loadSettings();
try { if (Notification.permission === 'default') Notification.requestPermission(); } catch {}
