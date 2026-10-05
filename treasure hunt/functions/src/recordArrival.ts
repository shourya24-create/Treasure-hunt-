/**
 * recordArrival.ts — Arrival check for a campus checkpoint (GAMEPLAY.md §4.3).
 *
 * The scanner recognises one of the 7 scan objects and sends that
 * checkpoint's ID. If it is the team's next checkpoint, arrival is recorded
 * (time + phone) and the fragment unlocks in the app. Anything else returns
 * { match: false } — "This is not your signal." — and reveals nothing.
 */

import { onCall } from "firebase-functions/v2/https";
import { parseCampusCheckpoint, parseTeamId, requireAuth } from "./lib/guards.js";
import { applyArrival, assertDevice } from "./lib/engine.js";
import { mutateTeam } from "./lib/store.js";

export const recordArrival = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data as { teamId?: unknown; checkpointId?: unknown };
  const teamId = parseTeamId(data.teamId);
  const checkpointId = parseCampusCheckpoint(data.checkpointId);

  return mutateTeam(teamId, (team, game, now) => {
    assertDevice(team, uid);
    return applyArrival(team, game, checkpointId, uid, now);
  });
});
