# CLAUDE.md — Karaokio

## What is this project?

Karaokio is a self-hosted karaoke machine for house parties. Guests add songs to a shared queue from their phones; the system autonomously acquires the audio, strips the vocals with AI source separation (Demucs), fetches and synchronizes lyrics, produces a karaoke video, and plays it full-screen when it's the guest's turn.

**This is a personal, non-commercial project.** It runs on one machine on a trusted home LAN for the host and their friends. Never add accounts, payments, multi-tenancy, or anything that smells like a product.

## ⚠️ Product Principles — DO NOT VIOLATE

1. **The party comes first — degrade, don't fail.** A song request should almost never end in `failed`. Every pipeline stage has a fallback ladder:

   ```
   karaoke video w/ word-level sync
     → generated video w/ line-level sync
       → audio + LRC lyrics in the player
         → instrumental audio only
   ```

   A stage that can't deliver its best output hands the song down the ladder; it does not throw and kill the request. If you're writing a `throw` in the pipeline, first ask what the song could still be without that stage.

2. **The browser never sees a filesystem path.** The SQLite DB stores server-side file paths; the API layer translates them into URLs served by the media route (`/api/media/...`) with HTTP Range support. Returning a raw `path.join(...)` result to the client is always a bug — it's the reason the original player never played anything.

3. **Every external service is optional and fails soft.** The full pipeline must work with **zero API keys** (keyless sources: LRCLIB, MusicBrainz, yt-dlp). Keys in `.env.local` unlock better sources; their absence must never crash a stage. Wrap every external call in a timeout + catch that falls through to the next source.

4. **Everything runs locally.** Audio processing, alignment, and video rendering happen on the host machine via spawned tools (ffmpeg, demucs, yt-dlp). Don't introduce runtime cloud dependencies for the core pipeline — a party with no internet should still play anything already cached or uploaded.

5. **Acquisition is host-supplied first.** Priority order: user uploads / local library → yt-dlp audio download → torrents (config-gated, **off by default**). This is a private tool for personal use at the host's home; keep it that way.

## Tech Stack

- **Frontend + API**: Next.js 14 (App Router, API routes), React 18, TypeScript, Tailwind CSS
- **Database**: SQLite via better-sqlite3 (`karaoke.db` in repo root, created on boot)
- **Audio**: Demucs (vocal separation), FFmpeg via fluent-ffmpeg (fallback separation, transcode, mux)
- **Video**: FFmpeg (subtitle burn-in, audio replacement, streaming optimization)
- **Acquisition**: yt-dlp via youtube-dl-exec; WebTorrent + torrent-search-api (optional, off by default)
- **Lyrics**: LRCLIB (synced, keyless) with plain-text fallbacks; forced alignment for word timing
- **Testing**: Jest + ts-jest

### Required system dependencies

```bash
brew install ffmpeg yt-dlp
pipx install demucs        # or: pip install demucs
```

Node version is pinned in `.nvmrc`. The app checks for these tools at startup — a missing tool disables its stage, it does not crash the server (Principle 3).

## Common Commands

```bash
npm run dev            # Dev server at localhost:3000
npm run build          # Production build
npm run type-check     # tsc --noEmit
npm run lint           # ESLint
npm test               # Jest (unit + integration)
npm run test:coverage  # Jest with coverage
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Queue / add-song home page
│   ├── sing/[songId]/page.tsx    # Full-screen karaoke player page
│   └── api/
│       ├── queue/                # add, list, [songId]/start, [songId]/complete
│       ├── songs/                # search, [songId] detail
│       └── upload/               # audio file upload
├── components/                   # QueueInterface, KaraokePlayer, SearchInterface, ...
├── lib/
│   ├── autonomousProcessor.ts    # THE PIPELINE — orchestrates every stage
│   ├── audioProcessor.ts         # Vocal separation (Demucs / FFmpeg)
│   ├── lyricsProcessor.ts        # Fetch, synchronize, LRC/SRT conversion
│   ├── videoGenerator.ts         # Generate karaoke video from scratch
│   ├── videoProcessor.ts         # Audio replacement, optimization, probing
│   ├── youtubeClient.ts          # yt-dlp search + download
│   ├── torrentClient.ts          # Torrent search + download (optional)
│   ├── cacheManager.ts           # Processed-song cache (title+artist+quality key)
│   ├── musicSearch.ts            # Spotify / MusicBrainz metadata search
│   ├── database.ts               # KaraokeDB — all SQLite access
│   └── config.ts                 # ConfigManager — env-driven settings
└── types/                        # Shared TS types
tests/                            # Jest: unit/, integration/, __mocks__/
uploads/ downloads/ cache/ output/ temp/ youtube_videos/   # Runtime dirs (gitignored)
```

