# The Echo Protocol

The AR/VR club's campus mystery hunt: 12 teams, 2 hours, 8 fragments of a
signal called Echo. This folder holds the Flutter web app (the player side and
the admin dashboard), the game's backend, and the scanner page.

It is separate from the Next.js app at the root of this repository (see the
[root README](../README.md)); the two share nothing at runtime.

## Read these first

| Document | What it covers |
|---|---|
| [GAMEPLAY.md](GAMEPLAY.md) | How the event plays: flow, routes, scoring, the final. **The source of truth.** |
| [UI.md](UI.md) | Every screen, route and widget of the Flutter app. |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Colours, typography, texture, component rules. |
| [BACKEND.md](BACKEND.md) | Callables, Firestore shape, setup, rehearsal and deploy commands. |
| [agents.md](agents.md) | Rules for AI coding agents working in this folder. |

## What is where

| Path | What it is |
|---|---|
| `flutter_app/` | The Flutter **web** app. `lib/player/` is the team's phone (Home, Fragments, Scan, Archive, Profile), `lib/admin/` is the dashboard, `lib/core/` holds models, services and providers, `lib/widgets/` the shared components. |
| `functions/` | The game rules and the eight callables, in TypeScript. `src/lib/engine.ts` holds the rules, `src/content/` the story, codes and answers (placeholders for now), `test/` the unit, integration and rules tests. |
| `field/` | The scanner page served at `/field/scan`: MindAR recognises a scan object, the backend checks it, and the app takes over again. `targets/` holds placeholder test targets. |
| `vercel/` | The live deployment: `build.sh` assembles the site, `api/index.js` serves the callables at `/api/<name>`. |
| `firebase.json`, `firebase.rules`, `firestore.indexes.json`, `.firebaserc` | Firestore rules and indexes, and the local emulators. |

## How it runs

- **Firebase** project `echo-protocol-da7f7` (free plan) provides Firestore and
  Auth only. No client ever writes to Firestore: every change goes through a
  callable.
- The callables are Firebase `onCall` handlers, but they are **not** on Cloud
  Functions (that needs the paid plan). **Vercel** serves them at `/api/<name>`,
  next to the Flutter build and the scanner page.
- Everything in `functions/src/content/` is a `TODO_*` placeholder until the
  story and AR teams deliver the real content. The same goes for the scan
  targets in `field/targets/` and for the fragment puzzles, which are a plain
  answer field for now.

## Everyday commands

Run these from Git Bash. Full details and troubleshooting are in
[BACKEND.md](BACKEND.md) §6 and §9.

Check the backend:

```
cd functions
npm install
npm run build        # TypeScript must compile
npm run test:unit    # the game rules
npm test             # + callables and Firestore rules on the emulators
```

`npm test` needs Java 21+ and the Firebase CLI (`npm i -g firebase-tools`).

Check the app:

```
cd flutter_app
flutter pub get
flutter analyze
```

Rehearse on your own machine, touching nothing live: see "Rehearsing on the
local emulators" in [BACKEND.md](BACKEND.md) §6.

Deploy the site (the Flutter app, the scanner and the callables):

```
cd vercel
FLUTTER=/path/to/flutter.bat bash build.sh
npx vercel deploy --prod
```

Deploy Firestore rules and indexes (only when they change):

```
firebase deploy --only firestore
```

A git push deploys none of this; it only redeploys the Next.js app at the
repository root.
