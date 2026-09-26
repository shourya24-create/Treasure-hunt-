# ECHO Protocol Hunt — Feature List

> **Status:** Draft | **Last updated:** 2026-09-26

## Feature Summary

| # | Feature | Category | Phase | Priority | Status |
|---|---|---|---|---|---|
| 1 | Team login | Auth | Phase 1 | Must-have | Planned |
| 2 | Route assignment engine | Game logic | Phase 1 | Must-have | Planned |
| 3 | QR checkpoint unlock | Game logic | Phase 1 | Must-have | Planned |
| 4 | Puzzle display | Gameplay | Phase 1 | Must-have | Planned |
| 5 | Answer validation | Gameplay | Phase 1 | Must-have | Planned |
| 6 | Content seeding | Content | Phase 1 | Must-have | Planned |
| 7 | QR code generator | Tooling | Phase 1 | Must-have | Planned |
| 8 | Run clock | Scoring | Phase 2 | Must-have | Planned |
| 9 | Hint system | Gameplay | Phase 2 | Must-have | Planned |
| 10 | Attempt cooldown | Anti-cheat | Phase 2 | Must-have | Planned |
| 11 | Story fragment archive | Gameplay | Phase 2 | Should-have | Planned |
| 12 | Final meta-code & VR unlock | Gameplay | Phase 2 | Must-have | Planned |
| 13 | Live admin dashboard | Operations | Phase 3 | Must-have | Planned |
| 14 | Admin overrides | Operations | Phase 3 | Must-have | Planned |
| 15 | Leaderboard & CSV export | Operations | Phase 3 | Must-have | Planned |
| 16 | Batch management | Operations | Phase 3 | Must-have | Planned |
| 17 | Event log | Operations | Phase 3 | Must-have | Planned |
| 18 | Offline play & sync | Reliability | Phase 4 | Must-have | Planned |

*Priority: Must-have / Should-have / Nice-to-have. Status: Planned / In progress / Done.*

---

## 1. Team login

**Category:** Auth · **Phase:** Phase 1 · **Priority:** Must-have

**What it does:** Lets a team into the game with a Team ID and passcode printed on a card handed out at registration.

**User story:** As a player, I want to log in with my team's ID, so that the site knows which route is ours.

**How it works:**
1. Player opens the site and enters Team ID (e.g. `T07`) and a 6-character passcode.
2. Server looks up the team, compares the passcode against a stored hash.
3. On success, a signed JWT is set as an httpOnly cookie with a 5-hour expiry, and the player lands on the play screen.
4. All four members can be logged in at once on separate phones — sessions are per-team, not per-person.

**Inputs:** Team ID, passcode.
**Outputs:** Session cookie; a `login` event row.

**Edge cases & error handling:**
- Wrong passcode → generic "Team ID or passcode is wrong", no hint about which was wrong.
- More than 10 login attempts from one IP in a minute → temporarily blocked.
- Team not yet released → shows a waiting screen with the story intro, not the first checkpoint.

**Dependencies:** Teams seeded in advance.

---

## 2. Route assignment engine

**Category:** Game logic · **Phase:** Phase 1 · **Priority:** Must-have

**What it does:** Decides which checkpoint each team visits next, keeping 12 teams spread across 8 locations.

**User story:** As a player, I want my own route, so that my team isn't queueing behind everyone else.

**How it works:**
1. Each team is seeded with a `routeOffset` between 0 and 7.
2. Their order is `((offset + i) % 8) + 1` for i = 0..7 — one number, not a stored list.
3. The next checkpoint is the first one in that order not yet marked solved.
4. With 12 teams and 8 offsets, four offsets repeat; duplicates are placed in different release waves so they never start together.

**Inputs:** Team's `routeOffset`, their solved checkpoints.
**Outputs:** The expected next checkpoint ID, or `null` when all 8 are done.

**Edge cases & error handling:**
- All 8 solved → returns null, which sends the team to the final meta-code screen.
- An organiser marks a checkpoint solved out of order → the engine simply skips it; order is derived, never stored.

