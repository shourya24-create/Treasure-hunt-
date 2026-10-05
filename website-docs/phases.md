# ECHO Protocol Hunt — Phases

> **Planning document, written before the build.** It is kept for the
> reasoning behind the design. Where it differs from [the README](../README.md)
> or the code, those win.

> **Status:** Draft | **Last updated:** 2026-09-26

## Roadmap Summary

| Phase | Name | Goal | Target duration |
|---|---|---|---|
| Phase 1 | Playable Skeleton | A team can walk a full 8-checkpoint loop on a live URL with placeholder content | Weeks 1–2 |
| Phase 2 | Real Game Rules | Timing, hints, cooldowns, story archive and the VR unlock all work | Week 3 |
| Phase 3 | Control Room | Organisers can watch and fix the whole event from one screen | Week 4 |
| Phase 4 | Survives Campus | Works offline, resists cheating, proven under load and in a dry run | Weeks 5–6 |

Weeks 7–8 of the event plan are the dress rehearsal and buffer — no new features.

---

## Phase 1: Playable Skeleton

**Goal:** Two people can play the whole hunt end to end on a deployed URL, using fake puzzles.

**Scope:**
- Next.js project deployed to Vercel on day one
- MongoDB Atlas connected with a cached connection
- Team, Checkpoint, Progress and Event models
- Team login with ID and passcode, signed cookie session
- Route offset logic and the next-checkpoint engine
- Signed QR URLs and the `/c/[cpId]` landing route
- Puzzle display and server-side answer checking
- Seed script loading content from JSON
- QR generator script producing 8 printable PNGs

**Out of scope for this phase:**
- Timing and rankings
- Hints
- Admin dashboard
- Offline support
- Any real puzzle content

**Deliverables:**
- A live URL where a team logs in, scans, solves and advances through all 8 checkpoints
- `npm run seed` rebuilding the database from scratch in one command
- 8 printable QR PNGs

**Dependencies:** Atlas cluster created, Vercel project connected to the repo.

**Exit criteria:** Two developers play the full loop on their own phones, outdoors, on mobile data, without touching the database by hand.

---

## Phase 2: Real Game Rules

**Goal:** The game plays by the actual rules of the event, not just the mechanics.

**Scope:**
- Run clock: starts on team release, stops on VR completion
- Hint system, each hint adding a fixed time penalty
- 30-second cooldown between answer attempts
- Atomic solve and hint handling so four phones can't double-count
- Story fragment archive, unlocked fragment by fragment
- Final meta-code entry and VR-ready state
- Elapsed time calculation with hint penalties applied

**Out of scope for this phase:**
- Who wins ties — ranking display comes in Phase 3
- Offline behaviour

**Deliverables:**
- A team's total time is computed correctly, including hint penalties
- A full playthrough produces a complete, readable event log

**Dependencies:** Phase 1 complete. Hint penalty value confirmed.

**Exit criteria:** A test team plays through, uses two hints, submits three wrong answers, and their final time matches a hand calculation.

---

## Phase 3: Control Room

**Goal:** An organiser who has never seen the code can run the event from one screen.

**Scope:**
- Live dashboard polling every 5 seconds: all teams in the active batch, current checkpoint, minutes on it, attempts, hints
- Rows flagged red after 12 minutes on one checkpoint
- Overrides: force-unlock next, mark solved, adjust time, reset team, confirm VR complete
- Batch switching and per-batch filtering
- Leaderboard view sized for a projector
- CSV export of results
- Admin authentication, separate from team login
- Every override written to the event log with a reason

**Out of scope for this phase:**
- Offline support
- Anti-cheat hardening

**Deliverables:**
- `/admin` and `/admin/board`
- A written half-page run sheet so a non-developer can operate the dashboard

**Dependencies:** Phase 2 complete.

**Exit criteria:** A volunteer who did not build the site is given the dashboard and successfully unblocks a deliberately stuck test team without help.

---

## Phase 4: Survives Campus

**Goal:** The things that only break on event day are found and fixed before event day.

**Scope:**
- PWA service worker caching the current checkpoint payload
- Offline answer checking against a salted hash
- IndexedDB submission queue with sync on reconnect, and a visible "will sync" state
- Login rate limiting
- Network response audit — confirm no answers leak to the client
- Load test with 20 simultaneous clients
- Real content seeded and every checkpoint verified at its actual location
- Printed QRs tested at their actual spots
- Database backup taken and restore tested

**Out of scope for this phase:**
- New features of any kind

**Deliverables:**
- Airplane-mode playthrough that syncs correctly on reconnect
- Load test results
- Final seeded database and printed QR set

**Dependencies:** Phase 3 complete. Final puzzle content and checkpoint locations delivered.

**Exit criteria:** A full dress rehearsal with roughly 12 volunteer teams completes with no code changes required during the run.

---

## Future / Not Yet Scheduled

- Per-batch answer variants — schema supports it; enable only if the two batches share one ranking
- Live team-to-team progress teasers ("3 teams ahead of you")
- Volunteer-facing checkpoint view for confirming physical card handovers
- Reuse as a generic event platform for other Somaiya fests
- Photo upload at checkpoints as proof of arrival
