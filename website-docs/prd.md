# ECHO Protocol Hunt — Product Requirements Document

> **Status:** Draft | **Last updated:** 2026-09-26 | **Owner:** Team Vision, AR/VR Council, KJSSE

## 1. Overview

A web app that runs Team Vision's campus treasure hunt end to end. It is the game master: it holds the puzzles, decides which checkpoint each team goes to next, checks their answers, tracks their time, and gives organisers a live view of all teams. Players open it in a phone browser — there is no app to install. It runs twice on event day, once per batch of 12 teams.

## 2. Problem Statement

A treasure hunt for 24 teams cannot be run on paper. Without software, every checkpoint needs a volunteer holding answer sheets, organisers have no idea where teams are until they show up, rankings are worked out by hand at the end, and there is no way to stop teams from following each other to the same place. Past student events solve this by having a volunteer at every clue with a printed list — it works, but it caps the event's size, makes staggered routes impossible, and turns scoring into an argument.

The AR/VR council also has a second reason: the website is the piece that makes the event feel like one connected experience rather than eight disconnected puzzles.

## 3. Goals

- Every team can complete the full 8-checkpoint hunt without an organiser intervening.
- Organisers can see, at any moment, where all 12 active teams are and which ones are stuck.
- Final rankings are produced automatically and are defensible when questioned.
- Nothing in the game stops working when campus wifi drops.
- The same system runs both batches without being rebuilt or manually reset.

## 4. Non-Goals

- Not a public-facing site. No marketing pages, no registration flow — teams are seeded by organisers beforehand.
- No real user accounts, passwords, email, or password resets.
- No in-app QR scanner. The phone's native camera app opens the QR as a URL.
- No AR or VR runs inside this app. The AR page is a separate static page; the VR finale runs on the headset.
- No payments, no notifications, no analytics platform.
- Not reusable-by-design. If it gets reused for a future fest, that is a bonus, not a requirement.

## 5. Target Users / Personas

| Persona | Description | Primary need |
|---|---|---|
| Player | Student in a team of 4, on their own phone, moving around campus, possibly on weak signal | See exactly where to go next and whether their answer was right, without confusion |
| Game Master | Runs the event, makes final calls on disputes | A live picture of all teams and the ability to fix anything instantly |
| Checkpoint volunteer | Stationed at one location, hands over story cards | Know which team is meant to be there and confirm they solved it |
| Web operator | Built the site, on a laptop during the event | Spot a stuck team or a failing checkpoint before players complain |

## 6. User Stories

- As a player, I want to log in with my team's ID and see only my next location, so that my team follows its own route and doesn't just follow the crowd.
- As a player, I want to scan the QR at a checkpoint and immediately get the puzzle, so that I don't have to find a volunteer first.
- As a player, I want to know instantly whether my answer was right, so that we keep moving.
- As a player, I want the site to keep working when my signal drops, so that a dead spot on campus doesn't end our run.
- As a player, I want to re-read the story pieces we've collected, so that the final puzzle makes sense.
- As a Game Master, I want a live table of all teams and how long they've been stuck, so that I can send help before a team gives up.
- As a Game Master, I want to manually unlock a checkpoint for a team, so that a torn QR or a bad answer key doesn't stall the event.
- As a Game Master, I want an automatic ranking by total time, so that the prize ceremony isn't a spreadsheet exercise.
- As a web operator, I want every action logged, so that a disputed result can be checked against what actually happened.

## 7. Requirements

### 7.1 Functional Requirements

1. The system must authenticate a team using a Team ID and a passcode issued by organisers.
2. The system must assign each team a rotated route through the 8 checkpoints, derived from a single stored offset.
3. The system must show a team only its current checkpoint — never the full route or future locations.
4. The system must unlock a checkpoint only when the scanned checkpoint matches that team's expected next checkpoint.
5. The system must reject checkpoint URLs that do not carry a valid signature.
6. The system must validate answers server-side against a list of accepted variants, ignoring case, spacing and punctuation.
7. The system must never transmit plaintext answers to the client.
8. The system must enforce a 30-second cooldown between answer attempts for the same checkpoint.
9. The system must record every attempt, hint, unlock and override as an immutable event.
10. The system must offer hints on request, each adding a fixed time penalty to the team's final time.
11. The system must start a team's clock on release and stop it when the VR finale is confirmed complete.
12. The system must rank teams by total elapsed time plus accrued hint penalties, ascending.
13. The system must accept a final meta-code assembled from the 8 story fragments and, on success, mark the team ready for the VR finale.
14. The system must provide organisers a live dashboard of all teams in the active batch, showing current checkpoint, time on that checkpoint, attempts and hints used.
15. The system must let an organiser force-unlock, mark-solved, adjust time, or reset a team.
16. The system must separate teams into batches, with the dashboard and leaderboard filterable by batch.
17. The system must continue to accept and check answers while the device is offline, and sync them when connectivity returns.
18. The system must load all puzzle, answer, hint and story content from a seed file, with no game content hardcoded in application code.

