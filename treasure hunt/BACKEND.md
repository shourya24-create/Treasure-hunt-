# The Echo Protocol — Backend Contract

How the Firebase backend implements `GAMEPLAY.md`, and what the Flutter app
(`UI.md`) and the field AR app call. If this file and `GAMEPLAY.md` disagree,
`GAMEPLAY.md` wins.

---

## 1. Shape

```
phone (Flutter app /  field AR app)         admin dashboard (Flutter /admin/…)
        │ callables                                  │ facilitatorAction
        ▼                                            ▼
   Cloud Functions ── lib/store.ts (transaction) ── lib/engine.ts (the rules, pure)
        │
        ▼
   Firestore:  /teams/{T1…T12}      server truth — facilitators read, nobody writes
               /teamViews/{T1…T12}  player-safe copy — only that team's phone reads
               /game/state          clock, pause, headset queue — any signed-in user reads
               /facilitators/{uid}  who may use the dashboard, and as what role
               /facilitatorCommands audit trail of every admin action
```

- **No client ever writes to Firestore.** The rules deny every write; all changes
  go through a callable, inside one transaction.
- **The rules of the game live in `functions/src/lib/engine.ts`** as pure
  functions. Change game behaviour there, and add a case to `test/engine.test.ts`.
- **`/teamViews` is rebuilt from `/teams` on every write.** It never contains the
  route, the next checkpoint's ID, an answer, the points, or whether the
  decision was correct.

## 2. Content (all placeholders until the story/AR team delivers)

| File in `functions/src/content/` | Holds | Keyed by |
|---|---|---|
| `teams.ts` | route (`start` + `direction`), password, gate code | team |
| `chapters.ts` | Echo chapters 1–8: title, transcript, audio URL | **step** |
| `checkpoints.ts` | station reaction, location clue, object hint (text + image URL) | **checkpoint** |
| `answers.ts` | AR activity answer + grading mode | checkpoint |
| `final.ts` | the correct final decision (`DESTROY` or `KEEP`) | — |

Codes and answers stay in these files; they are never written to Firestore.
Replace a value, run `npm run build`, redeploy the functions. The admin
**SETUP** tab shows how much is still a placeholder.

## 3. The clock

- **START GAME** (admin) sets `game.startedAt`. Before it, CP1 is locked: the
  gate code is refused and the phone shows the Waiting Room.
- The campus game closes when the admin presses **END GAME** or **2 hours after
  START**, whichever comes first. From then on scans, solves and
  force-completes are refused. Teams keep their points and still do the final.
- **Pause** (one team or everyone) blocks the gate code, scans and solves. It
  does not stop the 2-hour clock.

## 4. Player callables

Every call needs a signed-in Firebase user (anonymous is fine). After
`claimTeam`, only that one phone (that Auth UID) may act for the team.

| Callable | Request | Response |
|---|---|---|
| `claimTeam` | `{ teamId, loginCode }` | `{ teamId }` — or error if another phone holds the team |
| `enterGateCode` | `{ teamId, code }` | `{ accepted: boolean }` |
| `recordArrival` | `{ teamId, checkpointId }` | `{ match: boolean }` (false = "This is not your signal.") |
| `submitAnswer` | `{ teamId, checkpointId, answer }` | `{ correct: boolean }` |
| `ackReward` | `{ teamId }` | `{ ok: true }` |
| `requestHelp` | `{ teamId }` | `{ ok: true }` |
| `reportLocation` | `{ teamId, lat?, lng?, accuracy? }` | `{ ok: true }` — heartbeat; coordinates optional |

All calls are idempotent: repeating one that already succeeded changes nothing
and returns the same result.

### The reward

After the gate code or a solve, the team view carries
`pendingReward: { stationReaction | null, chapter }`. The **Flutter app** plays
it (reaction by checkpoint, then chapter by step), then calls `ackReward`. Until
then a reload shows it again; afterwards it never replays. The next clue and
object hint are already on the view (`locationClue`, `objectHint`).

### For the field AR app (`/field/`)

The field app scans and runs the activity. It never plays chapters or shows
clues (`UI.md` §5).

1. Find the team: query `teamViews` where `deviceUid == auth.currentUser.uid`
   (limit 1). The document ID is the `teamId`.
2. `/field/scan`: when MindAR recognises a scan object, call `recordArrival`
   with that object's checkpoint ID (`CP2`…`CP8`). On `match: false` show
   "THIS IS NOT YOUR SIGNAL" and stay in the scanner. On `match: true` go to
   `/field/activity?cp=CPx`. Flutter also opens `/field/activity?cp=CPx`
   directly when `teamViews.activeCheckpoint` is set (a reload mid-activity).
