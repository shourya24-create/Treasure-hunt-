/**
 * engine.ts — The game rules of GAMEPLAY.md as pure functions.
 *
 * No Firestore here. Every apply* function takes a TeamDoc (and the GameState
 * where the rule needs it), changes them in place and returns what the caller
 * should send back. lib/store.ts wraps these in a transaction, so the rules
 * can be unit-tested without an emulator.
 *
 * Every apply* function is idempotent: repeating a call that already
 * succeeded changes nothing and returns the same answer (GAMEPLAY.md §9).
 */

import { HttpsError } from "firebase-functions/v2/https";
import type { Timestamp } from "firebase-admin/firestore";
import {
  ALL_CHECKPOINTS,
  CAMPUS_CHECKPOINTS,
  type CampusCheckpointId,
  type ChapterView,
  type CheckpointId,
  type FinalDecision,
  type GameState,
  type ObjectHintView,
  type PendingReward,
  type RouteSpec,
  type TeamDoc,
  type TeamId,
  type TeamView,
} from "../schema.js";
import { gradeAnswer } from "../validate.js";
import { getCheckpointAnswer } from "../content/answers.js";
import { getChapter } from "../content/chapters.js";
import { CHECKPOINT_CONTENT } from "../content/checkpoints.js";
import { CORRECT_FINAL_DECISION } from "../content/final.js";
import { TEAMS, codeMatches } from "../content/teams.js";

// ── Constants (GAMEPLAY.md §1, §6) ────────────────────────────────────────────

export const POINTS_PER_CHECKPOINT = 100;
export const HINT_PENALTY = 20;
export const DECISION_BONUS = 100;

/** The event lasts 2 hours from "Start game". */
export const GAME_DURATION_MS = 2 * 60 * 60 * 1000;

// ── Route ─────────────────────────────────────────────────────────────────────

/** Derives the full visiting order from start + direction (GAMEPLAY.md §5.2). */
export function routeOrder(route: RouteSpec): CampusCheckpointId[] {
  const n = CAMPUS_CHECKPOINTS.length;
  const start = CAMPUS_CHECKPOINTS.indexOf(route.start);
  const dir = route.direction === "reverse" ? -1 : 1;
  return CAMPUS_CHECKPOINTS.map(
    (_, i) => CAMPUS_CHECKPOINTS[(((start + dir * i) % n) + n) % n]
  );
}

/** The derived order, unless an admin has swapped or reordered it. */
export function effectiveOrder(team: TeamDoc): CampusCheckpointId[] {
  return team.routeOverride ?? routeOrder(team.route);
}

/** Checkpoints still to visit, in order. */
export function remainingCheckpoints(team: TeamDoc): CampusCheckpointId[] {
  const done = new Set(team.checkpointsDone.map((d) => d.cp));
  return effectiveOrder(team).filter((cp) => !done.has(cp));
}

/** First checkpoint in the route order not yet done, or null after the 7th. */
export function nextCheckpoint(team: TeamDoc): CampusCheckpointId | null {
  return remainingCheckpoints(team)[0] ?? null;
}

export function stepOf(team: TeamDoc): number {
  return team.checkpointsDone.length;
}

/** Checkpoints completed, CP1 included (0–8). Also the latest chapter number. */
export function completionsOf(team: TeamDoc): number {
  return (team.cp1DoneAt ? 1 : 0) + stepOf(team);
}

// ── Points ────────────────────────────────────────────────────────────────────

export function checkpointPoints(team: TeamDoc): number {
  return POINTS_PER_CHECKPOINT * completionsOf(team);
}

export function hintPoints(team: TeamDoc): number {
  return HINT_PENALTY * team.hintsTaken.length;
}

export function pointsOf(team: TeamDoc): number {
  return (
    checkpointPoints(team) -
    hintPoints(team) +
    (team.decisionCorrect ? DECISION_BONUS : 0)
  );
}

// ── Construction ──────────────────────────────────────────────────────────────

