/**
 * answers.ts — Fragment answer definitions.
 *
 * ⚠️  PLACEHOLDER FILE — All `value` / `values` fields are TODO strings.
 *     The puzzle/AR team must replace every TODO_ANSWER_* before the event.
 *
 * The TypeScript structure (mode, shape) is final; only content changes needed.
 */

import type { FragmentAnswerDef } from "../schema.js";

export const FRAGMENT_ANSWERS: FragmentAnswerDef[] = [
  {
    fragmentId: "F01",
    answer: { mode: "exact", value: "TODO_ANSWER_F01", caseSensitive: false },
  },
  {
    fragmentId: "F02",
    answer: { mode: "exact", value: "TODO_ANSWER_F02", caseSensitive: false },
  },
  {
    fragmentId: "F03",
    answer: {
      mode: "sequence",
      values: ["TODO_ANSWER_F03_A", "TODO_ANSWER_F03_B", "TODO_ANSWER_F03_C"],
    },
  },
  {
    fragmentId: "F04",
    answer: { mode: "exact", value: "TODO_ANSWER_F04", caseSensitive: false },
  },
  {
    fragmentId: "F05",
    answer: {
      mode: "set",
      values: ["TODO_ANSWER_F05_A", "TODO_ANSWER_F05_B"],
    },
  },
  {
    // TODO: Set real numeric value and tolerance before event.
    fragmentId: "F06",
    answer: { mode: "numeric", value: 0, tolerance: 0 },
  },
  {
    fragmentId: "F07",
    answer: { mode: "exact", value: "TODO_ANSWER_F07", caseSensitive: false },
  },
];

/** Returns the answer definition for a given fragmentId, or undefined. */
export function getFragmentAnswer(fragmentId: string): FragmentAnswerDef | undefined {
  return FRAGMENT_ANSWERS.find((a) => a.fragmentId === fragmentId);
}
