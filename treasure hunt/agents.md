# The Echo Protocol — Agent Rules

**Read these first, in this order.** Build against them and do not invent
gameplay, screens or styling that isn't there.
1. `GAMEPLAY.md` — event flow, routes, scoring, story rules.
2. `UI.md` — every screen, route and widget of the Flutter app.
3. `DESIGN_SYSTEM.md` — colours, typography, texture, component rules.

## Scope boundary (hard rule)
This project has two independent workstreams: backend (Firebase/Flutter, this repo
owner) and field AR app (Vite/Three.js/MindAR, owned by a teammate, puzzle design
not finalized).

Unless explicitly told otherwise in a prompt:
- NEVER create, edit, or scaffold anything under `field-app/`.
- NEVER compile or reference `.mind` marker files.
- NEVER write Three.js scene/hologram code.
- NEVER write real puzzle answers, chapter text, clues, object hints, gate/login
  codes, or the correct final decision. Where the schema requires these
  (functions/src/content/: answers.ts, chapters.ts, checkpoints.ts, teams.ts,
  final.ts), use the placeholder convention below instead.

## Placeholder convention
Any puzzle-specific content value must be a string of the form:
  "TODO_<FIELD>_<ID>"  e.g. "TODO_ANSWER_CP3", "TODO_CHAPTER_3", "TODO_GATE_T4"
Never invent plausible-looking puzzle content — it will get mistaken for real content.

## Security rules
Firestore rules must always be role-scoped (team members read/write only their own
team; facilitators get read on the teams collection + write on facilitator actions).
Never leave or reintroduce an `if request.auth != null` catch-all rule.

## Definition of done
A phase is not complete until:
1. `npm run build` passes in functions/ with zero TypeScript errors.
2. Relevant emulator tests pass (`firebase emulators:exec` or equivalent).
3. A summary is reported: files touched, placeholders left, anything skipped and why.
Do not mark a step done without running these checks.