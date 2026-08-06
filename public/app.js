// PurffleGrab front-end (v9.0) — ultimate edition.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let sources = [];
let activeJobId = null;
let activeES = null;
let searchSel = new Set();
let searchResults = [];
let downloadQueue = [];
let scheduledDownloads = [];
let favorites = [];
let recentUrls = [];
let speedHistory = [];
let notifications = [];
let downloadProfiles = [];
let bulkSelected = new Set();
let prefs = { defaults: {}, theme: 'dark', themeMode: 'dark', notify: true, concurrency: 2, accentColor: '#8b5cf6', playSound: true, confetti: true, particles: true, speedGauge: true };
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
function timeAgo(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ---- completion sound ----
function playCompletionSound() {
  if (!prefs.playSound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 chord
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.6);
    });
  } catch {}
}

// ---- confetti ----
function fireConfetti() {
  if (!prefs.confetti) return;
  const canvas = $('#confettiCanvas');
  canvas.hidden = false;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#8b5cf6', '#ec4899', '#22d3ee', '#1db954', '#f59e0b', '#ef4444', '#3b82f6'];
  const pieces = [];
  for (let i = 0; i < 120; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 200,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 6,
      vy: 2 + Math.random() * 4,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
    });
  }
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of pieces) {
      p.x += p.vx;
      p.vy += 0.08;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      if (frame > 60) p.opacity -= 0.015;
      if (p.opacity <= 0) continue;
      alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame++;
    if (alive && frame < 200) requestAnimationFrame(draw);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.hidden = true; }
  }
  requestAnimationFrame(draw);
}

// ---- notification center ----
function addNotification(icon, title) {
  notifications.unshift({ icon, title, time: Date.now() });
  if (notifications.length > 50) notifications = notifications.slice(0, 50);
  try { localStorage.setItem('pg-notifs', JSON.stringify(notifications)); } catch {}
  renderNotifications();
  $('#notifDot').hidden = false;
}
function renderNotifications() {
  const body = $('#notifBody');
  if (!notifications.length) { body.innerHTML = '<div class="notif-empty">No notifications yet</div>'; return; }
  body.innerHTML = notifications.slice(0, 20).map((n, i) =>
    `<div class="notif-item" style="animation-delay:${i * 0.04}s"><span class="ni-icon">${n.icon}</span><div class="ni-text"><div class="ni-title">${esc(n.title)}</div><div class="ni-time">${timeAgo(n.time)}</div></div></div>`
  ).join('');
}
$('#notifBtn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const panel = $('#notifPanel');
  panel.hidden = !panel.hidden;
  if (!panel.hidden) { $('#notifDot').hidden = true; renderNotifications(); }
});
$('#notifClear')?.addEventListener('click', () => {
  notifications = [];
  try { localStorage.setItem('pg-notifs', '[]'); } catch {}
  renderNotifications();
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#notifPanel') && !e.target.closest('#notifBtn')) $('#notifPanel').hidden = true;
});
try { notifications = JSON.parse(localStorage.getItem('pg-notifs') || '[]'); } catch {}

// ---- context menu ----
function showContextMenu(x, y, items) {
  const menu = $('#ctxMenu');
  menu.innerHTML = items.map(item => {
    if (item === '---') return '<div class="ctx-sep"></div>';
    return `<button class="ctx-item ${item.danger ? 'danger' : ''}" data-ci="${item.id}">${item.icon || ''} ${esc(item.label)}</button>`;
  }).join('');
  menu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - items.length * 40) + 'px';
  menu.hidden = false;
  const handler = (e) => {
    const btn = e.target.closest('[data-ci]');
    if (btn) {
      const item = items.find(i => i.id === btn.dataset.ci);
      if (item?.action) item.action();
    }
    menu.hidden = true;
    document.removeEventListener('click', handler);
  };
  setTimeout(() => document.addEventListener('click', handler), 10);
}

// ---- 3D tilt on stat cards ----
function initTiltCards() {
  $$('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) scale(1.03)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

// ---- download profiles ----
function loadProfiles() { try { downloadProfiles = JSON.parse(localStorage.getItem('pg-profiles') || '[]'); } catch { downloadProfiles = []; } }
function saveProfiles() { try { localStorage.setItem('pg-profiles', JSON.stringify(downloadProfiles)); } catch {} }
function renderProfiles() {
  const bar = $('#profilesBar');
  const chips = downloadProfiles.map((p, i) =>
    `<button class="profile-chip" data-pi="${i}" title="Load: ${esc(p.name)}">${esc(p.name)} <span style="opacity:0.5;margin-left:4px" data-pdel="${i}">✕</span></button>`
  ).join('');
  bar.innerHTML = `<span class="profile-label">Profiles:</span>${chips}<button id="profileSaveBtn" class="mini">💾 Save profile</button>`;
  $$('.profile-chip').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.dataset.pdel !== undefined) {
        downloadProfiles.splice(Number(e.target.dataset.pdel), 1);
        saveProfiles(); renderProfiles(); toast('Profile deleted');
        return;
      }
      const p = downloadProfiles[Number(el.dataset.pi)];
      if (!p) return;
      applyProfileOptions(p.options);
      $$('.profile-chip').forEach(c => c.classList.toggle('active', c === el));
      toast(`Loaded profile: ${p.name}`);
    });
  });
  $('#profileSaveBtn')?.addEventListener('click', () => {
    const name = prompt('Profile name:');
    if (!name) return;
    downloadProfiles.push({ name, options: gatherOptions() });
    saveProfiles(); renderProfiles();
    toast(`💾 Profile "${name}" saved!`);
    addNotification('💾', `Profile "${name}" saved`);
  });
}
function applyProfileOptions(opts) {
  if (!opts) return;
  setContentType(opts.contentType || 'video');
  if (opts.resolution) $('#resolution').value = opts.resolution;
  if (opts.audioFormat) $('#audioFormat').value = opts.audioFormat;
  if (opts.audioBitrate !== undefined) $('#audioBitrate').value = opts.audioBitrate;
  if (opts.embedThumbnail !== undefined) $('#embedThumb').checked = opts.embedThumbnail;
  if (opts.embedMetadata !== undefined) $('#embedMeta').checked = opts.embedMetadata;
}

