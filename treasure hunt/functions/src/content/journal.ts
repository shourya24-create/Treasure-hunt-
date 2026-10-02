/**
 * journal.ts — Journal / narrative content per fragment and game endings.
 *
 * ⚠️  PLACEHOLDER FILE — All strings are TODO_JOURNAL_* / TODO_ENDING_* placeholders.
 *     The story/AR team must replace these before the event.
 */

export interface JournalEntry {
  fragmentId: string;
  title: string;
  /** Multi-line narrative body shown in the Journal screen. */
  body: string;
}

export const JOURNAL_ENTRIES: JournalEntry[] = [
  { fragmentId: "F01", title: "TODO_JOURNAL_TITLE_F01", body: "TODO_JOURNAL_BODY_F01" },
  { fragmentId: "F02", title: "TODO_JOURNAL_TITLE_F02", body: "TODO_JOURNAL_BODY_F02" },
  { fragmentId: "F03", title: "TODO_JOURNAL_TITLE_F03", body: "TODO_JOURNAL_BODY_F03" },
  { fragmentId: "F04", title: "TODO_JOURNAL_TITLE_F04", body: "TODO_JOURNAL_BODY_F04" },
  { fragmentId: "F05", title: "TODO_JOURNAL_TITLE_F05", body: "TODO_JOURNAL_BODY_F05" },
  { fragmentId: "F06", title: "TODO_JOURNAL_TITLE_F06", body: "TODO_JOURNAL_BODY_F06" },
  { fragmentId: "F07", title: "TODO_JOURNAL_TITLE_F07", body: "TODO_JOURNAL_BODY_F07" },
  { fragmentId: "F08", title: "TODO_JOURNAL_TITLE_F08", body: "TODO_JOURNAL_BODY_F08" },
];

/** Text shown on the final screen based on the team's ending choice. */
export const ENDINGS: Record<string, string> = {
  ISOLATE: "TODO_ENDING_ISOLATE",
  RELEASE: "TODO_ENDING_RELEASE",
};

/** Introductory briefing shown on the login/home screen. */
export const BRIEFING_TEXT = "TODO_BRIEFING_TEXT";

export function getJournalEntry(fragmentId: string): JournalEntry | undefined {
  return JOURNAL_ENTRIES.find((e) => e.fragmentId === fragmentId);
}
