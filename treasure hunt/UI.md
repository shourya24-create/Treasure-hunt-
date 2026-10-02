# The Echo Protocol — UI Specification (Flutter)

Screens, navigation and components for the Flutter Web app.

- **What happens in the game** → `GAMEPLAY.md` (source of truth for rules)
- **How it looks** → `DESIGN_SYSTEM.md` (colours, type, texture, component rules)
- **This file** → which screens exist, what is on them, how they map to Flutter

Do not add screens, features or game rules that are not in these three files.
UI copy shown here in quotes is placeholder wording; the story team may reword
it, but must not change what the screen does.

---

## 1. App structure

**One Flutter Web app**, deployed to Firebase Hosting, with two route trees:

| Side | Path | Device | Navigation |
|---|---|---|---|
| Player | `/…` | One phone per team, outdoors | Bottom `NavigationBar`, 3 tabs |
| Admin | `/admin/…` | Laptop in the base room; phone for desk volunteers | Left `NavigationRail` (drawer under 900 px width) |

Role routing (in `app_router.dart` redirect):
- Not signed in → `/login`
- Player → `/` (can never open `/admin/…`)
- Facilitator → `/admin/live`
- Desk volunteer → `/admin/gate` and `/admin/final` only

The AR scanner and AR activities are **not Flutter**. They live in the separate
field app at `/field/` (MindAR + Three.js, built by the AR team). See §5.

---

## 2. Design tokens in Flutter

All values come from `DESIGN_SYSTEM.md`. Replace the old cyan palette in
`lib/theme.dart` completely.

### 2.1 Colours (`EchoColors`)

| Token (design system) | Dart name | Hex |
|---|---|---|
| `bg-void` | `bgVoid` | `#0B0C0A` |
| `bg-surface` | `bgSurface` | `#13150F` |
| `bg-surface-raised` | `bgSurfaceRaised` | `#1B1E15` |
| `hairline` | `hairline` | `#2A2E22` |
| `text-primary` | `textPrimary` | `#C8D4B0` |
| `text-secondary` | `textSecondary` | `#8A9478` |
| `text-muted` | `textMuted` | `#5B5E4E` |
| `text-headline` | `textHeadline` | `#E8EEDC` |
| `signal-green` | `signalGreen` | `#4F8F3F` |
| `signal-green-bright` | `signalGreenBright` | `#7FD858` |
| `signal-green-dim` | `signalGreenDim` | `#2E4524` |
| `danger-red` | `dangerRed` | `#7A2320` |
| `danger-red-bright` | `dangerRedBright` | `#B23A2E` |
| `warning-amber` | `warningAmber` | `#A6822E` |
| `highlight-select` | `highlightSelect` | `#C9A227` |

Widgets use these names only. No raw `Color(0x…)` outside `theme.dart`.

### 2.2 Colour jobs in this game (one job per colour)

| Colour | Means | Used in this app for |
|---|---|---|
| Bright green | Live, right now | Scanner running, current objective, team online, team currently in the headset |
| Dim green | Done | Solved checkpoints, unlocked chapters, decision recorded |
| Red | Failed, right now | Wrong scan, invalid gate code, timer under 10 min, phone offline, checkpoint at 4+ teams, DESTROY button |
| Amber | Being measured | Countdown bar, signal/GPS strength, checkpoint at 3 teams, team idle 15+ min |
| Gold | The one selected thing | See the gold budget below |

**Gold budget (one per screen):**
- Player: the **active bottom-nav tab**. On screens that hide the nav (§3.4), the
  focused input field or the single primary focus.
- Admin: the **active rail item**. Selected table rows use `bgSurfaceRaised` +
  a `signalGreen` border, **never** gold.
- A modal dialog counts as its own screen. The content behind it is dimmed to 40%.

### 2.3 Typography (`EchoText`)

| Style | Font | Use |
|---|---|---|
| `headline` | **Oswald**, ALL CAPS, tight tracking | Screen titles, checkpoint/chapter titles, big buttons |
| `label` | Oswald, ALL CAPS, small, wide tracking, `textSecondary` | Section labels ("CURRENT OBJECTIVE") |
| `body` | **Noto Serif** | Clues, chapter transcripts, any prose |
| `mono` | **JetBrains Mono** | Timers, codes, team IDs, times, points, coordinates, queue numbers |