// ---- nav ----
$$('.side-btn').forEach((b) => b.addEventListener('click', () => {
  $$('.side-btn').forEach((x) => x.classList.toggle('active', x === b));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${b.dataset.view}`));
  if (b.dataset.view === 'history') loadHistory();
  if (b.dataset.view === 'settings') loadSettings();
  if (b.dataset.view === 'stats') { loadStats(); initTiltCards(); renderSpeedHistory(); }
  if (b.dataset.view === 'queue') renderQueue();
  if (b.dataset.view === 'scheduler') renderSchedule();
  if (b.dataset.view === 'favorites') renderFavorites();
  if (b.dataset.view === 'achievements') { renderAchievements(); renderHeatmap(); }
  updateMiniProgress();
}));
function goto(view) {
  $$('.side-btn').forEach((x) => x.classList.toggle('active', x.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  updateMiniProgress();
  if (view === 'stats') setTimeout(initTiltCards, 100);
}

// ---- sidebar toggle ----
$('#sidebarToggle')?.addEventListener('click', () => {
  $('#sidebar').classList.toggle('collapsed');
  try { localStorage.setItem('pg-sidebar', $('#sidebar').classList.contains('collapsed') ? 'collapsed' : 'expanded'); } catch {}
});
try { if (localStorage.getItem('pg-sidebar') === 'collapsed') $('#sidebar').classList.add('collapsed'); } catch {}

// ---- theme ----
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  prefs.theme = theme;
  const tog = $('#themeToggle');
  if (tog) { tog.querySelector('.tt-ic').textContent = theme === 'dark' ? '🌙' : '☀️'; tog.querySelector('.tt-label').textContent = theme === 'dark' ? 'Dark' : 'Light'; }
  try { localStorage.setItem('pg-theme', theme); } catch {}
  $$('#themeSeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.themeMode === (prefs.themeMode || theme)));
}
function applyThemeMode(mode) {
  prefs.themeMode = mode;
  try { localStorage.setItem('pg-theme-mode', mode); } catch {}
  if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  } else {
    applyTheme(mode);
  }
  $$('#themeSeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.themeMode === mode));
}
$$('#themeSeg .seg-btn').forEach(b => b.addEventListener('click', () => applyThemeMode(b.dataset.themeMode)));
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (prefs.themeMode === 'system') applyTheme(e.matches ? 'dark' : 'light');
});

$('#themeToggle').addEventListener('click', () => {
  const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyThemeMode(next);
  fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: next }) });
});
try {
  const mode = localStorage.getItem('pg-theme-mode');
  if (mode) applyThemeMode(mode);
  else { const t = localStorage.getItem('pg-theme'); if (t) applyTheme(t); }
} catch {}

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
    $('#notifPanel').hidden = true;
    $('#ctxMenu').hidden = true;
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
  if (e.ctrlKey && e.key === 'k') { e.preventDefault(); openCommandPalette(); }
  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (url) { addFavorite(url, ''); } else { goto('favorites'); }
  }
  if (e.ctrlKey && e.key === '\\') { e.preventDefault(); $('#sidebarToggle')?.click(); }
  if (e.ctrlKey && e.key === 'n') { e.preventDefault(); $('#notifBtn')?.click(); }
  if (e.ctrlKey && e.key === 'p') { e.preventDefault(); goto('player'); }
  if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    const views = ['download','search','queue','history','stats','converter','scheduler','favorites','player','achievements','settings'];
    const idx = parseInt(e.key) - 1;
    if (views[idx]) goto(views[idx]);
  }
  if (e.ctrlKey && e.key === '0') { e.preventDefault(); goto('about'); }
  if (e.key === '?' && !isInput) { e.preventDefault(); $('#shortcutsModal').hidden = false; }
});

// Close modal on background click
$$('.modal').forEach(m => m.addEventListener('click', (e) => { if (e.target === m) m.hidden = true; }));

// ---- What's New modal ----
$('#whatsNewBtn')?.addEventListener('click', () => { $('#whatsNewModal').hidden = false; });
try {
  if (!localStorage.getItem('pg-seen-v9')) {
    setTimeout(() => { $('#whatsNewModal').hidden = false; localStorage.setItem('pg-seen-v9', '1'); }, 1500);
  }
} catch {}

// ---- Floating Action Button ----
$('#fab')?.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      const urls = text.match(/https?:\/\/\S+/g);
      if (urls?.length) {
        urlInput.value = urls.join('\n');
        urlInput.dispatchEvent(new Event('input'));
        goto('download');
        toast(`📋 Pasted ${urls.length} link${urls.length > 1 ? 's' : ''}`);
        analyze();
        return;
      }
    }
    toast('No URLs found in clipboard');
  } catch {
    goto('download');
    urlInput.focus();
    toast('Paste a link to get started');
  }
});

// ---- command palette ----
const CMD_ACTIONS = [
  { icon: '⬇', label: 'Go to Download', hint: 'Ctrl+1', action: () => goto('download') },
  { icon: '🔎', label: 'Go to Search', hint: 'Ctrl+2', action: () => { goto('search'); setTimeout(() => $('#searchInput').focus(), 100); } },
  { icon: '📋', label: 'Go to Queue', hint: 'Ctrl+3', action: () => goto('queue') },
  { icon: '🕘', label: 'Go to History', hint: 'Ctrl+4', action: () => goto('history') },
  { icon: '📊', label: 'Go to Statistics', hint: 'Ctrl+5', action: () => goto('stats') },
  { icon: '🔄', label: 'Go to Converter', hint: 'Ctrl+6', action: () => goto('converter') },
  { icon: '⏰', label: 'Go to Scheduler', hint: 'Ctrl+7', action: () => goto('scheduler') },
  { icon: '⭐', label: 'Go to Favorites', hint: 'Ctrl+8', action: () => goto('favorites') },
  { icon: '⚙', label: 'Go to Settings', hint: 'Ctrl+9', action: () => goto('settings') },
  { icon: 'ℹ', label: 'Go to About', hint: 'Ctrl+0', action: () => goto('about') },
  { icon: '🌙', label: 'Toggle theme (dark/light)', hint: 'Ctrl+D', action: () => $('#themeToggle').click() },
  { icon: '💻', label: 'Set system theme', action: () => applyThemeMode('system') },
  { icon: '📋', label: 'Paste from clipboard', hint: 'Ctrl+V', action: () => { goto('download'); $('#pasteBtn').click(); } },
  { icon: '◀', label: 'Toggle sidebar', hint: 'Ctrl+\\', action: () => $('#sidebarToggle')?.click() },
  { icon: '⌨', label: 'Show keyboard shortcuts', hint: '?', action: () => { $('#shortcutsModal').hidden = false; } },
  { icon: '🔔', label: 'Toggle notifications', hint: 'Ctrl+N', action: () => $('#notifBtn')?.click() },
  { icon: '🗑', label: 'Clear download queue', action: () => { downloadQueue = []; saveQueue(); renderQueue(); updateQueueBadge(); toast('Queue cleared'); } },
  { icon: '📤', label: 'Export history', action: () => $('#exportHistory')?.click() },
  { icon: '📤', label: 'Export settings', action: () => $('#exportSettings')?.click() },
  { icon: '📤', label: 'Export queue as URL list', action: () => $('#queueExport')?.click() },
  { icon: '⬆', label: 'Update yt-dlp engine', action: () => { goto('settings'); $('#updateEngine').click(); } },
  { icon: '↺', label: 'Reset settings to defaults', action: () => $('#resetSettings')?.click() },
  { icon: '🔄', label: 'Refresh history', action: () => { goto('history'); loadHistory(); } },
  { icon: '🆕', label: "What's new in v6.0", action: () => { $('#whatsNewModal').hidden = false; } },
  { icon: '🎊', label: 'Test confetti', action: () => fireConfetti() },
  { icon: '🎧', label: 'Go to Player', hint: 'Ctrl+P', action: () => goto('player') },
];

let cmdIdx = 0;
function openCommandPalette() {
  const modal = $('#cmdPalette');
  modal.hidden = false;
  const input = $('#cmdInput');
  input.value = '';
  input.focus();
  renderCmdResults('');
}
function renderCmdResults(query) {
  const q = query.toLowerCase().trim();
  const filtered = q ? CMD_ACTIONS.filter(a => a.label.toLowerCase().includes(q)) : CMD_ACTIONS;
  cmdIdx = 0;
  const el = $('#cmdResults');
  if (!filtered.length) { el.innerHTML = '<div class="cmd-empty">No matching commands</div>'; return; }
  el.innerHTML = filtered.map((a, i) =>
    `<div class="cmd-item ${i === 0 ? 'active' : ''}" data-ci="${i}"><span class="cmd-ic">${a.icon}</span><span class="cmd-label">${esc(a.label)}</span>${a.hint ? `<span class="cmd-hint">${a.hint}</span>` : ''}</div>`
  ).join('');
  el._actions = filtered;
  $$('.cmd-item').forEach((el, i) => {
    el.addEventListener('click', () => { $('#cmdPalette').hidden = true; filtered[i].action(); });
    el.addEventListener('mouseenter', () => {
      $$('.cmd-item').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      cmdIdx = i;
    });
  });
}
$('#cmdInput')?.addEventListener('input', (e) => renderCmdResults(e.target.value));
$('#cmdInput')?.addEventListener('keydown', (e) => {
  const items = $$('.cmd-item');
  const actions = $('#cmdResults')._actions || [];
  if (e.key === 'ArrowDown') { e.preventDefault(); cmdIdx = Math.min(cmdIdx + 1, items.length - 1); items.forEach((el, i) => el.classList.toggle('active', i === cmdIdx)); items[cmdIdx]?.scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); cmdIdx = Math.max(cmdIdx - 1, 0); items.forEach((el, i) => el.classList.toggle('active', i === cmdIdx)); items[cmdIdx]?.scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'Enter') { e.preventDefault(); $('#cmdPalette').hidden = true; if (actions[cmdIdx]) actions[cmdIdx].action(); }
});

// ---- onboarding tour ----
const TOUR_STEPS = [
  { title: 'Welcome to PurffleGrab! 🎉', desc: 'The ultimate way to download media from Spotify and YouTube. Let us show you around!' },
  { title: 'Paste & Download ⬇', desc: 'Just paste a Spotify or YouTube link and hit Analyze. Use the floating button to quick-paste from clipboard!' },
  { title: 'Search YouTube 🔎', desc: 'No link? Search directly by name, select results, and download them all at once.' },
  { title: 'Queue System 📋', desc: 'Add items to the queue, drag to reorder, and batch download. Right-click for more options.' },
  { title: 'Command Palette 🚀', desc: 'Press Ctrl+K anytime for the command palette. Navigate anywhere, toggle theme, or trigger actions.' },
  { title: 'Favorites ⭐', desc: 'Save URLs you download often. Press Ctrl+B to bookmark the current URL.' },
  { title: 'Notification Center 🔔', desc: 'Click the bell icon to see all your download events and alerts. Press Ctrl+N to toggle.' },
  { title: 'Download Profiles 💾', desc: 'Save your favorite download options as profiles and reload them with one click.' },
  { title: 'Audio Player 🎧', desc: 'Play your downloaded audio right in the app with waveform visualization, shuffle, repeat and playlists.' },
  { title: 'You\'re all set! ✅', desc: 'Explore Stats (donut charts!), Converter, Scheduler, Player and Settings. Enjoy confetti and speed gauge! 🎊' },
];
let tourStep = 0;
function showTour() {
  try { if (localStorage.getItem('pg-toured-v9')) return; } catch {}
  tourStep = 0;
  renderTourStep();
  $$('.modal').forEach(m => m.hidden = true);
  $('#tourOverlay').hidden = false;
}
function renderTourStep() {
  const s = TOUR_STEPS[tourStep];
  $('#tourTitle').textContent = s.title;
  $('#tourDesc').textContent = s.desc;
  $('#tourDots').innerHTML = TOUR_STEPS.map((_, i) =>
    `<div class="tour-dot ${i === tourStep ? 'active' : ''}"></div>`
  ).join('');
  $('#tourNext').textContent = tourStep === TOUR_STEPS.length - 1 ? 'Get started!' : 'Next →';
}
$('#tourNext').addEventListener('click', () => {
  tourStep++;
  if (tourStep >= TOUR_STEPS.length) { $('#tourOverlay').hidden = true; try { localStorage.setItem('pg-toured-v9', '1'); } catch {} return; }
  renderTourStep();
});
$('#tourSkip').addEventListener('click', () => { $('#tourOverlay').hidden = true; try { localStorage.setItem('pg-toured-v9', '1'); } catch {} });
$('#tourCard').addEventListener('click', (e) => e.stopPropagation());
$('#tourOverlay').addEventListener('click', () => { $('#tourOverlay').hidden = true; try { localStorage.setItem('pg-toured-v9', '1'); } catch {} });

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

// drag & drop
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

// ---- recent urls ----
function loadRecents() { try { recentUrls = JSON.parse(localStorage.getItem('pg-recents') || '[]'); } catch { recentUrls = []; } }
function saveRecent(url) {
  recentUrls = recentUrls.filter(u => u !== url);
  recentUrls.unshift(url);
  if (recentUrls.length > 50) recentUrls = recentUrls.slice(0, 50);
  try { localStorage.setItem('pg-recents', JSON.stringify(recentUrls)); } catch {}
}

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
    saveRecent(link);
    try {
      const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: link }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      const idx = sources.length;
      sources.push({ data, selected: data.count > 1 ? new Set(data.tracks.map((_, i) => i)) : null });
      renderSourceCard(idx);
      if (data.capabilities?.video) anyVideo = true; ok++;
      addNotification('🔍', `Analyzed: ${data.title || link.slice(0, 40)}`);
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
  applyDefaultsToForm(); updateDlCount(); renderProfiles();
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
  card.innerHTML = `<div class="sc-top"><img class="sc-thumb" src="${data.thumbnail || ''}" alt="${esc(data.title || '')}" onerror="this.style.visibility='hidden'" loading="lazy"/><div class="sc-body">${badge}<h4 class="sc-title">${esc(data.title || 'Untitled')}</h4><p class="meta-sub">${esc(sub)}</p></div><button class="sc-fav mini" title="Add to favorites">⭐</button><button class="sc-remove" title="Remove">✕</button></div>${tracksHtml}`;
  card.querySelector('.sc-remove').addEventListener('click', () => { sources[idx] = null; card.remove(); updateDlCount(); if (!sources.some(Boolean)) $('#panel').hidden = true; });
  card.querySelector('.sc-fav').addEventListener('click', () => { addFavorite(data.url, data.title); });
  card.querySelectorAll('input[data-ti]').forEach((cb) => cb.addEventListener('change', () => { const i = Number(cb.dataset.ti); cb.checked ? selected.add(i) : selected.delete(i); updateSelInfo(card, selected, data.count); updateDlCount(); }));
  card.querySelectorAll('.mini[data-act]').forEach((btn) => btn.addEventListener('click', () => {
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
  djmix: { type: 'audio', audioFormat: 'flac', audioBitrate: '' },
  lecture: { type: 'audio', audioFormat: 'mp3', audioBitrate: '96' },
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

// ---- favorites ----
function loadFavorites() { try { favorites = JSON.parse(localStorage.getItem('pg-favorites') || '[]'); } catch { favorites = []; } }
function saveFavorites() { try { localStorage.setItem('pg-favorites', JSON.stringify(favorites)); } catch {} }
function addFavorite(url, label) {
  if (!url) return;
  if (favorites.some(f => f.url === url)) { toast('Already in favorites!'); return; }
  favorites.push({ url, label: label || url.slice(0, 60), addedAt: Date.now() });
  saveFavorites();
  toast('⭐ Added to favorites!');
  addNotification('⭐', `Favorited: ${label || url.slice(0, 40)}`);
}
function renderFavorites() {
  const list = $('#favList');
  if (!favorites.length) {
    list.innerHTML = '<p class="hint center">No favorites yet. Save URLs you download often!</p>';
    return;
  }
  list.innerHTML = favorites.map((f, i) => `
    <div class="queue-item" data-fi="${i}">
      <div class="qi-info">
        <div class="qi-title">${esc(f.label)}</div>
        <div class="qi-meta">${esc(f.url.slice(0, 80))} · ${new Date(f.addedAt).toLocaleDateString()}</div>
      </div>
      <div class="qi-actions">
        <button class="mini" data-fact="grab">⬇ Grab</button>
        <button class="mini" data-fact="queue">📋 Queue</button>
        <button class="mini" data-fact="copy">📋 Copy</button>
        <button class="mini danger" data-fact="remove">✕</button>
      </div>
    </div>`).join('');

  $$('#favList .queue-item').forEach(el => {
    const i = Number(el.dataset.fi);
    const f = favorites[i];
    el.querySelector('[data-fact="grab"]')?.addEventListener('click', () => { urlInput.value = f.url; goto('download'); analyze(); });
    el.querySelector('[data-fact="queue"]')?.addEventListener('click', () => { addToQueue([{ url: f.url, selected: null }], gatherOptions()); });
    el.querySelector('[data-fact="copy"]')?.addEventListener('click', () => { navigator.clipboard?.writeText(f.url).then(() => toast('📋 Copied!')); });
    el.querySelector('[data-fact="remove"]')?.addEventListener('click', () => { favorites.splice(i, 1); saveFavorites(); renderFavorites(); toast('Removed from favorites'); });
  });
}
$('#favAddBtn')?.addEventListener('click', () => {
  const url = $('#favUrl')?.value?.trim();
  const label = $('#favLabel')?.value?.trim();
  if (!url) { toast('Please enter a URL'); return; }
  addFavorite(url, label);
  $('#favUrl').value = '';
  $('#favLabel').value = '';
  renderFavorites();
});

// ---- queue system ----
function addToQueue(srcList, options) {
  const items = srcList.map(s => ({ id: Date.now() + Math.random().toString(36).slice(2,6), source: s, options, status: 'queued', addedAt: Date.now() }));
  downloadQueue.push(...items);
  saveQueue();
  renderQueue();
  updateQueueBadge();
  toast(`📋 Added ${items.length} item${items.length > 1 ? 's' : ''} to queue`);
  addNotification('📋', `${items.length} item${items.length > 1 ? 's' : ''} added to queue`);
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
    <div class="queue-item" data-qi="${i}" draggable="true">
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

  // Drag-to-reorder
  let dragIdx = null;
  $$('.queue-item[draggable]').forEach((el, i) => {
    el.addEventListener('dragstart', (e) => {
      dragIdx = i;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); dragIdx = null; });
    el.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragIdx !== null && dragIdx !== i) {
        const item = downloadQueue.splice(dragIdx, 1)[0];
        downloadQueue.splice(i, 0, item);
        saveQueue();
        renderQueue();
      }
    });
    // Right-click context menu
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const q = downloadQueue[i];
      showContextMenu(e.clientX, e.clientY, [
        ...(q.status === 'queued' ? [{ id: 'start', icon: '▶', label: 'Start now', action: () => { q.status = 'downloading'; saveQueue(); renderQueue(); updateQueueBadge(); startDownload([q.source], q.options); } }] : []),
        { id: 'copy', icon: '📋', label: 'Copy URL', action: () => navigator.clipboard?.writeText(q.source.url).then(() => toast('📋 Copied!')) },
        { id: 'fav', icon: '⭐', label: 'Add to favorites', action: () => addFavorite(q.source.url, '') },
        '---',
        { id: 'remove', icon: '✕', label: 'Remove', danger: true, action: () => { downloadQueue.splice(i, 1); saveQueue(); renderQueue(); updateQueueBadge(); } },
      ]);
    });
  });

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
$('#queueExport')?.addEventListener('click', () => {
  const urls = downloadQueue.map(q => q.source.url).join('\n');
  if (!urls) { toast('Queue is empty'); return; }
  const blob = new Blob([urls], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'purfflegrab-queue.txt'; a.click();
  URL.revokeObjectURL(url);
  toast('📤 Queue exported!');
});

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
    activeJobId = data.jobId; downloadStartTime = Date.now(); speedHistory = []; goto('download'); openProgress(); listenProgress(data.jobId);
    addNotification('⬇', 'Download started');
  } catch (err) { toast(err.message); } finally { setBtnLoading($('#downloadBtn'), false); }
}

// ---- visualizer ----
function initVisualizer() {
  const el = $('#progVisualizer');
  el.hidden = false;
  el.innerHTML = Array.from({ length: 16 }, (_, i) => {
    const h = 8 + Math.random() * 16;
    const dur = 0.4 + Math.random() * 0.5;
    return `<div class="viz-bar" style="--h:${h}px;--dur:${dur}s"></div>`;
  }).join('');
}

// ---- speed graph ----
function updateSpeedGraph(speedStr) {
  if (!speedStr) return;
  const match = speedStr.match(/([\d.]+)\s*(KiB|MiB|GiB|B)/i);
  if (!match) return;
  let val = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'mib') val *= 1024;
  else if (unit === 'gib') val *= 1024 * 1024;
  else if (unit === 'b') val /= 1024;
  speedHistory.push(val);
  if (speedHistory.length > 60) speedHistory.shift();

  const el = $('#speedGraph');
  el.hidden = false;
  const max = Math.max(1, ...speedHistory);
  el.innerHTML = speedHistory.map(v => {
    const h = Math.max(2, (v / max) * 44);
    return `<div class="sg-bar" style="height:${h}px"></div>`;
  }).join('');
}

// ---- mini progress ----
let lastMiniJob = null;
function updateMiniProgress() {
  const mp = $('#miniProgress');
  const isOnDownload = $('.view.active')?.id === 'view-download';
  if (!activeJobId || isOnDownload || !lastMiniJob) {
    mp.hidden = true;
    return;
  }
  mp.hidden = false;
}
$('#miniProgress')?.addEventListener('click', () => { goto('download'); });

function openProgress() {
  $('#panel').hidden = true; $('#progress').hidden = false; $('#doneActions').hidden = true; $('#cancelBtn').hidden = false;
  $('#itemList').innerHTML = ''; $('#progBar').style.width = '0%'; $('#progPct').textContent = '0%'; $('#progMeta').textContent = ''; $('#progTitle').textContent = 'Preparing…';
  $('#progTimeInfo').textContent = '';
  $('#speedGraph').hidden = true; $('#speedGraph').innerHTML = '';
  initVisualizer();
  $('#progress').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  $('#fab').hidden = true;
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
    let timeStr = `Elapsed: ${fmtTime(elapsed)}`;
    // ETA countdown
    if (job.eta && pct > 0 && pct < 100) {
      const etaMatch = job.eta.match(/(\d+):(\d+)/);
      if (etaMatch) {
        const etaSec = parseInt(etaMatch[1]) * 60 + parseInt(etaMatch[2]);
        timeStr += ` · <span class="eta-countdown">⏱ ${fmtTime(etaSec)} remaining</span>`;
      }
    }
    $('#progTimeInfo').innerHTML = timeStr;
  }

  document.title = pct < 100 ? `(${pct}%) Downloading — PurffleGrab` : 'PurffleGrab';

  if (job.speed) { updateSpeedGraph(job.speed); updateSpeedGauge(job.speed); }

  lastMiniJob = job;
  $('#mpTitle').textContent = job.title || 'Downloading…';
  $('#mpBar').style.width = pct + '%';
  $('#mpPct').textContent = pct + '%';
  updateMiniProgress();

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
  activeJobId = null;
  lastMiniJob = null;
  updateMiniProgress();
  $('#cancelBtn').hidden = true;
  $('#progVisualizer').hidden = true;
  $('#fab').hidden = false;
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
  $('#playDoneBtn').onclick = () => goto('player');
  $('#shareDoneBtn').onclick = () => {
    const text = `I just downloaded "${job.title}" with PurffleGrab! https://github.com/Chamanrajragu/purffle-grab`;
    if (navigator.share) { navigator.share({ title: 'PurffleGrab', text }).catch(() => {}); }
    else { navigator.clipboard?.writeText(text).then(() => toast('📋 Copied share text!')); }
  };
  if (job.status === 'complete' && lastDoneJob !== job.id) {
    lastDoneJob = job.id;
    notifyDone(done);
    saveDownloadStats(job);
    playCompletionSound();
    fireConfetti();
    addNotification('✅', `Downloaded: ${job.title || 'Unknown'} (${done} file${done > 1 ? 's' : ''})`);
  }
  if (job.status === 'error' || job.status === 'cancelled') {
    addNotification(job.status === 'error' ? '❌' : '⚠️', `${job.status === 'error' ? 'Failed' : 'Cancelled'}: ${job.title || 'Unknown'}`);
  }
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
    if (!stats.totalSize) stats.totalSize = 0;
    stats.totalSize += doneCount * 5 * 1024 * 1024;
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

    animateValue($('#statTotal'), 0, total, 800);
    animateValue($('#statSuccess'), 0, total - failed, 800);
    animateValue($('#statAudio'), 0, audio, 800);
    animateValue($('#statVideo'), 0, video, 800);
    animateValue($('#statSpotify'), 0, spotify, 800);
    animateValue($('#statYoutube'), 0, youtube, 800);
    $('#statSize').textContent = fmtBytes(stats.totalSize || 0);

    const uniqueDates = [...new Set(dl.map(d => d.date))].sort().reverse();
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const key = d.toISOString().slice(0, 10);
      if (uniqueDates.includes(key)) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    animateValue($('#statStreak'), 0, streak, 600);

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
  if (!history.length) { wrap.innerHTML = '<p class="hint center">No downloads yet. Start grabbing!</p>'; $('#historyPagination').hidden = true; $('#bulkToolbar').hidden = true; return; }

  const filterStatus = $('#historyFilter')?.value || 'all';
  const filterText = ($('#historySearch')?.value || '').toLowerCase().trim();
  let filtered = history;
  if (filterStatus !== 'all') filtered = filtered.filter(h => h.status === filterStatus);
  if (filterText) filtered = filtered.filter(h => (h.title || '').toLowerCase().includes(filterText));

  // Show bulk toolbar
  $('#bulkToolbar').hidden = false;
  bulkSelected = new Set();
  updateBulkCount();

  const totalPages = Math.ceil(filtered.length / HISTORY_PAGE_SIZE);
  historyPage = Math.min(historyPage, totalPages - 1);
  const page = filtered.slice(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE);

  wrap.innerHTML = page.map((h) => { const d = new Date(h.when); const cls = h.status === 'complete' ? 'done' : h.status === 'cancelled' ? 'cancelled' : 'failed';
    return `<div class="hist" data-id="${h.id}"><input type="checkbox" class="hist-check" data-hc="${h.id}" /><div class="hist-main"><span class="st ${cls}">${h.status}</span><div><p class="hist-title">${esc(h.title)}</p><p class="meta-sub">${h.done}/${h.count} files · ${d.toLocaleString()}</p></div></div><div class="hist-actions"><button class="mini" data-act="folder">📂 Folder</button><button class="mini" data-act="zip">⬇ Zip</button><button class="mini" data-act="regrab">↺ Re-grab</button><button class="mini" data-act="fav">⭐</button><button class="mini danger" data-act="del">🗑</button></div></div>`; }).join('');
  $$('#historyList .hist').forEach((el) => { const id = el.dataset.id; const h = history.find((x) => x.id === id);
    el.querySelector('[data-act="folder"]').onclick = () => fetch(`/api/open-folder/${id}`, { method: 'POST' });
    el.querySelector('[data-act="zip"]').onclick = () => (window.location = `/api/zip/${id}`);
    el.querySelector('[data-act="del"]').onclick = async () => { await fetch(`/api/history/delete/${id}`, { method: 'POST' }); loadHistory(); };
    el.querySelector('[data-act="regrab"]').onclick = () => { if (h) startDownload(h.sources, h.options); };
    el.querySelector('[data-act="fav"]').onclick = () => { if (h?.sources?.[0]) addFavorite(typeof h.sources[0] === 'string' ? h.sources[0] : h.sources[0].url, h.title); };
    // Bulk select checkbox
    el.querySelector('[data-hc]').addEventListener('change', (e) => {
      if (e.target.checked) bulkSelected.add(id); else bulkSelected.delete(id);
      updateBulkCount();
    });
    // Right-click context menu
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        { id: 'folder', icon: '📂', label: 'Open folder', action: () => fetch(`/api/open-folder/${id}`, { method: 'POST' }) },
        { id: 'zip', icon: '⬇', label: 'Download as zip', action: () => window.location = `/api/zip/${id}` },
        { id: 'regrab', icon: '↺', label: 'Re-download', action: () => { if (h) startDownload(h.sources, h.options); } },
        { id: 'fav', icon: '⭐', label: 'Add to favorites', action: () => { if (h?.sources?.[0]) addFavorite(typeof h.sources[0] === 'string' ? h.sources[0] : h.sources[0].url, h.title); } },
        '---',
        { id: 'del', icon: '🗑', label: 'Delete', danger: true, action: async () => { await fetch(`/api/history/delete/${id}`, { method: 'POST' }); loadHistory(); } },
      ]);
    });
  });

  const pagEl = $('#historyPagination');
  if (totalPages > 1) {
    pagEl.hidden = false;
    pagEl.innerHTML = Array.from({ length: totalPages }, (_, i) => `<button class="page-btn ${i === historyPage ? 'active' : ''}" data-page="${i}">${i + 1}</button>`).join('');
    $$('.page-btn').forEach(b => b.addEventListener('click', () => { historyPage = Number(b.dataset.page); loadHistory(); }));
  } else { pagEl.hidden = true; }
}
function updateBulkCount() {
  $('#bulkCount').textContent = `${bulkSelected.size} selected`;
  $('#bulkZip').disabled = bulkSelected.size === 0;
  $('#bulkDelete').disabled = bulkSelected.size === 0;
}
$('#bulkSelectAll')?.addEventListener('change', (e) => {
  $$('.hist-check[data-hc]').forEach(cb => { cb.checked = e.target.checked; if (e.target.checked) bulkSelected.add(cb.dataset.hc); else bulkSelected.delete(cb.dataset.hc); });
  updateBulkCount();
});
$('#bulkDelete')?.addEventListener('click', async () => {
  if (!bulkSelected.size) return;
  for (const id of bulkSelected) { await fetch(`/api/history/delete/${id}`, { method: 'POST' }); }
  bulkSelected.clear();
  toast('🗑 Deleted selected items');
  loadHistory();
});
$('#bulkZip')?.addEventListener('click', () => {
  // Download first selected as zip
  for (const id of bulkSelected) { window.location = `/api/zip/${id}`; break; }
});

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
    playCompletionSound();
    addNotification('🔄', `Converted: ${name}`);
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
  addNotification('⏰', `Scheduled: ${url.slice(0, 40)}`);
});

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
      addNotification('⏰', `Scheduled download started`);
    }
  });
}, 60000);

