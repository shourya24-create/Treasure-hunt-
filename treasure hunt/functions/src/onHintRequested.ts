// functions/src/onHintRequested.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireMember } from "./lib/guards.js";

interface HintRequest {
  teamId: string;
  questId: string;
}

export const onHintRequested = onCall(async (request) => {
  const { teamId, questId } = request.data as HintRequest;

  // Pass the complete request, not request.auth
  await requireMember(request, teamId);

  const db = getFirestore();
  const hintRef = db.doc(`teams/${teamId}/hints/${questId}`);
  const hintDoc = await hintRef.get();

  const currentLevel = hintDoc.exists
    ? (hintDoc.data()?.level ?? 0)
    : 0;

  const nextLevel = Math.min(currentLevel + 1, 3);

  if (nextLevel === currentLevel) {
    throw new HttpsError(
      "failed-precondition",
      "No further hints available."
    );
  }

  // Temporary hint text
  const hintText = `TODO_HINT_${questId}_L${nextLevel}`;

  await hintRef.set(
    {
      level: nextLevel,
      lastRequestedAt: new Date()
    },
    { merge: true }
  );

  return {
    level: nextLevel,
    text: hintText
  };
});