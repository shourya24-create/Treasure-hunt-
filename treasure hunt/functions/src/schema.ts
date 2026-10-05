/**
 * schema.ts — Firestore document type contracts for The Echo Protocol.
 *
 * These types mirror the exact shape stored in Firestore and follow
 * GAMEPLAY.md §9. No puzzle content lives here.
 *
 * Collections:
 *   /teams/{teamId}      server truth. Facilitators read; nobody writes directly.
 *   /teamViews/{teamId}  player-safe projection of a team. Only that team's phone reads it.
 *   /game/state          event-wide switches (paused, ended).
 *   /facilitators/{uid}  who may use the dashboard, and in which role.
 *   /facilitatorCommands/{id}  audit trail of every admin action.
 */

import type { Timestamp } from "firebase-admin/firestore";

// ── Identifiers ───────────────────────────────────────────────────────────────

/** The 7 campus checkpoints, in walking order around the loop (GAMEPLAY.md §5.1). */
export const CAMPUS_CHECKPOINTS = [
  "CP2", "CP3", "CP4", "CP5", "CP6", "CP7", "CP8",
] as const;
export type CampusCheckpointId = (typeof CAMPUS_CHECKPOINTS)[number];

/** CP1 is the starting-room paper puzzle; it is never part of a route. */
export type CheckpointId = "CP1" | CampusCheckpointId;
export const ALL_CHECKPOINTS: readonly CheckpointId[] = ["CP1", ...CAMPUS_CHECKPOINTS];

export const TEAM_IDS = [
  "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12",
] as const;
export type TeamId = (typeof TEAM_IDS)[number];

// ── Enumerations ──────────────────────────────────────────────────────────────

/** waiting → playing → atFinal → finished. Pausing is a separate flag. */
export type TeamStatus = "waiting" | "playing" | "atFinal" | "finished";
export type Direction = "forward" | "reverse";
export type FinalDecision = "DESTROY" | "KEEP";
export const FINAL_DECISIONS: readonly FinalDecision[] = ["DESTROY", "KEEP"];

/** Answer grading modes supported by validate.ts. */
export type AnswerMode = "exact" | "sequence" | "set" | "numeric";

/** Facilitator action verbs (GAMEPLAY.md §10). */
export type FacilitatorActionType =
  | "startGame"
  | "recordHint"
  | "undoHint"
  | "forceComplete"
  | "swapNext"
  | "moveToEnd"
  | "arrivedFinal"
  | "startViewing"
  | "cancelViewing"
  | "recordDecision"
  | "resolveHelp"
  | "pauseTeam"
  | "resumeTeam"
  | "pauseAll"
  | "resumeAll"
  | "endGame"
  | "reopenGame"
  | "releaseDevice"
  | "resetTeam"
  | "resetEvent"
  | "seedTeams"
  | "listGateCodes"
  | "contentStatus"
  | "ping";

/** A desk volunteer runs the CP1 gate desk and the headset desk only (UI.md §1). */
export type FacilitatorRole = "admin" | "desk";

// ── Team document  (/teams/{teamId}) ─────────────────────────────────────────

/** Stored as start + direction; the full order is always derived (GAMEPLAY.md §5.2). */
export interface RouteSpec {
  start: CampusCheckpointId;
  direction: Direction;
}

export interface CheckpointDone {
  cp: CampusCheckpointId;
  /** Null when an admin force-completed a checkpoint the team never scanned. */
  arrivedAt: Timestamp | null;
  solvedAt: Timestamp;
  via: "solve" | "force";
}

export interface Arrival {
  cp: CampusCheckpointId;
  at: Timestamp;
  /** The phone that scanned the object. */
  deviceUid: string;
}

export interface HintTaken {
  cp: CheckpointId;
  at: Timestamp;
  /** Facilitator UID who recorded it. */
  by: string;
}

/** Wrong-code counter: a short lock after several misses in a row. */
export interface CodeGuard {
  failures: number;
  lockedUntil: Timestamp | null;
}

export interface TeamLocation {
  lat: number;
  lng: number;
  accuracy: number;
  at: Timestamp;
}

export interface TeamDoc {
  id: TeamId;
  name: string;
  route: RouteSpec;
  /** Set only when an admin swaps or reorders; replaces the derived order. */
  routeOverride: CampusCheckpointId[] | null;
  status: TeamStatus;
  paused: boolean;
  /** Firebase Auth UID of the one phone allowed to play this team. */
  deviceUid: string | null;
  deviceClaimedAt: Timestamp | null;
  /** Wrong team passwords in a row. */
  loginGuard: CodeGuard;
  /** Wrong gate codes in a row. Separate, so a stranger guessing passwords cannot lock the gate. */
  gateGuard: CodeGuard;
  /** Gate code accepted; the campus run has started. */
  cp1DoneAt: Timestamp | null;
  cp1Via: "code" | "force" | null;
  /** Ordered. `step = checkpointsDone.length`. */
  checkpointsDone: CheckpointDone[];
  /** Scanned but not yet solved. At most one at a time. */
  arrival: Arrival | null;
  hintsTaken: HintTaken[];
  finalArrivedAt: Timestamp | null;
  /** The team's one member has put the headset on. */
  viewingStartedAt: Timestamp | null;
  decision: FinalDecision | null;
  decidedAt: Timestamp | null;
  /** Never copied to the team view. */
  decisionCorrect: boolean | null;
  /** How many completions (CP1 + campus) the phone has played the reward for. */
  rewardAck: number;
  /** Team pressed "I NEED HELP"; cleared when an admin resolves it. */
  helpRequestedAt: Timestamp | null;
  /** Derived by engine.pointsOf() on every write; stored so the board can sort. */
  points: number;
  lastProgressAt: Timestamp | null;
  location: TeamLocation | null;
  /** Last heartbeat from the team's phone. */
  lastSeenAt: Timestamp | null;
  updatedAt: Timestamp;
}