## The Processing Pipeline

`autonomousProcessor.processKaraokeSong()` is the single entry point, fired in the background when a song is queued. Stages, with their progress bands:

| Stage                | Progress | What happens                                              |
| -------------------- | -------- | --------------------------------------------------------- |
| Cache check          | 5%       | Serve instantly if (title, artist, quality) cached        |
| Audio acquisition    | 10–25%   | Uploads/local library → yt-dlp → torrents (if enabled)    |
| Karaoke video search | 30%      | yt-dlp search for an existing karaoke video (best-effort) |
| Vocal separation     | 45–70%   | Demucs (`high`) / FFmpeg center-cancel (`fast`)           |
| Lyrics fetch + sync  | 75%      | Synced LRC from LRCLIB, else fetch text + align locally   |
| Video assembly       | 85%      | Replace audio in found video, else generate one (ladder)  |
| Cache + ready        | 100%     | Store artifacts, mark `ready`                             |

Progress and status live in the `songs` table; the UI polls it. Every stage writes its artifact path to the DB as soon as it exists, so a later crash still leaves usable partial output.

### Architecture caveats to keep in mind

- **Processing runs in-process.** The pipeline runs inside the Next.js server via fire-and-forget promises and a module-level job map. In dev, a hot reload wipes in-memory job state (the DB status survives). Don't add a second bookkeeping layer — the DB is the source of truth; the map only tracks liveness.
- **One pipeline.** `autonomousProcessor` is it. `jobProcessor.ts` was an earlier draft slated for deletion — never extend it.
- **Spawned tools are integration boundaries.** Anything touching `spawn`, fluent-ffmpeg, yt-dlp, or the network gets mocked in unit tests and exercised for real only in integration tests / manual runs.

## Environment

Copy `.env.example` → `.env.local`. **All keys are optional** (Principle 3). Feature flags (`ENABLE_TORRENT_DOWNLOAD`, `ENABLE_YOUTUBE_DOWNLOAD`, `ENABLE_CACHE`) and paths/timeouts are env-driven through `config.ts` — read config through `ConfigManager`, never `process.env` directly in feature code.

Never commit secrets, `karaoke.db`, or anything in the runtime media directories.

## Conventions

- TypeScript strict; no semicolons (match existing style); 2-space indent
- Prettier is the formatter (`npm run format`, config in `.prettierrc`) — CI fails unformatted code
- Tailwind for styling (no CSS modules)
- Conventional commits: `feat:` `fix:` `refactor:` `test:` `chore:` `docs:` `perf:` — release-please turns these into version bumps, tags, and CHANGELOG entries on merge to main
- PRs get an automatic Claude Code review on open; `@claude` in any issue/PR comment summons the agent
- Feature branches only; never commit directly to `main`; PRs via `gh pr create`; the user reviews all PRs before merge
- **NEVER add `Co-Authored-By` or "Generated with Claude Code" to commits or PRs**

## Code Standards

