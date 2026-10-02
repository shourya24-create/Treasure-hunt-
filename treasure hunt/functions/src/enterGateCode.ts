/**
 * enterGateCode.ts — CP1: checks the gate code a volunteer handed the team.
 *
 * An accepted code completes CP1 (+100) and starts the campus run; the team
 * view then carries Echo Chapter 1 as its pending reward and the object hint
 * for the team's first checkpoint. A wrong code returns { accepted: false }
 * and costs nothing (GAMEPLAY.md §4.2).
 *
 * Actual codes live in content/teams.ts (all TODO placeholders).
 */

import { onCall } from "firebase-functions/v2/https";
import { parseString, parseTeamId, requireAuth } from "./lib/guards.js";
import { applyGateCode, assertDevice } from "./lib/engine.js";
import { mutateTeam } from "./lib/store.js";

export const enterGateCode = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data as { teamId?: unknown; code?: unknown };
  const teamId = parseTeamId(data.teamId);
  const code = parseString(data.code, "code");

  return mutateTeam(teamId, (team, game, now) => {
    assertDevice(team, uid);
    return applyGateCode(team, game, code, now);
  });
});
