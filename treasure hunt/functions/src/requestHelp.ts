/**
 * requestHelp.ts — "I NEED HELP" on the player's Team tab (UI.md §3.7).
 *
 * Raises an alert on the admin dashboard, which shows the team's last GPS
 * position. It stays raised until an admin resolves it.
 */

import { onCall } from "firebase-functions/v2/https";
import { parseTeamId, requireAuth } from "./lib/guards.js";
import { applyHelpRequest, assertDevice } from "./lib/engine.js";
import { mutateTeam } from "./lib/store.js";

export const requestHelp = onCall(async (request) => {
  const uid = requireAuth(request);
  const teamId = parseTeamId((request.data as { teamId?: unknown }).teamId);

  await mutateTeam(teamId, (team, _game, now) => {
    assertDevice(team, uid);
    applyHelpRequest(team, now);
  });

  return { ok: true };
});
