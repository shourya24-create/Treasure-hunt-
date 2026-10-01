/**
 * hints.ts — Hint text for each fragment at each of 3 levels.
 *
 * ⚠️  PLACEHOLDER FILE — All hint strings are TODO_HINT_* placeholders.
 *     The puzzle/AR team must replace these before the event.
 *
 * Level 1 = gentle nudge, level 2 = stronger, level 3 = near-reveal.
 */

export interface HintSet {
  fragmentId: string;
  /** Index 0 = level 1, index 1 = level 2, index 2 = level 3. */
  hints: [string, string, string];
}

export const FRAGMENT_HINTS: HintSet[] = [
  { fragmentId: "F01", hints: ["TODO_HINT_F01_L1", "TODO_HINT_F01_L2", "TODO_HINT_F01_L3"] },
  { fragmentId: "F02", hints: ["TODO_HINT_F02_L1", "TODO_HINT_F02_L2", "TODO_HINT_F02_L3"] },
  { fragmentId: "F03", hints: ["TODO_HINT_F03_L1", "TODO_HINT_F03_L2", "TODO_HINT_F03_L3"] },
  { fragmentId: "F04", hints: ["TODO_HINT_F04_L1", "TODO_HINT_F04_L2", "TODO_HINT_F04_L3"] },
  { fragmentId: "F05", hints: ["TODO_HINT_F05_L1", "TODO_HINT_F05_L2", "TODO_HINT_F05_L3"] },
  { fragmentId: "F06", hints: ["TODO_HINT_F06_L1", "TODO_HINT_F06_L2", "TODO_HINT_F06_L3"] },
  { fragmentId: "F07", hints: ["TODO_HINT_F07_L1", "TODO_HINT_F07_L2", "TODO_HINT_F07_L3"] },
  { fragmentId: "F08", hints: ["TODO_HINT_F08_L1", "TODO_HINT_F08_L2", "TODO_HINT_F08_L3"] },
];

/**
 * Returns the hint text for `fragmentId` at `level` (1–3).
 * Returns undefined if the fragmentId is unknown.
 */
export function getHint(fragmentId: string, level: 1 | 2 | 3): string | undefined {
  const set = FRAGMENT_HINTS.find((h) => h.fragmentId === fragmentId);
  return set?.hints[level - 1];
}
