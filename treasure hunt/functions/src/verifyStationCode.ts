/**
 * verifyStationCode.ts — Checks a physical station code against the registry.
 *
 * Teams must scan/enter the code posted at a physical location before
 * the AR puzzle for that station begins. This prevents teams from
 * skipping stations.
 *
 * Actual codes live in content/stations.ts (all TODO placeholders).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireMember } from "./lib/guards.js";
import { unlockFragment } from "./lib/progress.js";
import { verifyStationCode as checkCode } from "./content/stations.js";

export const verifyStationCode = onCall(async (request) => {
  const { teamId, fragmentId, code } = request.data as {
    teamId?: unknown;
    fragmentId?: unknown;
    code?: unknown;
  };

  if (typeof teamId !== "string" || !teamId) {
    throw new HttpsError("invalid-argument", "teamId is required.");
  }
  if (typeof fragmentId !== "string" || !fragmentId) {
    throw new HttpsError("invalid-argument", "fragmentId is required.");
  }
  if (typeof code !== "string" || !code) {
    throw new HttpsError("invalid-argument", "code is required.");
  }

  await requireMember(request, teamId);

  const db = getFirestore();
  const fragSnap = await db
    .collection("teams").doc(teamId)
    .collection("fragments").doc(fragmentId)
    .get();

  if (!fragSnap.exists) {
    throw new HttpsError("not-found", `Fragment ${fragmentId} not found.`);
  }

  const status = fragSnap.data()?.status;

  // If already active or completed, accept the call as idempotent.
  if (status === "active" || status === "completed") {
    return { verified: true };
  }

  if (status !== "locked") {
    throw new HttpsError("failed-precondition", `Unexpected fragment status: ${status}.`);
  }

  const verified = checkCode(fragmentId, code);
  if (!verified) {
    return { verified: false };
  }

  await unlockFragment(teamId, fragmentId);

  return { verified: true };
});
