/**
 * index.ts — Cloud Functions barrel file.
 *
 * Initialises the Admin SDK once, then re-exports every function from
 * its own module. Do NOT add business logic here.
 */

import { cert, initializeApp } from "firebase-admin/app";

// On Cloud Functions and the emulators the default credentials are enough.
// Hosted anywhere else (Vercel, see ../../vercel/), the service account comes
// from the FIREBASE_SERVICE_ACCOUNT environment variable as JSON.
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
initializeApp(
  serviceAccount ? { credential: cert(JSON.parse(serviceAccount)) } : undefined
);

// ── Player callables (the team's one phone) ───────────────────────────────────
export { claimTeam }      from "./claimTeam.js";
export { enterGateCode }  from "./enterGateCode.js";
export { recordArrival }  from "./recordArrival.js";
export { submitAnswer }   from "./submitAnswer.js";
export { ackReward }      from "./ackReward.js";
export { requestHelp }    from "./requestHelp.js";
export { reportLocation } from "./reportLocation.js";

// ── Admin callable (dashboard) ────────────────────────────────────────────────
export { facilitatorAction } from "./facilitatorAction.js";
