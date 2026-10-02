/**
 * schema.ts — Firestore document type contracts for The Echo Protocol.
 *
 * These types mirror the exact shape stored in Firestore. All fields
 * are required unless marked optional.  No puzzle content lives here.
 */

import type { Timestamp } from "firebase-admin/firestore";

// ── Status enumerations ───────────────────────────────────────────────────────

export type TeamStatus = "waiting" | "playing" | "paused" | "finished";
export type FragmentStatus = "locked" | "active" | "completed";
export type EndingChoice = "ISOLATE" | "RELEASE";

/** Answer grading modes supported by validate.ts. */
export type AnswerMode = "exact" | "sequence" | "set" | "numeric";

/** Facilitator action verbs. */
export type FacilitatorActionType =
  | "hint"
  | "forceComplete"
  | "pause"
  | "resume"
  | "reset";

// ── Evidence ──────────────────────────────────────────────────────────────────

/**
 * A single piece of evidence unlocked during a fragment.
 * Stored as an array field inside QuestRecord.
 */
export interface EvidenceCard {
  id: string;
  label: string;
  unlockedAt: Timestamp;
  /** Display value shown in the Journal (text, code, image URL, etc.). */
  data: string;
}

// ── Team document  (/teams/{teamId}) ─────────────────────────────────────────

export interface TeamDoc {
  /** Firestore document ID — duplicated here for convenience. */
  id: string;
  name: string;
  /** Short alphanumeric code used by joinTeam. */
  joinCode: string;
  status: TeamStatus;
  createdAt: Timestamp;
  /** Set when the facilitator starts the run (status transitions to "playing"). */
  startedAt?: Timestamp;
  /** Allowed run duration in seconds (e.g. 3600 = 1 hour). */
  timeLimit: number;
  /**
   * Total seconds the team has spent in "paused" state.
   * Subtracted from elapsed time so pauses don't count against the clock.
   */
  pausedDuration: number;
  /** UIDs of all team members, including the creator. */
  members: string[];
  /** Index into the canonical fragment sequence (0-based). */
  currentFragmentIndex: number;
  /** Set when the team completes Fragment 08 and picks an ending. */
  endingChoice?: EndingChoice;
}

// ── Fragment / quest record  (/teams/{teamId}/fragments/{fragmentId}) ─────────

export interface QuestRecord {
  /** e.g. "F01" … "F08" */
  fragmentId: string;
  status: FragmentStatus;
  unlockedAt?: Timestamp;
  completedAt?: Timestamp;
  /** Evidence cards accumulated during this fragment. */
  evidence: EvidenceCard[];
  hintsUsed: number;
}

// ── Hint document  (/teams/{teamId}/fragments/{fId}/hints/{hintId}) ──────────

export interface HintDoc {
  fragmentId: string;
  /** 1 = gentle nudge, 2 = stronger, 3 = near-reveal. */
  level: 1 | 2 | 3;
  /** Populated by the onHintRequested function after delivery. */
  text?: string;
  requestedAt: Timestamp;
  deliveredAt?: Timestamp;
}

// ── Facilitator document  (/facilitators/{uid}) ───────────────────────────────

export interface FacilitatorDoc {
  uid: string;
  displayName: string;
  createdAt: Timestamp;
}

// ── Facilitator command  (/facilitatorCommands/{commandId}) ──────────────────

export interface FacilitatorCommand {
  type: FacilitatorActionType;
  teamId: string;
  fragmentId?: string;
  hintLevel?: 1 | 2 | 3;
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

export interface FragmentAnswerDef {
  fragmentId: string;
  answer: AnswerDefinition;
}
