# Changelog

All notable changes to PurffleGrab are documented here.

## [12.0.0] — 2026-10-31
The biggest PurffleGrab update yet: every site the engine supports is a first-class
citizen, songs can be found by name, Spotify matches are smarter, 4K is really 4K,
and downloads repair themselves when a site changes.

### Added
- **1,000+ sites, properly.** TikTok, Instagram, SoundCloud, X, Facebook, Vimeo,
  Reddit, Twitch, Bandcamp, Dailymotion, Bilibili, Mixcloud and the rest always
  worked through yt-dlp, but every link was labelled "YouTube". Each now gets its
  own badge, audio-only sources (SoundCloud, Bandcamp) are recognised as such, and
  copied links from all of them are detected.
- **Type a song name — or paste a tracklist.** A line that isn't a link is searched,
  and the best match is shown with up to five alternatives a click away. Paste a
  whole list of songs, one per line, and each is matched.
- **Smarter Spotify matching.** Tracks used to take the first YouTube search hit,
  which was regularly a live version, a cover or a sped-up edit. Candidates are now
  scored on title, artist and how close their length is to the real track,
  preferring official audio ("Artist - Topic" uploads carry the studio master). If
  the best match is unavailable, the next one is tried automatically.
- **Album tags.** Spotify downloads now carry album, album artist, track number and
  year where Spotify provides them, and no longer inherit the matched upload's own
  container tags.
- **Synced lyrics.** The player's Lyrics pane can fetch time-synced lyrics from
  LRCLIB (only when you ask) and highlights each line as the song plays. A new
  "Save synced lyrics (.lrc)" option writes them next to each downloaded song.
- **Play right after downloading.** Play buttons on finished tracks, on the
  completion card, in History and on the home screen load the files straight into
  the player. "Play" used to open an empty player.
- **Recent downloads on the home screen**, with Play / Open / Folder.
- **Resume.** Cancelling keeps partial files; the completion card offers Resume
  and picks up where each download stopped. Unstarted items are now marked
  cancelled instead of left "queued" forever.
- **Self-healing engine.** yt-dlp now refreshes itself daily by default (the
  setting shipped switched off, so most installs never refreshed), and when a download
  fails in a way that points to a stale engine, PurffleGrab fetches a fresh one and
  retries — once, shared by every download in flight.
- **Browser cookies and proxy** (Settings → Downloads that need a login). Fixes
  age-restricted and members-only videos, YouTube's "confirm you're not a bot"
  check and login-only Instagram posts by reading your existing browser login
  locally; a cookies.txt file and an HTTP/SOCKS proxy are supported too.
- **Clear error messages** for bot checks, rate limits, login-required posts,
  region locks, unsupported links, a full disk, an unwritable folder and network
  failures — each saying what to do next.
- **Progress you can read.** Each track shows its own progress bar and stage
  ("Finding the best match", "Converting", "Tagging", "Updating engine"), the
  YouTube title it matched, and whether lyrics were saved.
- **Send links from your browser.** A bookmarklet (Settings) opens the page you're
  on in PurffleGrab via a `purfflegrab://` link the app now registers.
- **Taskbar / dock progress** while downloads run.
- **One-click MP3 from a copied link**, next to Grab on the copied-link prompt.
- **Download as MP3 / Download as MP4** in Search, instead of a "Download
  selected" whose format depended on a hidden form.
- **In-app updates link straight to the installer** for your OS and its size.
- **Converter:** several files at once, streamed instead of buffered in memory
  (the cap rises from 1 GB to 8 GB), saved into a "Converted" folder with Open /
  Show in folder, plus MOV and GIF targets.
- **YouTube's challenge solver, built in.** YouTube now requires a JavaScript
  runtime to unlock most formats, and without one yt-dlp falls back to a few
  low-quality streams. PurffleGrab runs the solver on its own bundled runtime
  (Electron 45, Node 24) — nothing to install. Settings → About shows it.
- **Intel Macs.** A separate `x64` DMG alongside the Apple Silicon one.
- **A gentle "enjoying it?" card** after your third successful download — once,
  easy to dismiss for good.
