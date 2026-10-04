/**
 * store.ts — Firestore access for teams and the game state.
 *
 * All team writes go through mutateTeam() so the rest of the codebase never
 * constructs Firestore paths by hand, every change is transactional, and the
 * player-safe view is rewritten together with the team it mirrors.
 */

import { HttpsError } from "firebase-functions/v2/https";
import {
  getFirestore,
  Timestamp,
  type DocumentReference,
  type Firestore,
} from "firebase-admin/firestore";
import { TEAM_IDS, type GameState, type TeamDoc, type TeamId } from "../schema.js";
import { buildView, newGame, newTeam, pointsOf } from "./engine.js";

export function teamRef(db: Firestore, teamId: string): DocumentReference {
  return db.collection("teams").doc(teamId);
}

export function viewRef(db: Firestore, teamId: string): DocumentReference {
  return db.collection("teamViews").doc(teamId);
}

export function gameRef(db: Firestore): DocumentReference {
  return db.collection("game").doc("state");
}

// ── mutateTeam ────────────────────────────────────────────────────────────────

/**
 * Runs `fn` against the team inside a transaction. `fn` changes the team (and,
 * for the final, the game state) in place via lib/engine.ts and returns the
 * caller's result. If nothing changed, nothing is written — which is what
 * makes repeated calls idempotent.
 */
export async function mutateTeam<T>(
  teamId: TeamId,
  fn: (team: TeamDoc, game: GameState, now: Timestamp) => T
): Promise<T> {
  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const now = Timestamp.now();
    const [teamSnap, gameSnap] = await Promise.all([
      tx.get(teamRef(db, teamId)),
      tx.get(gameRef(db)),
    ]);
    if (!teamSnap.exists) {
      throw new HttpsError("not-found", `Team ${teamId} has not been seeded.`);
    }

    // Defaults first, so a document written before a field existed still loads.
    const team: TeamDoc = { ...newTeam(teamId, now), ...(teamSnap.data() as TeamDoc) };
    const game: GameState = { ...newGame(now), ...(gameSnap.data() as GameState | undefined) };
    const teamBefore = JSON.stringify(team);
    const gameBefore = JSON.stringify(game);

    const result = fn(team, game, now);

    if (JSON.stringify(team) !== teamBefore) {
      team.points = pointsOf(team);
      team.updatedAt = now;
      tx.set(teamRef(db, teamId), team);
      tx.set(viewRef(db, teamId), buildView(team));
    }
    if (JSON.stringify(game) !== gameBefore) {
      game.updatedAt = now;
      tx.set(gameRef(db), game);
    }
    return result;
  });
}

// ── mutateGame ────────────────────────────────────────────────────────────────

/** Changes the event-wide switches (start, pause all, end game). */
export async function mutateGame(fn: (game: GameState, now: Timestamp) => void): Promise<void> {
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const now = Timestamp.now();
    const snap = await tx.get(gameRef(db));
    const game: GameState = { ...newGame(now), ...(snap.data() as GameState | undefined) };
    fn(game, now);
    game.updatedAt = now;
    tx.set(gameRef(db), game);
  });
}

// ── resetEvent ────────────────────────────────────────────────────────────────

/**
 * Back to a fresh event: clock cleared, every team's progress wiped and every
 * phone released. For the morning after a rehearsal — never during the event.
 */
export async function resetEvent(db: Firestore): Promise<void> {
  const now = Timestamp.now();
  const batch = db.batch();
  batch.set(gameRef(db), newGame(now));
  for (const id of TEAM_IDS) {
    const team = newTeam(id, now);
    batch.set(teamRef(db, id), team);
    batch.set(viewRef(db, id), buildView(team));
  }
  await batch.commit();
}

// ── seedTeams ─────────────────────────────────────────────────────────────────

/**
 * Creates T1…T12 and /game/state where they are missing. Never overwrites a
 * team that already exists, so it is safe to run again mid-event.
 */
export async function seedTeams(db: Firestore): Promise<{ created: TeamId[] }> {
  const now = Timestamp.now();
  const [gameSnap, ...teamSnaps] = await db.getAll(
    gameRef(db),
    ...TEAM_IDS.map((id) => teamRef(db, id))
  );

  const batch = db.batch();
  if (!gameSnap.exists) batch.set(gameRef(db), newGame(now));

  const created: TeamId[] = [];
  TEAM_IDS.forEach((id, i) => {
    if (teamSnaps[i].exists) return;
    const team = newTeam(id, now);
    batch.set(teamRef(db, id), team);
    batch.set(viewRef(db, id), buildView(team));
    created.push(id);
  });

  await batch.commit();
  return { created };
}