**Dependencies:** Checkpoints seeded.

---

## 3. QR checkpoint unlock

**Category:** Game logic · **Phase:** Phase 1 · **Priority:** Must-have

**What it does:** Turns a physical QR code at a location into the unlock for that checkpoint's puzzle.

**User story:** As a player, I want to scan the QR and get the puzzle immediately, so that we don't need to find a volunteer.

**How it works:**
1. Player scans with their phone's normal camera app. The QR is a URL: `/c/4?t=<signature>`.
2. The browser opens it; the session cookie identifies the team.
3. Server verifies the signature, then checks whether checkpoint 4 is this team's expected next one.
4. If yes, a Progress row is set to `open` and the player is redirected to the play screen showing the puzzle.
5. If no, the player is told this isn't their next location — without revealing where they should be.

**Inputs:** Checkpoint ID and signature from the URL; team session.
**Outputs:** Progress row set to `open`; a `scan` event.

**Edge cases & error handling:**
- Scanning a checkpoint already solved → "You've already done this one."
- Scanning ahead → rejected. Photographing all 8 QRs in advance gains nothing, because the sequence is the lock.
- Missing or invalid signature → rejected, logged.
- Not logged in → sent to login, then returned to the same checkpoint URL.

**Dependencies:** QR generator; signed-URL helper.

---

## 4. Puzzle display

**Category:** Gameplay · **Phase:** Phase 1 · **Priority:** Must-have

**What it does:** Shows the team where they are, what the puzzle is, and where to type the answer.

**User story:** As a player, I want one clear screen telling me what to do, so that there's no confusion mid-hunt.

**How it works:**
1. The play screen fetches the team's current state.
2. If no checkpoint is open, it shows the current location name and a "scan the QR here" prompt.
3. If a checkpoint is open, it shows the puzzle text, any media (audio clip, image), the answer box, and the hint button.
4. Puzzle types supported: text/riddle, audio, physical (instructions only), and AR (a link out to the standalone AR page).

**Inputs:** Team session, current progress.
**Outputs:** Rendered puzzle; no state change.

**Edge cases & error handling:**
- Audio won't autoplay on iOS → an explicit play button, never autoplay.
- Media fails to load → the text instructions still render, plus a retry link.
- Team refreshes mid-puzzle → state is server-held, so nothing is lost.

**Dependencies:** Content seeding.

---

## 5. Answer validation

**Category:** Gameplay · **Phase:** Phase 1 · **Priority:** Must-have

**What it does:** Checks a submitted answer server-side and advances the team if it's right.

**User story:** As a player, I want to know instantly whether we're right, so that we keep moving.

**How it works:**
1. Player submits an answer.
2. Server normalises it — lowercase, trim, strip everything but letters and digits.
3. Compares against the checkpoint's list of accepted variants, normalised the same way.
4. If correct, an atomic conditional update flips the Progress row from `open` to `solved` only if it is still `open`, then returns the story fragment and the next location.
5. If wrong, the attempt is logged, `lastAttemptAt` is stamped, and the team is told to try again.

**Inputs:** Checkpoint ID, submitted answer.
**Outputs:** Solved state, story fragment, next location; an `attempt` event either way.

**Edge cases & error handling:**
- Two members submit the correct answer at the same moment → the atomic update means only one wins; the second sees the same success screen, not an error.
- Submitted within 30 seconds of the last attempt → rejected with a countdown.
- Checkpoint not open → rejected.

**Dependencies:** Content seeding; attempt cooldown.

---

## 6. Content seeding

**Category:** Content · **Phase:** Phase 1 · **Priority:** Must-have

**What it does:** Loads every puzzle, answer, hint, story fragment and location from one JSON file into the database.

**User story:** As a web operator, I want to change puzzle content without touching code, so that the narrative team can finalise late.

**How it works:**
1. `data/checkpoints.json` holds all 8 checkpoints; `data/teams.json` holds the teams and their batch and offset.
2. `npm run seed` wipes and rebuilds the checkpoint and team collections, and computes the answer hashes used for offline checking.
3. Seeding never touches Progress or Event data unless explicitly asked, so a mid-event content fix doesn't erase progress.

