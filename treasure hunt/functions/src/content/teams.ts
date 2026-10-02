/**
 * teams.ts — The 12 teams: route, login code and gate code.
 *
 * ⚠️  PLACEHOLDER FILE — All codes are TODO_* strings.
 *     The club MUST replace these before every event run.
 *     Codes should be short, unambiguous (avoid I/O/0) and unique per team.
 *
 * Routes are the table in GAMEPLAY.md §5.3 and are not placeholders:
 * T1–T7 walk the loop forwards, T8–T12 in reverse.
 *
 *   loginCode  typed once to bind the team to its one phone (§4.1)
 *   gateCode   handed over by a volunteer after the CP1 paper is solved (§4.2)
 *
 * Codes stay in this file and are never written to Firestore.
 */

import type { RouteSpec, TeamId } from "../schema.js";

export interface TeamConfig {
  name: string;
  route: RouteSpec;
  loginCode: string;
  gateCode: string;
}

export const TEAMS: Record<TeamId, TeamConfig> = {
  T1: { name: "T1", route: { start: "CP2", direction: "forward" }, loginCode: "TODO_LOGIN_T1", gateCode: "TODO_GATE_T1" },
  T2: { name: "T2", route: { start: "CP3", direction: "forward" }, loginCode: "TODO_LOGIN_T2", gateCode: "TODO_GATE_T2" },
  T3: { name: "T3", route: { start: "CP4", direction: "forward" }, loginCode: "TODO_LOGIN_T3", gateCode: "TODO_GATE_T3" },
  T4: { name: "T4", route: { start: "CP5", direction: "forward" }, loginCode: "TODO_LOGIN_T4", gateCode: "TODO_GATE_T4" },
  T5: { name: "T5", route: { start: "CP6", direction: "forward" }, loginCode: "TODO_LOGIN_T5", gateCode: "TODO_GATE_T5" },
  T6: { name: "T6", route: { start: "CP7", direction: "forward" }, loginCode: "TODO_LOGIN_T6", gateCode: "TODO_GATE_T6" },
  T7: { name: "T7", route: { start: "CP8", direction: "forward" }, loginCode: "TODO_LOGIN_T7", gateCode: "TODO_GATE_T7" },
  T8: { name: "T8", route: { start: "CP2", direction: "reverse" }, loginCode: "TODO_LOGIN_T8", gateCode: "TODO_GATE_T8" },
  T9: { name: "T9", route: { start: "CP4", direction: "reverse" }, loginCode: "TODO_LOGIN_T9", gateCode: "TODO_GATE_T9" },
  T10: { name: "T10", route: { start: "CP6", direction: "reverse" }, loginCode: "TODO_LOGIN_T10", gateCode: "TODO_GATE_T10" },
  T11: { name: "T11", route: { start: "CP8", direction: "reverse" }, loginCode: "TODO_LOGIN_T11", gateCode: "TODO_GATE_T11" },
  T12: { name: "T12", route: { start: "CP3", direction: "reverse" }, loginCode: "TODO_LOGIN_T12", gateCode: "TODO_GATE_T12" },
};

/** Case-insensitive, whitespace-trimmed code comparison. */
export function codeMatches(expected: string, submitted: string): boolean {
  return submitted.trim().toUpperCase() === expected.trim().toUpperCase();
}
