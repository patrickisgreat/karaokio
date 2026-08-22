# Karaokio Roadmap

Goal: a machine you can point friends at on a Friday night — everyone adds songs from their phone, everything Just Plays. This document is the honest audit of where the code is today and the phased path to get there. Update phase status as work lands; CLAUDE.md points here.

## Current State (audited 2026-08-20)

The scaffolding is genuinely good — the pipeline orchestration, DB schema, queue API, and UI shells all exist. But the project has **never run end-to-end**, and several load-bearing pieces are stubs that pretend to work:

**Verified broken / never ran:**

- `npm run type-check` fails with 15 errors (12 in `tests/unit/torrentClient.test.ts`, 3 in `src/components/QueueList.tsx` — the queue UI references an undefined `mockQueue` and would crash at runtime).
- Test suite: 3 of 5 suites fail (14/65 tests), and hanging mocks push the "unit" suite to ~77 seconds.
- **Nothing is playable.** The player sets `<audio src={song.instrumentalPath}>` — a raw server filesystem path the browser cannot fetch — and the API doesn't even return a field by that name (it returns `karaoke.instrumentalUrl`). There is no media-serving route at all.
- **Lyrics in the player are hard-coded placeholders** ("♪ Sing along to the music ♪"). The LRC file is written to disk but never loaded, parsed, or displayed. The final video is never shown either.
- **"AI lyric sync" calls a fictional API** (`api.quicklrc.com` does not exist), then silently falls back to distributing lines evenly across the track — which is unusable for actual karaoke.
- Lyrics sources: Genius fetch is a stub that always returns `null`; Musixmatch needs a paid key; lyrics.ovh (keyless) is the only real source and it's flaky and unsynced.
- Demucs invocation has never been exercised: spawns `python` (macOS ships `python3`), ignores the requested output format, and assumes `htdemucs` output layout blindly.
- `VideoGenerator`'s ffmpeg filter graphs are almost certainly invalid (a `color=` source declared inside a complex filter alongside real inputs), the per-pixel `geq` gradient would take hours per song at 1080p, output is hard-capped at 5 minutes, and the font path is hard-coded to `/System/Library/Fonts/Arial.ttf`.
- Uploads save a file and return its path — but nothing connects an upload to a queue entry. The pipeline only finds uploads by filename guessing.
- "Add song" parses title/artist from the raw query string with word-splitting heuristics instead of using the search API that already exists.
- Two parallel pipelines: `jobProcessor.ts` is a stale earlier draft of `autonomousProcessor.ts`.
- CI installs demucs **and spleeter** (abandoned, broken on modern Python) just to run unit tests; the workflow has likely never been green.
- 55 npm audit vulnerabilities (3 critical), `.nvmrc` says Node 20 but nothing enforces it.

**What's in decent shape:** DB layer (clean prepared statements), queue API surface, cache manager design, yt-dlp search/scoring logic, `videoProcessor.replaceAudio`/`optimizeForStreaming` (plausible ffmpeg usage), the overall stage/progress architecture, and the UI component structure.

---

## Phase 0 — Make it honest (build, test, tools) — DONE

_Everything compiles, the test suite is fast and green, and a fresh clone can get running from the README._

- [x] Fix the 3 type errors in `QueueList.tsx` (undefined `mockQueue`) and the 12 in `torrentClient.test.ts`.
- [x] Fix the failing tests; kill every hanging-mock/30s-timeout pattern. Suite now: 65/65 green in ~1s (was 51/65 in 77s). Root causes fixed: per-worker SQLite isolation (`KARAOKE_DB_PATH`), leaked `fs` spies, a `downloadAudio` timeout that only armed after the torrent became ready, and never-cleared `Promise.race` timers in the pipeline (a real production leak — every processed song parked a live 5-minute timer).
- [x] Delete `jobProcessor.ts` (legacy duplicate of `autonomousProcessor`).
- [x] Drop Spleeter everywhere (code path, CI, docs). Quality ladder is now Demucs (`high`/`balanced`) → ffmpeg center-cancel (`fast`).
- [x] Add `npm run doctor`: checks Node version + ffmpeg / yt-dlp / demucs, prints install hints. (Server-boot check that disables stages moved to Phase 1 with the degradation work.)
- [x] CI: single job, no system deps (every external boundary is mocked), Node 20/22 matrix.
- [x] `npm audit fix` (55 → 37 vulns), removed unused deps (`node-cron`, `multer`, `ws`), pinned `.nvmrc` to 22. Remaining 37 vulns are all transitive via `torrent-search-api` (deprecated `request` — the 2 criticals), `webtorrent`, and Next 14 — need breaking upgrades or dependency swaps, tracked for Phase 4.
- [x] Rewrite SETUP.md against a genuinely fresh machine.

## Phase 0.5 — Party-code auth, and the AWS detour — CLOSED

