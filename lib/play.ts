import { connectDB } from './db';
import { matches } from './norm';
import { verifyCp } from './hmac';
import { sealForAnswers } from './seal';
import { CP_COUNT, nextCheckpoint } from './game';
import { Checkpoint, Progress, Settings, Team, logEvent, type CheckpointDoc, type SettingsDoc } from '@/models';
import type { GameState, LocateInfo, Phase, PuzzleInfo } from './types';

// Database-backed game actions. API routes authenticate, call one of these,
// and return the result. Every state change writes an event row.

type Lean<T> = T & { _id: unknown };

let settingsCache: { at: number; value: SettingsDoc } | null = null;

export async function getSettings(): Promise<SettingsDoc> {
  if (settingsCache && Date.now() - settingsCache.at < 30_000) return settingsCache.value;
  await connectDB();
  const s = await Settings.findOne({ key: 'game' }).lean<SettingsDoc>();
  if (!s) throw new Error('Game settings missing — run `npm run seed`');
  settingsCache = { at: Date.now(), value: s };
  return s;
}

/** Accepted answers for a team's batch; per-batch variants override the default list. */
export function answersFor(cp: CheckpointDoc, batch: number): string[] {
  const override = (cp.answersByBatch as Record<string, string[]> | undefined)?.[String(batch)];
  return override?.length ? override : cp.answers;
}

/** What the location card shows. Never includes the rest of the route. */
function locateCard(cp: CheckpointDoc, index: number): LocateInfo {
  return { cpId: cp.cpId, index, total: CP_COUNT, locationHint: cp.locationHint, hook: cp.hook };
}

async function loadTeam(teamId: string) {
  await connectDB();
  return Team.findOne({ teamId }).lean();
}

async function solvedIds(teamId: string): Promise<number[]> {
  const rows = await Progress.find({ teamId, status: 'solved' }, { cpId: 1 }).lean();
  return rows.map((r) => r.cpId);
}

// ---------------------------------------------------------------------------
// GET /api/state
// ---------------------------------------------------------------------------

export async function buildState(teamId: string): Promise<GameState | null> {
  const team = await loadTeam(teamId);
  if (!team) return null;
  const settings = await getSettings();
  const [progress, checkpoints] = await Promise.all([
    Progress.find({ teamId }).lean(),
    Checkpoint.find({}).lean<Lean<CheckpointDoc>[]>(),
  ]);
  const cpById = new Map(checkpoints.map((c) => [c.cpId, c]));
  const solved = progress.filter((p) => p.status === 'solved').sort((a, b) => +a.solvedAt! - +b.solvedAt!);
  const solvedSet = new Set(solved.map((p) => p.cpId));
  const next = nextCheckpoint(team.routeOffset, solvedSet);

  const fragments = solved.map((p, i) => {
    const cp = cpById.get(p.cpId);
    return { order: i + 1, cpId: p.cpId, title: cp?.title ?? '', text: cp?.fragment ?? '' };
  });

  const base = {
    serverNow: Date.now(),
    team: { teamId: team.teamId, name: team.name, batch: team.batch },
    game: {
      title: settings.title,
      intro: settings.intro,
      hintPenaltyMinutes: settings.hintPenaltyMinutes,
      cooldownSeconds: settings.cooldownSeconds,
      finalPrompt: settings.finalPrompt,
      councilRoom: settings.councilRoom,
    },
    solvedCount: solved.length,
    total: CP_COUNT,
    fragments,
  };

  if (!team.startedAt) return { ...base, phase: 'waiting' as Phase };

  if (next === null) {
    if (team.finishedAt) return { ...base, phase: 'finished' as Phase };
    if (team.vrReadyAt) {
      const ahead = await Team.countDocuments({
        vrReadyAt: { $ne: null, $lt: team.vrReadyAt },
        finishedAt: null,
      });
      return { ...base, phase: 'vr-ready' as Phase, queuePosition: ahead + 1 };
    }
    const cooldownUntil = team.lastFinalAttemptAt
      ? +team.lastFinalAttemptAt + settings.cooldownSeconds * 1000
      : 0;
    return { ...base, phase: 'final' as Phase, cooldownUntil };
  }

  const cp = cpById.get(next);
  if (!cp) throw new Error(`Checkpoint ${next} missing — reseed`);
  const current = locateCard(cp, solved.length + 1);
  const open = progress.find((p) => p.cpId === next && p.status === 'open');
  if (!open) return { ...base, phase: 'locate' as Phase, current };

  // Puzzle open: include only what this checkpoint needs, plus sealed
  // offline data (hashes, never plaintext answers).
  const after = nextCheckpoint(team.routeOffset, [...solvedSet, next]);
  const afterCp = after !== null ? cpById.get(after) : undefined;
  const reveal = {
    fragment: cp.fragment,
    title: cp.title,
    next: afterCp ? locateCard(afterCp, solved.length + 2) : null,
  };
  return {
    ...base,
    phase: 'puzzle' as Phase,
    current,
    puzzle: {
      cpId: cp.cpId,
      title: cp.title,
      type: cp.type as PuzzleInfo['type'],
      prompt: cp.prompt,
      media: (cp.media ?? {}) as PuzzleInfo['media'],
      hints: cp.hints.slice(0, open.hintsUsed),
      hintsTotal: cp.hints.length,
      attempts: open.attempts,
      cooldownUntil: open.lastAttemptAt ? +open.lastAttemptAt + settings.cooldownSeconds * 1000 : 0,
      offline: { salt: cp.salt, sealed: sealForAnswers(cp.salt, answersFor(cp, team.batch), reveal) },
    },
  };
}


