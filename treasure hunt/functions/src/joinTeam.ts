/**
 * joinTeam.ts — Adds a user to an existing team by join code.
 *
 * This file was missing from disk. It is exported from index.ts
 * and called by any team member who is not the original creator.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "./lib/guards.js";

const MAX_MEMBERS = 6;

export const joinTeam = onCall(async (request) => {
  const uid = requireAuth(request);

  const { joinCode } = request.data as { joinCode?: unknown };
  if (typeof joinCode !== "string" || joinCode.trim().length === 0) {
    throw new HttpsError("invalid-argument", "joinCode is required.");
  }

  const db = getFirestore();
  const snap = await db
    .collection("teams")
    .where("joinCode", "==", joinCode.trim().toUpperCase())
    .limit(1)
    .get();

  if (snap.empty) {
    throw new HttpsError("not-found", "No team found with that join code.");
  }

  const teamDoc = snap.docs[0];
  const teamId = teamDoc.id;
  const data = teamDoc.data();

  if (data.status === "finished") {
    throw new HttpsError("failed-precondition", "This team's run has already finished.");
  }

  const members: string[] = data.members ?? [];

  if (members.includes(uid)) {
    // Idempotent — already a member, return the teamId anyway.
    return { teamId, alreadyMember: true };
  }

  if (members.length >= MAX_MEMBERS) {
    throw new HttpsError("resource-exhausted", `Team is full (max ${MAX_MEMBERS} members).`);
  }

  await db.collection("teams").doc(teamId).update({
    members: FieldValue.arrayUnion(uid),
  });

  // Track on the user's profile.
  await db.collection("users").doc(uid).set(
    { teams: FieldValue.arrayUnion(teamId) },
    { merge: true }
  );

  return { teamId, alreadyMember: false };
});
