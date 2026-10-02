/**
 * stations.ts — Physical station code registry.
 *
 * ⚠️  PLACEHOLDER FILE — All codes are TODO_CODE_* strings.
 *     The facilitator team MUST replace these before every event run.
 *     Using placeholder codes in production will break station verification.
 *
 * Codes should be short, unambiguous (avoid I/O/0), and unique per event.
 */

/** Map of fragmentId → expected station code (case-insensitive comparison at runtime). */
export const STATION_CODES: Record<string, string> = {
  F01: "TODO_CODE_F01",
  F02: "TODO_CODE_F02",
  F03: "TODO_CODE_F03",
  F04: "TODO_CODE_F04",
  F05: "TODO_CODE_F05",
  F06: "TODO_CODE_F06",
  F07: "TODO_CODE_F07",
  F08: "TODO_CODE_F08",
};

/**
 * Returns true if `submitted` matches the expected code for `fragmentId`.
 * Comparison is case-insensitive and whitespace-trimmed.
 */
export function verifyStationCode(fragmentId: string, submitted: string): boolean {
  const expected = STATION_CODES[fragmentId];
  if (!expected) return false;
  return submitted.trim().toUpperCase() === expected.trim().toUpperCase();
}