_Guests authenticate with a per-party code. The cloud deployment was built, proven, and then deliberately retired._

Auth (shipped in TypeScript, ported to Go in Phase 0.6):

- [x] Party session model: per-party code persisted in SQLite (or overridden by config), signed HttpOnly session cookie, join page, and a guard on every route except join/status.
- [x] Host PIN gating skip/remove/reorder/complete and any admin surface.
- [x] Big-screen QR code embedding the join URL + code.
- [x] Unit and integration tests: session sign/verify/tamper/rotation, host-gate, join flow.

The AWS party box (retired 2026-08-21). It worked — nine CloudFormation stacks from
cloudformation-toolkit templates, scale-to-zero Fargate Spot, EFS for state, party
up/down from a phone — and was torn down anyway, for three reasons that only became
clear once it existed:

1. **A datacenter IP is the wrong place to fetch music from.** YouTube throttles them,
   and on-demand fetch is not optional for karaoke: someone will request a song nobody
   anticipated. A residential IP does this without ceremony.
2. **Demucs bills by the second** on hardware the host already owns and which is
   sitting in the same room as the party.
3. **Media is large and local disk is free**, and the host wants the library on an
   external drive anyway.

What survived and still pays off: the `data/efs-filesystem` template and Fargate EFS
volume support are merged into cloudformation-toolkit and reusable by anything; the
CI, release, and Claude-review workflows are language-agnostic and stay; every design
here — the fallback ladders, the cache model, the auth scheme — carries over unchanged.
`infra/` is recoverable from git history if a hosted deployment is ever wanted.

## Phase 0.6 — Go backend, local-first

_The backend becomes a single compiled binary with the frontend embedded; the host points it at any drive and runs it. TypeScript stays on `archive/typescript-backend` to port from._

Architecture: `domain` (entities, no dependencies) ← `store` (SQLite repositories) ←
`service` (business logic) ← `httpapi` (transport). Dependencies point inward;
services declare narrow interfaces that outer layers implement, so business logic is
testable without a database or an HTTP server.

- [x] `internal/jobs`: bounded worker pool, `exec.CommandContext` so cancelling a job
      kills its subprocess, panic isolation, graceful shutdown. Fixes the three real
      defects of the old orchestrator — no queue, no supervision, fake cancellation.
- [x] `internal/config`: one `--data-dir` relocates the entire state tree, external
      drives included.
- [x] `internal/domain`: entities with derived per-stage progress and an explicit
      degraded state, so the queue can show why a song came out audio-only.
- [ ] `internal/store`: SQLite (`modernc.org/sqlite`, pure Go — no cgo) implementing
      the repository interfaces, with schema migrations.
- [ ] `internal/service`: queue service and party auth, ported from the TypeScript.
- [ ] `internal/httpapi`: router, session middleware, JSON handlers, SSE for live
      stage progress, and media serving with HTTP Range support.
- [ ] Pipeline stages behind a common interface, one type per stage.
- [ ] Frontend: Next.js → Vite React SPA, embedded via `embed.FS`.
- [ ] CI: replace the npm pipeline with `go vet` / `go test` / `go build` plus the
      frontend build.

## Phase 1 — One song, end to end (the vertical slice)

_Add "Bohemian Rhapsody" from an uploaded MP3, watch progress reach 100%, click Start Singing, and hear the instrumental with lyrics on screen. Everything else is negotiable; this is not._

- [ ] **Media route**: `GET /api/media/[songId]/[asset]` (`instrumental` | `video` | `lyrics` | `original`) streaming from disk with HTTP Range support (required for seeking). Path resolution strictly via DB lookup — never client-supplied paths.
- [ ] **Fix the API/player contract**: API returns media _URLs_ built from the route above; align the player's field names with `QueuedSong`; player renders `<video>` when a video exists, `<audio>` otherwise.
- [ ] **Real lyrics display**: fetch the LRC via the media route, parse it (tiny parser + unit tests), highlight the current line, show next line. Delete the placeholder lyrics.
- [ ] **Wire uploads to requests**: "Add song" accepts an optional uploaded file; store the upload path on the song row so the pipeline uses it directly instead of filename-guessing.
- [ ] **Fix Demucs invocation**: resolve the python interpreter, verify expected output layout at runtime (glob for the stem dir instead of assuming), convert output to the requested format, surface stderr on failure.
- [ ] **Acquisition ladder v1** (uploads → local library dir → yt-dlp audio download). Torrents stay behind `ENABLE_TORRENT_DOWNLOAD=false` by default — yt-dlp is dramatically more reliable and this is a personal-use box.
- [ ] **Degrade, don't fail**: pipeline stages catch-and-downgrade per the CLAUDE.md ladder; add a `status_detail` column so the UI can say _why_ a song is audio-only.
- [ ] Integration test: full pipeline run with mocked tools covering each fallback edge.

## Phase 2 — Lyrics sync that's actually right