- **DRY** — extract shared logic; if you see duplication, refactor it.
- **SRP** — one job per function/module. If describing it needs an "and", split it.
- **Small, composable functions** over long procedures. The pipeline stages should each be independently testable.
- **Never over-engineer.** This is a house-party app, not a platform. Minimum code that solves the problem correctly; no speculative abstractions.
- **Intention-revealing names**; code reads like prose; comments only for what code can't say.
- **No dead code.** Remove unused imports, placeholder branches, and "would need real implementation" stubs — a stub that pretends to work is worse than a missing feature, because it hides where the ladder actually ends.
- **Honest fallbacks.** When a stage degrades (Principle 1), record what happened (log + DB status detail). Silent degradation makes "why did my song have no lyrics?" undebuggable.

## Testing

No PR merges without tests covering the behavior it introduces or changes. If it's too hard to test, restructure the code — don't skip the test.

### The pyramid, right-sized for this project

- **Unit tests (most):** Pure logic — LRC/SRT conversion, relevance scoring, filename matching, queue ordering, config parsing, DB methods (better-sqlite3 in-memory is fine and fast). No spawned processes, no network, no real ffmpeg. Mock at the tool boundary (`child_process`, fluent-ffmpeg, youtube-dl-exec, axios).
- **Integration tests (some):** Pipeline orchestration with mocked tools — does a torrent failure fall through to yt-dlp? Does a missing lyrics result still produce a playable song? API route contracts (request/response shapes, status codes).
- **E2E (few, later):** One happy path — add song → status polls to ready → player loads media — once the app actually runs end-to-end. Playwright, when introduced per the roadmap.

### Rules

- The unit suite must be fast. A mock that "never calls back" plus a 30s Jest timeout is a broken test, not a slow one — every async test asserts on a resolved/rejected promise, never on wall-clock waiting.
- Test behavior, not implementation. Name tests as specs: `it("falls back to yt-dlp when no torrent has enough seeders")`.
- After writing a test, verify it can fail.
- Tests that need ffmpeg/demucs binaries are integration tests, marked and skippable when tools are absent — CI and a fresh laptop must both pass the default suite.
- `npm run type-check` and `npm run lint` must be clean — tests included. Type errors in test files are errors.

## Security

- Never commit secrets; `.env.local` is gitignored — keep it that way.
- Validate uploads (type, size) and sanitize anything interpolated into shell/ffmpeg arguments — song titles are user input and ffmpeg filter strings are an injection surface. Prefer argument arrays over string-built commands.
- The media route must resolve paths against the known media directories only (no `../` traversal) — it's the one endpoint that serves files from disk.
- LAN-only trust model: no auth by design, so never expose the server to the public internet, and don't build features that assume it is.

## PR Description Template

```markdown
## Scope

<!-- WHAT and WHY. -->

## Implementation

<!-- HOW, at a high level. Tradeoffs. What to review closely. -->

## Demo

<!-- This is an audio/video app — show, don't tell. For pipeline changes:
the log of a real song run, or the output artifact. For UI: screenshot
(phone + big screen). -->

## How to Test

<!-- Automated coverage added, plus manual repro steps. -->

## Degradation & Risk

<!-- Which rung of the fallback ladder does this touch? What happens when
its external tool/API is missing, slow, or wrong? -->
```

## TypeScript Standards (condensed)

- No `any` — use `unknown` and narrow. The existing `as any` DB row casts are debt to burn down, not a pattern to copy.
- No `@ts-ignore`; `@ts-expect-error` with a comment if suppression is truly needed.
- Explicit return types on exported functions.
- Discriminated unions + exhaustive `switch` (with `assertNever`) for song status and pipeline stage handling.
- Every promise awaited, returned, or explicitly handled — floating promises in the pipeline are how songs get stuck in `processing` forever. The one deliberate fire-and-forget (kicking off the pipeline from the API route) must `.catch()` and mark the song failed.
- Prefer `??` / `?.` over truthiness checks; prefer `as const` objects over enums.

## Current State

The project scaffolding is complete but it has **never run end-to-end** — see [ROADMAP.md](./ROADMAP.md) for the honest audit of what works, what's stubbed, and the phased plan to a working party night. Check the roadmap's phase status before proposing work.
