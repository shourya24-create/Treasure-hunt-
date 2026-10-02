/**
 * contentStatus.ts — How much of the content in GAMEPLAY.md §8 has been
 * delivered, i.e. is no longer a TODO_* placeholder.
 *
 * Reports counts only. It never returns a content value, so it is safe to
 * show on the admin Setup tab.
 */

import { CHECKPOINT_ANSWERS } from "../content/answers.js";
import { CHAPTERS } from "../content/chapters.js";
import { CHECKPOINT_CONTENT } from "../content/checkpoints.js";
import { CORRECT_FINAL_DECISION } from "../content/final.js";
import { TEAMS } from "../content/teams.js";
import { FINAL_DECISIONS, type FinalDecision } from "../schema.js";

export interface ContentStatusItem {
  label: string;
  total: number;
  delivered: number;
}

/** A group is delivered when none of its values is still a placeholder. */
function delivered(groups: unknown[]): number {
  return groups.filter((g) => !JSON.stringify(g).includes("TODO_")).length;
}

export function contentStatus(): ContentStatusItem[] {
  const teams = Object.values(TEAMS);
  const checkpoints = Object.values(CHECKPOINT_CONTENT);
  const item = (label: string, groups: unknown[]): ContentStatusItem => ({
    label,
    total: groups.length,
    delivered: delivered(groups),
  });

  return [
    item("Team passwords", teams.map((t) => t.loginCode)),
    item("Gate codes", teams.map((t) => t.gateCode)),
    item("Echo chapters (title, transcript, audio)", CHAPTERS),
    item("AR activity answers", CHECKPOINT_ANSWERS),
    item("Object hints (text, image)", checkpoints.map((c) => c.objectHint)),
    item("Station reactions", checkpoints.map((c) => c.stationReaction)),
    item("Location clues", checkpoints.map((c) => c.locationClue)),
    {
      label: "Correct final decision",
      total: 1,
      delivered: FINAL_DECISIONS.includes(CORRECT_FINAL_DECISION as FinalDecision) ? 1 : 0,
    },
  ];
}
