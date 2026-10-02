/**
 * facilitatorAction.ts — Handles all admin-initiated commands from the dashboard.
 *
 * Actions are the controls in GAMEPLAY.md §10: start/end game, record/undo a
 * hint, force-complete, swap or move a checkpoint, the final desk (arrived,
 * viewing, decision), pause/resume, plus device release, reset and seeding.
 * Each action is written to /facilitatorCommands as an audit trail before execution.
 *
 * A desk volunteer (role "desk") may only run the gate desk and the final desk.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  parseCampusCheckpoint,
  parseCheckpoint,
  parseDecision,
  parseTeamId,
  requireFacilitator,
  requireRoleFor,
} from "./lib/guards.js";
import {
  applyArrivedFinal,
  applyDecision,
  applyForceComplete,
  applyHint,
  applyMoveToEnd,
  applyPause,
  applyReleaseDevice,
  applyReset,
  applyResolveHelp,
  applyStartViewing,
  applySwapNext,
  applyUndoHint,
} from "./lib/engine.js";
import { contentStatus } from "./lib/contentStatus.js";
import { mutateGame, mutateTeam, seedTeams } from "./lib/store.js";
import { TEAMS } from "./content/teams.js";
import {
  TEAM_IDS,
  type FacilitatorActionType,
  type FacilitatorCommand,
} from "./schema.js";

/** Read-only lookups are not worth an audit entry. */
const UNLOGGED: readonly string[] = ["listGateCodes", "contentStatus"];

export const facilitatorAction = onCall(async (request) => {
  const { uid: facilitatorUid, role } = await requireFacilitator(request);

  const { type, teamId, checkpointId, decision } = request.data as {
    type?: unknown;
    teamId?: unknown;
    checkpointId?: unknown;
    decision?: unknown;
  };

  if (typeof type !== "string") {
    throw new HttpsError("invalid-argument", "type is required.");
  }
  requireRoleFor(role, type);

  const db = getFirestore();

  // Write command to audit log.
  const cmdRef = db.collection("facilitatorCommands").doc();
  if (!UNLOGGED.includes(type)) {
    const command: FacilitatorCommand = {
      type: type as FacilitatorActionType,
      teamId: typeof teamId === "string" ? teamId : null,
      checkpointId: typeof checkpointId === "string" ? checkpointId : null,
      decision: typeof decision === "string" ? decision : null,
      issuedAt: Timestamp.now(),
      facilitatorUid,
      processed: false,
    };
    await cmdRef.set(command);
  }

  let result: Record<string, unknown> = {};

  switch (type as FacilitatorActionType) {
    // ── game clock ───────────────────────────────────────────────────────
    case "startGame": {
      await mutateGame((game, now) => {
        if (!game.startedAt) game.startedAt = now;
      });
      break;
    }
    case "endGame": {
      await mutateGame((game, now) => {
        if (game.ended) return;
        game.ended = true;
        game.endedAt = now;
      });
      break;
    }
    case "reopenGame": {
      await mutateGame((game) => {
        game.ended = false;
        game.endedAt = null;
      });
      break;
    }

    // ── hints (physical only, −20 each) ──────────────────────────────────
    case "recordHint": {
      const cp = parseCheckpoint(checkpointId);
      await mutateTeam(parseTeamId(teamId), (team, _game, now) =>
        applyHint(team, cp, facilitatorUid, now)
      );
      break;
    }
    case "undoHint": {
      await mutateTeam(parseTeamId(teamId), (team) => applyUndoHint(team));
      break;
    }

    // ── forceComplete ────────────────────────────────────────────────────
    case "forceComplete": {
      const cp = checkpointId == null ? undefined : parseCheckpoint(checkpointId);
      result = await mutateTeam(parseTeamId(teamId), (team, game, now) =>
        applyForceComplete(team, game, cp, now)
      );
      break;
    }

    // ── route changes (crowd control, broken checkpoint) ─────────────────
    case "swapNext": {
      const cp = parseCampusCheckpoint(checkpointId);
      await mutateTeam(parseTeamId(teamId), (team) => applySwapNext(team, cp));
      break;
    }
    case "moveToEnd": {
      const cp = checkpointId == null ? undefined : parseCampusCheckpoint(checkpointId);
      await mutateTeam(parseTeamId(teamId), (team) => applyMoveToEnd(team, cp));
      break;
    }

    // ── final desk ───────────────────────────────────────────────────────
    case "arrivedFinal": {
      await mutateTeam(parseTeamId(teamId), (team, game, now) =>
        applyArrivedFinal(team, game, now)
      );
      break;
    }
    case "startViewing": {
      await mutateTeam(parseTeamId(teamId), (team, game, now) =>
        applyStartViewing(team, game, now)
      );
      break;
    }
    case "recordDecision": {
      const choice = parseDecision(decision);
      await mutateTeam(parseTeamId(teamId), (team, game, now) =>
        applyDecision(team, game, choice, now)
      );
      break;
    }

    // ── help ─────────────────────────────────────────────────────────────
    case "resolveHelp": {
      await mutateTeam(parseTeamId(teamId), (team) => applyResolveHelp(team));
      break;
    }

    // ── pause / resume ───────────────────────────────────────────────────
    case "pauseTeam":
    case "resumeTeam": {
      await mutateTeam(parseTeamId(teamId), (team) =>
        applyPause(team, type === "pauseTeam")
      );
      break;
    }
    case "pauseAll":
    case "resumeAll": {
      await mutateGame((game) => {
        game.paused = type === "pauseAll";
      });
      break;
    }

    // ── housekeeping ─────────────────────────────────────────────────────
    case "releaseDevice": {
      await mutateTeam(parseTeamId(teamId), (team) => applyReleaseDevice(team));
      break;
    }
    case "resetTeam": {
      await mutateTeam(parseTeamId(teamId), (team, game, now) =>
        applyReset(team, game, now)
      );
      break;
    }
    case "seedTeams": {
      result = await seedTeams(db);
      break;
    }

    // ── read-only lookups ────────────────────────────────────────────────
    // Gate codes live only in content/teams.ts; the gate desk needs them to
    // hand out. They are returned to facilitators and never stored.
    case "listGateCodes": {
      result = {
        codes: Object.fromEntries(TEAM_IDS.map((id) => [id, TEAMS[id].gateCode])),
      };
      break;
    }
    case "contentStatus": {
      result = { items: contentStatus() };
      break;
    }

    default: {
      throw new HttpsError("invalid-argument", `Unknown action type: ${type}`);
    }
  }

  // Mark command processed.
  if (!UNLOGGED.includes(type)) await cmdRef.update({ processed: true });

  return { success: true, type, ...result };
});