**Inputs:** The two JSON files.
**Outputs:** Populated `checkpoints` and `teams` collections.

**Edge cases & error handling:**
- Duplicate checkpoint IDs or fewer than 8 entries → seed refuses to run and says why.
- A checkpoint with no accepted answers → refused.
- Re-seeding mid-event → allowed for checkpoints, blocked for teams unless forced.

**Dependencies:** Final content from the narrative lead (does not block building).

---

## 7. QR code generator

**Category:** Tooling · **Phase:** Phase 1 · **Priority:** Must-have

**What it does:** Produces the 8 printable QR images, each carrying its signed URL.

**How it works:**
1. `npm run qr` reads the checkpoint list and the base URL.
2. For each checkpoint it builds `/c/<id>?t=<signature>` and writes a high-resolution PNG with the checkpoint name printed underneath.
3. Files land in `qr-codes/`, ready to drop into a poster template.

**Inputs:** Checkpoint IDs, `QR_SECRET`, base URL.
**Outputs:** 8 PNGs.

**Edge cases & error handling:**
- Base URL changes after printing → old QRs stop working, so the generator prints a warning naming the URL baked in.
- Print two copies of each; a torn QR is handled by admin override.

**Dependencies:** Signed-URL helper.

---

## 8. Run clock

**Category:** Scoring · **Phase:** Phase 2 · **Priority:** Must-have

**What it does:** Times each team from release to finish — the only thing that decides the winner.

**User story:** As a Game Master, I want rankings calculated automatically, so that the ceremony isn't a spreadsheet exercise.

**How it works:**
1. `startedAt` is stamped when an organiser releases the team's wave.
2. `finishedAt` is stamped when a volunteer confirms the VR finale complete in the admin panel.
3. Total time = `finishedAt − startedAt` + (hints used × penalty).
4. Time is computed on read from the event log, never stored as a running total, so a rule change can be applied retroactively.
5. All timestamps come from the server. Phone clocks are never trusted.

**Inputs:** Release time, finish time, hint count.
**Outputs:** Elapsed time for display and ranking.

**Edge cases & error handling:**
- Team never finishes → ranked below all finishers, shown as "did not finish".
- Released by mistake → organiser resets `startedAt`, logged with a reason.
- Clock still running past the batch window → dashboard flags it; organiser decides.

**Dependencies:** Admin overrides for release and finish confirmation.

---

## 9. Hint system

**Category:** Gameplay · **Phase:** Phase 2 · **Priority:** Must-have

**What it does:** Gives a stuck team a nudge, at a cost in time.

**User story:** As a player, I want a hint when we're properly stuck, so that we don't waste 20 minutes on one puzzle.

**How it works:**
1. Player taps "Need a hint" and confirms — the confirm dialog states the exact time penalty.
2. Server returns the next unused hint for that checkpoint and increments `hintsUsed` atomically.
3. The penalty is applied at ranking time, not deducted from anything live.
4. Hints are ordered from vague to nearly-the-answer; most checkpoints have two.

**Inputs:** Checkpoint ID, team session.
**Outputs:** Hint text; incremented count; a `hint` event.

**Edge cases & error handling:**
- Two members tap simultaneously → atomic increment means one hint, one penalty.
- All hints used → button disabled with "No more hints here."
- Offline → hints are cached with the puzzle and still work; the penalty syncs later.

**Dependencies:** Content seeding; run clock.

---

## 10. Attempt cooldown

**Category:** Anti-cheat · **Phase:** Phase 2 · **Priority:** Must-have

**What it does:** Stops a team from brute-forcing a short numeric answer.

**How it works:**
1. Every attempt stamps `lastAttemptAt` on the Progress row.
2. A submission under 30 seconds after the last one is rejected with a live countdown.
3. Attempts are unlimited otherwise — wrong answers cost no time, only the count is logged for tie-breaks.

