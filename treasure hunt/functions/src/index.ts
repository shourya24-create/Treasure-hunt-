/**
 * index.ts — Cloud Functions barrel file.
 *
 * Initialises the Admin SDK once, then re-exports every function from
 * its own module. Do NOT add business logic here.
 */

import { initializeApp } from "firebase-admin/app";
initializeApp();

// ── Callable functions ─────────────────────────────────────────────────────────
export { createTeam }          from "./createTeam.js";
export { joinTeam }            from "./joinTeam.js";
export { submitAnswer }        from "./submitAnswer.js";
export { verifyStationCode }   from "./verifyStationCode.js";
export { submitFinalDecision } from "./submitFinalDecision.js";
export { facilitatorAction }   from "./facilitatorAction.js";

// ── Firestore triggers ─────────────────────────────────────────────────────────
export { onHintRequested } from "./onHintRequested.js";

// ── Scheduled functions (Phase 3 — timer) ─────────────────────────────────────
export { checkExpiredTeams } from "./checkExpiredTeams.js";