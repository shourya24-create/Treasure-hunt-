import { connectDB } from './db';
import { getSettings } from './play';
import {
  CP_COUNT, currentRunEvents, elapsedMs, hintCount, nextCheckpoint, rank, wrongAttempts, type TimedEvent,
} from './game';
import { Checkpoint, GameEvent, Progress, Team, logEvent } from '@/models';

// ---------------------------------------------------------------------------
// Live table: GET /api/admin/live
// ---------------------------------------------------------------------------

export type TeamStatus = 'waiting' | 'locate' | 'puzzle' | 'final' | 'vr-queue' | 'finished';

export async function liveData(batch: number | 'all') {
  await connectDB();
  const settings = await getSettings();
  const penaltyMs = settings.hintPenaltyMinutes * 60_000;
  const filter = batch === 'all' ? {} : { batch };
  const teams = await Team.find(filter).sort({ teamId: 1 }).lean();
  const ids = teams.map((t) => t.teamId);
  const [progress, events, checkpoints] = await Promise.all([
    Progress.find({ teamId: { $in: ids } }).lean(),
    GameEvent.find({ teamId: { $in: ids } }, { teamId: 1, type: 1, at: 1, payload: 1, cpId: 1 }).lean(),
    Checkpoint.find({}, { cpId: 1, title: 1 }).lean(),
  ]);
  const titles = new Map(checkpoints.map((c) => [c.cpId, c.title]));
  const now = new Date();

  const vrQueue = teams
    .filter((t) => t.vrReadyAt && !t.finishedAt)
    .sort((a, b) => +a.vrReadyAt! - +b.vrReadyAt!)
    .map((t) => t.teamId);

  const rows = teams.map((t) => {
    const tp = progress.filter((p) => p.teamId === t.teamId);
    const te = events.filter((e) => e.teamId === t.teamId) as unknown as (TimedEvent & { cpId: number | null })[];
    const run = currentRunEvents(te);
    const solved = tp.filter((p) => p.status === 'solved');
    const next = nextCheckpoint(t.routeOffset, solved.map((p) => p.cpId));
    const open = next !== null ? tp.find((p) => p.cpId === next && p.status === 'open') : undefined;

    let status: TeamStatus;
    if (!t.startedAt) status = 'waiting';
    else if (t.finishedAt) status = 'finished';
    else if (t.vrReadyAt) status = 'vr-queue';
    else if (next === null) status = 'final';
    else status = open ? 'puzzle' : 'locate';

    // Time on the current step: since release or the last solve.
    const lastSolve = solved.reduce((m, p) => Math.max(m, +(p.solvedAt ?? 0)), 0);
    const since = t.startedAt ? Math.max(+t.startedAt, lastSolve) : 0;
    const active = status === 'locate' || status === 'puzzle' || status === 'final';
    const minutesOnCurrent = active ? (+now - since) / 60_000 : 0;

    // Offline verdicts the server disagreed with, since the last resolve.
    let lastResolve = 0;
    for (const e of run) if (e.type === 'override' && e.payload?.action === 'resolve-flags') lastResolve = Math.max(lastResolve, +e.at);
    const flags = run.filter((e) => e.type === 'offline-mismatch' && +e.at > lastResolve).length;

    return {
      teamId: t.teamId,
      name: t.name,
      batch: t.batch,
      wave: t.wave,
      routeOffset: t.routeOffset,
      status,
      solvedCount: solved.length,
      currentCp: next,
      currentTitle: next !== null ? titles.get(next) ?? '' : '',
      minutesOnCurrent,
      flag: !active ? null : minutesOnCurrent >= settings.redMinutes ? 'red' : minutesOnCurrent >= settings.amberMinutes ? 'amber' : null,
      attemptsHere: open?.attempts ?? 0,
      hintsHere: open?.hintsUsed ?? 0,
      hints: hintCount(te),
      wrongAttempts: wrongAttempts(te),
      totalMs: elapsedMs(t, te, penaltyMs, now),
      finished: !!t.finishedAt,
      startedAt: t.startedAt ? +t.startedAt : null,
      finishedAt: t.finishedAt ? +t.finishedAt : null,
      vrQueuePosition: vrQueue.includes(t.teamId) ? vrQueue.indexOf(t.teamId) + 1 : null,
      mismatches: flags,
    };
  });

  const waves = [...new Set(teams.map((t) => `${t.batch}:${t.wave}`))]
    .map((k) => {
      const [b, w] = k.split(':').map(Number);
      const members = teams.filter((t) => t.batch === b && t.wave === w);
      return { batch: b, wave: w, size: members.length, released: members.filter((t) => t.startedAt).length };
    })
    .sort((a, b) => a.batch - b.batch || a.wave - b.wave);

  return {
    serverNow: +now,
    total: CP_COUNT,
    settings: {
      hintPenaltyMinutes: settings.hintPenaltyMinutes,
      amberMinutes: settings.amberMinutes,
      redMinutes: settings.redMinutes,
    },
    waves,
    teams: rank(rows),
  };
}

export type LiveData = Awaited<ReturnType<typeof liveData>>;
export type LiveRow = LiveData['teams'][number];

// ---------------------------------------------------------------------------
// Overrides: POST /api/admin/override
// ---------------------------------------------------------------------------

export const OVERRIDE_ACTIONS = [
  'release', 'release-wave', 'unlock-next', 'mark-solved', 'adjust-time',
  'vr-complete', 'unfinish', 'reset', 'resolve-flags',
] as const;
export type OverrideAction = (typeof OVERRIDE_ACTIONS)[number];