**Inputs:** Submission timestamp.
**Outputs:** Accept or reject.

**Edge cases & error handling:**
- Four members each submitting → the cooldown is per team, so they share it. The UI explains this so it doesn't read as a bug.
- Offline attempts → checked locally against the hash; the cooldown is enforced again server-side on sync.

**Dependencies:** Answer validation.

---

## 11. Story fragment archive

**Category:** Gameplay · **Phase:** Phase 2 · **Priority:** Should-have

**What it does:** Keeps every story piece the team has unlocked, readable at any time.

**User story:** As a player, I want to re-read what we've found, so that the final puzzle makes sense.

**How it works:**
1. Solving a checkpoint unlocks its fragment.
2. The archive lists unlocked fragments in the order the team found them, with locked ones shown as blanked-out slots.
3. The physical card handed over by the volunteer is the real artefact; this is the backup copy.

**Inputs:** Solved checkpoints.
**Outputs:** Rendered archive.

**Edge cases & error handling:**
- Team loses a physical card → the digital copy covers them for the final puzzle.
- Offline → previously unlocked fragments are cached and remain readable.

**Dependencies:** Content seeding.

---

## 12. Final meta-code & VR unlock

**Category:** Gameplay · **Phase:** Phase 2 · **Priority:** Must-have

**What it does:** Takes the code assembled from all 8 fragments and clears the team for the VR finale.

**How it works:**
1. Once all 8 are solved, the play screen becomes the final code entry.
2. The team works out the code from their 8 physical cards and submits it.
3. Correct → the team is marked VR-ready and told to report to the Council Room. The dashboard shows them in the VR queue.
4. A volunteer confirms completion in the admin panel, which stops the clock.

**Inputs:** Final code.
**Outputs:** VR-ready state; `final` event.

**Edge cases & error handling:**
- Wrong code → same 30-second cooldown, unlimited attempts.
- Arriving at the Council Room with headsets busy → the dashboard queue shows arrival order; the clock keeps running until an organiser pauses it, so queue policy must be decided before the event.

**Dependencies:** Run clock; admin overrides.

---

## 13. Live admin dashboard

**Category:** Operations · **Phase:** Phase 3 · **Priority:** Must-have

**What it does:** One screen showing where all 12 active teams are and who is stuck.

**User story:** As a Game Master, I want to see stuck teams, so that I can send help before they give up.

**How it works:**
1. Polls `/api/admin/live` every 5 seconds — no websockets needed for 12 rows.
2. Columns: team, batch, current checkpoint, minutes on it, attempts, hints, elapsed time, status.
3. Rows turn amber at 8 minutes on one checkpoint and red at 12.
4. Sortable; filterable by batch.

**Inputs:** Progress and Event data.
**Outputs:** Rendered table.

**Edge cases & error handling:**
- Laptop loses wifi → the last state stays on screen with a stale-data warning.
- Two organisers open it at once → read-only polling, so no conflict.

**Dependencies:** Event log.

---

## 14. Admin overrides

**Category:** Operations · **Phase:** Phase 3 · **Priority:** Must-have

**What it does:** Lets an organiser fix anything, instantly, without touching the database.

**How it works:**
1. Each dashboard row has: release team, force-unlock next, mark solved, adjust time, confirm VR complete, reset team.
2. Every action asks for a short reason and writes an `override` event recording who, what and why.
3. Changes appear on the player's screen within one poll cycle.

**Inputs:** Organiser action and reason.
**Outputs:** State change; `override` event.

**Edge cases & error handling:**
- Accidental reset → the event log holds the full history, so state can be reconstructed.
- Override while a team is offline → applies when they reconnect.

**Dependencies:** Admin auth; event log.

---

## 15. Leaderboard & CSV export

**Category:** Operations · **Phase:** Phase 3 · **Priority:** Must-have

**What it does:** Ranks teams by total time and produces a file you can keep.