export function newTeam(id: TeamId, now: Timestamp): TeamDoc {
  const config = TEAMS[id];
  return {
    id,
    name: config.name,
    route: config.route,
    routeOverride: null,
    status: "waiting",
    paused: false,
    deviceUid: null,
    deviceClaimedAt: null,
    cp1DoneAt: null,
    cp1Via: null,
    checkpointsDone: [],
    arrival: null,
    hintsTaken: [],
    finalArrivedAt: null,
    viewingStartedAt: null,
    decision: null,
    decidedAt: null,
    decisionCorrect: null,
    rewardAck: 0,
    helpRequestedAt: null,
    points: 0,
    lastProgressAt: null,
    location: null,
    lastSeenAt: null,
    updatedAt: now,
  };
}

export function newGame(now: Timestamp): GameState {
  return {
    startedAt: null,
    ended: false,
    endedAt: null,
    paused: false,
    finalQueue: [],
    inHeadset: null,
    updatedAt: now,
  };
}

// ── Clock ─────────────────────────────────────────────────────────────────────

/** True once the admin ended the game or the 2 hours ran out (GAMEPLAY.md §4.6). */
export function campusClosed(game: GameState, now: Timestamp): boolean {
  if (game.ended) return true;
  return (
    game.startedAt !== null &&
    now.toMillis() >= game.startedAt.toMillis() + GAME_DURATION_MS
  );
}

// ── Player-facing projection ──────────────────────────────────────────────────

interface Target {
  objectHint: ObjectHintView | null;
  locationClue: string | null;
  returnToBase: boolean;
}

const NO_TARGET: Target = { objectHint: null, locationClue: null, returnToBase: false };

/** Where the team should head now: looked up by its next checkpoint (§3). */
function targetOf(team: TeamDoc): Target {
  if (team.status !== "playing") return NO_TARGET;
  const next = nextCheckpoint(team);
  if (!next) return { objectHint: null, locationClue: null, returnToBase: true };
  // Straight after CP1 the paper already named the place, so only the object
  // hint is shown (§4.2) — unless an admin has since changed the route.
  const showClue = stepOf(team) > 0 || team.routeOverride !== null;
  const content = CHECKPOINT_CONTENT[next];
  return {
    objectHint: content.objectHint,
    locationClue: showClue ? content.locationClue : null,
    returnToBase: false,
  };
}

/** Chapters unlocked so far: by step count, never by checkpoint (§3). */
export function unlockedChapters(team: TeamDoc): ChapterView[] {
  return Array.from({ length: completionsOf(team) }, (_, i) => getChapter(i + 1));
}

/**
 * What the phone still has to play for the latest completion: the station
 * reaction (by checkpoint), then the chapter (by step). Null once played.
 */
function pendingRewardOf(team: TeamDoc): PendingReward | null {
  const completions = completionsOf(team);
  if (team.rewardAck >= completions) return null;
  const last = team.checkpointsDone[team.checkpointsDone.length - 1];
  return {
    stationReaction: last ? CHECKPOINT_CONTENT[last.cp].stationReaction : null,
    chapter: getChapter(completions),
  };
}

export function buildView(team: TeamDoc): TeamView {
  return {
    id: team.id,
    name: team.name,
    deviceUid: team.deviceUid,
    status: team.status,
    paused: team.paused,
    cp1Done: team.cp1DoneAt !== null,
    step: stepOf(team),
    pendingReward: pendingRewardOf(team),
    activeCheckpoint: team.status === "playing" ? team.arrival?.cp ?? null : null,
    ...targetOf(team),
    chapters: unlockedChapters(team),
    finalArrived: team.finalArrivedAt !== null,
    decision: team.decision,
    decidedAt: team.decidedAt,
    helpRequestedAt: team.helpRequestedAt,
    updatedAt: team.updatedAt,
  };
}

// ── Guards ────────────────────────────────────────────────────────────────────

