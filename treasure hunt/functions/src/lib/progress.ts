/**
 * progress.ts — Firestore write helpers for fragment progression.
 *
 * All writes go through these functions so the rest of the codebase
 * never constructs Firestore paths by hand.
 */

import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import type { EvidenceCard, FragmentStatus } from "../schema.js";

// ── writeEvidence ─────────────────────────────────────────────────────────────

/**
 * Appends an evidence card to the fragment's `evidence` array.
 * `unlockedAt` is set server-side to the current time.
 */
export async function writeEvidence(
  teamId: string,
  fragmentId: string,
  card: Omit<EvidenceCard, "unlockedAt">
): Promise<void> {
  const db = getFirestore();
  const full: EvidenceCard = { ...card, unlockedAt: Timestamp.now() };

  await db
    .collection("teams").doc(teamId)
    .collection("fragments").doc(fragmentId)
    .update({ evidence: FieldValue.arrayUnion(full) });
}

// ── completeFragment ──────────────────────────────────────────────────────────

/**
 * Marks a fragment as completed and records the server timestamp.
 * Does NOT advance `currentFragmentIndex` — that is the responsibility
 * of the calling function which may need to do extra work first.
 */
export async function completeFragment(
  teamId: string,
  fragmentId: string
): Promise<void> {
  const db = getFirestore();
  await db
    .collection("teams").doc(teamId)
    .collection("fragments").doc(fragmentId)
    .update({
      status: "completed" as FragmentStatus,
      completedAt: Timestamp.now(),
    });
}

// ── unlockFragment ────────────────────────────────────────────────────────────

/**
 * Transitions a fragment from "locked" to "active" and records when it opened.
 */
export async function unlockFragment(
  teamId: string,
  fragmentId: string
): Promise<void> {
  const db = getFirestore();
  await db
    .collection("teams").doc(teamId)
    .collection("fragments").doc(fragmentId)
    .update({
      status: "active" as FragmentStatus,
      unlockedAt: Timestamp.now(),
    });
}