- Every release is smoke-tested as an installed app before it is published: the
  packaged app boots with `--smoke-test` and checks its bundled engines, every
  encoder and the YouTube solver on Windows, macOS (both architectures) and Linux.
- `npm test`: an offline end-to-end suite that drives the real server, yt-dlp and
  FFmpeg against locally generated media.

### Changed
- **Tidy folders.** Every download used to land in its own `job-1a2b3c4d` folder.
  Single files and batches now go straight into the download folder; a playlist,
  album or channel gets a folder named after it.
- **Faster analyse and download.** A single video is probed once instead of twice,
  links are analysed four at a time, and pressing Download reuses the analysis
  instead of re-reading every link.
- Channel links (`youtube.com/@name`) list the channel's videos, not its tabs.
- The options panel tucks the long checkbox list under "Extras", and "Add to
  queue" is a button beside Download rather than a checkbox.
- History rows show a thumbnail, site, format, size and time; batches are titled
  "First item + 4 more" instead of "5 items".
- The tour is four steps instead of ten; What's New appears once per version, for
  people upgrading.
- Ctrl+1–9 follow the sidebar order (Ctrl+9 is Settings, which was unreachable),
  and every route into a view refreshes it.
- The Inter typeface is bundled — no request to Google Fonts on every launch, and
  the right font offline.
- The player visualiser uses log-spaced bands across the full width at native
  resolution, and the album art no longer spins.
- Default simultaneous downloads: 3 (new installs).
- **Electron 31 → 45** (Chromium 156, Node 24): current security fixes. macOS
  now needs **13 Ventura or newer** (Electron dropped 11 and 12).

### Fixed
- **4K and 1440p downloaded as 1080p.** The format selector required H.264, which
  YouTube only serves up to 1080p, so higher choices silently fell back. Quality
  is now chosen by resolution first, with H.264 preferred only as a tie-break.
- **Wrong file attributed to a track.** With several downloads running in one
  folder, a before/after folder comparison could credit one track's file to
  another — Open could open the wrong song and sizes were double-counted. Output
  paths now come straight from the engine.
- **macOS: FFmpeg only worked on Macs with Homebrew.** The DMG shipped
  Homebrew's FFmpeg, which loads its libraries from `/opt/homebrew`; on other Macs
  every conversion failed. It now ships static FFmpeg builds with no outside
  dependencies, checked at build time.
- **macOS: "PurffleGrab is damaged and can't be opened."** The app's signature
  was left broken by the build, so macOS offered no way past the warning except
  Terminal. It is now validly (ad-hoc) signed, so *Privacy & Security → Open
  Anyway* works.
- **Cancel at the last moment left a download stuck on "Cancelling…".** If the
  last track finished just as Cancel was clicked, the finished download was
  marked as cancelling and never left that state. A Cancel that lands between
  two steps of a track also no longer lets that step run on to the end.
- **Titles containing "%"** (e.g. "100% Hits") broke the output path.
- **Pasting on macOS:** the app removed the application menu, which is what routes
  ⌘V/⌘C/⌘A into text fields. A standard menu is back on macOS.
- **Typing with the keyboard piano switched on** swallowed letters in every text
  box.
- **The primary button turned violet on hover** whatever accent colour was chosen.
- **A hidden background animation ran every frame** (an O(n²) particle loop behind
  a canvas the design had hidden).
- Streaks and the activity heatmap used UTC dates, so late-night downloads could
  land on the wrong day.
- "Elapsed" read blank in the first second of a download.
- Three settings that controlled nothing visible were removed.

### Security
- The local server now listens on loopback only. It used to accept connections
  from the whole local network — anyone on the same Wi-Fi could start downloads,
  open files or change the download folder.
- Requests must come from the app itself: a non-local `Host` (DNS rebinding) or a
  cross-site `Origin` is refused, so a web page can no longer clear your history or
  start downloads with a hidden form.
- File endpoints use a real containment check (a prefix check let `job-ab` reach a
  sibling `job-abc`), and the app window can no longer be navigated away from the
  app.
- Settings and history are written atomically, so a crash mid-save can't truncate
  them.