Fonts are **bundled as assets** in `pubspec.yaml`, not fetched at runtime, so campus
Wi-Fi can't break typography. No rounded sans-serif anywhere.

### 2.4 Texture
- `EchoScaffold` stacks a **static tiled noise image at 3% opacity** over every
  background, wrapped in `IgnorePointer`. It's a static image, not animated, for
  low-end phones.
- **Scan-lines** (a `CustomPainter` of faint horizontal bands) only on hero screens:
  Waiting Room, Chapter playback, Return to Base, Mission Complete, Game Over,
  and Leaderboard projector mode.
- Irregular card borders are a nice-to-have. Ship crisp `hairline` borders first.

### 2.5 Motion
- **Pulse** = opacity breathing 60–100% over 1.6 s. Only for bright-green live states.
- **Failure flash** = one 150 ms flash to `dangerRedBright`, then a static `dangerRed`.
- **Done** = no animation.
- **Respect reduced motion**: if `MediaQuery.disableAnimations` is set, show no pulses.

---

## 3. Player app

### 3.1 Shell
`StatefulShellRoute` with 3 branches. Each tab keeps its scroll and state when you switch.

| Tab | Route | Icon idea |
|---|---|---|
| **MISSION** | `/` | radar/signal |
| **JOURNAL** | `/journal` | document |
| **TEAM** | `/team` | group |

Active tab = `highlightSelect` icon + label. Inactive = `textMuted`.

### 3.2 Top bar (`PlayerTopBar`, on every tab)

```
┌────────────────────────────────────────────┐
│ T5 · TEAM NAME          ● LIVE   ◉ GPS     │  label / mono
│ 01:12:44  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░   3 / 8       │  mono, amber bar
└────────────────────────────────────────────┘
```
- **Countdown** (mono) to the 2-hour mark + an amber bar. Under 10 min it turns
  `dangerRed`. At 0:00, one flash, then Game Over.
- **Progress** "3 / 8" = checkpoints done (CP1 counts).
- **Connection dot:** bright green pulse = online, red = offline.
- **GPS dot:** bright green = sharing, amber = weak, red = off.
- **Never shown:** points, route, checkpoint names.

### 3.3 Fragment tracker (`FragmentTracker`)
8 slots in a row on the Mission tab, numbered **1–8 by order of completion**, not by
checkpoint ID, so the tracker never reveals the route.
- Solved: filled `signalGreenDim`, static.
- Current: `signalGreenBright` outline, pulsing.
- Ahead: `hairline` outline, `textMuted` number.

### 3.4 MISSION tab: one screen, driven by state

`MissionScreen` listens to the team's Firestore document and shows **one view at a
time**. A reload always lands on the correct view (GAMEPLAY §9).

| # | View | When | Content | Nav shown? |
|---|---|---|---|---|
| 1 | `WaitingRoomView` | Before CP1 opens | Label "CP1 LOCKED", headline "LISTEN TO THE BRIEFING", a scan-line hero, a slowly pulsing signal glyph | Yes |
| 2 | `GateCodeView` | Briefing over, gate code not yet entered | Headline "ENTER ACCESS CODE", one large mono `CodeField` (gold when focused), primary button "VERIFY". Wrong code → field flashes red + "INVALID CODE", no penalty. | **No** (focus mode) |
| 3 | `RewardSequenceView` | Right after the gate code or after any solve | Plays in order: **station reaction** (skipped after CP1) → **Echo chapter** (`ChapterPlayer`) → **next objective**. First playback can't be skipped; "CONTINUE" appears when the audio ends. | **No** |
| 4 | `ObjectiveView` | A campus checkpoint is next (the home screen in play) | `FragmentTracker`; label "CURRENT OBJECTIVE"; **location clue** (serif body in a card); **object hint** (image in a card with label "SCAN TARGET"); a big primary **SCAN** button. After CP1 the clue card says "Go to the location from your paper", because the app never names the first checkpoint. | Yes |
| 5 | `ReturnToBaseView` | All 7 campus checkpoints done | Scan-line hero, headline "RETURN TO BASE", one serif line | Yes |
| 6 | `FinalQueueView` | Marked "arrived at final" | Headline "HEADSET QUEUE", a huge mono **#N** position (live), "Report to the club member at the headset desk". When it's their turn: "YOUR TURN" + bright green pulse. | Yes |
| 7 | `MissionCompleteView` | Decision recorded by admin | Headline "DECISION RECORDED". **Never** shows which decision was correct, the points or the rank. | Yes |
| 8 | `GameOverView` | 2:00 reached, decision not recorded yet | One red flash, headline "TIME'S UP", "Return to the starting room". Then becomes `FinalQueueView` once marked arrived. | Yes |

