// The game engine's pure core: route order, next checkpoint, elapsed time,
// ranking. No HTTP, no React, no database — so it can be tested in isolation.

export const CP_COUNT = 8;

/** A team's route: a start offset, walked forwards or (reverse) backwards round the loop. */
export type Route = number | { routeOffset: number; reverse?: boolean | null };

/**
 * Route order is derived, never stored: start at checkpoint offset+1 and walk
 * the loop. With 12 teams on 8 checkpoints, four pairs must share a start;
 * the second of each pair walks in reverse so they split after one stop.
 */
export function orderFor(route: Route, count = CP_COUNT): number[] {
  const offset = typeof route === 'number' ? route : route.routeOffset;
  const step = typeof route === 'object' && route.reverse ? -1 : 1;
  return Array.from({ length: count }, (_, i) => ((((offset + step * i) % count) + count) % count) + 1);
}

/** First checkpoint in the team's order not yet solved, or null when all are done. */
export function nextCheckpoint(route: Route, solved: Iterable<number>, count = CP_COUNT): number | null {
  const done = new Set(solved);
  return orderFor(route, count).find((cp) => !done.has(cp)) ?? null;
}

export type TimedTeam = { startedAt?: Date | null; finishedAt?: Date | null };
export type TimedEvent = { type: string; at: Date; payload?: Record<string, unknown> | null };

/** Only events after the most recent reset count towards the current run. */
export function currentRunEvents<T extends TimedEvent>(events: T[]): T[] {
  let lastReset = -Infinity;
  for (const e of events) if (e.type === 'reset' && +e.at > lastReset) lastReset = +e.at;
  return events.filter((e) => +e.at > lastReset);
}

export function hintCount(events: TimedEvent[]): number {
  return currentRunEvents(events).filter((e) => e.type === 'hint').length;
}

export function adjustmentMs(events: TimedEvent[]): number {
  return currentRunEvents(events)
    .filter((e) => e.type === 'override' && e.payload?.action === 'adjust-time')
    .reduce((sum, e) => sum + Number(e.payload?.deltaMs ?? 0), 0);
}

export function wrongAttempts(events: TimedEvent[]): number {
  return currentRunEvents(events).filter(
    (e) => (e.type === 'attempt' || e.type === 'final-attempt') && e.payload?.correct === false,
  ).length;
}

/**
 * Score is computed, never accumulated: (finish or now) − start
 * + hints × penalty + organiser adjustments. Server clock only.
 */
export function elapsedMs(team: TimedTeam, events: TimedEvent[], penaltyMs: number, now = new Date()): number {
  if (!team.startedAt) return 0;
  const end = team.finishedAt ?? now;
  const raw = +end - +team.startedAt;
  return Math.max(0, raw + hintCount(events) * penaltyMs + adjustmentMs(events));
}

export type RankInput = {
  teamId: string;
  finished: boolean;
  totalMs: number;
  wrongAttempts: number;
  solvedCount: number;
};

/**
 * Finishers first by total time ascending, ties broken by fewest wrong
 * attempts. Unfinished teams after, by checkpoints solved then time.
 */
export function rank<T extends RankInput>(rows: T[]): (T & { rank: number | null })[] {
  const finishers = rows
    .filter((r) => r.finished)
    .sort((a, b) => a.totalMs - b.totalMs || a.wrongAttempts - b.wrongAttempts || a.teamId.localeCompare(b.teamId));
  const rest = rows
    .filter((r) => !r.finished)
    .sort((a, b) => b.solvedCount - a.solvedCount || a.totalMs - b.totalMs || a.teamId.localeCompare(b.teamId));
  return [...finishers.map((r, i) => ({ ...r, rank: i + 1 })), ...rest.map((r) => ({ ...r, rank: null }))];
}

export function formatMs(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
