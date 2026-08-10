# Third-party notices

PurffleGrab is distributed as a binary that bundles the third-party components
listed below. Each remains under its own licence, and nothing in the PurffleGrab
licence restricts your rights in these components.

---

## FFmpeg — GPL v3

PurffleGrab bundles an unmodified **GPL build** of FFmpeg (`ffmpeg`, `ffprobe`),
obtained from the BtbN/FFmpeg-Builds project:

- Project: https://ffmpeg.org
- Build source: https://github.com/BtbN/FFmpeg-Builds
- Licence: GNU General Public License v3 — https://www.gnu.org/licenses/gpl-3.0.html

FFmpeg is executed as a separate program; PurffleGrab does not link against the
FFmpeg libraries.

### Written offer for source code

As required by the GPL, the complete corresponding source code for the FFmpeg
build distributed with PurffleGrab is available here:

- https://github.com/FFmpeg/FFmpeg
- Build scripts: https://github.com/BtbN/FFmpeg-Builds

If you cannot obtain it from those locations, email **purfflestore@gmail.com**
and we will provide the complete corresponding source for the version bundled
with your copy, on a physical medium or by download, for no more than the cost of
distribution. This offer is valid for three years from the date you received this
copy of PurffleGrab.

---

## yt-dlp — Unlicense (public domain)

- Project: https://github.com/yt-dlp/yt-dlp
- Licence: The Unlicense — https://unlicense.org

Bundled unmodified and executed as a separate program.

---

## Electron, Chromium, Node.js

PurffleGrab is built on Electron, which incorporates Chromium and Node.js.

- Electron — MIT — https://github.com/electron/electron/blob/main/LICENSE
- Chromium — BSD 3-Clause and others — full text in `LICENSES.chromium.html`,
  installed alongside the application
- Node.js — MIT — https://github.com/nodejs/node/blob/main/LICENSE

---

## Express, Archiver

- Express — MIT — https://github.com/expressjs/express
- Archiver — MIT — https://github.com/archiverjs/node-archiver

---

## Fonts and assets

Interface typography uses the system UI font on each platform. The Inter typeface
(SIL Open Font License 1.1) is loaded by the in-app interface where available —
https://github.com/rsms/inter

---

*If you believe a component is missing from this list, please open an issue and it
will be corrected.*