## [11.2.1 – 11.7.2]
### Fixed (v11.7.2 — OGG downloads & same-format conversion)
- **OGG Vorbis downloads no longer fail.** The audio-format picker offers "OGG
  Vorbis" as `ogg`, but yt-dlp only accepts that format as `vorbis` — so every
  OGG download errored out with "invalid audio format". It's now mapped
  correctly (and still produces a `.ogg` file). Caught by a reliability pass that
  downloads every offered format.
- **Converting a file to its own format works.** The converter wrote its output
  into the same temp folder under the same name as the input, so a WAV re-encoded
  to WAV (or any same-format convert) collided — ffmpeg refuses to read and write
  one file and the convert failed. The output now uses a distinct path, so every
  format-to-format combination succeeds.

### Changed (v11.7.1 — honest lossless, clearer macOS install)
- **Honest about "lossless."** YouTube and Spotify only stream compressed audio,
  so a FLAC or WAV made from them is a lossless *copy of a lossy source* — a
  spectrum analyser shows the source's cutoff. The app now says exactly this,
  right where you pick a lossless format, and suggests MP3 320 / M4A for the
  smallest files with no audible difference. FLAC is still there for archival —
  it just no longer implies quality the source never had. (A user reasonably
  felt the old "FLAC lossless" label over-promised.)
- **Clearer macOS install path.** PurffleGrab isn't notarised by Apple (that
  needs a paid developer account), so macOS can flag it as *"damaged"* or from an
  *"unidentified developer."* The README and release now spell out the safe way
  to open it — right-click → Open, or `xattr -cr /Applications/PurffleGrab.app` —
  and the FAQ answers the lossless question for people who search it.

### Changed (v11.7.0 — new logo & interface polish)
- **New app logo, theme-aware.** PurffleGrab now wears its own monogram instead
  of the old violet download-tile. It's a single crisp vector that recolours
  itself from the theme — silver on dark, near-black on light — across the
  sidebar, the About screen and the browser tab, and the desktop/taskbar icon is
  a matching silver mark on a dark badge.

### Fixed (v11.7.0)
- **The About screen's feature list was invisible.** A leftover rule hid the
  first `<span>` of each feature row to drop an old emoji bullet — but once the
  list was trimmed to plain text, that first span *was* the text, so every
  feature read as blank. The list is back, and its group headings now span the
  full width so the features flow in columns under their own heading instead of
  scattering across two.
- **Picking an accent colour now recolours everything.** Choosing a non-violet
  accent (or a mood) changed the buttons but left the active-nav highlight and
  the input focus ring stuck on the original violet, because those tints were
  hardcoded. They're now derived from the chosen accent.
- **The version number no longer goes stale.** The About panel and the sidebar
  footer read the running build's version instead of a number typed into the
  page (which still said v11.2), so they can't drift out of date again.

### Added (v11.6.0 — exact-format picker & copied-link detection)
- **Choose the exact format & size.** On a single YouTube video, a new
  **Choose exact format & size** button lists every available stream —
  resolution, codec, and the approximate file size — so you can pick precisely
  what you want instead of a preset. A video-only stream automatically has audio
  merged in, so any choice just works.
- **Copied-link detection.** Copy a Spotify or YouTube link anywhere, switch
  back to PurffleGrab, and it offers to grab it — one click instead of paste and
  analyze. It only prompts for a link it hasn't offered before and that isn't
  already in the box, and it can be turned off in **Settings → Detect copied
  links**.

### Added (v11.5.0 — transcripts & channels)
- **Transcript download.** Pick **Transcript** on the download screen to save a
  video's spoken text as a clean `.txt` — no video, no audio, just the words.
  Choose the language and optionally include `[hh:mm:ss]` timestamps. It uses the
  video's real captions where present and falls back to auto-generated ones,
  strips caption tags and the rolling-duplicate lines, and tells you plainly when
  a video has no captions.
- **Whole-channel downloads.** Paste a channel URL (e.g. `youtube.com/@channel`)
  and PurffleGrab lists every video, so you can grab them all — or tick a subset —
  and it downloads them one by one. Combine it with Transcript to pull the text of
  an entire channel.

### Added (v11.4.0 — self-updating engine & update alerts)
- **The YouTube engine keeps itself up to date, on every platform.** yt-dlp goes
  stale every few weeks and starts refusing videos; `yt-dlp -U` can't fix that on
  macOS or Linux because the bundled copy is read-only. The app now downloads a
  fresh engine into a writable folder and uses it automatically — so downloads
  keep working without anyone touching Settings. "Update engine" uses the same
  mechanism, and the auto-check is throttled to once a day.
