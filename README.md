# ECHO Protocol Hunt

The web app that runs Team Vision's campus treasure hunt. Its original planning docs (written before the build, partly outdated) live in [website-docs/](website-docs/).

## Repository layout

This repository holds **two separate apps** for the same event:

| Where | What | How it is deployed |
|---|---|---|
| The repo root (`app/`, `components/`, `lib/`, `models/`, `scripts/`, `data/`, `public/`) | **ECHO Protocol Hunt**: the QR-code based Next.js + MongoDB app this README describes. | Vercel rebuilds and deploys it **on every git push**. |
| [`treasure hunt/`](treasure%20hunt/) | **The Echo Protocol**: the newer Flutter web app (player side and admin dashboard) with a Firestore backend and an AR scanner. Start with [`treasure hunt/README.md`](treasure%20hunt/README.md). | By hand, from `treasure hunt/vercel/`. A git push does not deploy it. |

The two apps share nothing at runtime. `tsconfig.json` excludes `treasure hunt/` from this app's type check.

Next.js 14 (App Router) + MongoDB (Mongoose) in one repo, deployed to Vercel.

## Run it locally

```bash
npm install
cp .env.example .env.local      # then fill in secrets (see below)
npm run db:local                # terminal 1: throwaway MongoDB on :27017 (data in .localdb/)
npm run seed                    # terminal 2: load data/*.json into the database
npm run dev                     # http://localhost:3000
```

- Player: open `/login`, use a Team ID and passcode from `data/teams.json`.
- Organiser: open `/admin`, sign in with your name + `ADMIN_PASSWORD`.
- To "scan" a QR locally, run `npm run qr` and open a URL from `qr-codes/urls.tsv`.

## Scripts

| Command | What it does |
|---|---|
| `npm run seed` | Validates and loads checkpoints, settings and teams. Refuses bad content. Won't touch teams once any has started unless `-- --force`. `-- --wipe-play` also clears progress and events. |
| `npm run qr` | Writes 8 QR PNGs (+ labelled SVGs, `urls.tsv`) to `qr-codes/` using `NEXT_PUBLIC_BASE_URL`. |
| `npm test` | Unit tests: route order, normalisation, timing, ranking, offline sealing. |
| `npm run playtest` | Plays a team (T12) through the whole hunt over HTTP against a running server and checks every rule. Resets the team afterwards. |
| `npm run loadtest` | 20 simultaneous clients against a running server. Set `LOADTEST_URL` to the deployed site before event day. |
| `npm run db:local` | Local MongoDB for development only. |

## Environment variables

| Variable | Notes |
|---|---|
| `MONGODB_URI` | Atlas connection string in production. |
| `SESSION_SECRET` | Long random string. Signs session cookies. |
| `QR_SECRET` | A *different* long random string. Signs QR URLs. Changing it invalidates printed QRs. |
| `ADMIN_PASSWORD` | Organiser password. |
| `NEXT_PUBLIC_BASE_URL` | The public URL. **Frozen once QRs are printed.** |

Set all five in Vercel → Project → Settings → Environment Variables (Production), not only locally.

## Content

All game content is data. Edit, then `npm run seed`:

- `data/checkpoints.json`: 8 checkpoints (location clue, puzzle, accepted answers, hints, story fragment). Optional `answersByBatch: { "2": [...] }` gives batch 2 different answers.
- `data/game.json`: intro text, final meta-code answers, hint penalty, cooldown, amber/red thresholds.
- `data/teams.json`: team IDs, names, batch, route offset and direction (`reverse`), passcode (printed on cards; stored hashed).
- Media goes in `public/media/`. AR lenses are standalone pages in `public/ar/`.

Everything in these files right now is **placeholder**.

## How it works (short version)

