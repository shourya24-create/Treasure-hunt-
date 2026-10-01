/**
 * submitFinalDecision.ts — Records the team's ending choice (Fragment 08 outcome).
 *
 * Called when the team has completed all 8 fragments and picked
 * their narrative ending (ISOLATE or RELEASE).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireMember } from "./lib/guards.js";
import type { EndingChoice } from "./schema.js";

const VALID_CHOICES: EndingChoice[] = ["ISOLATE", "RELEASE"];

export const submitFinalDecision = onCall(async (request) => {
  const { teamId, choice } = request.data as {
    teamId?: unknown;
    choice?: unknown;
  };

  if (typeof teamId !== "string" || !teamId) {
    throw new HttpsError("invalid-argument", "teamId is required.");
  }
  if (!VALID_CHOICES.includes(choice as EndingChoice)) {
    throw new HttpsError(
      "invalid-argument",
      `choice must be one of: ${VALID_CHOICES.join(", ")}.`
    );
  }

  await requireMember(request, teamId);

  const db = getFirestore();
  const teamSnap = await db.collection("teams").doc(teamId).get();

  if (!teamSnap.exists) {
    throw new HttpsError("not-found", "Team not found.");
  }

  const data = teamSnap.data()!;

  if (data.currentFragmentIndex < 7) {
    throw new HttpsError(
      "failed-precondition",
      "All 8 fragments must be completed before submitting a final decision."
    );
  }

  if (data.endingChoice) {
    // Idempotent — decision already recorded.
    return { endingChoice: data.endingChoice as EndingChoice };
  }

  await db.collection("teams").doc(teamId).update({
    endingChoice: choice as EndingChoice,
    status: "finished",
  });

  return { endingChoice: choice as EndingChoice };
});