/** Only the one phone that claimed the team may act for it (§4.1). */
export function assertDevice(team: TeamDoc, uid: string): void {
  if (team.deviceUid !== uid) {
    throw new HttpsError(
      "permission-denied",
      "This phone is not logged in for this team."
    );
  }
}

function assertStarted(game: GameState): void {
  if (!game.startedAt) {
    throw new HttpsError("failed-precondition", "The game has not started yet.");
  }
}

function assertCampusOpen(team: TeamDoc, game: GameState, now: Timestamp): void {
  assertStarted(game);
  if (campusClosed(game, now)) {
    throw new HttpsError(
      "failed-precondition",
      "The campus game has ended. Return to base."
    );
  }
  if (game.paused || team.paused) {
    throw new HttpsError("failed-precondition", "The game is paused.");
  }
}

function assertPlaying(team: TeamDoc): void {
  if (team.status === "waiting") {
    throw new HttpsError("failed-precondition", "CP1 is not complete yet.");
  }
  if (team.status !== "playing") {
    throw new HttpsError("failed-precondition", "This team's campus run is over.");
  }
}

// ── Completion helpers ────────────────────────────────────────────────────────

function completeCp1(team: TeamDoc, via: "code" | "force", now: Timestamp): void {
  team.cp1DoneAt = now;
  team.cp1Via = via;
  team.status = "playing";
  team.lastProgressAt = now;
}

function completeCheckpoint(
  team: TeamDoc,
  cp: CampusCheckpointId,
  via: "solve" | "force",
  now: Timestamp
): void {
  const arrived = team.arrival?.cp === cp;
  team.checkpointsDone.push({
    cp,
    arrivedAt: arrived ? team.arrival!.at : null,
    solvedAt: now,
    via,
  });
  if (arrived) team.arrival = null;
  team.lastProgressAt = now;
}

// ── Player actions ────────────────────────────────────────────────────────────

/** Binds the team to one phone. A second phone is refused (§4.1). */
export function applyClaim(
  team: TeamDoc,
  uid: string,
  loginCode: string,
  now: Timestamp
): void {
  if (!codeMatches(TEAMS[team.id].loginCode, loginCode)) {
    throw new HttpsError("permission-denied", "Invalid team ID or password.");
  }
  if (team.deviceUid === uid) return;
  if (team.deviceUid !== null) {
    throw new HttpsError(
      "permission-denied",
      "This team is active on another phone. Ask a club member."
    );
  }
  team.deviceUid = uid;
  team.deviceClaimedAt = now;
}

/**
 * CP1: the volunteer's gate code starts the campus run (+100, Chapter 1).
 * A wrong code has no penalty (§4.2).
 */
export function applyGateCode(
  team: TeamDoc,
  game: GameState,
  code: string,
  now: Timestamp
): { accepted: boolean } {
  if (team.cp1DoneAt) return { accepted: true };
  assertCampusOpen(team, game, now);
  if (!codeMatches(TEAMS[team.id].gateCode, code)) return { accepted: false };
  completeCp1(team, "code", now);
  return { accepted: true };
}

/**
 * Arrival check: the scanner reports which scan object it recognised. Only
 * the team's next checkpoint counts; anything else reveals nothing (§4.3).
 */
export function applyArrival(
  team: TeamDoc,
  game: GameState,
  cp: CampusCheckpointId,
  uid: string,
  now: Timestamp
): { match: boolean } {
  assertPlaying(team);
  assertCampusOpen(team, game, now);
  if (nextCheckpoint(team) !== cp) return { match: false };
  if (team.arrival?.cp !== cp) team.arrival = { cp, at: now, deviceUid: uid };
  return { match: true };
}

