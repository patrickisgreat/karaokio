# Karaokio Setup Guide

Karaokio runs entirely on one machine (the party host's laptop) and shells out
to a few system tools. Get those installed, run the doctor, and start the dev
server.

## 1. System dependencies

| Tool   | Required?   | What it enables                                       |
| ------ | ----------- | ----------------------------------------------------- |
| Node   | required    | the app itself (version pinned in `.nvmrc`)           |
| ffmpeg | required    | all audio/video processing, plus "fast" vocal removal |
| yt-dlp | recommended | YouTube audio + karaoke video download                |
| demucs | recommended | high-quality AI vocal separation (`high`/`balanced`)  |

**macOS:**

```bash
brew install ffmpeg yt-dlp
pipx install demucs        # or: pip install demucs
```

**Ubuntu/Debian:**

```bash
sudo apt install ffmpeg
sudo apt install pipx && pipx install yt-dlp demucs
```

Missing optional tools don't break the app — the pipeline degrades (e.g. no
demucs → ffmpeg center-channel vocal removal, which is fast but much rougher).

## 2. Application setup

```bash
nvm use              # match the pinned Node version
npm install
npm run doctor       # verifies the system tools above
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

`.env.local` works with every value left unset — all API keys are optional.
The SQLite database (`karaoke.db`) and the runtime directories (`uploads/`,
`output/`, `temp/`, `cache/`, `downloads/`, `youtube_videos/`) are created
automatically on first run.

## 3. Verify

```bash
npm run type-check   # no type errors
npm run lint         # no lint errors
npm test             # full suite, runs in seconds, no system tools needed
```

## Usage

1. **Add songs**: guests enter their name and a song request
2. **Processing**: the pipeline acquires audio, separates vocals, syncs lyrics
3. **Queue**: songs show live status and progress
4. **Sing**: when a song is ready, hit Start Singing for the full-screen player

### Processing quality options

- **Fast** — ffmpeg center-channel removal (~30 seconds, rough)
- **Balanced / High** — Demucs AI separation (minutes per song, good)

### Audio sources (in priority order)

1. **User uploads** — drop files in `uploads/` or use the upload API
2. **yt-dlp download** — automatic, needs `yt-dlp` installed
3. **Torrents** — optional, disabled by default (`ENABLE_TORRENT_DOWNLOAD`)

## Troubleshooting

- **`npm run doctor` says a tool is missing** — install it with the hint shown;
  restart the dev server afterwards.
- **A song is stuck in processing** — check the dev server logs; restart the
  server (song state survives in SQLite; in-flight jobs do not, yet).
- **A song failed** — usually audio acquisition: put a correctly named file
  (`Artist - Title.mp3`) in `uploads/` and retry.
- **Disk filling up** — processed songs accumulate in `output/` and `cache/`;
  delete them freely, anything needed again will be reprocessed.

## Project docs

- [CLAUDE.md](./CLAUDE.md) — architecture, conventions, product principles
- [ROADMAP.md](./ROADMAP.md) — current state and the phased plan