// ── Team view  (/teamViews/{teamId}) ─────────────────────────────────────────

export interface ChapterView {
  n: number;
  title: string;
  transcript: string;
  audioUrl: string;
}

export interface ObjectHintView {
  text: string;
  imageUrl: string;
}

export interface ReactionView {
  text: string;
  audioUrl: string;
}

/** The reward still to be played: station reaction (by checkpoint), then chapter (by step). */
export interface PendingReward {
  /** Null after CP1, which has no station. */
  stationReaction: ReactionView | null;
  chapter: ChapterView;
}

/**
 * One cleared fragment, for the Archive Log. Numbered by order of completion,
 * never by checkpoint, and only ever about a place the team has already been.
 */
export interface ArchiveEntry {
  /** 1 = CP1, then the campus checkpoints in the order the team cleared them. */
  n: number;
  clearedAt: Timestamp;
  /** The chapter this completion unlocked. */
  chapter: ChapterView;
  /** Null for CP1, which has no station. */
  stationReaction: ReactionView | null;
  /** The riddle that led here. Null when the paper named the place. */
  locationClue: string | null;
  /** Null for CP1, which has no scan object. */
  objectHint: ObjectHintView | null;
}

/**
 * Everything the phone is allowed to know. Never holds an answer, the route,
 * the next checkpoint's ID, the points or whether the final decision was
 * correct (UI.md §3.2: points are never shown to players).
 */
export interface TeamView {
  id: TeamId;
  name: string;
  deviceUid: string | null;
  status: TeamStatus;
  paused: boolean;
  cp1Done: boolean;
  /** Campus checkpoints solved so far (0–7). */
  step: number;
  /** Set after the gate code or a solve, until the phone has played it. */
  pendingReward: PendingReward | null;
  /** The checkpoint whose fragment is unlocked to solve, once the scan object matched. */
  activeCheckpoint: CampusCheckpointId | null;
  /** What to look for next. Null before CP1 and after the 7th checkpoint. */
  objectHint: ObjectHintView | null;
  /** Riddle for the next checkpoint. Null straight after CP1: the paper named it. */
  locationClue: string | null;
  returnToBase: boolean;
  /** Unlocked chapters, in chapter order. */
  chapters: ChapterView[];
  /** Cleared fragments, oldest first. */
  archive: ArchiveEntry[];
  finalArrived: boolean;
  decision: FinalDecision | null;
  decidedAt: Timestamp | null;
  helpRequestedAt: Timestamp | null;
  updatedAt: Timestamp;
}

// ── Game state  (/game/state) ────────────────────────────────────────────────

export interface GameState {
  /** Admin pressed "Start game": the 2-hour clock runs from here. */
  startedAt: Timestamp | null;
  /** Admin pressed "End game": no more scans or solves for anyone. */
  ended: boolean;
  endedAt: Timestamp | null;
  /** Everyone paused. */
  paused: boolean;
  /** Teams that have arrived at the final and not yet decided, in arrival order. */
  finalQueue: TeamId[];
  /** The one team whose member is in the headset right now. */
  inHeadset: TeamId | null;
  updatedAt: Timestamp;
}

// ── Facilitator document  (/facilitators/{uid}) ───────────────────────────────

export interface FacilitatorDoc {
  uid: string;
  displayName: string;
  /** Missing = "admin". */
  role?: FacilitatorRole;
  createdAt: Timestamp;
}

// ── Facilitator command  (/facilitatorCommands/{commandId}) ──────────────────

/** Audit trail. Written only by the facilitatorAction function. */
export interface FacilitatorCommand {
  type: FacilitatorActionType;
  teamId: string | null;
  checkpointId: string | null;
  decision: string | null;
  issuedAt: Timestamp;
  facilitatorUid: string;
  /** Set to true by the Cloud Function after the command is handled. */
  processed: boolean;
}

// ── Answer definition shapes (used by content/answers.ts + validate.ts) ──────

export interface ExactMatchAnswer {
  mode: "exact";
  value: string;
  /** Defaults to false — comparison is case-insensitive unless set to true. */
  caseSensitive?: boolean;
}

export interface SequenceAnswer {
  mode: "sequence";
  /** Must match in order. */
  values: string[];
}

export interface SetMatchAnswer {
  mode: "set";
  /** All values must be present; order does not matter. */
  values: string[];
}

export interface NumericAnswer {
  mode: "numeric";
  value: number;
  /** Accepted delta on either side (e.g. 0.5 accepts 4.5–5.5 for value=5). */
  tolerance: number;
}

export type AnswerDefinition =
  | ExactMatchAnswer
  | SequenceAnswer
  | SetMatchAnswer
  | NumericAnswer;

export interface CheckpointAnswerDef {
  checkpointId: CampusCheckpointId;
  answer: AnswerDefinition;
}
