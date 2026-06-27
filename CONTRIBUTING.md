# Contributing to PurffleGrab

Thanks for your interest! PurffleGrab is a small, focused Electron + Node.js app.

## Getting started
```bash
git clone https://github.com/Chamanrajragu/purffle-grab.git
cd PurffleGrab
npm install
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1   # downloads yt-dlp + ffmpeg into bin/
npm start                                                    # launch the desktop app
```
You can also run just the web server for quick iteration:
```bash
npm run server      # http://localhost:7777
```

## Project layout
| Path | What it is |
|------|------------|
| `electron/main.js` | Electron entry — boots the embedded server, opens the window. |
| `server/server.js` | Express backend: analyze, download, search, history, settings. |
| `server/media.js`  | Wraps the bundled `yt-dlp` + `ffmpeg`. |
| `server/spotify.js`| Reads Spotify metadata (no API key) from the public embed page. |
| `public/`          | The UI (vanilla HTML/CSS/JS). |
| `installer.nsi`    | NSIS script that produces the installer from `release/win-unpacked`. |

## Building the installer
```bash
npm run dist        # produces release/win-unpacked
# then compile installer.nsi with makensis (see README → Build from source)
```

## Guidelines
- Keep dependencies minimal.
- Match the existing code style (no framework, small modules).
- Test both a YouTube link and a Spotify link before opening a PR.
- Be respectful and keep discussions on-topic.

## Scope & responsibility
PurffleGrab is for **personal use**. Please don't submit features designed to evade platform
protections or enable mass/commercial redistribution of copyrighted content.