**How it works:**
1. `/admin/board` renders a large-type leaderboard for the projector.
2. Sorted ascending by total time (with hint penalties applied); unfinished teams listed after finishers.
3. Ties broken by fewest wrong attempts.
4. A CSV export button downloads full results including attempts, hints and timestamps.

**Inputs:** Team times and event log.
**Outputs:** Leaderboard view; CSV file.

**Edge cases & error handling:**
- Revealed too early → the board is a separate URL, never shown to players mid-hunt.
- Laptop dies → CSV can be re-exported from any machine with the admin password.

**Dependencies:** Run clock; batch management.

---

## 16. Batch management

**Category:** Operations · **Phase:** Phase 3 · **Priority:** Must-have

**What it does:** Runs the same hunt twice for two different groups of 12 teams, without a rebuild between them.

**How it works:**
1. Every team carries a `batch` field (1 or 2).
2. The dashboard has an active-batch selector; leaderboards can be viewed per batch or combined.
3. Batch 2 teams simply aren't released until batch 2 starts — nothing is reset in between.
4. Checkpoint content can optionally carry per-batch answer variants, should the two batches need different answers.

**Inputs:** Batch field; organiser's batch selection.
**Outputs:** Filtered views.

**Edge cases & error handling:**
- A batch-1 team still playing when batch 2 starts → both appear, clearly labelled. Nothing breaks.
- Batch 2 knowing batch-1 answers → mitigated either by per-batch ranking or per-batch answer variants; decision due by week 5.

**Dependencies:** Content seeding; admin dashboard.

---

## 17. Event log

**Category:** Operations · **Phase:** Phase 3 · **Priority:** Must-have

**What it does:** Records everything that happened, so results can be proven and scoring rules can change after the fact.

**How it works:**
1. Every scan, attempt, hint, solve, final submission and override appends one immutable row.
2. Rows carry team, checkpoint, type, payload and a server timestamp.
3. Rankings are computed from this log, never from a stored counter.
4. Searchable by team in the admin panel.

**Inputs:** Every game action.
**Outputs:** Append-only `events` collection.

**Edge cases & error handling:**
- Disputed result → open that team's log and read exactly what happened, in order.
- Scoring rule changed mid-event → recompute from the log; no data migration needed.

**Dependencies:** None — build it first, everything else writes to it.

---

## 18. Offline play & sync

**Category:** Reliability · **Phase:** Phase 4 · **Priority:** Must-have

**What it does:** Keeps the game playable where campus wifi dies.

**User story:** As a player, I want the site to work with no signal, so that a dead spot doesn't end our run.

**How it works:**
1. A service worker caches the app shell and the current checkpoint's payload.
2. When a checkpoint unlocks, the server also sends `answerHash` — a salted SHA-256 of the normalised answer. The plaintext answer is never sent.
3. Offline, the phone hashes the submitted answer and compares locally, showing right or wrong and revealing the next location.
4. The submission goes into an IndexedDB queue and syncs on reconnect; the server re-validates and remains the source of truth.
5. A persistent "saved — will sync" chip shows the queue isn't lost.

**Inputs:** Cached payload; queued submissions.
**Outputs:** Local verdict; synced events.

**Edge cases & error handling:**
- Phone closed before sync → the queue survives in IndexedDB and syncs on next open.
- Server disagrees with the local verdict → server wins; the organiser is flagged on the dashboard to resolve it manually.
- Salt leaking via the client → the hash is per-checkpoint salted and only sent for the currently open checkpoint, so it can't be used to pre-solve others.

**Dependencies:** Answer validation; content seeding.

---

## Deferred / Future Features

- **Per-batch answer variants** — schema ready, switched on only if both batches share one ranking.
- **Live rival teasers** ("2 teams ahead of you") — fun, but adds polling load and can demoralise trailing teams.
- **Volunteer checkpoint view** — a screen per volunteer confirming card handovers. Nice, but 8 more logins to manage on the day.
- **Photo proof at checkpoints** — needs storage and moderation; not worth it for one event.
- **Automatic VR completion detection** — the headset would have to talk to the site. A volunteer tapping a button is more reliable.