- **In-app update alerts.** A small, dismissible banner appears when a newer
  PurffleGrab is released, linking straight to the download. Dismissal is
  remembered per version, so you're never nagged about a release you skipped.

### Fixed (v11.3.4 — converter hardening & clearer errors)
- **Clear message for a bad link.** Pasting something that isn't a URL used to
  surface a raw engine error ("ERROR: [generic] '…' is not a valid URL"). It now
  says "That doesn't look like a link — paste a Spotify or YouTube URL," and
  analyze/search failures are phrased in plain language too.
- **Converter safety.** The uploaded filename is sanitised so a crafted name
  can't write outside the temp folder; the target format is checked against the
  ten it actually supports; and an upload over 1 GB is refused with a clear
  message instead of risking an out-of-memory crash.

### Fixed (v11.3.3 — YouTube reliability)
- **Updated the bundled YouTube engine (yt-dlp) to the latest build.** YouTube
  changes its player every few weeks and an old engine starts returning "This
  video is unavailable" on videos that are perfectly fine — the usual cause of
  "it suddenly stopped downloading". Fresh builds always ship the newest engine.
- **A failed download now tells you why.** Instead of a bare "Failed", the item
  shows a plain reason — unavailable, private, age-restricted, region-blocked,
  or a format that isn't offered — so you know whether to retry, change quality,
  or move on.
- **Retries try alternative YouTube player clients.** When YouTube blocks the
  first client for a video, a retry now reaches for others (web, tv, android,
  iOS…), which recovers videos that failed on the first pass.

### Fixed (v11.3.2 — cross-platform & converter)
- **"Open folder", "Open file" and "Reveal in folder" now work on macOS and
  Linux.** They shelled out to Windows-only `explorer`/`start`, so on the Mac and
  Linux builds those buttons did nothing. They now use the right opener per
  platform (`open` / `xdg-open`), and run without a shell so a track title with
  quotes or other odd characters can't be misread as a command.
- **The Browse-for-folder button works on macOS and Linux** too (native chooser
  via AppleScript / zenity), instead of only Windows.
- **Reveal-in-folder gained the path-traversal guard** the other file endpoints
  already had.
- **The converter's Quality setting (High / Medium / Low) is applied.** It was
  parsed and then ignored, so MP3 always came out ~190 kbps regardless. High/
  Medium/Low now map to real bitrates for every lossy format, and to a CRF tier
  for video; FLAC/WAV stay lossless.

### Fixed (v11.3.1)
- **"Retry failed" now re-downloads only the failed tracks**, into the same
  folder, so the ones that already downloaded are kept. It used to restart the
  whole playlist from scratch, forcing you to re-select the missing tracks by hand.
- **Fewer tracks skipped on big playlists.** Each track now gets up to three
  attempts with backoff (was one), which recovers the transient/throttled
  failures that were leaving a chunk of long playlists undownloaded. yt-dlp is
  also bounded so a genuinely-unavailable track fails in seconds instead of
  stalling the batch.
