# ECHO Protocol Hunt — Todo

> **Last updated:** 2026-09-27. Check items off as they're completed; keep this file in sync with actual progress.

## Phase 1: Playable Skeleton

- [x] Create the Next.js project with TypeScript and Tailwind
- [ ] Push to GitHub and connect the repo to Vercel
- [ ] **Deploy a blank page to production on day one** — prove the pipeline before writing features
- [ ] Create a MongoDB Atlas M0 cluster, add the connection string to Vercel env vars
- [x] Write `lib/db.ts` with the cached-connection pattern and `maxPoolSize: 5`
- [x] Define the four Mongoose models
  - [x] Team (teamId, batch, routeOffset, passcodeHash, startedAt, finishedAt, vrCompleted)
  - [x] Checkpoint (cpId, title, locationHint, type, prompt, answers, answerHash, hints, fragment)
  - [x] Progress (teamId, cpId, status, attempts, hintsUsed, timestamps)
  - [x] Event (teamId, cpId, type, payload, at)
- [x] Add the three indexes, including the unique compound index on Progress
- [x] Write `lib/auth.ts` — sign and verify team session cookies with `jose`
- [x] Write `lib/hmac.ts` — sign and verify checkpoint URL tokens
- [x] Write `lib/game.ts` — `orderFor`, `nextCheckpoint`
- [x] Write `lib/norm.ts` — answer normalisation
- [x] Create `data/checkpoints.json` with 8 placeholder checkpoints (real content comes later)
- [x] Create `data/teams.json` with 24 teams across 2 batches, offsets assigned so duplicates sit in different waves
- [x] Write `scripts/seed.ts` with validation — refuse to seed on duplicate IDs or missing answers
- [x] Write `scripts/make-qr.ts` producing 8 PNGs with the signed URL and checkpoint name
- [x] Build `POST /api/login`
- [x] Build `GET /api/state`
- [x] Build `POST /api/scan` with signature and sequence checks
- [x] Build `POST /api/answer` with server-side validation
- [x] Build the login page
- [x] Build the play page (location card and puzzle states)
- [x] Build the `/c/[cpId]` landing route with redirect-after-login
- [x] Add `export const runtime = 'nodejs'` to every API route
- [ ] **Play the full 8-checkpoint loop outdoors on two phones on mobile data**

## Phase 2: Real Game Rules

- [x] Add `startedAt` / `finishedAt` to the team lifecycle
- [x] Implement `elapsedMs` — finish minus start, plus hint penalties
- [x] Move all timestamps to server time; remove any client clock use
- [x] Build `POST /api/hint` with atomic increment
- [x] Add the hint button with the penalty stated on it and a confirm step
- [x] Implement the 30-second attempt cooldown with a live countdown in the UI
- [x] Convert solve and hint writes to atomic conditional updates
- [ ] Test four simultaneous submissions from four devices — confirm one solve, one penalty
- [x] Build the fragment reveal screen with the type-on animation
- [x] Build the story archive page with locked and unlocked slots
- [x] Build `POST /api/final` and the final code entry screen
- [x] Add the VR-ready state and the "report to Council Room" screen
- [x] Verify a full playthrough's elapsed time against a hand calculation (automated in `npm run playtest`)

## Phase 3: Control Room

- [x] Build `POST /api/admin/login` and admin session cookie with a `role` claim
- [x] Add middleware protecting `/admin/*` and `/api/admin/*`
- [x] Build `GET /api/admin/live`
- [x] Build the dashboard table with 5-second polling
- [x] Add amber at 8 minutes and red at 12 minutes on one checkpoint
- [x] Build `POST /api/admin/override` with a required reason field
  - [x] Release team / release wave
  - [x] Force-unlock next checkpoint
  - [x] Mark checkpoint solved
  - [x] Adjust time
  - [x] Confirm VR complete
  - [x] Reset team
- [x] Write every override to the event log with the reason
- [x] Add the batch selector and per-batch filtering
- [x] Build `/admin/board` projector leaderboard
- [x] Implement ranking: time ascending, unfinished last, ties broken by fewest wrong attempts
- [x] Add CSV export
- [x] Add a per-team event log view for settling disputes
- [ ] **Hand the dashboard to a volunteer who didn't build it and have them unblock a stuck test team**
- [x] Write the half-page dashboard run sheet (in README.md)

## Phase 4: Survives Campus

- [x] Add `next-pwa` and a service worker caching the app shell (hand-written `public/sw.js` instead of next-pwa)
- [x] Send `answerHash` (salted SHA-256) when a checkpoint opens
- [x] Implement local answer checking against the hash when offline
- [x] Build the IndexedDB submission queue
- [x] Implement sync-on-reconnect with server revalidation
- [x] Add the "saved — will sync" chip and the offline indicator
- [x] Flag server/client verdict mismatches on the dashboard
- [x] Add login rate limiting
- [ ] **Audit every network response — confirm no plaintext answers reach the client**
- [ ] Load test with 20 simultaneous clients hitting `/api/answer`
- [ ] Confirm the Atlas connection count stays inside the free-tier limit under load
- [ ] Airplane-mode test: solve offline, reconnect, confirm sync
- [ ] Seed the real checkpoint content once the narrative team delivers it
- [ ] Generate and print the final QR set, 2 copies each, laminated
- [ ] Test every printed QR at its actual location on a real phone
- [ ] Verify iOS Safari: camera, audio playback, input zoom, `100dvh`
- [ ] `mongodump` the seeded database and test a restore
- [ ] Set every environment variable in Vercel production and verify on the deployed build
- [ ] Freeze the base URL — no domain changes after QRs are printed

## Backlog / Unscheduled

- [ ] Per-batch answer variants (build only if both batches share one ranking)
- [ ] Volunteer-facing checkpoint confirmation screen
- [ ] Live rival teasers on the play screen
- [ ] Post-event stats page for the recap post
- [ ] Extract the engine into something reusable for future Somaiya events
