// Capture 1920x1080 scene screenshots for the promo video.
// Run with:  npx electron scripts/capture-video-scenes.mjs
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
process.env.PURFFLE_BIN = path.join(ROOT, 'bin');

const OUT_ENV = process.env.SCENES_OUT;
const OUT = OUT_ENV || path.join(ROOT, '.scene-out');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Pass a plain string (not a template) so no accidental interpolation.
// We use JSON-stringified payloads for HTML content to avoid escape hell.
const inject = async (win, js) => {
  try {
    await win.webContents.executeJavaScript(js + '; true;');
  } catch (e) {
    console.error('INJECT ERROR:', e.message);
    console.error('JS was:', js.slice(0, 500));
    throw e;
  }
};

app.whenReady().then(async () => {
  const { port } = await startServer({
    publicDir: path.join(ROOT, 'public'),
    dataDir: path.join(ROOT, '.cap-data'),
    downloadsDir: path.join(ROOT, '.cap-dl'),
    port: 7813,
  });

  const win = new BrowserWindow({
    width: 1920, height: 1080,
    useContentSize: true,
    show: true,
    backgroundColor: '#0b0a12',
    autoHideMenuBar: true,
    frame: false,
  });
  win.setMenuBarVisibility(false);
  await win.loadURL('http://localhost:' + port);
  await wait(1400);

  const shoot = async (name) => {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, name + '.png'), img.toPNG());
    console.log('saved', name);
  };

  // Helper: set the active view + reset transient state
  const goToDownload = () => inject(win,
    "document.querySelectorAll('.tour-overlay,.modal').forEach(o=>o.hidden=true);" +
    "document.querySelectorAll('.side-btn').forEach(b=>b.classList.toggle('active',b.dataset.view==='download'));" +
    "document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-download'));" +
    "document.querySelector('#urlInput').value='';" +
    "document.querySelector('#panel').hidden=true;" +
    "document.querySelector('#progress').hidden=true;" +
    "document.querySelector('#sourceCards').innerHTML='';" +
    "window.scrollTo(0,0);"
  );

  const goTo = (view) => inject(win,
    "document.querySelectorAll('.tour-overlay,.modal').forEach(o=>o.hidden=true);" +
    "document.querySelectorAll('.side-btn').forEach(b=>b.classList.toggle('active',b.dataset.view==='" + view + "'));" +
    "document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-" + view + "'));"
  );

  const setHTML = (selector, html) => inject(win,
    "document.querySelector(" + JSON.stringify(selector) + ").innerHTML = " + JSON.stringify(html) + ";"
  );

  // ================================================================
  // 01 — HERO
  // ================================================================
  await goToDownload();
  await wait(300);
  await shoot('01_hero');

  // ================================================================
  // 02 — PASTE
  // ================================================================
  await goToDownload();
  const pasteJS =
    "const ta=document.querySelector('#urlInput');" +
    "ta.value='https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M\\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ';" +
    "ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,180)+'px';" +
    "ta.focus();";
  await inject(win, pasteJS);
  await wait(300);
  await shoot('02_paste');

  // ================================================================
  // 03 — ANALYZE
  // ================================================================
  await goToDownload();
  const tracks = [
    ['The Weeknd', 'Blinding Lights', '3:20'],
    ['Dua Lipa', 'Levitating', '3:23'],
    ['Harry Styles', 'As It Was', '2:47'],
    ['Tame Impala', 'The Less I Know The Better', '3:36'],
    ['Doja Cat', 'Say So', '3:57'],
    ['Glass Animals', 'Heat Waves', '3:58'],
    ['Post Malone', 'Sunflower', '2:38'],
    ['Billie Eilish', 'Bad Guy', '3:14'],
  ];
  const trackList = tracks.map((t, i) =>
    '<li><label class="trk"><input type="checkbox" checked/><span class="trk-n">' + (i+1) + '.</span><span class="trk-t">' + t[0] + ' — ' + t[1] + '</span><span class="trk-d">' + t[2] + '</span></label></li>'
  ).join('');
  const sc3Html =
    '<div class="source-card"><div class="sc-top">' +
    '<div class="sc-thumb" style="background:linear-gradient(135deg,#1db954,#0d572b);width:88px;height:88px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:36px;color:#fff">♫</div>' +
    '<div class="sc-body"><span class="badge spotify">♫ Spotify</span>' +
    '<h4 class="sc-title">Today&#39;s Top Hits</h4>' +
    '<p class="meta-sub">' + tracks.length + ' tracks · 26 min</p></div></div>' +
    '<div class="track-tools"><button class="mini">Select all</button><button class="mini">None</button>' +
    '<input type="text" class="track-search" placeholder="Filter tracks…" />' +
    '<span class="sel-info">' + tracks.length + '/' + tracks.length + ' selected</span></div>' +
    '<ul class="track-list">' + trackList + '</ul></div>';
  await setHTML('#sourceCards', sc3Html);
  await inject(win, "document.querySelector('#panel').hidden=false;window.scrollTo(0,340);");
  await wait(400);
  await shoot('03_analyze');

  // ================================================================
  // 04 — PRESETS
  // ================================================================
  await goToDownload();
  const sc4Html =
    '<div class="source-card"><div class="sc-top">' +
    '<div class="sc-thumb" style="background:linear-gradient(135deg,#ec4899,#f97316);width:88px;height:88px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:36px;color:#fff">▶</div>' +
    '<div class="sc-body"><span class="badge youtube">▶ YouTube</span>' +
    '<h4 class="sc-title">Never Gonna Give You Up · Rick Astley</h4>' +
    '<p class="meta-sub">Rick Astley · 3:33</p></div></div></div>';
  await setHTML('#sourceCards', sc4Html);
  await inject(win,
    "document.querySelector('#panel').hidden=false;" +
    "document.querySelectorAll('.preset').forEach(p=>p.classList.remove('active'));" +
    "var p=document.querySelector('.preset[data-preset=\\'video4k\\']');if(p)p.classList.add('active');" +
    "document.querySelectorAll('#contentTypeSeg .seg-btn').forEach(b=>b.classList.toggle('active',b.dataset.type==='video'));" +
    "document.querySelector('#resGroup').hidden=false;" +
    "document.querySelector('#audioGroup').hidden=true;" +
    "document.querySelector('#bitrateGroup').hidden=true;" +
    "document.querySelector('#resolution').value='2160';" +
    "window.scrollTo(0,460);"
  );
  await wait(400);
  await shoot('04_presets');

  // ================================================================
  // 05 — PROGRESS
  // ================================================================
  await goToDownload();
  const items = [
    ['The Weeknd — Blinding Lights', 'done', 100],
    ['Dua Lipa — Levitating', 'done', 100],
    ['Harry Styles — As It Was', 'done', 100],
    ['Tame Impala — The Less I Know The Better', 'done', 100],
    ['Doja Cat — Say So', 'done', 100],
    ['Glass Animals — Heat Waves', 'running', 74],
    ['Post Malone — Sunflower', 'running', 41],
    ['Billie Eilish — Bad Guy', 'queued', 0],
  ];
  const itemsHtml = items.map(i =>
    '<li class="dl-item ' + i[1] + '">' +
    '<span class="dl-name">' + i[0] + '</span>' +
    '<span class="dl-bar"><span class="dl-bar-fill" style="width:' + i[2] + '%"></span></span>' +
    '<span class="dl-pct">' + (i[1]==='done'?'✓':(i[1]==='queued'?'·':i[2]+'%')) + '</span></li>'
  ).join('');
  await inject(win,
    "document.querySelector('#progress').hidden=false;" +
    "document.querySelector('#progTitle').textContent='Downloading Today\\'s Top Hits';" +
    "document.querySelector('#progPct').textContent='62%';" +
    "document.querySelector('#progBar').style.width='62%';" +
    "document.querySelector('#progMeta').textContent='5 of 8 · 12.4 MB/s';" +
    "document.querySelector('#progTimeInfo').textContent='about 48 seconds remaining';"
  );
  await setHTML('#itemList', itemsHtml);
  await inject(win, "window.scrollTo(0,260);");
  await wait(400);
  await shoot('05_progress');

  // ================================================================
  // 06 — SEARCH
  // ================================================================
  await goTo('search');
  await inject(win, "document.querySelector('#searchInput').value='lofi hip hop beats';");
  const results = [
    ['lofi hip hop radio — beats to relax/study to', 'Lofi Girl', '1.2B views', '24:00:00'],
    ['Chillhop Essentials — Autumn 2024', 'Chillhop Music', '38M views', '58:12'],
    ['Best of Lofi Hip Hop 2024', 'Lofi Fruits Music', '14M views', '1:02:45'],
    ['Late Night Lofi — Study Session', 'Nujabes Lofi', '5.6M views', '45:30'],
    ['Chill Beats to Work / Code', 'Purffle Beats', '2.1M views', '1:15:00'],
    ['Rainy Lofi Cafe Ambience', 'Coffee Shop Vibes', '892K views', '3:00:00'],
  ];
  const gradients = [
    '#8b5cf6,#3b82f6', '#ec4899,#f97316', '#10b981,#06b6d4',
    '#f59e0b,#ef4444', '#84cc16,#22d3ee', '#a855f7,#ec4899',
  ];
  const resultsHtml = results.map((r,i) =>
    '<div class="result-card' + (i<3?' selected':'') + '">' +
    '<div class="rc-thumb" style="background:linear-gradient(135deg,' + gradients[i] + ');position:relative;height:135px;border-radius:10px;">' +
    '<span style="position:absolute;bottom:6px;right:8px;background:rgba(0,0,0,.7);color:#fff;font-size:12px;padding:2px 6px;border-radius:4px">' + r[3] + '</span></div>' +
    '<div class="rc-body"><h4 class="rc-title">' + r[0] + '</h4>' +
    '<p class="rc-meta">' + r[1] + ' · ' + r[2] + '</p></div>' +
    '<label class="rc-check"><input type="checkbox"' + (i<3?' checked':'') + '/></label></div>'
  ).join('');
  await setHTML('#searchResults', resultsHtml);
  await inject(win,
    "document.querySelector('#searchActions').hidden=false;" +
    "document.querySelector('#selCount').textContent='3 selected';" +
    "document.querySelector('#resultCount').textContent='" + results.length + " results';" +
    "window.scrollTo(0,0);"
  );
  await wait(400);
  await shoot('06_search');

  // ================================================================
  // 07 — QUEUE
  // ================================================================
  await goTo('queue');
  const qItems = [
    ['The Weeknd — Blinding Lights', 'MP3 320'],
    ['Rick Astley — Never Gonna Give You Up', '4K MP4'],
    ["Today's Top Hits (playlist · 50)", 'FLAC'],
    ['lofi hip hop radio — 24h stream', '720p MP4'],
    ['The Joe Rogan Experience #2050', 'Podcast MP3'],
    ['Chillhop Essentials — Autumn 2024', 'MP3 320'],
  ];
  const qHtml = qItems.map(q =>
    '<div class="queue-item">' +
    '<div class="qi-thumb" style="background:linear-gradient(135deg,#8b5cf6,#ec4899);width:56px;height:56px;border-radius:10px;"></div>' +
    '<div class="qi-body"><div class="qi-title">' + q[0] + '</div>' +
    '<div class="qi-meta"><span class="qi-preset">' + q[1] + '</span> · queued</div></div>' +
    '<button class="qi-btn">✕</button></div>'
  ).join('');
  await setHTML('#queueList', qHtml);
  await inject(win,
    "document.querySelector('#queueStartAll').disabled=false;" +
    "document.querySelector('#queuePauseAll').disabled=false;" +
    "document.querySelector('#queueClearAll').disabled=false;" +
    "document.querySelector('#queueStats').textContent='" + qItems.length + " items · ~1.2 GB';" +
    "document.querySelector('#queueBadge').textContent='" + qItems.length + "';" +
    "document.querySelector('#queueBadge').hidden=false;" +
    "window.scrollTo(0,0);"
  );
  await wait(400);
  await shoot('07_queue');

  // ================================================================
  // 08 — SCHEDULER
  // ================================================================
  await goTo('scheduler');
  const scheduled = [
    ['Lofi Girl — daily stream', 'Every day · 2:30 AM', 'in 3h 12m'],
    ['Chillhop Weekly Radio', 'Every Sunday · 8:00 PM', 'in 2 days'],
    ["Rick Astley — Never Gonna…", 'Once · Tomorrow 6:00 AM', 'in 6h 42m'],
  ];
  const sHtml = scheduled.map(s =>
    '<div class="queue-item">' +
    '<div class="qi-thumb" style="background:linear-gradient(135deg,#f59e0b,#ef4444);width:56px;height:56px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:24px">⏰</div>' +
    '<div class="qi-body"><div class="qi-title">' + s[0] + '</div>' +
    '<div class="qi-meta">' + s[1] + ' · next ' + s[2] + '</div></div>' +
    '<button class="qi-btn">✕</button></div>'
  ).join('');
  await setHTML('#scheduleList', sHtml);
  await inject(win,
    "document.querySelector('#scheduleUrl').value='https://www.youtube.com/@lofigirl/streams';" +
    "var t=new Date();t.setDate(t.getDate()+1);var pad=n=>String(n).padStart(2,'0');" +
    "document.querySelector('#scheduleDate').value=t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate());" +
    "document.querySelector('#scheduleTime').value='02:30';" +
    "document.querySelector('#scheduleRepeat').value='daily';" +
    "window.scrollTo(0,0);"
  );
  await wait(400);
  await shoot('08_scheduler');

  // ================================================================
  // 09 — CONVERTER
  // ================================================================
  await goTo('converter');
  await inject(win,
    "document.querySelector('#converterInfo').hidden=false;" +
    "document.querySelector('#converterFileName').textContent='📄 The Weeknd — Blinding Lights.wav (52.4 MB)';" +
    "document.querySelector('#convertFormat').value='flac';" +
    "document.querySelector('#convertQuality').value='high';" +
    "window.scrollTo(0,0);"
  );
  await wait(400);
  await shoot('09_converter');

  // ================================================================
  // 10 — SETTINGS
  // ================================================================
  await goTo('settings');
  await inject(win,
    "document.querySelector('#outputDir').value='C:\\\\Users\\\\Chama\\\\Music\\\\PurffleGrab';" +
    "document.querySelectorAll('.swatch').forEach(s=>s.classList.toggle('active',s.dataset.color==='#ec4899'));" +
    "document.documentElement.style.setProperty('--brand','#ec4899');" +
    "window.scrollTo(0,0);"
  );
  await wait(400);
  await shoot('10_settings');

  console.log('DONE — all scenes captured to', OUT);
  app.quit();
}).catch((e) => { console.error('FATAL', e); app.quit(); });
