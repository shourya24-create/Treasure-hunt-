/**
 * claimTeam.ts — Logs a team in on exactly one phone (GAMEPLAY.md §4.1).
 *
 * The phone signs in anonymously, then calls this with its team ID and login
 * code. The first phone to do so owns the team; a second phone is refused
 * until a facilitator releases the device.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { parseString, parseTeamId, requireAuth } from "./lib/guards.js";
import { applyClaim } from "./lib/engine.js";
import { mutateTeam } from "./lib/store.js";

export const claimTeam = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data as { teamId?: unknown; loginCode?: unknown };
  const teamId = parseTeamId(data.teamId);
  const loginCode = parseString(data.loginCode, "loginCode");

  // One phone plays for one team.
  const held = await getFirestore()
    .collection("teams")
    .where("deviceUid", "==", uid)
    .limit(2)
    .get();
  const other = held.docs.find((doc) => doc.id !== teamId);
  if (other) {
    throw new HttpsError(
      "failed-precondition",
      `This phone is already logged in for ${other.id}. Ask a club member.`
    );
  }

  // The refusal is thrown only after the transaction, so a wrong password is counted.
  const result = await mutateTeam(teamId, (team, _game, now) =>
    applyClaim(team, uid, loginCode, now)
  );
  if (!result.claimed) {
    throw new HttpsError("permission-denied", result.message);
  }

  return { teamId };
});
