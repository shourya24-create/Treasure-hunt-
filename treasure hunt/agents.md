# The Echo Protocol — Agent Rules

**Read `GAMEPLAY.md` first.** It defines the event flow, routes and story rules;
build against it and do not invent gameplay that isn't there.

## Scope boundary (hard rule)
This project has two independent workstreams: backend (Firebase/Flutter, this repo
owner) and field AR app (Vite/Three.js/MindAR, owned by a teammate, puzzle design
not finalized).

Unless explicitly told otherwise in a prompt:
- NEVER create, edit, or scaffold anything under `field-app/`.
- NEVER compile or reference `.mind` marker files.
- NEVER write Three.js scene/hologram code.
- NEVER write real puzzle answers, hint text, journal narrative, or station codes.
  Where the schema requires these (answers.ts, hints.ts, journal.ts, stations.ts),
  use the placeholder convention below instead.

## Placeholder convention
Any puzzle-specific content value must be a string of the form:
  "TODO_<FIELD>_<FRAGMENT_ID>"  e.g. "TODO_ANSWER_F03"
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