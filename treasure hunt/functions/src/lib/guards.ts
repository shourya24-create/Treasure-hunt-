/**
 * guards.ts — Authentication, authorization and input-parsing helpers.
 *
 * Every exported function throws an HttpsError on failure so callers
 * can simply `await requireXxx(request, ...)` without null checks.
 *
 * Team membership is not checked here: a team belongs to one phone, and
 * engine.assertDevice() checks that inside the same transaction as the write.
 */

import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import {
  ALL_CHECKPOINTS,
  CAMPUS_CHECKPOINTS,
  FINAL_DECISIONS,
  TEAM_IDS,
  type CampusCheckpointId,
  type CheckpointId,
  type FacilitatorActionType,
  type FacilitatorRole,
  type FinalDecision,
  type TeamId,
} from "../schema.js";

// ── requireAuth ───────────────────────────────────────────────────────────────

/**
 * Asserts the request carries a valid Firebase Auth token.
 * @returns The caller's UID.
 */
export function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  return request.auth.uid;
}

// ── requireFacilitator ────────────────────────────────────────────────────────

/** The only actions a desk volunteer may send: the gate desk and the headset desk. */
const DESK_ACTIONS: readonly FacilitatorActionType[] = [
  "listGateCodes",
  "arrivedFinal",
  "startViewing",
  "recordDecision",
];

/**
 * Asserts the caller is an authenticated facilitator.
 * Facilitator status is determined by the existence of a document at
 * `/facilitators/{uid}` (written exclusively by the Admin SDK).
 * @returns The caller's UID and role ("admin" unless the document says "desk").
 */
export async function requireFacilitator(
  request: CallableRequest
): Promise<{ uid: string; role: FacilitatorRole }> {
  const uid = requireAuth(request);
  const db = getFirestore();
  const snap = await db.collection("facilitators").doc(uid).get();

  if (!snap.exists) {
    throw new HttpsError("permission-denied", "Facilitator access required.");
  }
  return { uid, role: snap.data()?.role === "desk" ? "desk" : "admin" };
}

/** Asserts a desk volunteer is not reaching past the gate and final desks. */
export function requireRoleFor(role: FacilitatorRole, type: string): void {
  if (role === "desk" && !(DESK_ACTIONS as readonly string[]).includes(type)) {
    throw new HttpsError("permission-denied", "Admin access required for this action.");
  }
}

// ── Input parsing ─────────────────────────────────────────────────────────────

export function parseTeamId(value: unknown): TeamId {
  if (typeof value !== "string" || !(TEAM_IDS as readonly string[]).includes(value)) {
    throw new HttpsError("invalid-argument", "teamId must be one of T1…T12.");
  }
  return value as TeamId;
}

export function parseCampusCheckpoint(value: unknown): CampusCheckpointId {
  if (typeof value !== "string" || !(CAMPUS_CHECKPOINTS as readonly string[]).includes(value)) {
    throw new HttpsError("invalid-argument", "checkpointId must be one of CP2…CP8.");
  }
  return value as CampusCheckpointId;
}

export function parseCheckpoint(value: unknown): CheckpointId {
  if (typeof value !== "string" || !(ALL_CHECKPOINTS as readonly string[]).includes(value)) {
    throw new HttpsError("invalid-argument", "checkpointId must be one of CP1…CP8.");
  }
  return value as CheckpointId;
}

export function parseDecision(value: unknown): FinalDecision {
  if (!FINAL_DECISIONS.includes(value as FinalDecision)) {
    throw new HttpsError(
      "invalid-argument",
      `decision must be one of: ${FINAL_DECISIONS.join(", ")}.`
    );
  }
  return value as FinalDecision;
}

export function parseString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpsError("invalid-argument", `${field} is required.`);
  }
  return value;
}