// ---------------------------------------------------------------------------
// Scan: /c/[cpId]?t=... and POST /api/scan
// ---------------------------------------------------------------------------

export type ScanResult = 'ok' | 'invalid' | 'not-started' | 'already' | 'wrong' | 'done' | 'unknown-team';

export async function scan(teamId: string, cpId: number, token: string | null): Promise<ScanResult> {
  const team = await loadTeam(teamId);
  if (!team) return 'unknown-team';
  if (!Number.isInteger(cpId) || !verifyCp(cpId, token)) {
    await logEvent(teamId, 'scan-rejected', Number.isInteger(cpId) ? cpId : null, { reason: 'bad-signature' });
    return 'invalid';
  }
  if (!team.startedAt) return 'not-started';
  const solved = await solvedIds(teamId);
  if (solved.includes(cpId)) return 'already';
  const next = nextCheckpoint(team.routeOffset, solved);
  if (next === null) return 'done';
  if (cpId !== next) {
    await logEvent(teamId, 'scan-rejected', cpId, { reason: 'out-of-sequence', expected: next });
    return 'wrong';
  }
  try {
    const res = await Progress.updateOne(
      { teamId, cpId },
      { $setOnInsert: { status: 'open', openedAt: new Date(), attempts: 0, hintsUsed: 0 } },
      { upsert: true },
    );
    if (res.upsertedCount) await logEvent(teamId, 'scan', cpId);
  } catch (e: unknown) {
    // Two phones scanning at once: the unique index rejects the duplicate.
    if ((e as { code?: number }).code !== 11000) throw e;
  }
  return 'ok';
}

// ---------------------------------------------------------------------------
// POST /api/answer
// ---------------------------------------------------------------------------

export type AnswerInput = {
  cpId: number;
  answer: string;
  offline?: boolean;
  localVerdict?: 'correct' | 'wrong';
  offlineWrong?: number;
  clientAt?: number;
};

export type AnswerResult =
  | { status: 200; correct: true; fragment: string; title: string; next: LocateInfo | null }
  | { status: 200; correct: false; cooldownUntil: number; attempts: number }
  | { status: 409; error: string; reason: 'not-open' | 'not-started' | 'already-solved' }
  | { status: 429; error: string; cooldownUntil: number };

export async function submitAnswer(teamId: string, input: AnswerInput): Promise<AnswerResult> {
  const team = await loadTeam(teamId);
  if (!team?.startedAt) return { status: 409, error: 'Not released yet', reason: 'not-started' };
  const [settings, cp] = await Promise.all([getSettings(), Checkpoint.findOne({ cpId: input.cpId }).lean()]);
  if (!cp) return { status: 409, error: 'Checkpoint not open', reason: 'not-open' };

  const now = new Date();
  const cooldownMs = settings.cooldownSeconds * 1000;
  const correct = matches(input.answer, answersFor(cp, team.batch));

  // Atomic conditional update: the row changes only if it is still open and
  // outside the cooldown, so four phones submitting at once record one result.
  // Offline submissions skip the cooldown — they were already rate-limited on
  // the phone, and the local hash makes brute force possible offline anyway.
  const filter: Record<string, unknown> = { teamId, cpId: input.cpId, status: 'open' };
  if (!input.offline) {
    filter.$or = [{ lastAttemptAt: null }, { lastAttemptAt: { $lte: new Date(+now - cooldownMs) } }];
  }
  const update = correct
    ? { $set: { status: 'solved', solvedAt: now, lastAttemptAt: now, solvedVia: input.offline ? 'offline' : 'answer' }, $inc: { attempts: 1 } }
    : { $set: { lastAttemptAt: now }, $inc: { attempts: 1 } };
  const row = await Progress.findOneAndUpdate(filter, update, { new: true }).lean();

  if (!row) {
    const existing = await Progress.findOne({ teamId, cpId: input.cpId }).lean();
    if (!existing) return { status: 409, error: 'Checkpoint not open', reason: 'not-open' };
    if (existing.status === 'solved') {
      // A teammate got there first — show the same success screen.
      if (correct) return { status: 200, correct: true, ...(await revealAfter(team.routeOffset, teamId, cp)) };
      return { status: 409, error: 'Already solved', reason: 'already-solved' };
    }
    const until = +(existing.lastAttemptAt ?? now) + cooldownMs;
    return { status: 429, error: 'Cooling down', cooldownUntil: until };
  }

  await logEvent(teamId, 'attempt', input.cpId, {
    correct,
    answer: input.answer.slice(0, 200),
    offline: !!input.offline,
    ...(input.offlineWrong ? { offlineWrong: input.offlineWrong } : {}),
    ...(input.clientAt ? { clientAt: input.clientAt } : {}),
  });
  if (input.offline && input.localVerdict === 'correct' && !correct) {
    await logEvent(teamId, 'offline-mismatch', input.cpId, { answer: input.answer.slice(0, 200) });
  }
  if (!correct) return { status: 200, correct: false, cooldownUntil: +now + cooldownMs, attempts: row.attempts };

  await logEvent(teamId, 'solve', input.cpId, { via: input.offline ? 'offline' : 'answer' });
  return { status: 200, correct: true, ...(await revealAfter(team.routeOffset, teamId, cp)) };
}