- **Route**: each team starts at checkpoint `offset + 1` and walks the loop forwards, or backwards if `reverse` is set. 12 teams on 8 checkpoints means four pairs share a start; one of each pair walks in reverse so they split after the first stop. Only the current location is ever sent to the phone.
- **QR**: `/c/<id>?t=<hmac>`. The signature stops hand-typed URLs; the real lock is the sequence check. Scanning ahead does nothing.
- **Answers**: checked server-side after normalising (case, spaces, punctuation). Atomic conditional updates mean duplicate submissions (a double tap, a queued offline answer racing a live one) record one result. There's a 30 s cooldown per team.
- **Score**: computed from the event log on read: `finish − start + hints × penalty + adjustments`. Never stored as a running total.
- **Offline**: when a puzzle opens, the phone gets salted hashes of the accepted answers, plus the fragment and next location encrypted with a key derived from the answer. With no signal it checks answers locally, reveals the next location, and queues the answer in IndexedDB. The server re-validates on reconnect and flags disagreements on the dashboard. A service worker (`public/sw.js`, production builds only) keeps the app shell and media available.

## Tracking and anti-cheat

- **One phone per team.** The first phone to log in holds the team; any other phone is refused (and the attempt is logged). If the phone dies, use **Unlock login** on the dashboard, then log in on the new phone.
- **Live location.** The team phone reports its GPS position every `locationIntervalSeconds` (default 10). The dashboard map shows every team with an accuracy circle. Expect about ±5–15 m outdoors, worse indoors. The screen is kept awake while the game is open; browsers can't track a page that's closed or in the background.
- **Leaving the page sets off a siren.** Switching tab or app, or locking the screen, is logged and shown on the dashboard (`AWAY NOW`, count, total time away). A siren and full-screen warning play on the phone; on iPhones the siren usually starts the moment they return, because hidden pages are paused. Tune with `sirenGraceSeconds` and `sirenSeconds` in `data/game.json`.
- **Scan inside the page.** The in-page scanner replaces the camera app, since leaving the page would trigger the siren. The AR lens also opens inside the page.
- Players see a notice about location and the alarm on the login screen. Location history deletes itself after 7 days.

## Organiser run sheet

1. Open `/admin` on the laptop and sign in with **your name** (every action is logged against it).
2. Pick the batch in the top-left.
3. At start time, press **Release batch 1**. All 12 teams start together on the same clock.
4. Watch the table. It refreshes every 5 seconds.
   - **Amber row** = 8+ minutes on one step. Keep an eye on it.
   - **Red row / STUCK** = 12+ minutes. Send a floater.
   - **⚠ offline mismatch** = a phone accepted an answer offline that the server rejected. Open the team, decide, then use *Resolve offline flags*.
5. Fixing problems: use the **Action…** menu on the row. Every action asks for a reason.
   - Torn or unreadable QR → *Force-unlock next checkpoint*.
   - Bad answer key, or the team clearly solved it → *Mark current checkpoint solved*.
   - Time dispute → *Adjust time* (minutes, negative subtracts).
   - Released by mistake → *Reset team*.
   - Team's phone died or they need to switch phone → *Unlock login (switch phone)*.
   - Red **🚨 Off the game page** banner or **AWAY NOW** → the phone left the game. The row shows how often and for how long. Check the team's log for times.
   - Use the **Live map** above the table to see where every team is.
6. When a team finishes the VR finale, press **VR complete, stop clock** in the VR queue (under the table).
7. Click a team ID to see its full event log. Use this to settle any dispute.
8. At the end: open **Leaderboard ↗** on the projector and press **Export CSV**.
9. For batch 2, switch the selector to 2 and repeat. Nothing needs resetting.

If the stale-data banner appears, the laptop has lost its connection. The game keeps running for players.

## Before event day

See [website-docs/todo.md](website-docs/todo.md), Phase 4. Key items: deploy to Vercel + Atlas, run `npm run loadtest` against production, do an airplane-mode playthrough on a real phone, seed real content, print QRs from the production URL, and take a `mongodump`.
