/**
 * submitAnswer.ts — Grades a team's answer for the active fragment.
 *
 * The actual answer values live in content/answers.ts (all placeholders).
 * This function contains ZERO puzzle-specific logic.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireMember } from "./lib/guards.js";
import { writeEvidence, completeFragment, unlockFragment } from "./lib/progress.js";
import { gradeAnswer } from "./validate.js";
import { getFragmentAnswer } from "./content/answers.js";

const FRAGMENT_IDS = ["F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08"];

export const submitAnswer = onCall(async (request) => {
  const { teamId, fragmentId, answer } = request.data as {
    teamId?: unknown;
    fragmentId?: unknown;
    answer?: unknown;
  };

  if (typeof teamId !== "string" || !teamId) {
    throw new HttpsError("invalid-argument", "teamId is required.");
  }
  if (typeof fragmentId !== "string" || !fragmentId) {
    throw new HttpsError("invalid-argument", "fragmentId is required.");
  }
  if (answer === undefined) {
    throw new HttpsError("invalid-argument", "answer is required.");
  }

  await requireMember(request, teamId);

  const db = getFirestore();

  // Verify the fragment is currently active.
  const fragSnap = await db
    .collection("teams").doc(teamId)
    .collection("fragments").doc(fragmentId)
    .get();

  if (!fragSnap.exists) {
    throw new HttpsError("not-found", `Fragment ${fragmentId} not found.`);
  }
  if (fragSnap.data()?.status !== "active") {
    throw new HttpsError("failed-precondition", `Fragment ${fragmentId} is not active.`);
  }

  // Grade the answer.
  const def = getFragmentAnswer(fragmentId);
  if (!def) {
    throw new HttpsError("internal", `No answer definition for ${fragmentId}.`);
  }

  const correct = gradeAnswer(answer, def.answer);
  if (!correct) {
    return { correct: false };
  }

  // Write evidence and complete the fragment.
  await writeEvidence(teamId, fragmentId, {
    id: `${fragmentId}_answer`,
    label: `${fragmentId} solved`,
    data: String(answer),
  });
  await completeFragment(teamId, fragmentId);

  // Unlock the next fragment if one exists.
  const currentIndex = FRAGMENT_IDS.indexOf(fragmentId);
  const nextId = FRAGMENT_IDS[currentIndex + 1];
  if (nextId) {
    await unlockFragment(teamId, nextId);
    await db.collection("teams").doc(teamId).update({
      currentFragmentIndex: currentIndex + 1,
    });
  } else {
    // All fragments done — mark team as finished.
    await db.collection("teams").doc(teamId).update({ status: "finished" });
  }

  return { correct: true };
});
