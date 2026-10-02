/**
 * claimTeam.ts — Logs a team in on exactly one phone (GAMEPLAY.md §4.1).
 *
 * The phone signs in anonymously, then calls this with its team ID and login
 * code. The first phone to do so owns the team; a second phone is refused
 * until a facilitator releases the device.
 */

import { onCall } from "firebase-functions/v2/https";
import { parseString, parseTeamId, requireAuth } from "./lib/guards.js";
import { applyClaim } from "./lib/engine.js";
import { mutateTeam } from "./lib/store.js";

export const claimTeam = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data as { teamId?: unknown; loginCode?: unknown };
  const teamId = parseTeamId(data.teamId);
  const loginCode = parseString(data.loginCode, "loginCode");

  await mutateTeam(teamId, (team, _game, now) => applyClaim(team, uid, loginCode, now));

  return { teamId };
});