async function revealAfter(routeOffset: number, teamId: string, cp: CheckpointDoc) {
  const solved = await solvedIds(teamId);
  const after = nextCheckpoint(routeOffset, solved);
  const afterCp = after !== null ? await Checkpoint.findOne({ cpId: after }).lean() : null;
  return {
    fragment: cp.fragment,
    title: cp.title,
    next: afterCp ? locateCard(afterCp, solved.length + 1) : null,
  };
}

// ---------------------------------------------------------------------------
// POST /api/hint
// ---------------------------------------------------------------------------

export type HintResult =
  | { status: 200; hint: string; index: number; hintsUsed: number }
  | { status: 409; error: string };

/** `index` is the hint the player is asking for, so a double tap costs one penalty. */
export async function takeHint(teamId: string, cpId: number, index: number): Promise<HintResult> {
  await connectDB();
  const cp = await Checkpoint.findOne({ cpId }).lean();
  if (!cp || !Number.isInteger(index) || index < 0 || index >= cp.hints.length) {
    return { status: 409, error: 'No more hints here' };
  }
  const row = await Progress.findOneAndUpdate(
    { teamId, cpId, status: 'open', hintsUsed: index },
    { $inc: { hintsUsed: 1 } },
    { new: true },
  ).lean();
  if (row) {
    await logEvent(teamId, 'hint', cpId, { index });
    return { status: 200, hint: cp.hints[index], index, hintsUsed: row.hintsUsed };
  }
  const existing = await Progress.findOne({ teamId, cpId }).lean();
  if (existing && existing.hintsUsed > index) {
    return { status: 200, hint: cp.hints[index], index, hintsUsed: existing.hintsUsed };
  }
  return { status: 409, error: 'Checkpoint not open' };
}

// ---------------------------------------------------------------------------
// POST /api/final
// ---------------------------------------------------------------------------

export type FinalResult =
  | { status: 200; correct: boolean; cooldownUntil?: number }
  | { status: 409; error: string }
  | { status: 429; error: string; cooldownUntil: number };

export async function submitFinal(teamId: string, code: string): Promise<FinalResult> {
  const team = await loadTeam(teamId);
  if (!team?.startedAt) return { status: 409, error: 'Not released yet' };
  if (team.vrReadyAt) return { status: 200, correct: true };
  const solved = await solvedIds(teamId);
  if (nextCheckpoint(team.routeOffset, solved) !== null) return { status: 409, error: 'Fragments missing' };

  const settings = await getSettings();
  const now = new Date();
  const cooldownMs = settings.cooldownSeconds * 1000;
  const correct = matches(code, settings.finalAnswers);
  const row = await Team.findOneAndUpdate(
    {
      teamId,
      vrReadyAt: null,
      $or: [{ lastFinalAttemptAt: null }, { lastFinalAttemptAt: { $lte: new Date(+now - cooldownMs) } }],
    },
    { $set: { lastFinalAttemptAt: now, ...(correct ? { vrReadyAt: now } : {}) } },
    { new: true },
  ).lean();
  if (!row) {
    const t = await loadTeam(teamId);
    if (t?.vrReadyAt) return { status: 200, correct: true };
    return { status: 429, error: 'Cooling down', cooldownUntil: +(t?.lastFinalAttemptAt ?? now) + cooldownMs };
  }
  await logEvent(teamId, 'final-attempt', null, { correct, code: code.slice(0, 200) });
  if (correct) await logEvent(teamId, 'final', null);
  return correct ? { status: 200, correct: true } : { status: 200, correct: false, cooldownUntil: +now + cooldownMs };
}