### 3.5 Full-screen routes (above the tabs, no nav)

| Route | Screen | Notes |
|---|---|---|
| `/login` | `LoginScreen` | Team ID + password (mono fields). If the team is already active on another phone: a red card saying "THIS TEAM IS ACTIVE ON ANOTHER PHONE. Ask a club member." Replaces the current `create_join_screen.dart`, because teams are created by the club, not by players. |
| `/preflight` | `PreflightScreen` | Shown once after the first login, **before lights-off**. Three checklist rows: CAMERA, LOCATION, SOUND (test tone). Each row is ghost → live → done. "READY" is enabled only when all three are done. Denied permission → a red row + step-by-step fix text for Android and iPhone. |
| `/field/scan` | *(field app, not Flutter)* | Opened by the SCAN button. See §5. |

### 3.6 JOURNAL tab (`/journal`)
- Label "ECHO TRANSMISSIONS". A vertical list of chapters **1–8 in chapter order**.
- Unlocked chapter: card with headline "CHAPTER 3", duration (mono), play button,
  and a "TRANSCRIPT" expander (serif body). Static `signalGreenDim` "RECEIVED" tag.
- Currently playing: card raised, bright-green pulse dot.
- Locked chapter: hairline outline, `textMuted` "CHAPTER 6 · ENCRYPTED", not tappable.
- **Never shows** checkpoint names, places or the route.

### 3.7 TEAM tab (`/team`)
- Team name + ID (mono), checkpoints done, elapsed time.
- "THIS PHONE" card showing location sharing and connection, with live, amber or red dots.
- **"I NEED HELP"** ghost button → confirm → sends an alert to the admin with the GPS
  position. Afterwards: "Help requested at 14:32" (mono).
- No points and no leaderboard.

### 3.8 Shared player states

| State | UI |
|---|---|
| Offline | Red banner under the top bar: "SIGNAL LOST · RETRYING". Actions queue and retry. The banner turns green for 2 s when back online, then hides. |
| Loading | Mono "DECRYPTING…" with a blinking caret. No spinners. |
| Paused by admin | Full-screen overlay: amber "TRANSMISSION PAUSED". Everything disabled. |
| Error from backend | Red card with a short message + "TRY AGAIN" ghost button. |

---

## 4. Admin dashboard

### 4.1 Shell
`ShellRoute` + `NavigationRail` (icon + label). Active item = gold. Below 900 px it
becomes a `Drawer` for the desk volunteer on a phone.