export type OverrideInput = {
  action: OverrideAction;
  reason: string;
  teamId?: string;
  batch?: number;
  wave?: number;
  cpId?: number;
  minutes?: number;
};

export async function applyOverride(admin: string, input: OverrideInput): Promise<{ ok: true; affected: string[] } | { ok: false; error: string }> {
  await connectDB();
  const reason = input.reason?.trim();
  if (!reason) return { ok: false, error: 'A reason is required' };
  if (!OVERRIDE_ACTIONS.includes(input.action)) return { ok: false, error: 'Unknown action' };
  const now = new Date();
  const log = (teamId: string, cpId: number | null = null, extra: Record<string, unknown> = {}) =>
    logEvent(teamId, 'override', cpId, { action: input.action, by: admin, reason, ...extra });

  if (input.action === 'release-wave') {
    if (!Number.isInteger(input.batch) || !Number.isInteger(input.wave)) return { ok: false, error: 'batch and wave required' };
    const pending = await Team.find({ batch: input.batch, wave: input.wave, startedAt: null }, { teamId: 1 }).lean();
    const ids = pending.map((t) => t.teamId);
    await Team.updateMany({ teamId: { $in: ids }, startedAt: null }, { $set: { startedAt: now } });
    await Promise.all(ids.map((id) => log(id, null, { batch: input.batch, wave: input.wave })));
    return { ok: true, affected: ids };
  }

  const team = input.teamId ? await Team.findOne({ teamId: input.teamId }).lean() : null;
  if (!team) return { ok: false, error: 'Team not found' };
  const teamId = team.teamId;

  switch (input.action) {
    case 'release': {
      const res = await Team.updateOne({ teamId, startedAt: null }, { $set: { startedAt: now } });
      if (!res.modifiedCount) return { ok: false, error: 'Team already released' };
      await log(teamId);
      break;
    }
    case 'unlock-next': {
      if (!team.startedAt) return { ok: false, error: 'Release the team first' };
      const solved = (await Progress.find({ teamId, status: 'solved' }).lean()).map((p) => p.cpId);
      const next = nextCheckpoint(team.routeOffset, solved);
      if (next === null) return { ok: false, error: 'All checkpoints solved' };
      await Progress.updateOne(
        { teamId, cpId: next },
        { $setOnInsert: { status: 'open', openedAt: now, attempts: 0, hintsUsed: 0 } },
        { upsert: true },
      );
      await log(teamId, next);
      break;
    }
    case 'mark-solved': {
      if (!team.startedAt) return { ok: false, error: 'Release the team first' };
      const solved = (await Progress.find({ teamId, status: 'solved' }).lean()).map((p) => p.cpId);
      const cpId = input.cpId ?? nextCheckpoint(team.routeOffset, solved);
      if (cpId === null || cpId === undefined) return { ok: false, error: 'Nothing to solve' };
      if (solved.includes(cpId)) return { ok: false, error: `Checkpoint ${cpId} already solved` };
      await Progress.updateOne(
        { teamId, cpId },
        {
          $set: { status: 'solved', solvedAt: now, solvedVia: 'override' },
          $setOnInsert: { openedAt: now, attempts: 0, hintsUsed: 0 },
        },
        { upsert: true },
      );
      await log(teamId, cpId);
      await logEvent(teamId, 'solve', cpId, { via: 'override', by: admin });
      break;
    }
    case 'adjust-time': {
      const minutes = Number(input.minutes);
      if (!Number.isFinite(minutes) || minutes === 0) return { ok: false, error: 'Minutes must be a non-zero number' };
      await log(teamId, null, { deltaMs: Math.round(minutes * 60_000) });
      break;
    }
    case 'vr-complete': {
      if (!team.startedAt) return { ok: false, error: 'Team has not started' };
      if (team.finishedAt) return { ok: false, error: 'Already finished' };
      await Team.updateOne(
        { teamId },
        { $set: { finishedAt: now, vrCompleted: true, vrReadyAt: team.vrReadyAt ?? now } },
      );
      await log(teamId);
      break;
    }
    case 'unfinish': {
      await Team.updateOne({ teamId }, { $set: { finishedAt: null, vrCompleted: false } });
      await log(teamId);
      break;
    }
    case 'reset': {
      // Events stay (append-only); scoring only counts events after the reset.
      await Progress.deleteMany({ teamId });
      await Team.updateOne(
        { teamId },
        { $set: { startedAt: null, vrReadyAt: null, finishedAt: null, vrCompleted: false, lastFinalAttemptAt: null } },
      );
      await log(teamId);
      await logEvent(teamId, 'reset', null, { by: admin, reason });
      break;
    }
    case 'resolve-flags': {
      await log(teamId);
      break;
    }
  }
  return { ok: true, affected: [teamId] };
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export function toCsv(data: LiveData): string {
  const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : '');
  const header = [
    'rank', 'teamId', 'name', 'batch', 'wave', 'status', 'solved', 'totalMinutes',
    'hints', 'wrongAttempts', 'startedAt', 'finishedAt',
  ];
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = data.teams.map((r) =>
    [
      r.rank ?? 'DNF', r.teamId, r.name, r.batch, r.wave, r.status, r.solvedCount,
      (r.totalMs / 60_000).toFixed(2), r.hints, r.wrongAttempts, iso(r.startedAt), iso(r.finishedAt),
    ].map(esc).join(','),
  );
  return [header.join(','), ...lines].join('\n') + '\n';
}
