/**
 * answers.ts — AR activity answer definitions, one per campus checkpoint.
 *
 * ⚠️  PLACEHOLDER FILE — All `value` fields are TODO strings.
 *     The puzzle/AR team must replace every TODO_ANSWER_* before the event,
 *     and may change `mode` to "sequence", "set" or "numeric" (see schema.ts).
 *
 * Keyed by checkpoint, never by step (GAMEPLAY.md §3).
 */

import type { CampusCheckpointId, CheckpointAnswerDef } from "../schema.js";

export const CHECKPOINT_ANSWERS: CheckpointAnswerDef[] = [
  { checkpointId: "CP2", answer: { mode: "exact", value: "TODO_ANSWER_CP2", caseSensitive: false } },
  { checkpointId: "CP3", answer: { mode: "exact", value: "TODO_ANSWER_CP3", caseSensitive: false } },
  { checkpointId: "CP4", answer: { mode: "exact", value: "TODO_ANSWER_CP4", caseSensitive: false } },
  { checkpointId: "CP5", answer: { mode: "exact", value: "TODO_ANSWER_CP5", caseSensitive: false } },
  { checkpointId: "CP6", answer: { mode: "exact", value: "TODO_ANSWER_CP6", caseSensitive: false } },
  { checkpointId: "CP7", answer: { mode: "exact", value: "TODO_ANSWER_CP7", caseSensitive: false } },
  { checkpointId: "CP8", answer: { mode: "exact", value: "TODO_ANSWER_CP8", caseSensitive: false } },
];

/** Returns the answer definition for a campus checkpoint, or undefined. */
export function getCheckpointAnswer(
  checkpointId: CampusCheckpointId
): CheckpointAnswerDef | undefined {
  return CHECKPOINT_ANSWERS.find((a) => a.checkpointId === checkpointId);
}