**Game header (on every admin tab):**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ECHO PROTOCOL · CONTROL   01:12:44   WAITING 0 · PLAYING 9 · FINAL 2 ·   │
│                                      DONE 1        ⚠ 3   [START] [END]   │
└──────────────────────────────────────────────────────────────────────────┘
```
- Game clock (mono, amber bar, red under 10 min).
- Team counts by status (mono).
- Alert counter (red if any failure alert, amber if only warnings).
- **START GAME** (primary) / **END GAME** (destructive). Both need typed confirmation ("type END").

### 4.2 Tabs

| Route | Tab | Who |
|---|---|---|
| `/admin/live` | LIVE | Admin |
| `/admin/map` | MAP | Admin |
| `/admin/teams` | TEAMS | Admin |
| `/admin/gate` | GATE | Admin, desk volunteer |
| `/admin/final` | FINAL | Admin, desk volunteer |
| `/admin/leaderboard` | BOARD | Admin |
| `/admin/log` | LOG | Admin |
| `/admin/setup` | SETUP | Admin |

#### LIVE (`/admin/live`), the home tab
- **Checkpoint load:** 7 tiles CP2–CP8 in loop order. Each shows a big mono team count
  + team chips (e.g. "T5", "T10").
  0–2 teams = normal surface · 3 = amber border + amber count · 4+ = red border + one flash.
- **Alerts feed** (newest first). Each row has a time, a team chip, a message and "OPEN TEAM":

  | Alert | Colour |
  |---|---|
  | Checkpoint has 4+ teams | red |
  | Phone offline > 2 min | red |
  | Team pressed I NEED HELP | red |
  | Team left campus (GPS) | red |
  | Checkpoint has 3 teams | amber |
  | No progress for 15+ min | amber |

  Alerts clear themselves when the condition ends. Help alerts need "RESOLVE".

#### MAP (`/admin/map`)
- `flutter_map` with dark-styled OpenStreetMap tiles, tinted toward `bgVoid`.
- 7 checkpoint markers (mono labels CP2–CP8) + the base room.
- Team pins: bright green = playing, amber = idle 15+ min, red = offline, dim green = finished.
- Tap a pin → side panel with the team summary + "OPEN TEAM".

#### TEAMS (`/admin/teams`) → `/admin/teams/:id`
- A `DataTable` with 12 rows, sortable:
  `TEAM` · `STEP` · `NEXT CP` · `POINTS` · `HINTS` · `LAST ACTIVITY` · `PHONE` · `STATUS`
- Selected row = raised surface + green border (not gold).
- **Team detail** (side panel on wide screens, full page on narrow):
  - **Timeline** (mono times): gate code → each arrival/solve → hints → admin actions.
  - **Route strip**: 7 slots in route order. Done = dim green, next = bright green pulse, later = hairline.
  - **Actions** (each opens a `ConfirmDialog`):

    | Action | Button style | Notes |
    |---|---|---|
    | RECORD HINT (−20) | primary | Pick the checkpoint. **Undo for 30 s** via a snackbar. |
    | FORCE-COMPLETE CHECKPOINT | primary | Counts as a normal solve (+100). |
    | SWAP NEXT CHECKPOINT | ghost | Choose from the team's unvisited checkpoints. Shows the live team count for each option. |
    | PAUSE / RESUME TEAM | ghost | |
    | RELEASE PHONE | destructive | Lets the team log in on a new phone (dead battery, etc.). |

#### GATE (`/admin/gate`), CP1 desk
- 12 rows: team · paper variant (`P-CP4`) · gate code (hidden, "REVEAL" ghost button,
  hides again after 10 s) · status (`NOT ENTERED` muted / `ENTERED 00:14:32` dim green).
- **Shared-start pairs** are grouped visually (T1+T8, T2+T12, T3+T9, T5+T10, T7+T11)
  with a small note "hold 2nd code ~2–3 min if both are ready together".
- The app never issues codes by itself. This screen is a reference for the volunteer.

#### FINAL (`/admin/final`), headset desk
- **Queue** in arrival order. Each row shows the position number (mono), team, arrival time and stage:

  | Stage | Look | Button |
  |---|---|---|
  | Not arrived | muted | MARK ARRIVED |
  | Waiting | normal | START VIEWING |
  | **In headset** (max 1 team at a time) | bright green pulse | RECORD DECISION |
  | Decided | dim green, static | — |

- **RECORD DECISION** dialog: headline "TEAM T5 DECISION", two big buttons side by side:
  **DESTROY ECHO** (destructive red) and **KEEP ECHO** (primary green). After a tap:
  "Confirm DESTROY for T5? This cannot be changed." → CONFIRM.
- The screen **never shows which decision is correct**.

#### LEADERBOARD (`/admin/leaderboard`)
- Table: RANK · TEAM · CHECKPOINTS (×100) · HINTS (×−20) · DECISION BONUS · TOTAL · FINISH TIME.
  The ranking order follows GAMEPLAY §6.
- **PROJECTOR MODE** button: full screen with scan-lines, large Oswald type, no admin
  chrome. The decision bonus column shows "SEALED" until the admin presses **REVEAL**.
- **EXPORT CSV** ghost button.

#### LOG (`/admin/log`)
- A mono, append-only list: time · actor (team or admin name) · action · details.
- Filter by team and by action type. Read-only.

#### SETUP (`/admin/setup`), used before the event
- Teams + logins, the route of each team (generated from GAMEPLAY §5, read-only), and
  **content status**: a checklist of everything in GAMEPLAY §8. Items still on a
  `TODO_` placeholder show red, delivered items dim green.
- **TEST MODE** toggle so the club can rehearse without affecting real teams.

### 4.3 Admin interaction rules
- Every action that changes points, progress or the route → `ConfirmDialog`.
- Teams are always written **"T5 · Team Name"**, so nobody confuses team numbers.
- Everything updates live from Firestore streams, with no refresh button.
- Every action goes through the `facilitatorAction` backend function. The admin app
  never writes to Firestore directly.

---

## 5. Flutter ↔ AR field app contract

The scanner and activities are web pages built by the AR team at `/field/` on the
**same domain**, so they share the Firebase login.

```
Flutter ObjectiveView ──SCAN──▶ /field/scan
   /field/scan   recognises the scan object (MindAR) → backend checks it's the team's next CP
       ├─ wrong CP → field app shows "THIS IS NOT YOUR SIGNAL" (red flash), stays in scanner
       └─ right CP → /field/activity?cp=CPx  (AR activity)
   /field/activity  team solves it → backend records the solve
       └─ redirects to Flutter "/"  → MissionScreen sees the new state → RewardSequenceView
