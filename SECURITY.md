# Security Policy

## Supported versions

Only the latest release receives fixes. PurffleGrab tells you in-app when a new
version is out, with a direct link to the installer.

| Version | Supported |
| ------- | --------- |
| 12.x    | ✅ |
| < 12.0  | ❌ — please update |

## Reporting a vulnerability

Please **don't** open a public issue for a security problem.

1. Report it privately through
   [GitHub Security Advisories](https://github.com/Chamanrajragu/purffle-grab/security/advisories/new),
   or email **chamanrajragu@purffle.com**.
2. Include the version, your operating system and steps to reproduce.
3. You'll get a reply within 72 hours with next steps and a fix timeline.

## How PurffleGrab protects you

- **No telemetry, analytics or tracking.** The app contacts only the sites whose
  links you paste, GitHub (to check for updates and refresh its download engine)
  and — only if you ask for lyrics — LRCLIB.
- **Local-only server.** The interface talks to a small server on your own
  machine. It listens on loopback only and refuses requests from other web pages
  (cross-site origins) and from foreign host names (DNS rebinding).
- **Contained file access.** File actions are limited to the files a download
  produced, with path-traversal checks on every file endpoint.
- **Browser cookies stay local.** If you turn on "Use browser cookies", they are
  read on your machine by the bundled yt-dlp and never sent anywhere else.
- **Bundled tools from official sources.** yt-dlp and FFmpeg are fetched from
  their official release channels at build time.
