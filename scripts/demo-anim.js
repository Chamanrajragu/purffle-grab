// Deterministic demo animation driver, injected into the running PurffleGrab UI.
//
// Every frame is a pure function of (sceneId, t): __demo.frame(id, t, dur) sets the
// complete DOM state for time t. Nothing depends on the wall clock, so capture can
// run slower than real time and still produce perfectly smooth 30fps motion.
//
// All CSS transitions/animations in the app are disabled on init -- they are
// wall-clock driven and would tear frames. Motion here is explicit inline style.
(() => {
  const D = {};
  window.__demo = D;

  // ------------------------------------------------------------------ helpers
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  // normalised progress of t through the window [a,b]
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, k) => a + (b - a) * k;

  const rect = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return r;
  };
  const centre = (sel, dx = 0, dy = 0) => {
    const r = rect(sel);
    if (!r) return null;
    return { x: r.left + r.width / 2 + dx, y: r.top + r.height / 2 + dy };
  };

  // Move along a list of {t,x,y} waypoints with eased segments.
  const along = (t, pts) => {
    if (!pts.length) return { x: 0, y: 0 };
    if (t <= pts[0].t) return { x: pts[0].x, y: pts[0].y };
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i].t) {
        const a = pts[i - 1], b = pts[i];
        const k = easeInOut(seg(t, a.t, b.t));
        return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
      }
    }
    const z = pts[pts.length - 1];
    return { x: z.x, y: z.y };
  };

  // Deterministic pseudo-noise so "live" speed readouts wobble believably.
  const wob = (t, f, a) => Math.sin(t * f) * a + Math.sin(t * f * 2.7 + 1.3) * a * 0.4;

  const typeOut = (full, t, t0, t1) =>
    full.slice(0, Math.round(full.length * clamp01((t - t0) / (t1 - t0))));

  // ------------------------------------------------------------------- init
  D.init = () => {
    // 1. Kill every wall-clock animation so frames are reproducible.
    const kill = document.createElement('style');
    kill.textContent = `
      *,*::before,*::after{
        transition:none !important;
        animation:none !important;
        scroll-behavior:auto !important;
      }
      #__cur,#__rip,#__dd,#__end,#__drag{pointer-events:none;}
      .tour-overlay{display:none !important;}
      ::-webkit-scrollbar{width:0 !important;height:0 !important;}
    `;
    document.head.appendChild(kill);

    try { localStorage.setItem('pg-toured-v3', '1'); } catch (e) { /* ignore */ }
    $$('.tour-overlay,.modal').forEach((o) => { o.hidden = true; });

    // 2. Click ripple.
    const rip = document.createElement('div');
    rip.id = '__rip';
    rip.style.cssText = 'position:fixed;border-radius:50%;z-index:99998;opacity:0;'
      + 'background:radial-gradient(circle,rgba(139,92,246,.55),rgba(236,72,153,.12) 70%,transparent 72%);';
    document.body.appendChild(rip);

    // 3. Cursor -- white arrow with dark outline so it reads on light and dark UI.
    const cur = document.createElement('div');
    cur.id = '__cur';
    cur.style.cssText = 'position:fixed;z-index:99999;width:30px;height:30px;'
      + 'left:0;top:0;will-change:transform;';
    cur.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24">
      <path d="M5 2l14 9.5-6.1.9 3.4 6.6-2.7 1.4-3.4-6.6-3.5 4.2z"
            fill="#fff" stroke="rgba(15,12,25,.85)" stroke-width="1.4"
            stroke-linejoin="round"/></svg>`;
    document.body.appendChild(cur);

    // 4. Faux dropdown -- a native <select> popup cannot be screen-captured.
    const dd = document.createElement('div');
    dd.id = '__dd';
    dd.style.cssText = 'position:fixed;z-index:99997;display:none;min-width:240px;'
      + 'background:#fff;border:1px solid rgba(20,16,32,.14);border-radius:12px;'
      + 'box-shadow:0 24px 60px rgba(15,12,25,.28);overflow:hidden;'
      + 'font:500 15px/1 "Segoe UI",Inter,system-ui,sans-serif;color:#1c1830;padding:6px;';
    document.body.appendChild(dd);

    // 5. A chip that flies into the converter dropzone.
    const drag = document.createElement('div');
    drag.id = '__drag';
    drag.style.cssText = 'position:fixed;z-index:99996;display:none;padding:12px 20px;'
      + 'border-radius:12px;background:#fff;border:1px solid rgba(20,16,32,.14);'
      + 'box-shadow:0 18px 44px rgba(15,12,25,.24);'
      + 'font:600 15px/1 "Segoe UI",Inter,system-ui,sans-serif;color:#1c1830;white-space:nowrap;';
    document.body.appendChild(drag);

    // 6. Full-bleed end card.
    const end = document.createElement('div');
    end.id = '__end';
    end.style.cssText = 'position:fixed;inset:0;z-index:100000;display:none;'
      + 'background:#0b0a12;overflow:hidden;'
      + 'font-family:"Segoe UI Variable Display","Segoe UI",Inter,system-ui,sans-serif;';
    end.innerHTML = `
      <div id="__end_glow" style="position:absolute;inset:0;
        background:radial-gradient(ellipse 55% 45% at 50% 42%,rgba(139,92,246,.30),transparent 65%),
                   radial-gradient(ellipse 55% 45% at 58% 72%,rgba(236,72,153,.24),transparent 60%);"></div>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                  align-items:center;justify-content:center;">
        <div id="__end_icon" style="width:170px;height:170px;border-radius:40px;
             background:linear-gradient(135deg,#8b5cf6,#ec4899);display:flex;
             align-items:center;justify-content:center;margin-bottom:46px;
             box-shadow:0 26px 90px rgba(236,72,153,.45);">
          <svg width="96" height="96" viewBox="0 0 24 24" fill="#fff">
            <path d="M12 3v10.17l3.59-3.58L17 11l-5 5-5-5 1.41-1.41L12 13.17V3z"/>
            <path d="M5 19h14v2H5z"/></svg>
        </div>
        <div id="__end_name" style="font-size:112px;font-weight:800;letter-spacing:-2px;
             background:linear-gradient(90deg,#fff,#f9a8d4 60%,#c4b5fd);
             -webkit-background-clip:text;background-clip:text;color:transparent;
             margin-bottom:20px;">PurffleGrab</div>
        <div id="__end_tag" style="font-size:33px;color:#cfccdb;margin-bottom:44px;">
          Free. Open source. <b style="color:#f9a8d4;">Spotify &amp; YouTube</b> — MP3, MP4, FLAC, 4K.</div>
        <div id="__end_cta" style="padding:25px 58px;border-radius:999px;font-size:33px;
             font-weight:800;color:#fff;background:linear-gradient(135deg,#8b5cf6,#ec4899);
             box-shadow:0 22px 66px rgba(236,72,153,.45);">⬇ Free on GitHub</div>
        <div id="__end_url" style="margin-top:30px;font-size:25px;color:#a7a4b8;
             letter-spacing:.4px;">github.com/Chamanrajragu/purffle-grab</div>
      </div>
      <div id="__end_foot" style="position:absolute;bottom:40px;left:0;right:0;
           text-align:center;color:#6b6980;font-size:21px;">a Purffle tool · purffle.com</div>`;
    document.body.appendChild(end);

    D._built = null;
    return true;
  };

  // ---------------------------------------------------------- per-frame paint
  D._cursor = { x: 1700, y: 980, press: 0, hidden: false };

  const paintCursor = () => {
    const c = $('#__cur');
    const s = 1 - 0.22 * D._cursor.press;
    c.style.opacity = D._cursor.hidden ? '0' : '1';
    c.style.transform = `translate(${D._cursor.x}px,${D._cursor.y}px) scale(${s})`;
  };

  // Click feedback: ripple expands and fades over 0.45s from tc.
  const clickAt = (t, tc, x, y) => {
    const k = seg(t, tc, tc + 0.45);
    const el = $('#__rip');
    if (k <= 0 || k >= 1) { el.style.opacity = '0'; }
    else {
      const size = 14 + 78 * easeOut(k);
      el.style.width = el.style.height = size + 'px';
      el.style.left = (x - size / 2) + 'px';
      el.style.top = (y - size / 2) + 'px';
      el.style.opacity = String(0.6 * (1 - k));
    }
    // brief cursor press right at the click
    D._cursor.press = t >= tc - 0.05 && t <= tc + 0.14 ? 1 : 0;
  };

  const showDD = (anchorSel, items, activeIdx) => {
    const r = rect(anchorSel);
    const dd = $('#__dd');
    if (!r) { dd.style.display = 'none'; return; }
    dd.style.display = 'block';
    dd.style.left = r.left + 'px';
    dd.style.top = (r.bottom + 8) + 'px';
    dd.style.minWidth = r.width + 'px';
    dd.innerHTML = items.map((it, i) => `
      <div style="padding:12px 14px;border-radius:8px;display:flex;
        align-items:center;gap:10px;${i === activeIdx
          ? 'background:linear-gradient(135deg,rgba(139,92,246,.16),rgba(236,72,153,.16));font-weight:700;'
          : ''}">
        <span style="width:16px;color:#8b5cf6;">${i === activeIdx ? '✓' : ''}</span>
        <span>${it}</span></div>`).join('');
  };
  const hideDD = () => { $('#__dd').style.display = 'none'; };

  // ------------------------------------------------------------ app DOM utils
  const goView = (view) => {
    $$('.side-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  };
  // The shell is `.app{height:100vh;overflow:hidden}` with an inner `.content` scroller,
  // so window.scrollTo is a no-op here -- scroll the content element instead.
  const scroller = () => $('.content');
  const setScroll = (y) => {
    const c = scroller();
    if (c) c.scrollTop = Math.max(0, y);
    else window.scrollTo(0, Math.max(0, y));
  };
  // Offset of an element inside the scroller, independent of the current scroll
  // position -- safe to call every frame while a scroll is animating.
  const absTop = (sel) => {
    const c = scroller();
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!c || !el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;   // hidden: not measurable
    return r.top - c.getBoundingClientRect().top + c.scrollTop;
  };
  const spin = (btnSel, on, t) => {
    const b = $(btnSel); if (!b) return;
    const lab = b.querySelector('.btn-label');
    const sp = b.querySelector('.spinner');
    if (lab) lab.style.opacity = on ? '0' : '1';
    if (sp) {
      sp.hidden = !on;
      if (on) sp.style.transform = `rotate(${(t * 620) % 360}deg)`;
    }
  };
  // Staggered reveal: element i appears at t0 + i*step, easing up over `rise`.
  const stagger = (els, t, t0, step, rise = 0.3) => {
    els.forEach((el, i) => {
      const k = easeOut(seg(t, t0 + i * step, t0 + i * step + rise));
      el.style.opacity = String(k);
      el.style.transform = `translateY(${(1 - k) * 16}px)`;
    });
  };
  const fadeUp = (el, t, t0, dur = 0.42, dist = 22) => {
    if (!el) return;
    const k = easeOut(seg(t, t0, t0 + dur));
    el.style.opacity = String(k);
    el.style.transform = `translateY(${(1 - k) * dist}px)`;
  };

  const SPOTIFY_URL = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
  const YT_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const BOTH = SPOTIFY_URL + '\n' + YT_URL;

  const TRACKS = [
    ['The Weeknd', 'Blinding Lights', '3:20'],
    ['Dua Lipa', 'Levitating', '3:23'],
    ['Harry Styles', 'As It Was', '2:47'],
    ['Tame Impala', 'The Less I Know The Better', '3:36'],
    ['Doja Cat', 'Say So', '3:57'],
    ['Glass Animals', 'Heat Waves', '3:58'],
    ['Post Malone', 'Sunflower', '2:38'],
    ['Billie Eilish', 'Bad Guy', '3:14'],
  ];

  const spotifyCard = (nSel) => `
    <div class="source-card" id="__sc">
      <div class="sc-top">
        <div class="sc-thumb" style="background:linear-gradient(135deg,#1db954,#0d572b);
             width:88px;height:88px;border-radius:12px;display:flex;align-items:center;
             justify-content:center;font-size:36px;color:#fff;">♫</div>
        <div class="sc-body"><span class="badge spotify">♫ Spotify</span>
          <h4 class="sc-title">Today&#39;s Top Hits</h4>
          <p class="meta-sub">${TRACKS.length} tracks · 26 min</p></div>
      </div>
      <div class="track-tools">
        <button class="mini">Select all</button><button class="mini">None</button>
        <input type="text" class="track-search" placeholder="Filter tracks…" />
        <span class="sel-info" id="__selinfo">${nSel}/${TRACKS.length} selected</span>
      </div>
      <ul class="track-list">${TRACKS.map((tr, i) => `
        <li><label class="trk"><input type="checkbox" id="__trk${i}" checked/>
          <span class="trk-n">${i + 1}.</span>
          <span class="trk-t">${tr[0]} — ${tr[1]}</span>
          <span class="trk-d">${tr[2]}</span></label></li>`).join('')}</ul>
    </div>`;

  const ytCard = `
    <div class="source-card" id="__sc">
      <div class="sc-top">
        <div class="sc-thumb" style="background:linear-gradient(135deg,#ec4899,#f97316);
             width:88px;height:88px;border-radius:12px;display:flex;align-items:center;
             justify-content:center;font-size:36px;color:#fff;">▶</div>
        <div class="sc-body"><span class="badge youtube">▶ YouTube</span>
          <h4 class="sc-title">Never Gonna Give You Up · Rick Astley</h4>
          <p class="meta-sub">Rick Astley · 3:33</p></div>
      </div>
    </div>`;

  const DL_ITEMS = [
    'The Weeknd — Blinding Lights',
    'Dua Lipa — Levitating',
    'Harry Styles — As It Was',
    'Tame Impala — The Less I Know The Better',
    'Doja Cat — Say So',
    'Glass Animals — Heat Waves',
    'Post Malone — Sunflower',
    'Billie Eilish — Bad Guy',
  ];

  const SEARCH_RESULTS = [
    ['lofi hip hop radio — beats to relax/study to', 'Lofi Girl', '1.2B views', '24:00:00', '#8b5cf6,#3b82f6'],
    ['Chillhop Essentials — Autumn 2024', 'Chillhop Music', '38M views', '58:12', '#ec4899,#f97316'],
    ['Best of Lofi Hip Hop 2024', 'Lofi Fruits Music', '14M views', '1:02:45', '#10b981,#06b6d4'],
    ['Late Night Lofi — Study Session', 'Nujabes Lofi', '5.6M views', '45:30', '#f59e0b,#ef4444'],
    ['Chill Beats to Work / Code', 'Purffle Beats', '2.1M views', '1:15:00', '#84cc16,#22d3ee'],
    ['Rainy Lofi Cafe Ambience', 'Coffee Shop Vibes', '892K views', '3:00:00', '#a855f7,#ec4899'],
  ];

  const QUEUE_ITEMS = [
    ['The Weeknd — Blinding Lights', 'MP3 320'],
    ['Rick Astley — Never Gonna Give You Up', '4K MP4'],
    ["Today's Top Hits (playlist · 50)", 'FLAC'],
    ['lofi hip hop radio — 24h stream', '720p MP4'],
    ['The Joe Rogan Experience #2050', 'Podcast MP3'],
    ['Chillhop Essentials — Autumn 2024', 'MP3 320'],
  ];

  const SCHED_ITEMS = [
    ['Lofi Girl — daily stream', 'Every day · 2:30 AM', 'in 3h 12m'],
    ['Chillhop Weekly Radio', 'Every Sunday · 8:00 PM', 'in 2 days'],
    ['Rick Astley — Never Gonna…', 'Once · Tomorrow 6:00 AM', 'in 6h 42m'],
  ];

  const PRESET_CHIP = 'display:inline-block;padding:2px 8px;border-radius:999px;'
    + 'background:linear-gradient(135deg,rgba(139,92,246,.22),rgba(236,72,153,.22));'
    + 'font-weight:700;font-size:11.5px;letter-spacing:.2px;';

  const queueRow = (title, meta, id) => `
    <div class="queue-item" ${id ? `id="${id}"` : ''}>
      <div style="background:linear-gradient(135deg,#8b5cf6,#ec4899);flex:none;
           width:56px;height:56px;border-radius:10px;"></div>
      <div class="qi-info"><div class="qi-title">${title}</div>
        <div class="qi-meta">${meta}</div></div>
      <button style="border:0;background:transparent;opacity:.4;font-size:15px;
              cursor:pointer;flex:none;">✕</button></div>`;

  const schedRow = (s, id) => `
    <div class="queue-item" ${id ? `id="${id}"` : ''}>
      <div class="qi-thumb" style="background:linear-gradient(135deg,#f59e0b,#ef4444);
           width:56px;height:56px;border-radius:10px;display:flex;align-items:center;
           justify-content:center;font-size:24px;">⏰</div>
      <div class="qi-info"><div class="qi-title">${s[0]}</div>
        <div class="qi-meta">${s[1]} · next ${s[2]}</div></div>
      <button style="border:0;background:transparent;opacity:.4;font-size:15px;
              cursor:pointer;flex:none;">✕</button></div>`;

  // Build a scene's static DOM exactly once (capture walks scenes in order).
  const ensure = (key, fn) => {
    if (D._built === key) return;
    fn();
    D._built = key;
  };

  const resetCommon = () => {
    hideDD();
    $('#__drag').style.display = 'none';
    $('#__end').style.display = 'none';
    $('#__rip').style.opacity = '0';
    D._cursor.hidden = false;
    D._cursor.press = 0;
  };

  // ==================================================================== SCENES
  D.scenes = {};

  // ---- 01 hero: cursor drifts in, input wakes up ----------------------------
  D.scenes['01_hero'] = (t, dur) => {
    ensure('01', () => {
      goView('download');
      $('#urlInput').value = '';
      $('#panel').hidden = true;
      $('#progress').hidden = true;
      $('#sourceCards').innerHTML = '';
      setScroll(0);
    });
    // gentle open: whole app fades up in the first 0.5s
    const app = $('.app') || document.body.firstElementChild;
    if (app) {
      const k = easeOut(seg(t, 0, 0.55));
      app.style.opacity = String(0.15 + 0.85 * k);
    }
    const box = centre('#urlInput', -260, 0) || { x: 820, y: 190 };
    const p = along(t, [
      { t: 0.0, x: 1780, y: 1010 },
      { t: 2.6, x: box.x, y: box.y },
      { t: dur, x: box.x + 8, y: box.y + 4 },
    ]);
    D._cursor.x = p.x; D._cursor.y = p.y;
    // input glows once the pointer arrives
    const dz = $('#dropzone');
    if (dz) {
      const k = easeOut(seg(t, 2.3, 3.0));
      dz.style.boxShadow = `0 0 0 ${2 * k}px rgba(139,92,246,${0.34 * k})`;
    }
  };

  // ---- 02 paste: click the box, type two links -----------------------------
  D.scenes['02_paste'] = (t, dur) => {
    ensure('02', () => {
      goView('download');
      $('#panel').hidden = true;
      $('#progress').hidden = true;
      $('#sourceCards').innerHTML = '';
      const app = $('.app'); if (app) app.style.opacity = '1';
      setScroll(0);
    });
    const ta = $('#urlInput');
    const box = centre('#urlInput', -250, -8) || { x: 820, y: 185 };

    const p = along(t, [
      { t: 0.0, x: box.x + 120, y: box.y + 90 },
      { t: 0.75, x: box.x, y: box.y },
      { t: 4.9, x: box.x, y: box.y },
      { t: dur, x: (centre('#analyzeBtn') || box).x, y: (centre('#analyzeBtn') || box).y },
    ]);
    D._cursor.x = p.x; D._cursor.y = p.y;
    clickAt(t, 0.8, box.x, box.y);

    // focus ring after the click
    const dz = $('#dropzone');
    if (dz) {
      const k = easeOut(seg(t, 0.8, 1.1));
      dz.style.boxShadow = `0 0 0 ${2 * k}px rgba(139,92,246,${0.4 * k})`;
    }

    // type link 1, newline, link 2
    let txt = '';
    if (t >= 1.0) {
      if (t < 3.0) txt = typeOut(SPOTIFY_URL, t, 1.0, 3.0);
      else if (t < 3.25) txt = SPOTIFY_URL;
      else txt = SPOTIFY_URL + '\n' + typeOut(YT_URL, t, 3.3, 4.85);
    }
    // blinking caret while typing
    const caret = t > 1.0 && t < 4.95 && (Math.floor(t * 2) % 2 === 0) ? '|' : '';
    ta.value = txt + (txt ? caret : '');
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
  };

  // ---- 03 analyze: click Analyze, results build, untick a track -------------
  D.scenes['03_analyze'] = (t, dur) => {
    ensure('03', () => {
      goView('download');
      $('#urlInput').value = BOTH;
      const ta = $('#urlInput');
      ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
      $('#progress').hidden = true;
      $('#sourceCards').innerHTML = spotifyCard(TRACKS.length);
      $('#panel').hidden = false;
    });

    const ab = centre('#analyzeBtn') || { x: 1470, y: 265 };
    // analysing 0.75 -> 2.0, then the card exists
    const working = t >= 0.8 && t < 2.0;
    spin('#analyzeBtn', working, t);

    const card = $('#__sc');
    const list = $$('#__sc .track-list li');
    const tools = $('#__sc .track-tools');

    if (t < 1.95) {
      // nothing revealed yet
      if (card) { card.style.opacity = '0'; }
      $('#panel').style.opacity = '0';
      list.forEach((li) => { li.style.opacity = '0'; });
      if (tools) tools.style.opacity = '0';
    } else {
      fadeUp(card, t, 1.95, 0.45, 26);
      if (tools) { const k = easeOut(seg(t, 2.25, 2.6)); tools.style.opacity = String(k); }
      stagger(list, t, 2.35, 0.055, 0.28);
      const kp = easeOut(seg(t, 2.0, 2.4));
      $('#panel').style.opacity = String(kp);
      $('#panel').style.transform = `translateY(${(1 - kp) * 18}px)`;
    }

    // smooth scroll so the track list fills the frame
    const want = Math.max(0, (absTop('#__sc') || 400) - 150);
    setScroll(Math.round(lerp(0, want, easeInOut(seg(t, 3.6, 5.1)))));

    // untick track 5 to show the picker works
    const t5 = $('#__trk4');
    const unticked = t >= 6.15;
    if (t5) t5.checked = !unticked;
    const info = $('#__selinfo');
    if (info) info.textContent = `${unticked ? TRACKS.length - 1 : TRACKS.length}/${TRACKS.length} selected`;

    const cb = centre('#__trk4') || { x: 690, y: 640 };
    const p = along(t, [
      { t: 0.0, x: ab.x - 60, y: ab.y + 40 },
      { t: 0.7, x: ab.x, y: ab.y },
      { t: 2.2, x: ab.x, y: ab.y },
      { t: 5.5, x: cb.x, y: cb.y },
      { t: 6.1, x: cb.x, y: cb.y },
      { t: dur, x: cb.x + 30, y: cb.y - 26 },
    ]);
    D._cursor.x = p.x; D._cursor.y = p.y;
    if (t < 3.0) clickAt(t, 0.75, ab.x, ab.y);
    else clickAt(t, 6.1, cb.x, cb.y);
  };

  // ---- 04 presets: tour the quality presets --------------------------------
  D.scenes['04_presets'] = (t, dur) => {
    ensure('04', () => {
      goView('download');
      $('#urlInput').value = YT_URL;
      const ta = $('#urlInput');
      ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
      $('#progress').hidden = true;
      $('#sourceCards').innerHTML = ytCard;
      $('#panel').hidden = false;
      $('#panel').style.opacity = '1';
      $('#panel').style.transform = 'none';
      const sc = $('#__sc'); if (sc) { sc.style.opacity = '1'; sc.style.transform = 'none'; }
    });
    setScroll(Math.max(0, (absTop('.presets') || 500) - 200));

    const setType = (type) => {
      $$('#contentTypeSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
      $('#resGroup').hidden = type !== 'video';
      $('#audioGroup').hidden = type === 'video';
      $('#bitrateGroup').hidden = type === 'video';
    };
    const activate = (preset) => {
      $$('.preset').forEach((p) => p.classList.toggle('active', p.dataset.preset === preset));
    };

    // preset clicks: MP3 320 -> FLAC -> 4K
    const steps = [
      { at: 0.85, preset: 'mp3hq', type: 'audio', fmt: 'mp3', br: '320' },
      { at: 3.10, preset: 'flac', type: 'audio', fmt: 'flac', br: '' },
      { at: 5.40, preset: 'video4k', type: 'video', res: '2160' },
    ];
    let cur = null;
    for (const s of steps) if (t >= s.at) cur = s;
    if (cur) {
      activate(cur.preset);
      setType(cur.type);
      if (cur.fmt) $('#audioFormat').value = cur.fmt;
      if (cur.br !== undefined) $('#audioBitrate').value = cur.br;
      if (cur.res) $('#resolution').value = cur.res;
    } else {
      $$('.preset').forEach((p) => p.classList.remove('active'));
      setType('video');
    }

    const pc = (name) => centre(`.preset[data-preset="${name}"]`);
    const a = pc('mp3hq') || { x: 1100, y: 600 };
    const b = pc('flac') || { x: 1390, y: 600 };
    const c = pc('video4k') || { x: 833, y: 600 };
    const q = centre('#resolution') || { x: 1080, y: 700 };

    const p = along(t, [
      { t: 0.0, x: a.x - 140, y: a.y + 70 },
      { t: 0.8, x: a.x, y: a.y },
      { t: 2.9, x: b.x, y: b.y },
      { t: 5.3, x: c.x, y: c.y },
      { t: 7.0, x: q.x, y: q.y },
      { t: dur, x: q.x, y: q.y + 6 },
    ]);
    D._cursor.x = p.x; D._cursor.y = p.y;

    if (t < 2.6) clickAt(t, 0.85, a.x, a.y);
    else if (t < 5.0) clickAt(t, 3.10, b.x, b.y);
    else if (t < 7.0) clickAt(t, 5.40, c.x, c.y);
    else clickAt(t, 7.15, q.x, q.y);

    // faux quality dropdown at the end, since a native select popup can't be captured
    if (t >= 7.2) {
      showDD('#resolution',
        ['Best available', '4K — 2160p', '2K — 1440p', 'Full HD — 1080p', 'HD — 720p'], 1);
    } else hideDD();
  };

  // ---- 05 progress: click Download, watch it run ---------------------------
  D.scenes['05_progress'] = (t, dur) => {
    ensure('05', () => {
      goView('download');
      $('#urlInput').value = BOTH;
      const ta = $('#urlInput');
      ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
      $('#sourceCards').innerHTML = spotifyCard(TRACKS.length);
      $('#panel').hidden = false;
      $('#panel').style.opacity = '1';
      $('#panel').style.transform = 'none';
      const sc = $('#__sc'); if (sc) { sc.style.opacity = '1'; sc.style.transform = 'none'; }
      // The app's stylesheet has no .dl-* rules, so these rows are styled inline --
      // otherwise the "live progress" shot renders as a plain list of text.
      $('#itemList').innerHTML = DL_ITEMS.map((nm, i) => `
        <li id="__dl${i}" style="display:flex;align-items:center;gap:16px;
            padding:11px 15px;border-radius:12px;border:1px solid rgba(139,92,246,.12);
            background:rgba(139,92,246,.045);">
          <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;
                text-overflow:ellipsis;font-size:14.5px;font-weight:600;">${nm}</span>
          <span style="width:230px;height:8px;border-radius:999px;flex:none;
                background:rgba(139,92,246,.16);overflow:hidden;">
            <span id="__dlb${i}" style="display:block;height:100%;width:0%;
                  border-radius:999px;background:linear-gradient(90deg,#8b5cf6,#ec4899);"></span>
          </span>
          <span id="__dlp${i}" style="width:48px;flex:none;text-align:right;font-size:13px;
                font-weight:700;font-variant-numeric:tabular-nums;opacity:.55;">·</span>
        </li>`).join('');
      setScroll(0);
      D._s05 = {};
    });
    D._s05 = D._s05 || {};

    const started = t >= 0.62;

    // before the click: the options panel; after: the live progress card
    $('#panel').hidden = started;
    $('#progress').hidden = !started;

    if (!started) {
      // park the view on the Download button so the click is visible
      if (D._s05.before == null) {
        D._s05.before = Math.max(0, (absTop('#downloadBtn') || 900) - 720);
      }
      setScroll(D._s05.before);
      const db0 = centre('#downloadBtn') || { x: 1090, y: 900 };
      const p = along(t, [
        { t: 0.0, x: db0.x - 220, y: db0.y + 80 },
        { t: 0.55, x: db0.x, y: db0.y },
      ]);
      D._cursor.x = p.x; D._cursor.y = p.y;
      clickAt(t, 0.58, db0.x, db0.y);
      return;
    }

    // measured once, on the first frame where #progress is actually visible
    if (D._s05.after == null) {
      D._s05.after = Math.max(0, (absTop('#progress') || 700) - 130);
    }
    setScroll(Math.round(lerp(D._s05.before || 0, D._s05.after,
      easeInOut(seg(t, 0.62, 1.5)))));
    const db = { x: 1090, y: 640 };
    fadeUp($('#progress'), t, 0.62, 0.4, 20);

    // overall progress 3% -> 97%
    const k = easeInOut(seg(t, 0.7, dur - 0.5));
    const pct = 3 + 94 * k;
    $('#progBar').style.width = pct.toFixed(1) + '%';
    $('#progPct').textContent = Math.round(pct) + '%';

    // per-item completion, staggered across the run
    const N = DL_ITEMS.length;
    let done = 0;
    for (let i = 0; i < N; i++) {
      const t0 = 0.75 + i * 0.62;
      const ip = clamp01((t - t0) / 0.95);
      const bar = document.getElementById('__dlb' + i);
      const lab = document.getElementById('__dlp' + i);
      const row = document.getElementById('__dl' + i);
      if (!bar) continue;
      bar.style.width = (ip * 100).toFixed(0) + '%';
      if (ip >= 1) {
        done++;
        lab.textContent = '✓';
        lab.style.color = '#10b981';
        lab.style.opacity = '1';
        row.style.borderColor = 'rgba(16,185,129,.3)';
        row.style.background = 'rgba(16,185,129,.06)';
      } else if (ip > 0) {
        lab.textContent = Math.round(ip * 100) + '%';
        lab.style.color = '';
        lab.style.opacity = '1';
        row.style.borderColor = 'rgba(139,92,246,.45)';
        row.style.background = 'rgba(139,92,246,.10)';
      } else {
        lab.textContent = '·';
        lab.style.color = '';
        lab.style.opacity = '.55';
        row.style.borderColor = 'rgba(139,92,246,.12)';
        row.style.background = 'rgba(139,92,246,.045)';
      }
    }

    const speed = 11.4 + wob(t, 3.1, 1.9);
    $('#progMeta').textContent = `${Math.min(done + 1, N)} of ${N} · ${speed.toFixed(1)} MB/s`;
    const left = Math.max(0, (dur - 0.4 - t) * 8.5);
    $('#progTimeInfo').textContent = left > 1
      ? `about ${Math.round(left)} seconds remaining`
      : 'finishing up…';
    $('#progTitle').textContent = "Downloading Today's Top Hits";

    // pointer eases away to the item list
    const p = along(t, [
      { t: 0.62, x: db.x, y: db.y },
      { t: 2.0, x: 1180, y: 560 },
      { t: dur, x: 1240, y: 640 },
    ]);
    D._cursor.x = p.x; D._cursor.y = p.y;
    clickAt(t, 0.58, db.x, db.y);
  };

  // ---- 06 search: type a query, results land, tick three -------------------
  D.scenes['06_search'] = (t, dur) => {
    ensure('06', () => {
      goView('search');
      $('#searchInput').value = '';
      $('#searchResults').innerHTML = SEARCH_RESULTS.map((r, i) => `
        <div class="result-card" id="__rc${i}" style="position:relative;padding:10px;
             border-radius:14px;border:1px solid rgba(139,92,246,.14);
             background:rgba(139,92,246,.04);">
          <div style="background:linear-gradient(135deg,${r[4]});position:relative;
               height:135px;border-radius:10px;">
            <span style="position:absolute;bottom:6px;right:8px;background:rgba(0,0,0,.72);
              color:#fff;font-size:12px;padding:2px 6px;border-radius:4px;
              font-weight:600;">${r[3]}</span></div>
          <div style="padding:10px 4px 2px;">
            <div style="font-size:14px;font-weight:700;line-height:1.32;display:-webkit-box;
                 -webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
                 min-height:37px;">${r[0]}</div>
            <div style="font-size:12.5px;opacity:.62;margin-top:5px;">${r[1]} · ${r[2]}</div></div>
          <label style="position:absolute;top:18px;left:18px;width:22px;height:22px;
                 border-radius:6px;background:rgba(12,10,20,.6);display:flex;
                 align-items:center;justify-content:center;">
            <input type="checkbox" id="__rck${i}" style="width:15px;height:15px;
                   accent-color:#8b5cf6;margin:0;"/></label></div>`).join('');
      $('#searchActions').hidden = true;
      $('#resultCount').textContent = '';
      setScroll(0);
    });

    const nav = centre('.side-btn[data-view="search"]') || { x: 127, y: 184 };
    const inp = centre('#searchInput', -320, 0) || { x: 720, y: 180 };
    const sb = centre('#searchBtn') || { x: 1472, y: 180 };

    // typing
    const q = 'lofi hip hop beats';
    const typing = t >= 0.75 && t < 2.45;
    $('#searchInput').value = t < 0.75 ? '' : typeOut(q, t, 0.75, 2.4)
      + (typing && Math.floor(t * 2) % 2 === 0 ? '|' : '');

    const searching = t >= 2.6 && t < 3.15;
    spin('#searchBtn', searching, t);

    // results
    const cards = SEARCH_RESULTS.map((_, i) => document.getElementById('__rc' + i));
    if (t < 3.1) {
      cards.forEach((c) => { if (c) c.style.opacity = '0'; });
      $('#resultCount').textContent = '';
    } else {
      stagger(cards.filter(Boolean), t, 3.15, 0.07, 0.3);
      $('#resultCount').textContent = SEARCH_RESULTS.length + ' results';
    }

    // tick the first three
    const tickAt = [4.55, 5.25, 5.9];
    let sel = 0;
    tickAt.forEach((ta, i) => {
      const on = t >= ta;
      const cb = document.getElementById('__rck' + i);
      if (cb) cb.checked = on;
      const card = document.getElementById('__rc' + i);
      if (card) card.classList.toggle('selected', on);
      if (on) sel++;
    });
    $('#searchActions').hidden = sel === 0;
    if (sel) {
      $('#selCount').textContent = sel + ' selected';
      fadeUp($('#searchActions'), t, tickAt[0], 0.3, 14);
    }

    const k1 = centre('#__rck0') || { x: 646, y: 549 };
    const k2 = centre('#__rck1') || { x: 875, y: 549 };
    const k3 = centre('#__rck2') || { x: 1104, y: 549 };
    const p = along(t, [
      { t: 0.0, x: nav.x + 300, y: nav.y + 240 },
      { t: 0.45, x: nav.x, y: nav.y },
      { t: 0.72, x: inp.x, y: inp.y },
      { t: 2.5, x: sb.x, y: sb.y },
      { t: 4.5, x: k1.x, y: k1.y },
      { t: 5.2, x: k2.x, y: k2.y },
      { t: 5.85, x: k3.x, y: k3.y },
      { t: dur, x: k3.x + 40, y: k3.y + 30 },
    ]);
    D._cursor.x = p.x; D._cursor.y = p.y;
    if (t < 1.0) clickAt(t, 0.48, nav.x, nav.y);
    else if (t < 3.6) clickAt(t, 2.55, sb.x, sb.y);
    else if (t < 5.15) clickAt(t, 4.55, k1.x, k1.y);
    else if (t < 5.8) clickAt(t, 5.25, k2.x, k2.y);
    else clickAt(t, 5.9, k3.x, k3.y);
  };

  // ---- 07 queue: open it, start the batch ---------------------------------
  D.scenes['07_queue'] = (t, dur) => {
    ensure('07', () => {
      goView('queue');
      $('#queueStartAll').disabled = false;
      $('#queuePauseAll').disabled = false;
      $('#queueClearAll').disabled = false;
      $('#queueList').innerHTML = QUEUE_ITEMS
        .map((q, i) => queueRow(q[0],
          `<span style="${PRESET_CHIP}">${q[1]}</span> · <span id="__qs${i}">queued</span>`,
          '__q' + i))
        .join('');
      $('#queueStats').textContent = `${QUEUE_ITEMS.length} items · ~1.2 GB`;
      const badge = $('#queueBadge');
      if (badge) { badge.textContent = String(QUEUE_ITEMS.length); badge.hidden = false; }
      setScroll(0);
    });

    const rows = QUEUE_ITEMS.map((_, i) => document.getElementById('__q' + i));
    stagger(rows.filter(Boolean), t, 0.6, 0.075, 0.3);

    const nav = centre('.side-btn[data-view="queue"]') || { x: 127, y: 230 };
    const start = centre('#queueStartAll') || { x: 697, y: 157 };

    // press Start all -> first two rows go live
    const running = t >= 3.35;
    for (let i = 0; i < QUEUE_ITEMS.length; i++) {
      const st = document.getElementById('__qs' + i);
      if (!st) continue;
      if (running && i === 0) st.textContent = `downloading · ${Math.round(clamp01((t - 3.5) / 1.7) * 100)}%`;
      else if (running && i === 1 && t >= 4.35) st.textContent = `downloading · ${Math.round(clamp01((t - 4.5) / 1.7) * 100)}%`;
      else st.textContent = 'queued';
    }
    if (running) {
      const remaining = Math.max(0, QUEUE_ITEMS.length - (t >= 4.35 ? 2 : 1));
      $('#queueStats').textContent = `${QUEUE_ITEMS.length} items · ${remaining} queued · ~1.2 GB`;
      $('#queueStartAll').classList.add('active');
    }

    const p = along(t, [
      { t: 0.0, x: nav.x + 320, y: nav.y + 200 },
      { t: 0.45, x: nav.x, y: nav.y },
      { t: 2.9, x: start.x, y: start.y },
      { t: 3.9, x: start.x, y: start.y },
      { t: dur, x: start.x + 260, y: start.y + 120 },
    ]);
    D._cursor.x = p.x; D._cursor.y = p.y;
    if (t < 2.0) clickAt(t, 0.48, nav.x, nav.y);
    else clickAt(t, 3.35, start.x, start.y);
  };

  // ---- 08 scheduler: set a repeating download -----------------------------
  D.scenes['08_scheduler'] = (t, dur) => {
    ensure('08', () => {
      goView('scheduler');
      $('#scheduleUrl').value = '';
      const d = new Date(2026, 7, 6);
      const pad = (x) => String(x).padStart(2, '0');
      $('#scheduleDate').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      $('#scheduleTime').value = '02:30';
      $('#scheduleRepeat').value = 'once';
      $('#scheduleList').innerHTML = SCHED_ITEMS
        .map((s, i) => schedRow(s, '__s' + i)).join('');
      setScroll(0);
    });

    const url = 'youtube.com/@lofigirl/streams';
    const typing = t >= 0.7 && t < 2.05;
    $('#scheduleUrl').value = t < 0.7 ? '' : typeOut(url, t, 0.7, 2.0)
      + (typing && Math.floor(t * 2) % 2 === 0 ? '|' : '');

    // repeat dropdown -> Daily
    if (t >= 2.35 && t < 3.15) showDD('#scheduleRepeat', ['Once', 'Daily', 'Weekly'], t >= 2.85 ? 1 : 0);
    else hideDD();
    $('#scheduleRepeat').value = t >= 3.0 ? 'daily' : 'once';

    // schedule button -> rows appear
    const added = t >= 3.95;
    const rows = SCHED_ITEMS.map((_, i) => document.getElementById('__s' + i));
    if (!added) rows.forEach((r) => { if (r) r.style.opacity = '0'; });
    else stagger(rows.filter(Boolean), t, 3.95, 0.13, 0.32);

    const nav = centre('.side-btn[data-view="scheduler"]') || { x: 127, y: 414 };
    const inp = centre('#scheduleUrl', -300, 0) || { x: 790, y: 243 };
    const rep = centre('#scheduleRepeat') || { x: 1377, y: 338 };
    const btn = centre('#scheduleAddBtn') || { x: 766, y: 401 };

    const p = along(t, [
      { t: 0.0, x: nav.x + 300, y: nav.y - 180 },
      { t: 0.42, x: nav.x, y: nav.y },
      { t: 0.68, x: inp.x, y: inp.y },
      { t: 2.3, x: rep.x, y: rep.y },
      { t: 3.1, x: rep.x, y: rep.y + 34 },
      { t: 3.85, x: btn.x, y: btn.y },
      { t: dur, x: btn.x + 180, y: btn.y + 150 },
    ]);
    D._cursor.x = p.x; D._cursor.y = p.y;
    if (t < 1.5) clickAt(t, 0.45, nav.x, nav.y);
    else if (t < 3.0) clickAt(t, 2.4, rep.x, rep.y);
    else if (t < 3.8) clickAt(t, 3.0, rep.x, rep.y + 34);
    else clickAt(t, 3.9, btn.x, btn.y);
  };

  // ---- 09 converter: drop a file, pick FLAC, convert -----------------------
  D.scenes['09_converter'] = (t, dur) => {
    ensure('09', () => {
      goView('converter');
      $('#converterInfo').hidden = true;
      $('#converterFileName').textContent = '';
      $('#convertFormat').value = 'mp3';
      $('#convertQuality').value = 'high';
      const cp = $('#convertProgress'); if (cp) cp.hidden = true;
      const cr = $('#convertResult'); if (cr) { cr.hidden = true; cr.innerHTML = ''; }
      setScroll(0);
    });

    const drop = centre('#converterDrop') || { x: 1090, y: 254 };
    const nav = centre('.side-btn[data-view="converter"]') || { x: 127, y: 368 };

    // a file chip flies into the dropzone
    const dragEl = $('#__drag');
    const dz = $('#converterDrop');
    if (t >= 0.7 && t < 1.75) {
      const k = easeInOut(seg(t, 0.7, 1.6));
      dragEl.style.display = 'block';
      dragEl.textContent = '📄 Blinding Lights.wav';
      const r = dragEl.getBoundingClientRect();
      dragEl.style.left = (lerp(1560, drop.x - r.width / 2, k)) + 'px';
      dragEl.style.top = (lerp(1000, drop.y - 20, k)) + 'px';
      dragEl.style.opacity = String(1 - easeOut(seg(t, 1.42, 1.62)) * 0.9);
      if (dz) dz.classList.add('drag');
    } else {
      dragEl.style.display = 'none';
      if (dz) dz.classList.remove('drag');
    }

    const loaded = t >= 1.7;
    $('#converterInfo').hidden = !loaded;
    if (loaded) {
      $('#converterFileName').textContent = '📄 The Weeknd — Blinding Lights.wav (52.4 MB)';
      fadeUp($('#converterInfo'), t, 1.7, 0.38, 16);
    }

    // format dropdown -> FLAC
    if (t >= 2.5 && t < 3.35) {
      showDD('#convertFormat', ['MP3', 'M4A (AAC)', 'FLAC', 'WAV', 'Opus'], t >= 3.0 ? 2 : 0);
    } else hideDD();
    $('#convertFormat').value = t >= 3.15 ? 'flac' : 'mp3';

    // convert -> bar fills -> done
    const converting = t >= 3.95;
    const cp = $('#convertProgress');
    if (cp) {
      cp.hidden = !converting;
      if (converting) {
        const k = clamp01((t - 4.05) / 1.85);
        $('#convertBar').style.width = (k * 100).toFixed(0) + '%';
      }
    }
    spin('#convertBtn', converting && t < 5.9, t);
    const cr = $('#convertResult');
    if (cr) {
      const show = t >= 6.0;
      cr.hidden = !show;
      if (show) {
        cr.innerHTML = '<p class="ok-msg" style="margin-top:14px;font-weight:700;color:#10b981;">'
          + '✓ Converted to FLAC — Blinding Lights.flac</p>';
        fadeUp(cr, t, 6.0, 0.3, 10);
      }
    }

    const fmt = centre('#convertFormat') || { x: 872, y: 454 };
    const btn = centre('#convertBtn') || { x: 1090, y: 524 };
    const p = along(t, [
      { t: 0.0, x: nav.x + 280, y: nav.y - 90 },
      { t: 0.42, x: nav.x, y: nav.y },
      { t: 1.9, x: fmt.x, y: fmt.y },
      { t: 3.3, x: fmt.x, y: fmt.y + 78 },
      { t: 3.9, x: btn.x, y: btn.y },
      { t: dur, x: btn.x + 120, y: btn.y + 70 },
    ]);
    D._cursor.x = p.x; D._cursor.y = p.y;
    if (t < 1.5) clickAt(t, 0.45, nav.x, nav.y);
    else if (t < 3.2) clickAt(t, 2.55, fmt.x, fmt.y);
    else if (t < 3.85) clickAt(t, 3.15, fmt.x, fmt.y + 78);
    else clickAt(t, 4.0, btn.x, btn.y);
  };

  // ---- 09b palette: Ctrl+K command palette -> Favorites --------------------
  const CMDS = [
    ['⬇', 'Go to Download', 'Ctrl+1'],
    ['🔎', 'Go to Search', 'Ctrl+2'],
    ['📋', 'Go to Queue', 'Ctrl+3'],
    ['⏰', 'Go to Scheduler', 'Ctrl+7'],
    ['⭐', 'Go to Favorites', 'Ctrl+8'],
    ['🌙', 'Toggle theme (dark/light)', 'Ctrl+D'],
    ['⌨', 'Show keyboard shortcuts', '?'],
  ];
  const FAVS = [
    ['Lofi Girl — study stream', 'youtube.com/@lofigirl'],
    ["Today's Top Hits", 'open.spotify.com/playlist/…'],
    ['Chillhop Essentials', 'youtube.com/@chillhopmusic'],
  ];

  D.scenes['09b_palette'] = (t, dur) => {
    ensure('09b', () => {
      goView('favorites');
      $('#favUrl').value = '';
      $('#favList').innerHTML = FAVS.map((f, i) => `
        <div class="queue-item" id="__fav${i}">
          <div style="background:linear-gradient(135deg,#f59e0b,#ec4899);flex:none;
               width:56px;height:56px;border-radius:10px;display:flex;
               align-items:center;justify-content:center;font-size:24px;">⭐</div>
          <div class="qi-info"><div class="qi-title">${f[0]}</div>
            <div class="qi-meta">${f[1]}</div></div>
          <button style="border:0;background:transparent;opacity:.4;font-size:15px;
                  cursor:pointer;flex:none;">✕</button></div>`).join('');
      setScroll(0);
    });

    // The palette is open for the first stretch, then "Enter" runs the command
    // and reveals the Favorites view underneath.
    const closed = t >= 2.55;
    const modal = $('#cmdPalette');
    const query = t < 1.25 ? '' : typeOut('fav', t, 1.25, 1.75);
    const shown = query
      ? CMDS.filter((c) => c[1].toLowerCase().includes(query.toLowerCase()))
      : CMDS;

    modal.hidden = closed;
    if (!closed) {
      const k = easeOut(seg(t, 0.1, 0.5));
      modal.style.opacity = String(k);
      const inner = modal.querySelector('.modal-content');
      if (inner) inner.style.transform = `scale(${lerp(0.94, 1, k)}) translateY(${(1 - k) * 12}px)`;

      const caret = t > 1.25 && t < 2.2 && Math.floor(t * 2) % 2 === 0 ? '|' : '';
      $('#cmdInput').value = query + (query ? caret : '');

      $('#cmdResults').innerHTML = shown.map((c, i) => `
        <div class="cmd-item ${i === 0 ? 'active' : ''}" id="__cmd${i}">
          <span class="cmd-ic">${c[0]}</span>
          <span class="cmd-label">${c[1]}</span>
          ${c[2] ? `<span class="cmd-hint">${c[2]}</span>` : ''}</div>`).join('');
      // rows drop in only on the initial open, not on every filter keystroke
      if (t < 1.2) {
        stagger(shown.map((_, i) => document.getElementById('__cmd' + i)).filter(Boolean),
          t, 0.28, 0.035, 0.22);
      }
      D._cursor.hidden = true;
      return;
    }

    // Favorites revealed
    D._cursor.hidden = false;
    const rows = FAVS.map((_, i) => document.getElementById('__fav' + i));
    stagger(rows.filter(Boolean), t, 2.7, 0.11, 0.3);

    const r0 = centre('#__fav0') || { x: 1090, y: 560 };
    const p = along(t, [
      { t: 2.55, x: r0.x - 120, y: r0.y + 190 },
      { t: dur, x: r0.x, y: r0.y + 30 },
    ]);
    D._cursor.x = p.x; D._cursor.y = p.y;
  };

  // ---- 10 settings: recolour the accent, then flip to dark -----------------
  D.scenes['10_settings'] = (t, dur) => {
    ensure('10', () => {
      goView('settings');
      $('#outputDir').value = 'C:\\Users\\Chama\\Music\\PurffleGrab';
      document.body.dataset.theme = 'light';
      setScroll(0);
    });

    const nav = centre('.side-btn[data-view="settings"]') || { x: 127, y: 460 };

    // accent clicks
    const picks = [
      { at: 1.05, c: '#3b82f6' },
      { at: 1.85, c: '#10b981' },
      { at: 2.60, c: '#f59e0b' },
      { at: 3.35, c: '#ec4899' },
    ];
    let accent = '#8b5cf6';
    for (const p of picks) if (t >= p.at) accent = p.c;
    document.documentElement.style.setProperty('--brand', accent);
    $$('.swatch').forEach((s) => s.classList.toggle('active', s.dataset.color === accent));

    // theme flip -- the line says "dark and light themes"
    const dark = t >= 4.45;
    document.body.dataset.theme = dark ? 'dark' : 'light';
    const tog = $('#themeToggle');
    if (tog) {
      const ic = tog.querySelector('.tt-ic'); const lb = tog.querySelector('.tt-label');
      if (ic) ic.textContent = dark ? '🌙' : '☀️';
      if (lb) lb.textContent = dark ? 'Dark' : 'Light';
    }
    // keep the Theme segmented control honest -- otherwise it still reads "Light"
    // while the whole UI is dark.
    $$('#themeSeg .seg-btn').forEach((b) => b.classList.toggle(
      'active', b.dataset.themeMode === (dark ? 'dark' : 'light')));

    const sw = (c) => centre(`.swatch[data-color="${c}"]`);
    const s1 = sw('#3b82f6') || { x: 728, y: 630 };
    const s2 = sw('#10b981') || { x: 774, y: 630 };
    const s3 = sw('#f59e0b') || { x: 820, y: 630 };
    const s4 = sw('#ec4899') || { x: 912, y: 630 };
    const th = centre('#themeToggle') || { x: 129, y: 962 };

    const p = along(t, [
      { t: 0.0, x: nav.x + 300, y: nav.y - 120 },
      { t: 0.42, x: nav.x, y: nav.y },
      { t: 1.0, x: s1.x, y: s1.y },
      { t: 1.8, x: s2.x, y: s2.y },
      { t: 2.55, x: s3.x, y: s3.y },
      { t: 3.30, x: s4.x, y: s4.y },
      { t: 4.35, x: th.x, y: th.y },
      { t: dur, x: th.x + 40, y: th.y - 30 },
    ]);
    D._cursor.x = p.x; D._cursor.y = p.y;
    if (t < 0.9) clickAt(t, 0.45, nav.x, nav.y);
    else if (t < 1.75) clickAt(t, 1.05, s1.x, s1.y);
    else if (t < 2.5) clickAt(t, 1.85, s2.x, s2.y);
    else if (t < 3.25) clickAt(t, 2.60, s3.x, s3.y);
    else if (t < 4.3) clickAt(t, 3.35, s4.x, s4.y);
    else clickAt(t, 4.45, th.x, th.y);
  };

  // ---- 11 end card --------------------------------------------------------
  D.scenes['11_endcard'] = (t, dur) => {
    ensure('11', () => { document.body.dataset.theme = 'dark'; });
    const end = $('#__end');
    end.style.display = 'block';
    D._cursor.hidden = true;

    const ic = $('#__end_icon');
    const ki = easeOut(seg(t, 0.05, 0.75));
    ic.style.opacity = String(ki);
    ic.style.transform = `scale(${lerp(0.72, 1, ki)})`;

    const bits = [
      ['#__end_name', 0.32], ['#__end_tag', 0.52],
      ['#__end_cta', 0.72], ['#__end_url', 0.9], ['#__end_foot', 1.05],
    ];
    for (const [sel, t0] of bits) {
      const el = $(sel); if (!el) continue;
      const k = easeOut(seg(t, t0, t0 + 0.5));
      el.style.opacity = String(k);
      el.style.transform = `translateY(${(1 - k) * 20}px)`;
    }
    // slow glow breathe so the hold is not a frozen frame
    const g = $('#__end_glow');
    if (g) g.style.opacity = String(0.82 + 0.18 * Math.sin(t * 1.15));
    const cta = $('#__end_cta');
    if (cta && t > 1.2) {
      const pulse = 1 + 0.018 * Math.sin((t - 1.2) * 2.4);
      cta.style.transform = `scale(${pulse})`;
    }
  };

  // ------------------------------------------------------------------- driver
  D.frame = (id, t, dur) => {
    resetCommon();
    const fn = D.scenes[id];
    if (!fn) throw new Error('no scene ' + id);
    fn(t, dur);
    paintCursor();
    return true;
  };

  D.newScene = () => { D._built = null; };
})();