// ---- settings ----
async function loadSettings() {
  try {
    const res = await fetch('/api/settings'); const { settings, defaultDir } = await res.json(); prefs = settings;
    applyTheme(settings.theme || document.body.dataset.theme || 'dark');
    if (settings.themeMode) applyThemeMode(settings.themeMode);
    if (settings.accentColor) applyAccent(settings.accentColor);
    if (settings.playSound !== undefined) prefs.playSound = settings.playSound;
    if (settings.confetti !== undefined) prefs.confetti = settings.confetti;
    $('#outputDir').value = settings.outputDir || ''; $('#dirHint').textContent = `Default folder: ${defaultDir}`;
    const d = settings.defaults || {};
    $('#defType').value = d.contentType || 'video'; $('#defRes').value = d.resolution || '1080'; $('#defFmt').value = d.audioFormat || 'mp3';
    $('#defConc').value = String(settings.concurrency || 2); $('#defNotify').checked = settings.notify !== false;
    $('#defPlaySound').checked = settings.playSound !== false;
    $('#defConfetti').checked = settings.confetti !== false;
  } catch {}
}
function applyDefaultsToForm() { const d = prefs.defaults || {}; if (d.resolution) $('#resolution').value = d.resolution; if (d.audioFormat) $('#audioFormat').value = d.audioFormat; }
$('#pickFolder').addEventListener('click', async () => { const res = await fetch('/api/pick-folder', { method: 'POST' }); const { path } = await res.json(); if (path) $('#outputDir').value = path; });
$('#saveSettings').addEventListener('click', async () => {
  const body = { outputDir: $('#outputDir').value, theme: document.body.dataset.theme, themeMode: prefs.themeMode, accentColor: prefs.accentColor, concurrency: Number($('#defConc').value), notify: $('#defNotify').checked, playSound: $('#defPlaySound').checked, confetti: $('#defConfetti').checked,
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
loadFavorites();
loadRecents();
loadProfiles();
try { if (Notification.permission === 'default') Notification.requestPermission(); } catch {}
setTimeout(showTour, 600);

// ====================================================================
// v7.0 NEW FEATURES
// ====================================================================

// ---- typewriter hero text ----
(function typewriterHero() {
  const el = $('#heroTypewriter');
  if (!el) return;
  const phrases = ['Download', 'Grab Music', 'Save Playlists', 'Rip Audio', 'Capture Video'];
  let pi = 0, ci = 0, deleting = false;
  function tick() {
    const phrase = phrases[pi];
    if (!deleting) {
      el.textContent = phrase.slice(0, ci + 1);
      ci++;
      if (ci >= phrase.length) { deleting = true; setTimeout(tick, 2200); return; }
      setTimeout(tick, 80 + Math.random() * 40);
    } else {
      el.textContent = phrase.slice(0, ci);
      ci--;
      if (ci <= 0) { deleting = false; pi = (pi + 1) % phrases.length; setTimeout(tick, 400); return; }
      setTimeout(tick, 40);
    }
  }
  tick();
})();

// ---- URL preview cards ----
urlInput.addEventListener('input', () => {
  const urls = urlInput.value.match(/https?:\/\/\S+/g) || [];
  const wrap = $('#urlCards');
  if (!urls.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  wrap.innerHTML = urls.slice(0, 10).map((u, i) => {
    const isSpotify = u.includes('spotify');
    const icon = isSpotify ? '🟢' : '🔴';
    const label = isSpotify ? 'Spotify' : 'YouTube';
    const short = u.replace(/https?:\/\/(www\.)?/, '').slice(0, 40);
    return `<div class="url-card" style="animation-delay:${i*0.05}s"><span class="uc-icon">${icon}</span><span class="uc-text" title="${esc(u)}">${label}: ${esc(short)}</span><span class="uc-close" data-ucr="${i}">✕</span></div>`;
  }).join('');
  $$('.uc-close').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const lines = urlInput.value.split('\n');
    const idx = Number(btn.dataset.ucr);
    let count = 0;
    for (let j = 0; j < lines.length; j++) {
      if (lines[j].match(/https?:\/\/\S+/)) {
        if (count === idx) { lines.splice(j, 1); break; }
        count++;
      }
    }
    urlInput.value = lines.join('\n');
    urlInput.dispatchEvent(new Event('input'));
  }));
});

// ---- speed gauge ----
function updateSpeedGauge(speedStr) {
  if (!prefs.speedGauge) return;
  const gauge = $('#speedGauge');
  gauge.hidden = false;
  const match = speedStr.match(/([\d.]+)\s*(KiB|MiB|GiB|B)/i);
  if (!match) return;
  let val = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  let displayUnit = unit.replace('ib','B/s').replace('b','B/s');
  if (unit === 'mib') { val *= 1024; displayUnit = 'MB/s'; }
  else if (unit === 'gib') { val *= 1024 * 1024; displayUnit = 'GB/s'; }
  else if (unit === 'b') { val /= 1024; displayUnit = 'B/s'; }
  else displayUnit = 'KB/s';
  // Gauge arc is ~251 units long. Map speed 0-20MB/s to 0-251
  const maxSpeed = 20 * 1024; // 20 MB/s in KB
  const ratio = Math.min(val / maxSpeed, 1);
  const offset = 251 - (251 * ratio);
  const arc = $('#gaugeArc');
  if (arc) arc.style.strokeDashoffset = offset;
  const text = $('#gaugeText');
  if (text) {
    if (val >= 1024) text.textContent = (val / 1024).toFixed(1) + ' MB/s';
    else text.textContent = Math.round(val) + ' KB/s';
  }
}

// ---- interactive particles ----
(function initParticles() {
  const canvas = $('#particlesCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, particles = [], mouseX = -1000, mouseY = -1000;
  function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
  for (let i = 0; i < 50; i++) {
    particles.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
      r: 1.5 + Math.random() * 2, alpha: 0.1 + Math.random() * 0.2,
    });
  }
  function draw() {
    if (!prefs.particles) { ctx.clearRect(0, 0, w, h); requestAnimationFrame(draw); return; }
    ctx.clearRect(0, 0, w, h);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#8b5cf6';
    for (const p of particles) {
      // Mouse repulsion
      const dx = p.x - mouseX, dy = p.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        const force = (150 - dist) / 150 * 0.8;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }
      p.vx *= 0.98; p.vy *= 0.98;
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
    }
    // Draw connections
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d = dx * dx + dy * dy;
        if (d < 15000) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
  draw();
})();