_Line timing good enough to sing from, on most popular songs, with zero API keys._

- [ ] **LRCLIB first** (`lrclib.net` — free, keyless, returns real time-synced LRC for a huge catalog). For most songs this completely solves sync with no AI at all. Match by title+artist+duration.
- [ ] Delete the fictional QuickLRC integration.
- [ ] **Forced alignment fallback** for songs with only plain-text lyrics: we already produce the isolated _vocals_ stem — run Whisper-based alignment (whisperX or stable-ts, spawned like demucs) on the vocals to get word-level timestamps, then align the fetched lyric text to the transcription (DTW over normalized words). Output: word-timed lyrics ⊃ line-timed LRC.
- [ ] Sanity checks: alignment must cover ≥60% of lyric words and fit the track duration, else fall back to plain LRC from even distribution _marked as low confidence_ (player shows all lyrics scroll-style instead of pretending to be synced).
- [ ] Store lyrics as structured JSON (words + lines + confidence) alongside the exported `.lrc`.

## Phase 3 — Generated karaoke video 🎬 (the fun one)

_When no karaoke video exists — or ours is better — render one: animated background, big lyrics, word-by-word highlight wipe, perfectly synced to our own instrumental._

Key insight: **generation needs no sync-align step at all.** The video is rendered _from_ our word timestamps _over_ our instrumental — sync is free by construction. The hard alignment problem only exists for external videos (Phase 3b).

- [ ] **Rip out the `geq`/drawtext approach** in `VideoGenerator` — it's both broken and unrenderable.
- [ ] **ASS subtitles with karaoke tags**: emit an `.ass` file from Phase 2 word timings using `\k` tags (the classic karaoke wipe — libass renders per-word highlight natively). Style: large centered current line, dim upcoming line, singer's name + song title card at the top, countdown dots during instrumental gaps ≥ 5s.
- [ ] **Cheap good-looking backgrounds**: a set of pre-rendered seamless loop videos (or generated once at build time) + album art (MusicBrainz/iTunes cover art, keyless) blurred/darkened as a backdrop. Compose with one pass: `loop bg → overlay art → subtitles=lyrics.ass → mux instrumental`. Minutes, not hours, per song.
- [ ] Font handling: ship a bundled open font (no `/System/Library` paths); escape/sanitize all text that reaches ffmpeg args.
- [ ] Line-level fallback: no word timings → `\k` per line (still looks proper).
- [ ] **Flip the default**: generated video becomes the _primary_ path; a downloaded YouTube karaoke video is used only when it scores very high on relevance (3b below). Our generated video is guaranteed in-sync; a random YouTube karaoke track over a different recording's instrumental usually isn't.
- [ ] **(3b, optional) External-video sync-align**: when using a found karaoke video, estimate offset by cross-correlating its extracted audio with our instrumental (onset envelopes); apply via the existing `smart_sync` path; reject if correlation is weak and fall back to generation.
- [ ] Golden test: fixture lyrics + 10s tone → assert the `.ass` output exactly; integration test renders a 10s video and probes it with ffprobe.

## Phase 4 — Party-night hardening

_Runs for 4 hours with 15 guests without the host touching a terminal._

- [ ] Processing queue with concurrency 1 (Demucs saturates a laptop; concurrent requests currently all fire at once). Queue position feeds the wait-time estimate.
- [ ] Live updates via SSE or polling interval tuning (the `ws` dep is currently unused — pick one approach, delete the other's dependency).
- [ ] Auto-advance: song ends → mark complete → splash next singer's name → start when ready.
- [ ] Search-first add flow: hit `/api/songs/search` (MusicBrainz keyless) and have the guest pick a result — replaces the "last word is the artist" string parsing, and gives us canonical title/artist/duration for lyrics matching and cache keys.
- [ ] Phone experience: QR code on the big screen → add-song page; big-screen experience: queue + now-singing view.
- [ ] Failed songs show _why_ (from `status_detail`) with a retry button.
- [ ] Cache eviction actually enforced (age/count/size limits exist in config but need a scheduled sweep); startup recovery marks orphaned `processing` songs failed.
- [ ] Disk-space guard before starting a job.

## Phase 5 — Stretch goals (only after a real party has happened)

- Key change (rubberband pitch shift ±3 semitones) and tempo control.
- Singer scoring via mic pitch detection vs. the vocals-stem melody.
- Duet mode (split lines by color using LRCLIB duet metadata where present).
- Applause/transition sounds, per-singer stats for the night.
- Persistent local library management UI.

---

## Sequencing notes

- Phases are strictly ordered 0 → 1 → 2 → 3; don't start a phase until the prior one's acceptance line is true. 4 can interleave with 3.
- Every phase lands as reviewable PRs with tests, per CLAUDE.md.
- The single most valuable early milestone is Phase 1's slice — until one song plays, every other improvement is speculative.