3. `/field/activity`: when the activity is finished, call `submitAnswer` with
   the same `checkpointId`. `answer` is a string, or an array/number if
   `answers.ts` uses the `sequence` / `set` / `numeric` mode for that checkpoint.
4. On `correct: true`, redirect to `/`. Flutter sees the new state and plays
   the reward.
5. Call `reportLocation` every ~30 s while the page is open; the Flutter app
   only sends its heartbeat while it is the open page.

## 5. Admin callable

`facilitatorAction({ type, teamId?, checkpointId?, decision? })` — caller must
have a document at `/facilitators/{uid}`. With `role: "desk"` only the four
actions marked **desk** are allowed.

| `type` | Needs | Effect |
|---|---|---|
| `startGame` | — | starts the 2-hour clock, unlocks CP1 |
| `endGame` / `reopenGame` | — | closes the campus game / undoes a mistaken end |
| `pauseAll` / `resumeAll` | — | |
| `pauseTeam` / `resumeTeam` | `teamId` | |
| `recordHint` | `teamId`, `checkpointId` (CP1–CP8) | −20 |
| `undoHint` | `teamId` | removes the last recorded hint |
| `forceComplete` | `teamId`, optional `checkpointId` | counts as a real solve; defaults to the team's current checkpoint |
| `swapNext` | `teamId`, `checkpointId` | swap the next checkpoint with a later unvisited one |
| `moveToEnd` | `teamId`, optional `checkpointId` | move a checkpoint (default: next) to the end of the route |
| `arrivedFinal` **desk** | `teamId` | joins the headset queue; needs all 7 done, or the campus closed |
| `startViewing` **desk** | `teamId` | the team's member puts the headset on; one team at a time |
| `recordDecision` **desk** | `teamId`, `decision` (`DESTROY`/`KEEP`) | once only; sets the finish time |
| `resolveHelp` | `teamId` | clears an "I NEED HELP" alert |
| `releaseDevice` | `teamId` | frees the team so a replacement phone can log in |
| `listGateCodes` **desk** | — | returns the 12 gate codes for the CP1 desk (not logged) |
| `contentStatus` | — | counts of delivered vs placeholder content (not logged) |
| `seedTeams` | — | creates missing teams; never overwrites |
| `resetTeam` | `teamId` | rehearsals: wipes progress, keeps the phone (no button in the app) |

Points are always recomputed from the record:
`100 × (CP1 + campus checkpoints) − 20 × hints + 100 if the decision is correct`.

## 6. Setup and checks

```
cd functions
npm install
npm run build        # must pass with zero TypeScript errors
npm run test:unit    # game rules, no emulator
npm test             # + functions and Firestore rules on the emulators (needs Java 21+)
```

First run on a new project (or the emulator):

1. Create the facilitator's email/password user in Firebase Auth, copy its UID.
2. `npm run seed -- --facilitator <uid> "Name"` — creates T1–T12, `/game/state`
   and the facilitator document. Use `--desk <uid> "Name"` for a desk volunteer.
   (Or create `/facilitators/{uid}` by hand in the console, sign in, and press
   **Create missing teams** on the SETUP tab.)
3. Replace every `TODO_*` value in `functions/src/content/`.

Flutter app: `flutter pub get`, then `flutter build web`. Fonts, the noise
texture and the preflight test tone are bundled under `flutter_app/assets/`.

## 7. Additions beyond GAMEPLAY.md

These are operational needs, not gameplay. Remove any the club does not want.

- **Team password** — GAMEPLAY.md says a team logs in on one phone but not how;
  a password stops one team claiming another team's slot.
- **Release phone** — without it, a team whose phone dies or clears its browser
  data is locked out, because a second login is refused.
- **Automatic close at 2:00 after START** — so the server and the phone's
  "TIME'S UP" screen agree even if nobody presses END GAME.
- **Undo last hint**, **Reopen game** — corrections for a mis-tap.
- **Reset team**, **Seed teams** — rehearsal and setup.

## 8. Not built yet (from UI.md)

- **"Team left campus" alert** and **checkpoint markers on the map** — both need
  the real coordinates, which the club has not fixed yet
  (`flutter_app/lib/core/models/checkpoint.dart`).
- **TEST MODE toggle** on SETUP — UI.md does not say what it should isolate.
- **Offline action queue** — the phone shows "SIGNAL LOST · RETRYING" and a
  TRY AGAIN button, but does not queue actions while offline.
- **EXPORT CSV** copies the CSV to the clipboard rather than downloading a file.
- **Device ID via `shared_preferences`** — the one-phone rule uses the Firebase
  anonymous Auth UID instead, which needs no extra storage.