// ---- donut chart for stats ----
function renderDonutChart(formats) {
  const svg = $('#donutSvg');
  const legend = $('#donutLegend');
  if (!svg || !legend) return;
  const colors = ['#8b5cf6', '#ec4899', '#22d3ee', '#1db954', '#f59e0b', '#ef4444', '#3b82f6', '#f97316'];
  const entries = Object.entries(formats).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const total = entries.reduce((s, e) => s + e[1], 0) || 1;
  const cx = 100, cy = 100, r = 70;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  svg.innerHTML = entries.map(([fmt, count], i) => {
    const pct = count / total;
    const dash = circumference * pct;
    const gap = circumference - dash;
    const rot = offset * 360;
    offset += pct;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="20" stroke-dasharray="${dash} ${gap}" transform="rotate(${rot - 90} ${cx} ${cy})" style="transition: stroke-dasharray 1s ease"/>`;
  }).join('') + `<circle cx="${cx}" cy="${cy}" r="50" fill="var(--bg-2)"/>
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="var(--text)" font-size="22" font-weight="900">${total}</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="var(--muted)" font-size="10" font-weight="600">FILES</text>`;
  legend.innerHTML = entries.map(([fmt, count], i) =>
    `<div class="donut-legend-item"><span class="donut-legend-dot" style="background:${colors[i % colors.length]}"></span><span>${fmt.toUpperCase()}</span><span class="donut-legend-val">${count} (${Math.round(count / total * 100)}%)</span></div>`
  ).join('') || '<p class="hint">No data yet</p>';
}

// Patch loadStats to call donut
const _origLoadStats = loadStats;
loadStats = function() {
  _origLoadStats();
  try {
    const stats = JSON.parse(localStorage.getItem('pg-stats') || '{}');
    const dl = stats.downloads || [];
    const formats = {};
    dl.forEach(d => { formats[d.format] = (formats[d.format] || 0) + d.count; });
    renderDonutChart(formats);
  } catch {}
};

// ---- audio player ----
let playerAudio = null;
let playerPlaylist = [];
let playerIdx = 0;
let playerShuffle = false;
let playerRepeat = false;
let playerWaveCtx = null;
let playerAnalyser = null;
let playerAudioCtx = null;

$('#playerLoadFile')?.addEventListener('click', () => $('#playerFileInput').click());
$('#playerFileInput')?.addEventListener('change', (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  files.forEach(f => {
    playerPlaylist.push({ name: f.name.replace(/\.[^.]+$/, ''), file: f, url: URL.createObjectURL(f) });
  });
  renderPlayerPlaylist();
  if (!playerAudio || playerAudio.paused) loadPlayerTrack(playerPlaylist.length - files.length);
  e.target.value = '';
});

function renderPlayerPlaylist() {
  const el = $('#playerPlaylist');
  if (!playerPlaylist.length) {
    el.innerHTML = '<p class="hint center">No files loaded. Click "Load file" to add audio files.</p>';
    return;
  }
  el.innerHTML = playerPlaylist.map((t, i) =>
    `<div class="pl-item ${i === playerIdx ? 'playing' : ''}" data-pli="${i}"><span class="pl-n">${i + 1}</span><span class="pl-name">${esc(t.name)}</span></div>`
  ).join('');
  $$('.pl-item').forEach(el => el.addEventListener('click', () => loadPlayerTrack(Number(el.dataset.pli))));
}

function loadPlayerTrack(idx) {
  playerIdx = idx;
  const track = playerPlaylist[idx];
  if (!track) return;
  if (!playerAudio) {
    playerAudio = new Audio();
    playerAudio.addEventListener('timeupdate', updatePlayerTime);
    playerAudio.addEventListener('ended', () => {
      if (playerRepeat) { playerAudio.currentTime = 0; playerAudio.play(); }
      else playerNextTrack();
    });
    playerAudio.addEventListener('loadedmetadata', () => {
      $('#playerDuration').textContent = fmtDur(playerAudio.duration);
      $('#playerSeek').max = Math.floor(playerAudio.duration);
    });
  }
  playerAudio.src = track.url;
  playerAudio.volume = ($('#playerVolume')?.value || 80) / 100;
  playerAudio.play();
  $('#playerTitle').textContent = track.name;
  $('#playerArtist').textContent = `Track ${idx + 1} of ${playerPlaylist.length}`;
  $('#playerPlay').textContent = '⏸';
  $('#playerArtwork').classList.add('playing');
  renderPlayerPlaylist();
  initWaveform();
}

function updatePlayerTime() {
  if (!playerAudio) return;
  const cur = playerAudio.currentTime;
  const dur = playerAudio.duration || 1;
  $('#playerCurrent').textContent = fmtDur(cur);
  $('#playerSeek').value = Math.floor(cur);
  const pct = (cur / dur * 100).toFixed(1);
  $('#playerSeek').style.setProperty('--progress', pct + '%');
}

$('#playerPlay')?.addEventListener('click', () => {
  if (!playerAudio) return;
  if (playerAudio.paused) {
    playerAudio.play();
    $('#playerPlay').textContent = '⏸';
    $('#playerArtwork').classList.add('playing');
  } else {
    playerAudio.pause();
    $('#playerPlay').textContent = '▶';
    $('#playerArtwork').classList.remove('playing');
  }
});

$('#playerSeek')?.addEventListener('input', (e) => {
  if (playerAudio) playerAudio.currentTime = Number(e.target.value);
});
$('#playerVolume')?.addEventListener('input', (e) => {
  if (playerAudio) playerAudio.volume = Number(e.target.value) / 100;
});
$('#playerNext')?.addEventListener('click', playerNextTrack);
$('#playerPrev')?.addEventListener('click', () => {
  if (playerPlaylist.length) loadPlayerTrack((playerIdx - 1 + playerPlaylist.length) % playerPlaylist.length);
});
function playerNextTrack() {
  if (!playerPlaylist.length) return;
  if (playerShuffle) {
    loadPlayerTrack(Math.floor(Math.random() * playerPlaylist.length));
  } else {
    loadPlayerTrack((playerIdx + 1) % playerPlaylist.length);
  }
}
$('#playerShuffle')?.addEventListener('click', () => {
  playerShuffle = !playerShuffle;
  $('#playerShuffle').classList.toggle('active', playerShuffle);
  toast(playerShuffle ? '🔀 Shuffle on' : '🔀 Shuffle off');
});
$('#playerRepeat')?.addEventListener('click', () => {
  playerRepeat = !playerRepeat;
  $('#playerRepeat').classList.toggle('active', playerRepeat);
  toast(playerRepeat ? '🔁 Repeat on' : '🔁 Repeat off');
});

// Waveform visualization
function initWaveform() {
  const canvas = $('#waveformCanvas');
  if (!canvas || !playerAudio) return;
  const ctx = canvas.getContext('2d');
  try {
    if (!playerAudioCtx) {
      playerAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = playerAudioCtx.createMediaElementSource(playerAudio);
      playerAnalyser = playerAudioCtx.createAnalyser();
      playerAnalyser.fftSize = 256;
      source.connect(playerAnalyser);
      playerAnalyser.connect(playerAudioCtx.destination);
    }
    playerWaveCtx = ctx;
    drawWaveform();
  } catch {}
}

function drawWaveform() {
  if (!playerAnalyser || !playerWaveCtx) return;
  const canvas = $('#waveformCanvas');
  const ctx = playerWaveCtx;
  const bufferLength = playerAnalyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  function draw() {
    requestAnimationFrame(draw);
    playerAnalyser.getByteFrequencyData(dataArray);
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const barW = (w / bufferLength) * 2;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#8b5cf6';
    for (let i = 0; i < bufferLength; i++) {
      const barH = (dataArray[i] / 255) * h * 0.9;
      const x = i * barW;
      const grad = ctx.createLinearGradient(x, h, x, h - barH);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, accent + '44');
      ctx.fillStyle = grad;
      ctx.fillRect(x, h - barH, barW - 1, barH);
    }
  }
  draw();
}

// Space to play/pause in player view
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && $('.view.active')?.id === 'view-player' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
    e.preventDefault();
    $('#playerPlay')?.click();
  }
});

// ---- quick bar ----
(function initQuickBar() {
  const bar = $('#quickBar');
  if (!bar) return;
  // Show after scroll
  let shown = false;
  document.querySelector('.content')?.addEventListener('scroll', () => {
    const scrolled = document.querySelector('.content').scrollTop > 200;
    if (scrolled && !shown) { bar.hidden = false; shown = true; }
    else if (!scrolled && shown) { bar.hidden = true; shown = false; }
  });
  $$('.qb-btn').forEach(btn => btn.addEventListener('click', () => {
    const act = btn.dataset.qb;
    if (act === 'theme') $('#themeToggle').click();
    else if (act === 'cmd') openCommandPalette();
    else goto(act);
  }));
})();

// ---- settings: particles & gauge toggles ----
$('#defParticles')?.addEventListener('change', (e) => { prefs.particles = e.target.checked; });
$('#defSpeedGauge')?.addEventListener('change', (e) => { prefs.speedGauge = e.target.checked; });

// Patch saveSettings to include new prefs
const origSaveClick = $('#saveSettings');
if (origSaveClick) {
  const origHandler = origSaveClick.onclick;
  // Already handled in the main click listener — just make sure the new fields are read
}

// Hide speed gauge on finish
const _origFinish = finishProgress;
finishProgress = function(job) {
  _origFinish(job);
  $('#speedGauge').hidden = true;
};

// ====================================================================
// v8.0 NEW FEATURES
// ====================================================================

// ---- equalizer ----
let eqFilters = [];
const EQ_FREQS = [60, 230, 910, 3600, 14000];
const EQ_LABELS = ['Bass', 'Low', 'Mid', 'High', 'Treble'];

function initEqualizer() {
  if (!playerAudioCtx || !playerAnalyser || eqFilters.length) return;
  // Disconnect analyser, insert EQ chain
  try {
    const source = playerAudioCtx.createMediaElementSource ? null : null; // already connected
    let lastNode = playerAnalyser;
    // We need to reconnect: source → EQ filters → analyser → destination
    // Since source is already connected to analyser, we'll create filters between analyser and destination
    playerAnalyser.disconnect();
    EQ_FREQS.forEach((freq, i) => {
      const filter = playerAudioCtx.createBiquadFilter();
      filter.type = i === 0 ? 'lowshelf' : i === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = freq;
      filter.gain.value = 0;
      filter.Q.value = 1;
      eqFilters.push(filter);
    });
    // Chain: analyser → filter0 → filter1 → ... → destination
    let prev = playerAnalyser;
    eqFilters.forEach(f => { prev.connect(f); prev = f; });
    prev.connect(playerAudioCtx.destination);
  } catch {}
}

function renderEqualizer() {
  const wrap = $('#eqSliders');
  if (!wrap) return;
  wrap.innerHTML = EQ_FREQS.map((freq, i) => {
    const label = EQ_LABELS[i];
    const val = eqFilters[i]?.gain?.value || 0;
    return `<div class="eq-band">
      <input type="range" class="eq-slider" data-eqi="${i}" min="-12" max="12" step="1" value="${Math.round(val)}" orient="vertical" />
      <span class="eq-label">${label}</span>
      <span class="eq-val" id="eqVal${i}">${Math.round(val)} dB</span>
    </div>`;
  }).join('');
  $$('.eq-slider').forEach(s => s.addEventListener('input', (e) => {
    const i = Number(s.dataset.eqi);
    const val = Number(e.target.value);
    if (eqFilters[i]) eqFilters[i].gain.value = val;
    $(`#eqVal${i}`).textContent = `${val} dB`;
  }));
}
$('#eqToggle')?.addEventListener('click', () => {
  const panel = $('#eqPanel');
  if (!panel) return;
  panel.hidden = !panel.hidden;
  if (!panel.hidden) {
    if (!eqFilters.length && playerAudioCtx) initEqualizer();
    renderEqualizer();
  }
});
$('#eqReset')?.addEventListener('click', () => {
  eqFilters.forEach(f => { f.gain.value = 0; });
  renderEqualizer();
  toast('🎛 Equalizer reset');
});
// EQ presets
$$('[data-eqpreset]').forEach(btn => btn.addEventListener('click', () => {
  const presets = {
    flat: [0, 0, 0, 0, 0],
    bass: [6, 4, 0, -1, -2],
    treble: [-2, -1, 0, 4, 6],
    vocal: [-2, 0, 4, 3, -1],
    rock: [4, 2, -1, 3, 5],
  };
  const vals = presets[btn.dataset.eqpreset] || presets.flat;
  vals.forEach((v, i) => { if (eqFilters[i]) eqFilters[i].gain.value = v; });
  renderEqualizer();
  toast(`🎛 EQ: ${btn.dataset.eqpreset}`);
}));