- **Honest expectations for Spotify's editorial playlists.** Since Nov 2024
  Spotify blocks Web API access to its own editorial/algorithmic playlists
  (Today's Top Hits, RapCaviar, etc.), so even with credentials those stay
  capped at 100. Settings now says so plainly, the error is specific instead of
  a silent fallback, and it suggests copying such a list into one of your own to
  download it in full. User-created playlists are unaffected.

### Added
- **Large Spotify playlists (optional).** The account-free path reads Spotify's
  public embed, which Spotify caps at the first 100 tracks — so playlists over
  100 were truncated. You can now add your own free Spotify API credentials
  (Client ID + Secret from developer.spotify.com) under **Settings → Spotify**
  to lift the cap: the app then uses the official Web API and fetches the whole
  playlist or album, however large, with each track's own album art. Credentials
  stay on your machine, the secret is never sent back to the UI, and the default
  no-setup experience (up to 100 tracks) is unchanged — anything wrong with the
  credentials silently falls back to the embed rather than failing.

### Fixed
- **Spotify playlist & album downloads now embed cover art.** Spotify's
  playlist/album embed data carries no per-track artwork, and the downloader had
  no fallback — so playlist files came out with no cover while single-track
  downloads (which do carry one) worked. Album tracks now use the album cover;
  playlist tracks are upgraded to their own album art at download time via a
  per-track lookup (`getTrackCover`), with the playlist thumbnail as a fallback
  if that lookup fails.

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

## [11.2.0]
First release built for all three platforms from a single source revision.
Windows, macOS and Linux installers are attached together.

### Added
- **Organise into Artist / Album folders.** A checkbox in the options. On the
  YouTube path this is a yt-dlp output template with field fallbacks, so a video
  with no album still lands somewhere sensible. The Spotify path builds the
  directories itself, because there the filename comes from the Spotify metadata
  rather than from whichever YouTube video happened to match.
- **Automatic retry.** Every item now gets one silent second attempt before it is
  reported as failed. Most failures in a long batch are transient — a dropped
  connection, a throttled response — and losing a track to that used to mean
  noticing afterwards and re-running the whole grab by hand.
- **Ctrl+Shift+V — paste and go.** Takes a link straight from the clipboard
  through analysis to a download using your last settings. Ctrl+V still just
  fills the box.
- **The last preset is remembered** between sessions.
- **Copy link** in the history right-click menu. Recovering the original URL of a
  past download previously meant exporting the entire history as JSON.

## [11.1.0]
### Added
- **Retry failed downloads.** A failed item used to be a dead end — the only way
  to try again was to find the link and paste it back in. The completion card now
  offers to re-run just what failed, with the same options.
- **Already-downloaded warning.** Analyzing a link you have grabbed before now
  says so, with when and how many files. History existed but was never consulted,
  so re-downloading the same album was the easiest mistake in the app. It is a
  note rather than a block: re-grabbing at better quality is a fair reason.
- **Track range selection.** Enter a range such as 5-20 in a playlist to tick
  exactly those tracks. Selecting tracks 40 to 60 of a 200-track album one
  checkbox at a time is what makes people give up and take the whole thing.
- **CSV history export**, alongside the existing JSON. JSON is for re-importing;
  CSV is what you want when you open it in a spreadsheet. Includes size, format
  and source columns.
- **Lyrics are saved per track.** The pane previously rendered a textarea that
  was never read back, so anything typed vanished on the next track.

### Fixed
- **The search filter chips did nothing.** All / Videos / Music / Shorts moved
  their own highlight and then re-rendered the unfiltered list. They now filter
  by length — the only thing a flat search result can support, since it carries
  no view count and no upload date.
- **Two sort options could not work.** "View count" was never handled and
  "Upload date" simply reversed the array. Replaced with longest, shortest and
  title, which the data supports.
- **Mood themes corrupted the palette.** Choosing a mood and then an accent
  colour left the mood's second and third colours behind — pick Sunset then blue
  and you were stuck with a blue accent over Sunset's red and amber, saved to disk.
- **"Zip selected" only zipped the first item.** Selecting five downloads
  produced one file.
- **History paging could go negative** when a filter matched nothing, indexing
  the page slice from -20.

## [11.0.0] — redesigned interface
### Changed
- Rebuilt the interface around a single accent colour, an SVG icon set on a
  shared grid, and neutral surfaces separated by hairline borders. The previous
  build put one violet-to-pink gradient on the logo, every button, progress bars,
  badges and thumbnails, so nothing stood out.
- Navigation grouped into Library, Tools, Insights and App, instead of twelve
  entries at equal weight.
- Removed four animated background layers (mesh gradient, particle canvas,
  floating particles, noise overlay). Idle CPU cost is now effectively zero.
- The view heading no longer types itself through five different words.
- Visible keyboard focus throughout, and controls share a consistent height.
- Three floating buttons removed; each duplicated an existing control.
- About trimmed from 44 emoji rows to a short grouped summary.

### Fixed
- Player transport controls rendered bright cyan: emoji ignore CSS colour.
  All are SVG now.
- `ffprobe` is bundled again, so batch rename reads embedded tags rather than
  falling back to filename parsing.

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
