# Changelog

All notable changes to PurffleGrab are documented here.

## [Unreleased]
### Added
Eight features that the UI offered but that were never actually implemented now
work end to end:
- **Speed limiter** and **custom filename templates** are passed to yt-dlp
  (`--limit-rate`, `-o`). Both inputs are validated — a template cannot escape
  the download folder, and a malformed rate is ignored rather than forwarded.
- **Split by chapters** now passes `--split-chapters`.
- **Scheduler** actually starts the download instead of only analysing the link,
  remembers the options chosen when the entry was created, and genuinely repeats
  daily/weekly — rolling forward past any occurrences missed while the app was
  shut, so it fires once rather than in a burst.
- **QR codes** are real, scannable QR codes: a complete byte-mode encoder at
  error-correction level M, versions 1–10, with Reed–Solomon error correction,
  all eight mask patterns scored by the standard penalty rules, and a 4-module
  quiet zone. Verified by round-tripping through an independent decoder. The
  previous implementation drew a hash-seeded random pattern that nothing could
  read. Codes can now be saved as PNG.
- **Crossfade** overlaps tracks for real. The player now runs two audio decks
  through a shared analyser chain instead of one element, so the outgoing and
  incoming tracks are briefly audible together and the visualizer shows the blend.
- **Batch rename** renames files. It targets a chosen download, always shows a
  preview before touching anything, fills `%(title)s`/`%(artist)s`/`%(album)s`
  from embedded tags (via ffprobe, falling back to the "Artist - Title" filename
  convention), collapses separators left by empty fields, and never overwrites an
  existing file.
- **Reset to defaults** resets and persists. It previously reported success
  while doing nothing.

### Fixed
- **Settings no longer silently reset.** The server only persisted five keys, so
  everything else came back as `undefined` and the front-end overwrote its own
  defaults with it. All preferences now round-trip, and a `settings.json` written
  by an older build gains new keys without losing existing ones.
- **Background particles** were dead twice over: the preference above was always
  `undefined`, and the canvas latched `window.innerWidth` before layout, leaving
  it `0x0` with every particle stacked at the origin. Size is now re-checked each
  frame and self-heals.
- **Speed gauge** never appeared, for the same lost-preference reason.
- **Audio visualizer** froze permanently the first time playback was paused — the
  render loop returned without re-scheduling itself. It also started a new loop
  per loaded track; now exactly one loop runs and it idles while paused.
- **"Total size"** in Statistics was fabricated (`files × 5MB`). The server now
  reports real on-disk bytes per item and history records a `bytes` total.
- **"Total time"** on the completion card always read `0s`, because the timer was
  cleared before the panel read it. Format also always read `auto`.
- **Six settings had no effect at all** — auto-start queued downloads, show speed
  graph, confirm before closing during a download, auto-update yt-dlp on startup,
  minimize to system tray, and focus mode are now wired up.
- **"Load folder"** in the player and **"Pause all"** in the queue were buttons
  with no handler; Pause all was also permanently disabled.

## [2.0.0] — 2026-06-28
### Added
- **Installable Windows app** — one-click `PurffleGrab-Setup.exe` (NSIS), per-user install with
  Desktop + Start-menu shortcuts. ffmpeg and yt-dlp are bundled — nothing else to install.
- **Brand-new UI** — sidebar desktop layout with **dark & light themes**.
- **Drag & drop** links onto the window, **clipboard paste**, and **batch** (many links at once).
- **Quick presets** — Best video (4K), 1080p MP4, MP3 320, Phone MP4 720, FLAC lossless.
- **Normalize loudness**, **simultaneous downloads**, per-item **Open file / Show in folder**,
  desktop **notifications**, and a native **folder picker**.

## [1.0.0] — 2026-06-27
### Added
- Spotify (track/playlist) and YouTube (video/playlist) downloading.
- Track picker, YouTube keyword search, download history, settings.
- SponsorBlock, subtitles, clip/trim, embed chapters, audio bitrate, cancel, live speed + ETA.
- Self-contained web server with `yt-dlp` + `ffmpeg`.