// ---- sleep timer ----
let sleepTimerId = null;
let sleepTimeRemaining = 0;
$('#sleepTimerBtn')?.addEventListener('click', () => {
  const modal = $('#sleepTimerModal');
  if (modal) modal.hidden = false;
});
$$('[data-sleep]').forEach(btn => btn.addEventListener('click', () => {
  const mins = Number(btn.dataset.sleep);
  if (sleepTimerId) clearInterval(sleepTimerId);
  if (mins === 0) {
    sleepTimerId = null;
    sleepTimeRemaining = 0;
    $('#sleepStatus').textContent = '';
    $('#sleepTimerModal').hidden = true;
    toast('😴 Sleep timer cancelled');
    return;
  }
  sleepTimeRemaining = mins * 60;
  sleepTimerId = setInterval(() => {
    sleepTimeRemaining--;
    const m = Math.floor(sleepTimeRemaining / 60);
    const s = sleepTimeRemaining % 60;
    const status = $('#sleepStatus');
    if (status) status.textContent = `Sleep in ${m}:${String(s).padStart(2, '0')}`;
    if (sleepTimeRemaining <= 0) {
      clearInterval(sleepTimerId);
      sleepTimerId = null;
      if (playerAudio) { playerAudio.pause(); $('#playerPlay').textContent = '▶'; $('#playerArtwork').classList.remove('playing'); }
      toast('😴 Sleep timer — playback stopped');
      addNotification('😴', 'Sleep timer stopped playback');
      if (status) status.textContent = '';
    }
  }, 1000);
  $('#sleepTimerModal').hidden = true;
  toast(`😴 Sleep timer: ${mins} minutes`);
}));