/** Grades the AR activity result for the checkpoint the team has arrived at. */
export function applySolve(
  team: TeamDoc,
  game: GameState,
  cp: CampusCheckpointId,
  answer: unknown,
  now: Timestamp
): { correct: boolean } {
  if (team.checkpointsDone.some((d) => d.cp === cp)) return { correct: true };

  assertPlaying(team);
  assertCampusOpen(team, game, now);
  if (team.arrival?.cp !== cp) {
    throw new HttpsError(
      "failed-precondition",
      "Scan this checkpoint's object first."
    );
  }

  const def = getCheckpointAnswer(cp);
  if (!def) {
    throw new HttpsError("internal", `No answer definition for ${cp}.`);
  }
  if (!gradeAnswer(answer, def.answer)) return { correct: false };

  completeCheckpoint(team, cp, "solve", now);
  return { correct: true };
}

/** The phone has played the station reaction and chapter for its latest completion. */
export function applyAckReward(team: TeamDoc): void {
  team.rewardAck = completionsOf(team);
}

/** "I NEED HELP" — raises an alert on the admin dashboard until resolved. */
export function applyHelpRequest(team: TeamDoc, now: Timestamp): void {
  if (!team.helpRequestedAt) team.helpRequestedAt = now;
}

// ── Admin actions (GAMEPLAY.md §10) ───────────────────────────────────────────

export function applyResolveHelp(team: TeamDoc): void {
  team.helpRequestedAt = null;
}

/** A physical hint, reported by the club member at the checkpoint: −20 (§4.4). */
export function applyHint(
  team: TeamDoc,
  cp: CheckpointId,
  by: string,
  now: Timestamp
): void {
  if (!ALL_CHECKPOINTS.includes(cp)) {
    throw new HttpsError("invalid-argument", `Unknown checkpoint: ${cp}.`);
  }
  team.hintsTaken.push({ cp, at: now, by });
}

/** Removes the most recently recorded hint — for a hint recorded by mistake. */
export function applyUndoHint(team: TeamDoc): void {
  if (team.hintsTaken.length === 0) {
    throw new HttpsError("failed-precondition", "This team has no hints recorded.");
  }
  team.hintsTaken.pop();
}

/**
 * Counts exactly like a real solve. Defaults to the checkpoint the team is on:
 * CP1 if the gate is still closed, otherwise its next campus checkpoint.
 */
export function applyForceComplete(
  team: TeamDoc,
  game: GameState,
  requested: CheckpointId | undefined,
  now: Timestamp
): { checkpointId: CheckpointId } {
  assertStarted(game);
  if (campusClosed(game, now)) {
    throw new HttpsError("failed-precondition", "The campus game has ended.");
  }
  const cp = requested ?? (team.cp1DoneAt ? nextCheckpoint(team) : "CP1");
  if (!cp) {
    throw new HttpsError("failed-precondition", "This team has no checkpoint left.");
  }

  if (cp === "CP1") {
    if (!team.cp1DoneAt) completeCp1(team, "force", now);
    return { checkpointId: cp };
  }

  if (team.checkpointsDone.some((d) => d.cp === cp)) return { checkpointId: cp };
  assertPlaying(team);
  completeCheckpoint(team, cp, "force", now);
  return { checkpointId: cp };
}

function assertRouteEditable(team: TeamDoc): void {
  if (team.status === "atFinal" || team.status === "finished") {
    throw new HttpsError("failed-precondition", "This team's campus run is over.");
  }
}

function setRemainingOrder(team: TeamDoc, remaining: CampusCheckpointId[]): void {
  team.routeOverride = [...team.checkpointsDone.map((d) => d.cp), ...remaining];
  // The team may already have scanned the checkpoint it is being sent away from.
  if (team.arrival && team.arrival.cp !== remaining[0]) team.arrival = null;
}

/** Crowd control: swap the team's next checkpoint with a later unvisited one (§5.5). */
export function applySwapNext(team: TeamDoc, withCp: CampusCheckpointId): void {
  assertRouteEditable(team);
  const remaining = remainingCheckpoints(team);
  const idx = remaining.indexOf(withCp);
  if (idx < 0) {
    throw new HttpsError("failed-precondition", `${withCp} is not on this team's remaining route.`);
  }
  if (idx === 0) return;
  [remaining[0], remaining[idx]] = [remaining[idx], remaining[0]];
  setRemainingOrder(team, remaining);
}