```

- Flutter **never** loads Three.js or MindAR, and never embeds them in an iframe
  (the camera in an iframe is unreliable on iPhone).
- The field app **never** plays chapters or shows clues. That is Flutter's job.
- The field app's overlay UI (exit button, "THIS IS NOT YOUR SIGNAL") uses the same
  `DESIGN_SYSTEM.md` tokens, written as CSS variables.

---

## 6. Shared components (`lib/widgets/`)

| Widget | Purpose |
|---|---|
| `EchoScaffold` | Background `bgVoid` + grain overlay (+ optional scan-lines) |
| `EchoCard` | `bgSurface`, `hairline` border; raised variant |
| `EchoButton` | `.primary` / `.destructive` / `.ghost` per DESIGN_SYSTEM §5 |
| `StatusDot` | `.live` (pulse) / `.done` / `.failed` (flash once) / `.warning` |
| `SectionLabel` | Small all-caps Oswald label, `textSecondary` |
| `CountdownBar` | Mono time + amber bar, red under threshold |
| `FragmentTracker` | 8 slots, completion order (§3.3) |
| `CodeField` | Large mono input, gold when focused |
| `ChapterPlayer` | Play/pause, progress (amber), transcript expander (`just_audio`) |
| `SignalBanner` | Offline / back-online banner |
| `ConfirmDialog` | Title, consequence sentence, confirm button styled by action type |
| `TeamChip` | Mono "T5" chip, coloured by team status |

---

## 7. Folder structure

```
lib/
  main.dart · app_router.dart · theme.dart (EchoColors, EchoText, ThemeData)
  core/
    models/     team.dart, route.dart, chapter.dart, checkpoint.dart
    services/   auth_service.dart, team_service.dart, admin_service.dart, location_service.dart
    providers/  team_provider.dart, game_clock_provider.dart, admin_providers.dart
  player/
    shell/      player_shell.dart, player_top_bar.dart
    mission/    mission_screen.dart, views/*.dart (one per view in §3.4)
    journal/    journal_screen.dart
    team/       team_screen.dart
    login/      login_screen.dart
    preflight/  preflight_screen.dart
  admin/
    shell/      admin_shell.dart, game_header.dart
    live/ map/ teams/ gate/ final/ leaderboard/ log/ setup/
  widgets/      (§6)
assets/
  fonts/        Oswald, NotoSerif, JetBrainsMono
  textures/     noise.png
```

### Packages

| Need | Package |
|---|---|
| Routing | `go_router` (already present) |
| State | `provider` (already present) |
| Firebase | `firebase_core`, `firebase_auth`, `cloud_firestore`, `cloud_functions` (already present) |
| Chapter audio | `just_audio` |
| GPS | `geolocator` |
| Admin map | `flutter_map` + `latlong2` |
| Device ID (one phone per team) | `shared_preferences` |

---

## 8. Accessibility and field conditions

- Body text is at least 16 sp. Tap targets are at least 48 × 48. Outdoor glare is why
  `textPrimary` is near-white.
- Red and green never carry meaning alone: always add a word ("FAILED", "DONE",
  "LIVE") or an icon, because some players will be colour-blind.
- Every audio chapter has a transcript, since campuses are noisy.
- Test on a low-end Android phone and an iPhone in Safari before the event.