// ---- achievement system ----
const ACHIEVEMENTS = [
  { id: 'first', icon: '🎉', title: 'First Download', desc: 'Download your first file', check: s => s >= 1 },
  { id: 'ten', icon: '🔟', title: 'Getting Started', desc: 'Download 10 files', check: s => s >= 10 },
  { id: 'fifty', icon: '🏆', title: 'Power User', desc: 'Download 50 files', check: s => s >= 50 },
  { id: 'hundred', icon: '💯', title: 'Centurion', desc: 'Download 100 files', check: s => s >= 100 },
  { id: 'fivehundred', icon: '🌟', title: 'Legend', desc: 'Download 500 files', check: s => s >= 500 },
  { id: 'streak3', icon: '🔥', title: 'On Fire', desc: '3-day download streak', check: (s, st) => st >= 3 },
  { id: 'streak7', icon: '⚡', title: 'Unstoppable', desc: '7-day download streak', check: (s, st) => st >= 7 },
  { id: 'streak30', icon: '👑', title: 'King of Downloads', desc: '30-day download streak', check: (s, st) => st >= 30 },
];

function checkAchievements() {
  try {
    const stats = JSON.parse(localStorage.getItem('pg-stats') || '{}');
    const dl = stats.downloads || [];
    const total = dl.reduce((a, d) => a + d.count, 0);
    const unlocked = JSON.parse(localStorage.getItem('pg-achievements') || '[]');
    const uniqueDates = [...new Set(dl.map(d => d.date))].sort().reverse();
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const key = d.toISOString().slice(0, 10);
      if (uniqueDates.includes(key)) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    for (const a of ACHIEVEMENTS) {
      if (unlocked.includes(a.id)) continue;
      if (a.check(total, streak)) {
        unlocked.push(a.id);
        toast(`🏅 Achievement unlocked: ${a.title}!`);
        addNotification('🏅', `Achievement: ${a.title} — ${a.desc}`);
        fireConfetti();
      }
    }
    localStorage.setItem('pg-achievements', JSON.stringify(unlocked));
  } catch {}
}

function renderAchievements() {
  const wrap = $('#achievementsList');
  if (!wrap) return;
  const unlocked = JSON.parse(localStorage.getItem('pg-achievements') || '[]');
  wrap.innerHTML = ACHIEVEMENTS.map(a => {
    const done = unlocked.includes(a.id);
    return `<div class="achievement ${done ? 'unlocked' : 'locked'}">
      <span class="ach-icon">${a.icon}</span>
      <div class="ach-info"><div class="ach-title">${a.title}</div><div class="ach-desc">${a.desc}</div></div>
      ${done ? '<span class="ach-check">✓</span>' : '<span class="ach-lock">🔒</span>'}
    </div>`;
  }).join('');
}

// Hook into download complete to check achievements
const _origFinish2 = finishProgress;
finishProgress = function(job) {
  _origFinish2(job);
  if (job.status === 'complete') setTimeout(checkAchievements, 500);
};

// ---- heatmap calendar ----
function renderHeatmap() {
  const wrap = $('#heatmapGrid');
  if (!wrap) return;
  try {
    const stats = JSON.parse(localStorage.getItem('pg-stats') || '{}');
    const dl = stats.downloads || [];
    const counts = {};
    dl.forEach(d => { counts[d.date] = (counts[d.date] || 0) + d.count; });
    const cells = [];
    const today = new Date();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const count = counts[key] || 0;
      const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;
      cells.push(`<div class="hm-cell hm-${level}" title="${key}: ${count} downloads" data-date="${key}"></div>`);
    }
    wrap.innerHTML = cells.join('');
  } catch {}
}

