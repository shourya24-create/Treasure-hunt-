/**
 * guards.ts — Authentication & authorization helpers.
 *
 * Every exported function throws an HttpsError on failure so callers
 * can simply `await requireXxx(request, ...)` without null checks.
 */

import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

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

// ── requireMember ─────────────────────────────────────────────────────────────

/**
 * Asserts the caller is an authenticated member of `teamId`.
 * @returns The caller's UID.
 */
export async function requireMember(
  request: CallableRequest,
  teamId: string
): Promise<string> {
  const uid = requireAuth(request);
  const db = getFirestore();
  const snap = await db.collection("teams").doc(teamId).get();

  if (!snap.exists) {
    throw new HttpsError("not-found", `Team "${teamId}" not found.`);
  }

  const members: string[] = snap.data()?.members ?? [];
  if (!members.includes(uid)) {
    throw new HttpsError("permission-denied", "You are not a member of this team.");
  }
  return uid;
}

// ── requireFacilitator ────────────────────────────────────────────────────────

/**
 * Asserts the caller is an authenticated facilitator.
 * Facilitator status is determined by the existence of a document at
 * `/facilitators/{uid}` (written exclusively by the Admin SDK).
 * @returns The caller's UID.
 */
export async function requireFacilitator(
  request: CallableRequest
): Promise<string> {
  const uid = requireAuth(request);
  const db = getFirestore();
  const snap = await db.collection("facilitators").doc(uid).get();

  if (!snap.exists) {
    throw new HttpsError("permission-denied", "Facilitator access required.");
  }
  return uid;
}
