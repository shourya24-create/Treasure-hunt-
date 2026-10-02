/**
 * createTeam.ts — Creates a new team and initialises its Firestore documents.
 *
 * Called by the team leader's device immediately after they sign in.
 * The caller is automatically added as the first member.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "./lib/guards.js";
import type { TeamDoc, QuestRecord, FragmentStatus } from "./schema.js";

// Canonical fragment order — identifiers only, no puzzle content.
const FRAGMENT_IDS = ["F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08"];

/** Default run duration — 60 minutes. Facilitator can override before starting. */
const DEFAULT_TIME_LIMIT_SECONDS = 3600;

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
  return Array.from({ length: 5 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export const createTeam = onCall(async (request) => {
  const uid = requireAuth(request);

  const { teamName } = request.data as { teamName?: unknown };
  if (typeof teamName !== "string" || teamName.trim().length === 0) {
    throw new HttpsError("invalid-argument", "teamName is required.");
  }

  const db = getFirestore();
  const now = Timestamp.now();

  // Retry a few times in case of join-code collision (extremely unlikely).
  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = generateJoinCode();
    const existing = await db
      .collection("teams")
      .where("joinCode", "==", joinCode)
      .limit(1)
      .get();

    if (!existing.empty) continue; // collision — try again

    const teamRef = db.collection("teams").doc();
    const teamId = teamRef.id;

    const teamDoc: Omit<TeamDoc, "id"> = {
      name: teamName.trim(),
      joinCode,
      status: "waiting",
      createdAt: now,
      timeLimit: DEFAULT_TIME_LIMIT_SECONDS,
      pausedDuration: 0,
      members: [uid],
      currentFragmentIndex: 0,
    };

    const batch = db.batch();

    // Write the team document.
    batch.set(teamRef, { id: teamId, ...teamDoc });

    // Initialise all fragment records in the sub-collection.
    for (let i = 0; i < FRAGMENT_IDS.length; i++) {
      const fragmentRef = teamRef.collection("fragments").doc(FRAGMENT_IDS[i]);
      const record: QuestRecord = {
        fragmentId: FRAGMENT_IDS[i],
        status: (i === 0 ? "active" : "locked") as FragmentStatus,
        evidence: [],
        hintsUsed: 0,
        ...(i === 0 ? { unlockedAt: now } : {}),
      };
      batch.set(fragmentRef, record);
    }

    await batch.commit();

    // Track the team on the user's profile (optional convenience field).
    await db.collection("users").doc(uid).set(
      { teams: FieldValue.arrayUnion(teamId) },
      { merge: true }
    );

    return { teamId, joinCode };
  }

  throw new HttpsError("internal", "Could not generate a unique join code. Please try again.");
});