// ---- focus mode ----
let focusMode = false;
$('#focusModeBtn')?.addEventListener('click', () => {
  focusMode = !focusMode;
  document.body.classList.toggle('focus-mode', focusMode);
  toast(focusMode ? '🧘 Focus mode on — distractions hidden' : '🧘 Focus mode off');
});

// ---- export as M3U playlist ----
$('#exportM3U')?.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/history');
    const { history } = await res.json();
    const completed = history.filter(h => h.status === 'complete');
    if (!completed.length) { toast('No completed downloads to export'); return; }
    let m3u = '#EXTM3U\n';
    completed.forEach(h => {
      m3u += `#EXTINF:-1,${h.title || 'Unknown'}\n`;
      m3u += `${h.sources?.[0]?.url || h.url || 'unknown'}\n`;
    });
    const blob = new Blob([m3u], { type: 'audio/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `purfflegrab-playlist-${new Date().toISOString().slice(0,10)}.m3u`;
    a.click();
    URL.revokeObjectURL(url);
    toast('📤 M3U playlist exported!');
    addNotification('📤', 'Playlist exported as M3U');
  } catch { toast('Export failed'); }
});

// ---- batch rename ----
$('#batchRenameBtn')?.addEventListener('click', () => {
  const modal = $('#batchRenameModal');
  if (modal) modal.hidden = false;
});
$('#batchRenameApply')?.addEventListener('click', () => {
  const pattern = $('#renamePattern')?.value?.trim();
  if (!pattern) { toast('Enter a rename pattern'); return; }
  toast(`📝 Rename pattern saved: ${pattern}`);
  try { localStorage.setItem('pg-rename-pattern', pattern); } catch {}
  $('#batchRenameModal').hidden = true;
});

// ---- drag reorder player playlist ----
(function initPlaylistDrag() {
  const list = $('#playerPlaylist');
  if (!list) return;
  let dragIdx = null;
  list.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.pl-item');
    if (!item) return;
    dragIdx = Number(item.dataset.pli);
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  list.addEventListener('dragend', (e) => {
    const item = e.target.closest('.pl-item');
    if (item) item.classList.remove('dragging');
    dragIdx = null;
  });
  list.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
  list.addEventListener('drop', (e) => {
    e.preventDefault();
    const item = e.target.closest('.pl-item');
    if (!item || dragIdx === null) return;
    const dropIdx = Number(item.dataset.pli);
    if (dragIdx !== dropIdx) {
      const moved = playerPlaylist.splice(dragIdx, 1)[0];
      playerPlaylist.splice(dropIdx, 0, moved);
      if (playerIdx === dragIdx) playerIdx = dropIdx;
      else if (dragIdx < playerIdx && dropIdx >= playerIdx) playerIdx--;
      else if (dragIdx > playerIdx && dropIdx <= playerIdx) playerIdx++;
      renderPlayerPlaylist();
    }
  });
})();

// ---- mini player (picture-in-picture style) ----
$('#miniPlayerToggle')?.addEventListener('click', () => {
  const mp = $('#pipPlayer');
  if (!mp) return;
  mp.hidden = !mp.hidden;
  if (!mp.hidden) updateMiniPlayer();
});

function updateMiniPlayer() {
  const mp = $('#pipPlayer');
  if (!mp || mp.hidden || !playerAudio) return;
  const track = playerPlaylist[playerIdx];
  $('#pipTitle').textContent = track?.name || 'No track';
  $('#pipTime').textContent = fmtDur(playerAudio.currentTime) + ' / ' + fmtDur(playerAudio.duration || 0);
  requestAnimationFrame(updateMiniPlayer);
}
$('#pipPlayBtn')?.addEventListener('click', () => $('#playerPlay')?.click());
$('#pipNextBtn')?.addEventListener('click', () => $('#playerNext')?.click());
$('#pipClose')?.addEventListener('click', () => { $('#pipPlayer').hidden = true; });

// Make PiP draggable
(function initPipDrag() {
  const pip = $('#pipPlayer');
  if (!pip) return;
  let dragging = false, ox, oy;
  pip.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    dragging = true;
    ox = e.clientX - pip.offsetLeft;
    oy = e.clientY - pip.offsetTop;
    pip.style.transition = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    pip.style.left = (e.clientX - ox) + 'px';
    pip.style.top = (e.clientY - oy) + 'px';
    pip.style.right = 'auto';
    pip.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => { dragging = false; if (pip) pip.style.transition = ''; });
})();

// Patch renderPlayerPlaylist to add draggable
const _origRenderPlaylist = renderPlayerPlaylist;
renderPlayerPlaylist = function() {
  _origRenderPlaylist();
  $$('.pl-item').forEach(el => { el.draggable = true; });
};

// ====================================================================
// v9.0 NEW FEATURES
// ====================================================================

// ---- scroll progress indicator ----
(function initScrollProgress() {
  const bar = $('#scrollProgress');
  const content = document.querySelector('.content');
  if (!bar || !content) return;
  content.addEventListener('scroll', () => {
    const pct = content.scrollTop / (content.scrollHeight - content.clientHeight) * 100;
    bar.style.width = Math.min(pct, 100) + '%';
  });
})();

// ---- visualizer modes ----
let vizMode = 'bars'; // bars, wave, circular
$('#vizModeBtn')?.addEventListener('click', () => {
  const modes = ['bars', 'wave', 'circular'];
  vizMode = modes[(modes.indexOf(vizMode) + 1) % modes.length];
  toast(`🎨 Visualizer: ${vizMode}`);
});

// Override waveform draw if exists
const _origDrawWaveform = typeof drawWaveform === 'function' ? drawWaveform : null;
if (_origDrawWaveform) {
  drawWaveform = function() {
    if (!playerAnalyser || !playerAudio || playerAudio.paused) return;
    const canvas = $('#waveformCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const bufLen = playerAnalyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);
    playerAnalyser.getByteFrequencyData(data);
    ctx.clearRect(0, 0, width, height);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#8b5cf6';

    if (vizMode === 'bars') {
      const barW = (width / bufLen) * 2.5;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const barH = (data[i] / 255) * height;
        const grad = ctx.createLinearGradient(0, height, 0, height - barH);
        grad.addColorStop(0, accent);
        grad.addColorStop(1, '#ec4899');
        ctx.fillStyle = grad;
        ctx.fillRect(x, height - barH, barW - 1, barH);
        x += barW;
        if (x > width) break;
      }
    } else if (vizMode === 'wave') {
      playerAnalyser.getByteTimeDomainData(data);
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = accent;
      const sliceW = width / bufLen;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const v = data[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += sliceW;
      }
      ctx.stroke();
    } else if (vizMode === 'circular') {
      const cx = width / 2, cy = height / 2, radius = Math.min(cx, cy) * 0.6;
      ctx.beginPath();
      for (let i = 0; i < bufLen; i++) {
        const angle = (i / bufLen) * Math.PI * 2 - Math.PI / 2;
        const amp = (data[i] / 255) * (radius * 0.8);
        const x = cx + Math.cos(angle) * (radius + amp);
        const y = cy + Math.sin(angle) * (radius + amp);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    requestAnimationFrame(drawWaveform);
  };
}

// ---- crossfade ----
let crossfadeDuration = 3; // seconds
$('#crossfadeSlider')?.addEventListener('input', (e) => {
  crossfadeDuration = Number(e.target.value);
  $('#crossfadeVal').textContent = `${crossfadeDuration}s`;
});

// ---- floating music notes during playback ----
let notesInterval = null;
function startMusicNotes() {
  if (notesInterval) return;
  const container = $('#musicNotes');
  if (!container) return;
  container.hidden = false;
  const notes = ['♪', '♫', '♬', '♩', '𝅗𝅥', '🎵', '🎶'];
  notesInterval = setInterval(() => {
    const note = document.createElement('span');
    note.className = 'floating-note';
    note.textContent = notes[Math.floor(Math.random() * notes.length)];
    note.style.left = (10 + Math.random() * 80) + '%';
    note.style.animationDuration = (3 + Math.random() * 4) + 's';
    note.style.fontSize = (14 + Math.random() * 18) + 'px';
    container.appendChild(note);
    setTimeout(() => note.remove(), 7000);
  }, 800);
}
function stopMusicNotes() {
  if (notesInterval) { clearInterval(notesInterval); notesInterval = null; }
  const container = $('#musicNotes');
  if (container) container.hidden = true;
}

// Hook player play/pause for music notes
const _origPlayerPlay = $('#playerPlay');
if (_origPlayerPlay) {
  const origClick = _origPlayerPlay.onclick;
  _origPlayerPlay.addEventListener('click', () => {
    setTimeout(() => {
      if (playerAudio && !playerAudio.paused) startMusicNotes();
      else stopMusicNotes();
    }, 100);
  });
}

// ---- mood themes ----
const MOOD_THEMES = {
  sunset: { brand: '#f97316', brand2: '#ef4444', brand3: '#fbbf24' },
  ocean: { brand: '#06b6d4', brand2: '#3b82f6', brand3: '#22d3ee' },
  forest: { brand: '#10b981', brand2: '#84cc16', brand3: '#34d399' },
  neon: { brand: '#f0abfc', brand2: '#c084fc', brand3: '#67e8f9' },
  midnight: { brand: '#6366f1', brand2: '#8b5cf6', brand3: '#a78bfa' },
  cherry: { brand: '#f43f5e', brand2: '#ec4899', brand3: '#fb7185' },
};
$$('[data-mood]').forEach(btn => btn.addEventListener('click', () => {
  const mood = MOOD_THEMES[btn.dataset.mood];
  if (!mood) return;
  document.documentElement.style.setProperty('--brand', mood.brand);
  document.documentElement.style.setProperty('--brand-2', mood.brand2);
  document.documentElement.style.setProperty('--brand-3', mood.brand3);
  $$('[data-mood]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  toast(`🎨 Mood: ${btn.dataset.mood}`);
  try { localStorage.setItem('pg-mood', btn.dataset.mood); } catch {}
}));
// Restore mood on load
try {
  const savedMood = localStorage.getItem('pg-mood');
  if (savedMood && MOOD_THEMES[savedMood]) {
    const m = MOOD_THEMES[savedMood];
    document.documentElement.style.setProperty('--brand', m.brand);
    document.documentElement.style.setProperty('--brand-2', m.brand2);
    document.documentElement.style.setProperty('--brand-3', m.brand3);
    $$(`[data-mood="${savedMood}"]`).forEach(b => b.classList.add('active'));
  }
} catch {}

// ---- lyrics viewer ----
$('#lyricsToggle')?.addEventListener('click', () => {
  const panel = $('#lyricsPanel');
  if (panel) panel.hidden = !panel.hidden;
  if (panel && !panel.hidden) fetchLyrics();
});

async function fetchLyrics() {
  const title = $('#playerTitle')?.textContent;
  const artist = $('#playerArtist')?.textContent;
  const lyricsBody = $('#lyricsBody');
  if (!lyricsBody || !title || title === 'No track loaded') {
    if (lyricsBody) lyricsBody.innerHTML = '<p class="hint center">No track playing</p>';
    return;
  }
  lyricsBody.innerHTML = '<p class="hint center">Searching lyrics...</p>';
  try {
    const q = encodeURIComponent(`${artist} ${title} lyrics`);
    // Use a simple lyrics placeholder since we can't call external APIs directly
    lyricsBody.innerHTML = `<div class="lyrics-content">
      <p class="lyrics-title">${esc(title)}</p>
      <p class="lyrics-artist">${esc(artist)}</p>
      <hr style="border-color:var(--border);margin:12px 0"/>
      <p class="lyrics-placeholder">Lyrics display ready.<br>Connect a lyrics API or paste lyrics manually below.</p>
      <textarea id="lyricsManual" class="text-input" rows="8" placeholder="Paste lyrics here..." style="margin-top:12px;width:100%;resize:vertical"></textarea>
    </div>`;
  } catch {
    lyricsBody.innerHTML = '<p class="hint center">Could not load lyrics</p>';
  }
}

// ---- tag editor ----
$('#tagEditorBtn')?.addEventListener('click', () => {
  const modal = $('#tagEditorModal');
  if (!modal) return;
  modal.hidden = false;
  const track = playerPlaylist?.[playerIdx];
  if (track) {
    const name = track.name || '';
    const parts = name.split(' - ');
    $('#tagTitle').value = parts.length > 1 ? parts[1]?.trim() || name : name;
    $('#tagArtist').value = parts.length > 1 ? parts[0]?.trim() || '' : '';
    $('#tagAlbum').value = '';
  }
});
$('#tagSaveBtn')?.addEventListener('click', () => {
  const title = $('#tagTitle')?.value?.trim();
  const artist = $('#tagArtist')?.value?.trim();
  if (title && playerPlaylist?.[playerIdx]) {
    playerPlaylist[playerIdx].name = artist ? `${artist} - ${title}` : title;
    renderPlayerPlaylist();
    if ($('#playerTitle')) $('#playerTitle').textContent = title;
    if ($('#playerArtist')) $('#playerArtist').textContent = artist || 'Unknown artist';
    toast('🏷 Tags updated');
  }
  $('#tagEditorModal').hidden = true;
});

// ---- QR code generator ----
$('#qrGenBtn')?.addEventListener('click', () => {
  const modal = $('#qrModal');
  if (modal) modal.hidden = false;
});
$('#qrGenerateBtn')?.addEventListener('click', () => {
  const url = $('#qrInput')?.value?.trim();
  const canvas = $('#qrCanvas');
  if (!url || !canvas) { toast('Enter a URL'); return; }
  // Simple QR code visualization (placeholder — uses a canvas pattern)
  const ctx = canvas.getContext('2d');
  const size = 200;
  canvas.width = size; canvas.height = size;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  // Generate a deterministic pattern from URL hash
  let hash = 0;
  for (let i = 0; i < url.length; i++) hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  const moduleSize = 5;
  const count = Math.floor(size / moduleSize);
  // Draw finder patterns (corners)
  function drawFinder(x, y) {
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4))
        ctx.fillRect((x + i) * moduleSize, (y + j) * moduleSize, moduleSize, moduleSize);
    }
  }
  drawFinder(0, 0); drawFinder(count - 7, 0); drawFinder(0, count - 7);
  // Fill data area with hash-based pattern
  let seed = Math.abs(hash);
  for (let i = 8; i < count - 8; i++) for (let j = 0; j < count; j++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    if (seed % 3 === 0) ctx.fillRect(i * moduleSize, j * moduleSize, moduleSize, moduleSize);
  }
  toast('📱 QR code generated');
});