### 7.2 Non-Functional Requirements

- **Load:** 48 concurrent phones (12 teams × 4 members) per batch, roughly 2.5 hours per batch. Peak is the release moment, when all teams log in within two minutes.
- **Availability:** must survive the event window. Free-tier hosting is acceptable; anything that sleeps on idle is not.
- **Latency:** answer submission should feel instant — under 1 second on a normal connection.
- **Offline:** an unlocked checkpoint must remain playable with no connectivity.
- **Security:** answers never reachable from the browser; admin routes behind a separate credential; QR URLs signed.
- **Devices:** must work on low-end Android and on iOS Safari. Layout is mobile-first; the dashboard is the only desktop view.
- **Content changes:** puzzle and story content must be replaceable up to the day before without a code change.

## 8. Success Metrics

| Metric | Target | Timeframe |
|---|---|---|
| Teams completing all 8 checkpoints | 11 of 12 per batch | Each batch |
| Organiser manual overrides needed | Fewer than 5 per batch | Each batch |
| Checkpoint unlock failures (valid scan rejected) | 0 | Event day |
| Ranking disputes that can't be settled from the event log | 0 | Event day |
| Site downtime during a batch | 0 minutes | Event day |
| Teams finishing within the 2.5-hour window | All | Each batch |

## 9. Constraints & Assumptions

- **Constraint:** Built by student volunteers during a running semester. Assume 2 developers and roughly 6 hours a week each.
- **Constraint:** Free tiers only — MongoDB Atlas M0, Vercel Hobby.
- **Constraint:** Players use their own phones. No shared devices, no kiosk mode, no guaranteed battery.
- **Constraint:** Campus wifi outdoors is unreliable and untestable in advance at every point.
- **Assumption:** 8 checkpoints, fixed for both batches. Locations and puzzle content are not yet decided and will arrive later.
- **Assumption:** Story fragments are handed over as physical cards by volunteers; the site shows a digital copy.
- **Assumption:** The VR finale is confirmed complete by a volunteer in the admin panel, not detected automatically.
- **Assumption:** 12 teams per batch, 4 members per team, 2 batches on the same day.

## 10. Dependencies

- **MongoDB Atlas** — team, progress and event storage.
- **Vercel** — hosting, HTTPS, environment variables.
- **Final puzzle content** from the narrative lead — blocks the seed file, not the build.
- **Final checkpoint locations** — blocks QR printing, not the build.
- **Printed QR boards** — produced from the generator script once locations are fixed.
- **Separate static AR page** (MindAR) — linked from a checkpoint, not integrated.

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Campus wifi dead at a checkpoint | High | High | Offline play with local answer checking and queued sync |
| Atlas connection limit hit mid-event | Medium | High | Cached connection, capped pool size, load test with 20 tabs before the day |
| Content arrives late from the narrative team | High | Low | All content is seed data; engine is built and tested against placeholders |
| Batch 2 learns answers from batch 1 | High | Medium | Schema supports per-batch answer variants; decide policy by week 5 |
| A team finds answers in the browser's network tab | Medium | High | Answers never sent to the client; audit network responses before the event |
| Torn or unreadable QR at a checkpoint | Medium | Medium | Admin force-unlock, plus sealed printed backup envelopes at each checkpoint |
| Phones dying mid-hunt | Medium | Low | Only one working phone per team is required; power banks with floaters |
| Two team members submit simultaneously, double-penalising | Medium | Medium | Atomic conditional updates on progress documents |

## 12. Open Questions

- [ ] Do the two batches share one ranking, or does each batch get its own winner?
- [ ] If batches are ranked together, do batch 2's answers need to differ from batch 1's?
- [ ] What exactly is the hint time penalty — 3 minutes assumed, needs confirming after a playtest.
- [ ] Is the VR finale time included in the team's total, or does the clock stop when they reach the Council Room?
- [ ] Who has the admin password on the day, and on how many devices?
- [ ] Do we need a printed team card per team, or per player?
