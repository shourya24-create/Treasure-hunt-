/**
 * chapters.ts — Echo's story chapters.
 *
 * ⚠️  PLACEHOLDER FILE — All strings are TODO_CHAPTER_* placeholders.
 *     The story team must replace these before the event.
 *
 * Keyed by STEP, never by checkpoint (GAMEPLAY.md §3): Chapter 1 plays after
 * CP1, Chapters 2–8 after campus steps 1–7. Every team hears them in this
 * order whatever its route, so a chapter must never mention a place, an
 * activity or a scan object.
 */

import type { ChapterView } from "../schema.js";

export const CHAPTER_COUNT = 8;

export const CHAPTERS: ChapterView[] = [
  { n: 1, title: "TODO_CHAPTER_TITLE_1", transcript: "TODO_CHAPTER_1", audioUrl: "TODO_CHAPTER_AUDIO_1" },
  { n: 2, title: "TODO_CHAPTER_TITLE_2", transcript: "TODO_CHAPTER_2", audioUrl: "TODO_CHAPTER_AUDIO_2" },
  { n: 3, title: "TODO_CHAPTER_TITLE_3", transcript: "TODO_CHAPTER_3", audioUrl: "TODO_CHAPTER_AUDIO_3" },
  { n: 4, title: "TODO_CHAPTER_TITLE_4", transcript: "TODO_CHAPTER_4", audioUrl: "TODO_CHAPTER_AUDIO_4" },
  { n: 5, title: "TODO_CHAPTER_TITLE_5", transcript: "TODO_CHAPTER_5", audioUrl: "TODO_CHAPTER_AUDIO_5" },
  { n: 6, title: "TODO_CHAPTER_TITLE_6", transcript: "TODO_CHAPTER_6", audioUrl: "TODO_CHAPTER_AUDIO_6" },
  { n: 7, title: "TODO_CHAPTER_TITLE_7", transcript: "TODO_CHAPTER_7", audioUrl: "TODO_CHAPTER_AUDIO_7" },
  { n: 8, title: "TODO_CHAPTER_TITLE_8", transcript: "TODO_CHAPTER_8", audioUrl: "TODO_CHAPTER_AUDIO_8" },
];

/** Returns chapter `n` (1–8). */
export function getChapter(n: number): ChapterView {
  const chapter = CHAPTERS.find((c) => c.n === n);
  if (!chapter) throw new Error(`No chapter ${n}.`);
  return chapter;
}