// ---- keyboard piano ----
const PIANO_NOTES = {
  'a': 261.63, 's': 293.66, 'd': 329.63, 'f': 349.23, 'g': 392.00,
  'h': 440.00, 'j': 493.88, 'k': 523.25, 'l': 587.33,
  'w': 277.18, 'e': 311.13, 't': 369.99, 'y': 415.30, 'u': 466.16,
};
let pianoCtx = null;
let pianoEnabled = false;
$('#pianoToggle')?.addEventListener('click', () => {
  pianoEnabled = !pianoEnabled;
  $('#pianoPanel')?.classList.toggle('active', pianoEnabled);
  toast(pianoEnabled ? '🎹 Piano mode ON — use keys A-L' : '🎹 Piano mode OFF');
});
document.addEventListener('keydown', (e) => {
  if (!pianoEnabled) return;
  const freq = PIANO_NOTES[e.key.toLowerCase()];
  if (!freq) return;
  e.preventDefault();
  // Highlight key
  $$(`.piano-key[data-note="${e.key.toLowerCase()}"]`).forEach(k => k.classList.add('pressed'));
  try {
    if (!pianoCtx) pianoCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = pianoCtx.createOscillator();
    const gain = pianoCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, pianoCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, pianoCtx.currentTime + 0.8);
    osc.connect(gain).connect(pianoCtx.destination);
    osc.start(); osc.stop(pianoCtx.currentTime + 0.8);
  } catch {}
});
document.addEventListener('keyup', (e) => {
  if (!pianoEnabled) return;
  $$(`.piano-key[data-note="${e.key.toLowerCase()}"]`).forEach(k => k.classList.remove('pressed'));
});

// ---- ambient sounds ----
let ambientSounds = {};
const AMBIENT_URLS = {
  rain: null, fire: null, birds: null, waves: null, wind: null
};
$$('[data-ambient]').forEach(btn => btn.addEventListener('click', () => {
  const key = btn.dataset.ambient;
  if (ambientSounds[key]) {
    // Stop
    ambientSounds[key].stop();
    delete ambientSounds[key];
    btn.classList.remove('active');
    toast(`🔇 ${key} stopped`);
    return;
  }
  // Generate ambient sound using oscillators
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    if (key === 'rain' || key === 'wind') {
      // Brown noise for rain/wind
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (last + (0.02 * white)) / 1.02;
        last = output[i];
        output[i] *= 3.5;
      }
    } else if (key === 'fire') {
      // Crackling - random pops
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * (Math.random() < 0.01 ? 0.5 : 0.02);
      }
    } else if (key === 'waves') {
      // Sine wave modulated noise
      for (let i = 0; i < bufferSize; i++) {
        const mod = Math.sin(i / (ctx.sampleRate * 4)) * 0.5 + 0.5;
        output[i] = (Math.random() * 2 - 1) * mod * 0.15;
      }
    } else {
      // Birds - random chirps using sine tones
      for (let i = 0; i < bufferSize; i++) {
        const chirp = Math.sin(i * (2000 + Math.sin(i / 800) * 1000) / ctx.sampleRate * Math.PI * 2);
        output[i] = chirp * (Math.random() < 0.003 ? 0.2 : 0) * Math.random();
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    source.connect(gain).connect(ctx.destination);
    source.start();
    ambientSounds[key] = { stop: () => { source.stop(); ctx.close(); } };
    btn.classList.add('active');
    toast(`🔊 ${key} ambience playing`);
  } catch { toast('Could not start ambient sound'); }
}));

// ---- download comparison (file size before/after) ----
const _origFinish3 = finishProgress;
finishProgress = function(job) {
  _origFinish3(job);
  if (job.status === 'complete') {
    const comparison = $('#downloadComparison');
    if (comparison) {
      comparison.hidden = false;
      // Show estimated vs actual
      const items = job.items || [];
      const totalFiles = items.filter(i => i.status === 'done').length;
      comparison.innerHTML = `<div class="comparison-card">
        <div class="comp-stat"><span class="comp-icon">📁</span><span class="comp-val">${totalFiles}</span><span class="comp-label">Files downloaded</span></div>
        <div class="comp-stat"><span class="comp-icon">⚡</span><span class="comp-val">${fmtTime((Date.now() - (downloadStartTime || Date.now())) / 1000)}</span><span class="comp-label">Total time</span></div>
        <div class="comp-stat"><span class="comp-icon">📊</span><span class="comp-val">${job.format || 'auto'}</span><span class="comp-label">Format</span></div>
      </div>`;
    }
  }
};

// ---- speed history persistence ----
function saveSpeedHistory() {
  try {
    const history = JSON.parse(localStorage.getItem('pg-speed-history') || '[]');
    if (speedHistory.length) {
      const avg = speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length;
      history.push({ date: new Date().toISOString(), avg: Math.round(avg), peak: Math.max(...speedHistory) });
      // Keep last 50
      while (history.length > 50) history.shift();
      localStorage.setItem('pg-speed-history', JSON.stringify(history));
    }
  } catch {}
}
const _origFinish4 = finishProgress;
finishProgress = function(job) {
  _origFinish4(job);
  saveSpeedHistory();
};

function renderSpeedHistory() {
  const wrap = $('#speedHistoryChart');
  if (!wrap) return;
  try {
    const history = JSON.parse(localStorage.getItem('pg-speed-history') || '[]');
    if (!history.length) { wrap.innerHTML = '<p class="hint center">No speed history yet</p>'; return; }
    const max = Math.max(...history.map(h => h.peak), 1);
    wrap.innerHTML = history.slice(-20).map(h => {
      const pct = (h.avg / max) * 100;
      const date = h.date.slice(5, 10);
      return `<div class="sh-bar" style="height:${pct}%" title="${date}: avg ${fmtBytes(h.avg)}/s, peak ${fmtBytes(h.peak)}/s"><span class="sh-label">${date}</span></div>`;
    }).join('');
  } catch {}
}