/** Broken checkpoint: move it to the end of the team's route (§5.5). Defaults to the next one. */
export function applyMoveToEnd(team: TeamDoc, requested: CampusCheckpointId | undefined): void {
  assertRouteEditable(team);
  const remaining = remainingCheckpoints(team);
  const cp = requested ?? remaining[0];
  const idx = cp ? remaining.indexOf(cp) : -1;
  if (idx < 0) {
    throw new HttpsError("failed-precondition", `${cp ?? "That checkpoint"} is not on this team's remaining route.`);
  }
  if (idx === remaining.length - 1) return;
  remaining.push(...remaining.splice(idx, 1));
  setRemainingOrder(team, remaining);
}

// ── Final (GAMEPLAY.md §4.5) ──────────────────────────────────────────────────

/** Sets the team's place in the headset queue: first come, first served. */
export function applyArrivedFinal(team: TeamDoc, game: GameState, now: Timestamp): void {
  if (team.finalArrivedAt) return;
  const allDone = team.cp1DoneAt !== null && nextCheckpoint(team) === null;
  if (!allDone && !campusClosed(game, now)) {
    throw new HttpsError(
      "failed-precondition",
      "This team still has checkpoints to visit. Force-complete them or end the game first."
    );
  }
  team.finalArrivedAt = now;
  team.status = "atFinal";
  team.arrival = null;
  if (!game.finalQueue.includes(team.id)) game.finalQueue.push(team.id);
}

/** One member puts the headset on. There is one headset, so one team at a time. */
export function applyStartViewing(team: TeamDoc, game: GameState, now: Timestamp): void {
  if (!team.finalArrivedAt) {
    throw new HttpsError("failed-precondition", "Mark the team as arrived at the final first.");
  }
  if (team.decision !== null) {
    throw new HttpsError("failed-precondition", "This team's decision is already recorded.");
  }
  if (game.inHeadset !== null && game.inHeadset !== team.id) {
    throw new HttpsError(
      "failed-precondition",
      `${game.inHeadset} is in the headset. Record their decision first.`
    );
  }
  if (!team.viewingStartedAt) team.viewingStartedAt = now;
  game.inHeadset = team.id;
}

/** Recorded once by the club member; cannot be changed. Finish time = now. */
export function applyDecision(
  team: TeamDoc,
  game: GameState,
  decision: FinalDecision,
  now: Timestamp
): void {
  if (team.decision === decision) return;
  if (team.decision !== null) {
    throw new HttpsError(
      "failed-precondition",
      "This team's decision is already recorded and cannot be changed."
    );
  }
  if (!team.finalArrivedAt) {
    throw new HttpsError(
      "failed-precondition",
      "Mark the team as arrived at the final first."
    );
  }
  team.decision = decision;
  team.decidedAt = now;
  team.decisionCorrect = decision === CORRECT_FINAL_DECISION;
  team.status = "finished";
  leaveFinal(team, game);
}

function leaveFinal(team: TeamDoc, game: GameState): void {
  game.finalQueue = game.finalQueue.filter((id) => id !== team.id);
  if (game.inHeadset === team.id) game.inHeadset = null;
}

// ── Housekeeping ──────────────────────────────────────────────────────────────

export function applyPause(team: TeamDoc, paused: boolean): void {
  team.paused = paused;
}

/** Frees the team's slot so a replacement phone can log in. */
export function applyReleaseDevice(team: TeamDoc): void {
  team.deviceUid = null;
  team.deviceClaimedAt = null;
  team.arrival = null;
}

/** Rehearsals only: back to a fresh team. The phone stays logged in. */
export function applyReset(team: TeamDoc, game: GameState, now: Timestamp): void {
  const fresh = newTeam(team.id, now);
  fresh.deviceUid = team.deviceUid;
  fresh.deviceClaimedAt = team.deviceClaimedAt;
  Object.assign(team, fresh);
  leaveFinal(team, game);
}
