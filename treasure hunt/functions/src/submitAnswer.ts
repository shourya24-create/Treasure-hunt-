/**
 * submitAnswer.ts — Grades the AR activity result for the checkpoint the
 * team has arrived at (GAMEPLAY.md §4.3).
 *
 * Wrong → { correct: false }; the team may retry. Right → +100, and the team
 * view then carries the reward to play in order: station reaction, the next
 * Echo chapter, then the location clue + object hint for the next checkpoint.
 * The Flutter app plays those; the field app only redirects back to it.
 *
 * The actual answer values live in content/answers.ts (all placeholders).
 * This function contains ZERO puzzle-specific logic.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { parseCampusCheckpoint, parseTeamId, requireAuth } from "./lib/guards.js";
import { applySolve, assertDevice } from "./lib/engine.js";
import { mutateTeam } from "./lib/store.js";

export const submitAnswer = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data as {
    teamId?: unknown;
    checkpointId?: unknown;
    answer?: unknown;
  };
  const teamId = parseTeamId(data.teamId);
  const checkpointId = parseCampusCheckpoint(data.checkpointId);
  if (data.answer === undefined) {
    throw new HttpsError("invalid-argument", "answer is required.");
  }

  return mutateTeam(teamId, (team, game, now) => {
    assertDevice(team, uid);
    return applySolve(team, game, checkpointId, data.answer, now);
  });
});
