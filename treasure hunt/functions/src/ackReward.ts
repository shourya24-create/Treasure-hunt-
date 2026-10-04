/**
 * ackReward.ts — The phone has played the reward for its latest completion.
 *
 * After the gate code or a solve, the team view carries `pendingReward`
 * (station reaction + Echo chapter). The Flutter app plays it once and then
 * calls this, so a reload never replays it (GAMEPLAY.md §9).
 */

import { onCall } from "firebase-functions/v2/https";
import { parseTeamId, requireAuth } from "./lib/guards.js";
import { applyAckReward, assertDevice } from "./lib/engine.js";
import { mutateTeam } from "./lib/store.js";

export const ackReward = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data as { teamId?: unknown; chapter?: unknown };
  const teamId = parseTeamId(data.teamId);
  // The chapter the phone has just played. Optional for older clients.
  const chapter = typeof data.chapter === "number" ? data.chapter : undefined;

  await mutateTeam(teamId, (team) => {
    assertDevice(team, uid);
    applyAckReward(team, chapter);
  });

  return { ok: true };
});
