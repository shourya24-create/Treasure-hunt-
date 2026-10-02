/**
 * facilitatorAction.ts — Handles all admin-initiated commands from the dashboard.
 *
 * Actions: hint delivery, force-complete a fragment, pause/resume the timer, reset.
 * Each action is written to /facilitatorCommands as an audit trail before execution.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { requireFacilitator } from "./lib/guards.js";
import { completeFragment, unlockFragment } from "./lib/progress.js";
import { getHint } from "./content/hints.js";
import type { FacilitatorActionType, HintDoc } from "./schema.js";

const FRAGMENT_IDS = ["F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08"];

export const facilitatorAction = onCall(async (request) => {
  const facilitatorUid = await requireFacilitator(request);

  const { type, teamId, fragmentId, hintLevel } = request.data as {
    type?: unknown;
    teamId?: unknown;
    fragmentId?: unknown;
    hintLevel?: unknown;
  };

  if (typeof type !== "string") {
    throw new HttpsError("invalid-argument", "type is required.");
  }
  if (typeof teamId !== "string" || !teamId) {
    throw new HttpsError("invalid-argument", "teamId is required.");
  }

  const db = getFirestore();
  const now = Timestamp.now();

  // Write command to audit log.
  const cmdRef = db.collection("facilitatorCommands").doc();
  await cmdRef.set({
    type: type as FacilitatorActionType,
    teamId,
    fragmentId: fragmentId ?? null,
    hintLevel: hintLevel ?? null,
    issuedAt: now,
    facilitatorUid,
    processed: false,
  });

  const teamRef = db.collection("teams").doc(teamId);
  const teamSnap = await teamRef.get();
  if (!teamSnap.exists) {
    throw new HttpsError("not-found", "Team not found.");
  }

  switch (type as FacilitatorActionType) {
    // ── hint ────────────────────────────────────────────────────────────
    case "hint": {
      if (typeof fragmentId !== "string" || !fragmentId) {
        throw new HttpsError("invalid-argument", "fragmentId required for hint action.");
      }
      const level = Number(hintLevel);
      if (![1, 2, 3].includes(level)) {
        throw new HttpsError("invalid-argument", "hintLevel must be 1, 2, or 3.");
      }

      const text = getHint(fragmentId, level as 1 | 2 | 3);
      if (!text) {
        throw new HttpsError("not-found", `No hint for ${fragmentId} level ${level}.`);
      }

      const hintDoc: HintDoc = {
        fragmentId,
        level: level as 1 | 2 | 3,
        text,
        requestedAt: now,
        deliveredAt: now,
      };

      await db
        .collection("teams").doc(teamId)
        .collection("fragments").doc(fragmentId)
        .collection("hints").doc()
        .set(hintDoc);

      await db
        .collection("teams").doc(teamId)
        .collection("fragments").doc(fragmentId)
        .update({ hintsUsed: (teamSnap.data()?.hintsUsed ?? 0) + 1 });

      break;
    }

    // ── forceComplete ────────────────────────────────────────────────────
    case "forceComplete": {
      if (typeof fragmentId !== "string" || !fragmentId) {
        throw new HttpsError("invalid-argument", "fragmentId required for forceComplete.");
      }
      await completeFragment(teamId, fragmentId);
      const idx = FRAGMENT_IDS.indexOf(fragmentId);
      const nextId = FRAGMENT_IDS[idx + 1];
      if (nextId) {
        await unlockFragment(teamId, nextId);
        await teamRef.update({ currentFragmentIndex: idx + 1 });
      } else {
        await teamRef.update({ status: "finished" });
      }
      break;
    }

    // ── pause ────────────────────────────────────────────────────────────
    case "pause": {
      const d = teamSnap.data()!;
      if (d.status !== "playing") {
        throw new HttpsError("failed-precondition", "Team is not currently playing.");
      }
      await teamRef.update({ status: "paused", pausedAt: now });
      break;
    }

    // ── resume ───────────────────────────────────────────────────────────
    case "resume": {
      const d = teamSnap.data()!;
      if (d.status !== "paused") {
        throw new HttpsError("failed-precondition", "Team is not paused.");
      }
      const pausedAt: Timestamp = d.pausedAt ?? now;
      const additionalPause = now.seconds - pausedAt.seconds;
      await teamRef.update({
        status: "playing",
        pausedDuration: (d.pausedDuration ?? 0) + additionalPause,
        pausedAt: null,
      });
      break;
    }

    // ── reset ────────────────────────────────────────────────────────────
    case "reset": {
      // Resets the team back to waiting state for a fresh run.
      // Fragment sub-documents are NOT reset here — use the emulator UI for that.
      await teamRef.update({
        status: "waiting",
        startedAt: null,
        currentFragmentIndex: 0,
        pausedDuration: 0,
        endingChoice: null,
      });
      break;
    }

    default: {
      throw new HttpsError("invalid-argument", `Unknown action type: ${type}`);
    }
  }

  // Mark command processed.
  await cmdRef.update({ processed: true });

  return { success: true, type };
});
