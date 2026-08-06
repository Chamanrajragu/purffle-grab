# PurffleGrab — YouTube / Instagram launch pack

Ready-to-paste copy for the 76-second promo video. Same shape as the Claude-Multi launch
that worked.

## 📦 Assets

| File | What |
|---|---|
| `purfflegrab-16x9-1080p.mp4` | Main video — 1920×1080, 30fps, 76.0s, H.264 + AAC |
| `purfflegrab-9x16-1080p.mp4` | Reels / Shorts cut — 1080×1920, branded frame around the full app |
| `docs/thumbnail.png` | YouTube thumbnail — 1280×720 |
| `docs/thumbnail-1x1.png` | Instagram square — 1080×1080, purpose-built (not a crop) |

**Recording:** a real interaction demo, not stills. The app runs live while a scripted
pointer moves, clicks, types, and opens menus; progress bars fill, lists stagger in, the
accent colour recolours the UI, and the theme flips to dark. Captured frame-by-frame at
1920×1080 / 30fps.

Every frame is a pure function of time — `__demo.frame(sceneId, t)` sets the complete DOM
state for time `t`, and all CSS transitions are disabled during capture. That means capture
can run slower than real time (it runs at ~15fps) and still produce perfectly even 30fps
motion, with no dropped or torn frames.

**Voiceover:** ElevenLabs, voice *Eric — Smooth, Trustworthy* (`cjVigY5qzO86Huf0OWal`),
model `eleven_multilingual_v2`, stability 0.45 / similarity 0.8 / style 0.3. Generated per
line with `previous_text`/`next_text` so prosody carries across sentences. Mastered to
−16 LUFS (LRA 2.3 LU) — YouTube's normalization target, so it will not get turned down.

**Sync:** each scene's crossfade is centred on the first word of its line, so the picture
lands exactly as the sentence starts. Video and audio are both 76.003s — zero drift.

### Regenerating

```bash
python plan.py                                     # shot timeline -> timeline.json
python gen_tts.py                                  # voiceover  (ONLY=id1,id2 for one line)
TIMELINE=timeline.json FRAMES_OUT=frames npx electron scripts/capture-motion.mjs
python build3.py                                   # assemble
```

`scripts/demo-anim.js` holds the per-scene choreography — edit that to change what the demo
does. `scripts/render-html.mjs` renders any HTML to an exact-size PNG (used for the
thumbnail and the Reels frame).

---

## 🎯 YouTube title (pick one)

1. **PurffleGrab — Free Spotify & YouTube Downloader for Windows (No Ads, Open Source)**
2. **I built a free Spotify + YouTube downloader — MP3, MP4, FLAC, 4K, no accounts**
3. **The cleanest free YouTube & Spotify downloader I've used — PurffleGrab (open source)**

Recommended: **#1** — matches the format of the Claude-Multi title that ranked.

## 📝 YouTube description

```
PurffleGrab is a free, open-source downloader for Spotify and YouTube — MP3, MP4, FLAC, up to 4K.
No accounts, no ads, no subscriptions. FFmpeg and yt-dlp are bundled inside the installer.

⬇ Free on GitHub — https://github.com/Chamanrajragu/purffle-grab
🌐 Website — https://chamanrajragu.github.io/purffle-grab/

WHAT'S INSIDE
• Spotify playlists, YouTube videos & channels (up to 4K)
• Batch, drag-and-drop, import from .txt
• Presets: 4K, 1080p MP4, MP3 320, FLAC lossless, Phone 720p, Podcast, Ringtone, Audiobook
• Track picker + filter for Spotify playlists
• Live queue with speed / ETA, cancel, ZIP all
• Built-in YouTube search + sort + filter
• NEW in v3 — download scheduler (once / daily / weekly)
• Built-in converter — MP3, FLAC, MP4, M4A, WAV, Opus…
• Stats dashboard, history, 9 accent colors, dark + light themes
• 100% local. No telemetry. Ever.

DOWNLOAD (Windows 10 / 11)
Grab PurffleGrab-Setup.exe from the GitHub releases page — installs per user, no admin.

Made in the open as part of the Purffle toolset:
🎵 PurffleGrab — Spotify & YouTube downloader
🎥 PurffleVision — AI video creation
⚡ PurffleShorts — YouTube Shorts generator
📈 PurffleTrader — crypto paper-trading bot
🤖 PurffleCopyBot — copy-trading bot

If it saves you time, dropping a ⭐ on GitHub genuinely helps the project reach more people.

For personal use — respect the terms of service of the platforms you download from.

#OpenSource #Windows #SpotifyDownloader #YouTubeDownloader #YouTubeToMP3 #FLAC #4K
```

## 🏷 Hashtags (30 for description end / Shorts caption / Instagram)

```
#PurffleGrab #Purffle #SpotifyDownloader #YouTubeDownloader #YouTubeToMP3
#YouTubeTo4K #FLACDownloader #MusicDownloader #FreeSoftware #OpenSource
#WindowsApps #Electron #ytdlp #FFmpeg #DownloadManager
#Playlist #SpotifyToMP3 #4KDownload #NoAds #Privacy
#DevTools #IndieDev #BuildInPublic #GitHub #IndieSoftware
#WindowsTools #AudioTools #Chamanraj #MediaDownloader #PurffleTools
```

## 🎨 Thumbnail

**Shipped:** `docs/thumbnail.png` (1280×720) and `docs/thumbnail-1x1.png` (1080×1080).
Sources are `docs/thumbnail.html` / `docs/thumbnail-1x1.html` — edit and re-render with:

```bash
RENDER_HTML=docs/thumbnail.html RENDER_OUT=docs/thumbnail.png RENDER_W=1280 RENDER_H=720 npx electron scripts/render-html.mjs
```

### What it is

Type-first poster on the `#0b0a12` brand field. Everything hangs off one flush-left spine
at x=64, in a three-step size ladder so there is exactly one focal point:

| Tier | Content | Size |
|---|---|---|
| 1 | `FREE` — white | 222px |
| 2 | `SPOTIFY + YOUTUBE` — purple→pink gradient | 92px |
| 3 | `DOWNLOADER` — white | 88px |

Plus the `PurffleGrab` wordmark top-left, a gradient `⬇ OPEN SOURCE` pill top-right, the
app icon (same rounded square as the video's end card) as a wordless anchor in the right
third, and a pill row `MP3 · MP4 · FLAC · UP TO 4K` with the 4K pill in brand gradient.

### Why this one

Five concepts were designed and ranked by three independent lenses — scroll-stopping power,
typographic craft at feed size, and brand truth. All three ranked the type-first poster
first (27.8 / 22.5 / 18.8 / 12.5 / 11.8 weighted). The runners-up are kept in
`docs/thumbnail-alts/` if you want to A/B them later — `d3-split` is the closest second and
the most conservative option.

### Verified, not assumed

- exactly 1280×720 (and 1080×1080 for the square)
- legible at 320×180 — checked at 320px and stress-tested at 210px
- bottom-right 22%×18% is empty for YouTube's duration stamp (luma max 49 vs 235 full-frame)
- ≥44px safe margin on all four edges
- fully self-contained: no webfonts, no remote images, no scripts — inline CSS gradients and
  inline SVG only
- **no third-party logos.** "Spotify" and "YouTube" appear as plain gradient text
  (nominative reference). The Spotify green circle and YouTube play mark were deliberately
  rejected even though two of the three judges asked for them — using them would imply a
  partnership that does not exist.

### The square is not a crop

`thumbnail-1x1.png` is built natively at 1080×1080. A centre-crop of the 16:9 decapitates
`FREE` to "REE" and clips the wordmark, so the square has its own layout: same spine and
ladder, `FREE` up to 292px, full icon+wordmark lockup, and a gradient rule binding the
headline to the pill row.

## 📸 Instagram Reel caption (9:16)

Use `purfflegrab-9x16-1080p.mp4`. It is **not** a centre-crop — a plain crop of a desktop UI
cuts the heading and the right edge of every card. Instead the full 16:9 frame sits inside a
branded 1080×1920 surround (product name + format chips above, CTA + repo URL below), so
nothing in the app is lost.

Caption:
```
Free Spotify & YouTube downloader I built — open source, no accounts, no ads.
MP3, MP4, FLAC, 4K. Comes with a converter, queue, and scheduler.
Grab it → github.com/Chamanrajragu/purffle-grab (link in bio)

#PurffleGrab #OpenSource #SpotifyDownloader #YouTubeDownloader #IndieDev
```

## 🎬 Pinned first comment (YouTube)

```
Direct download → https://github.com/Chamanrajragu/purffle-grab/releases/latest
The installer is per-user (no admin). FFmpeg + yt-dlp are bundled inside.
If it saves you time, a ⭐ on the repo genuinely helps me push updates 💜
```

## 🎙 Voiceover script (final, matches the audio in the MP4)

| # | Scene | Line starts | On screen | Line |
|---|---|---|---|---|
| 1 | Download view | 0:00.5 | pointer drifts in, input wakes | PurffleGrab — a free, open-source Spotify and YouTube downloader for Windows. |
| 2 | Paste | 0:05.4 | clicks the box, types two links | Paste any link. Spotify, YouTube, an entire playlist. Drop them in, or just hit Control V. |
| 3 | Analyze | 0:12.1 | Analyze spins, tracks stagger in, one un-ticked | Hit Analyze, and PurffleGrab reads the whole track list — artwork, artist, tags — then lets you pick exactly what to grab. |
| 4 | Presets | 0:19.8 | clicks MP3 320 → FLAC → 4K, quality menu opens | One-click presets: 4K, 1080p MP4, MP3 320, FLAC lossless, phone, podcast, even ringtone. |
| 5 | Live progress | 0:28.6 | bars fill, rows flip to ✓, speed/ETA tick | Downloads run in parallel, with live speed and ETA. Grab one file, or zip the entire batch. |
| 6 | Search | 0:35.7 | types a query, results land, ticks three | No link? Search YouTube by name, filter, sort, and send results straight to the queue. |
| 7 | Queue | 0:41.8 | Start all pressed, items go live | The queue handles everything at once. Start all, pause, or clear it in a single click. |
| 8 | Scheduler | 0:46.9 | types a URL, picks Daily, schedules it | The scheduler queues downloads for later — once, daily, or weekly. |
| 9 | Converter | 0:53.5 | file dropped in, picks FLAC, converts | And convert between MP3, FLAC, MP4 and more, right inside the app. |
| 10 | Command palette | 1:00.1 | palette opens, filters to "fav", jumps to Favorites | Press Control K for the command palette, and star the links you grab most often. |
| 11 | Settings | 1:04.5 | accent recolours the UI, theme flips to dark | Nine accent colors, dark and light themes, your own download folder — and zero telemetry. |
| 12 | End card | 1:10.2 | logo and CTA animate up | PurffleGrab. Free, open-source, and on GitHub. |

Use these timestamps as YouTube chapters if you want them, or as caption cue points.
