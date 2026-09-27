'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LiveRow, OverrideAction } from '@/lib/admin';
import { formatMs } from '@/lib/game';
import { useLive } from '@/components/admin/useLive';
import { TeamMap, markerColor } from '@/components/admin/TeamMap';

type SortKey = 'teamId' | 'status' | 'solvedCount' | 'minutesOnCurrent' | 'attemptsHere' | 'hints' | 'totalMs';

const ACTIONS: { action: OverrideAction; label: string; danger?: boolean }[] = [
  { action: 'release', label: 'Release team' },
  { action: 'unlock-next', label: 'Force-unlock next checkpoint' },
  { action: 'mark-solved', label: 'Mark current checkpoint solved' },
  { action: 'adjust-time', label: 'Adjust time' },
  { action: 'vr-complete', label: 'Confirm VR complete (stops clock)' },
  { action: 'unfinish', label: 'Undo VR complete' },
  { action: 'resolve-flags', label: 'Resolve offline flags' },
  { action: 'unlock-login', label: 'Unlock login (switch phone)' },
  { action: 'reset', label: 'Reset team (wipes progress)', danger: true },
];

function statusLabel(r: LiveRow): string {
  switch (r.status) {
    case 'waiting': return 'Not released';
    case 'locate': return `Walking to CP ${r.currentCp}`;
    case 'puzzle': return `Solving CP ${r.currentCp}`;
    case 'final': return 'Final code';
    case 'vr-queue': return `VR queue #${r.vrQueuePosition}`;
    case 'finished': return 'Finished';
  }
}

type Pending = { action: OverrideAction; teamId?: string; batch?: number; label: string };

function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const batch = params.get('batch') ?? '1';
  const { data, refresh, stale } = useLive(batch);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'teamId', dir: 1 });
  const [pending, setPending] = useState<Pending | null>(null);
  const [toast, setToast] = useState('');
  const [showMap, setShowMap] = useState(true);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const rows = useMemo(() => {
    const list = [...(data?.teams ?? [])];
    return list.sort((a, b) => {
      const av = a[sort.key] ?? '';
      const bv = b[sort.key] ?? '';
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
  }, [data, sort]);

  const vrQueue = (data?.teams ?? []).filter((t) => t.status === 'vr-queue').sort((a, b) => a.vrQueuePosition! - b.vrQueuePosition!);
  const released = (data?.teams ?? []).some((t) => t.status !== 'waiting');

  const th = (key: SortKey, label: string) => (
    <th className="cursor-pointer select-none whitespace-nowrap px-2 py-2 text-left font-semibold" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }))}>
      {label}
      {sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <div className="px-4 py-4 text-sm">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-4 text-xl font-bold">ECHO Control Room</h1>
        <label className="flex items-center gap-2">
          Batch
          <select value={batch} onChange={(e) => router.replace(`/admin?batch=${e.target.value}`)} className="h-9 rounded border border-gray-300 px-2">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="all">All</option>
          </select>
        </label>
        {data?.batches
          .filter((b) => batch === 'all' || String(b.batch) === batch)
          .map((b) => (
            <button
              key={b.batch}
              disabled={b.released === b.size}
              onClick={() => setPending({ action: 'release-batch', batch: b.batch, label: `Release batch ${b.batch}: start the clock for ${b.size - b.released} teams` })}
              className="h-9 rounded bg-green-700 px-3 font-semibold text-white disabled:bg-gray-300 disabled:text-gray-600"
            >
              {b.released === b.size ? `Batch ${b.batch} released` : `Release batch ${b.batch}`}
            </button>
          ))}
        <span className="ml-auto flex gap-3">
          <Link href={`/admin/board?batch=${batch}`} className="underline" target="_blank">
            Leaderboard ↗
          </Link>
          <a href={`/api/admin/export?batch=${batch}`} className="underline">
            Export CSV
          </a>
          <button
            className="underline"
            onClick={async () => {
              await fetch('/api/admin/logout', { method: 'POST' });
              window.location.assign('/admin/login');
            }}
          >
            Sign out
          </button>
        </span>
      </header>

      {stale && (
        <div role="alert" className="mb-3 rounded border border-red-700 bg-red-50 px-3 py-2 font-semibold text-red-800">
          ⚠ Live data is stale. Polling has failed for over 15 seconds. Check this laptop&apos;s connection.
        </div>
      )}
      {toast && <div className="mb-3 rounded border border-gray-400 bg-gray-50 px-3 py-2">{toast}</div>}

      {!data ? (
        <p>Loading…</p>
      ) : (
        <>
          {!released && <p className="mb-3 text-gray-600">No team in this view has been released yet.</p>}
          {data.teams.some((t) => t.awayNow && t.status !== 'waiting' && t.status !== 'finished') && (
            <div role="alert" className="mb-3 rounded border border-red-700 bg-red-600 px-3 py-2 font-semibold text-white">
              🚨 Off the game page right now:{' '}
              {data.teams
                .filter((t) => t.awayNow && t.status !== 'waiting' && t.status !== 'finished')
                .map((t) => t.teamId)
                .join(', ')}
            </div>
          )}
          <section className="mb-4">
            <button className="mb-2 font-semibold underline" onClick={() => setShowMap((v) => !v)}>
              {showMap ? '▾' : '▸'} Live map ({data.teams.filter((t) => t.location).length}/{data.teams.length} located)
            </button>
            {showMap && (
              <>
                <TeamMap rows={data.teams} center={data.settings.campusCenter} now={now} />
                <p className="mt-1 text-xs text-gray-600">
                  Green = fix under 30s old · amber = 30s to 2 min · grey = older or none · red = phone off the game page. Circle = GPS accuracy.
                </p>
              </>
            )}
          </section>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b-2 border-gray-900">
                <tr>
                  {th('teamId', 'Team')}
                  <th className="px-2 text-left">Batch</th>
                  {th('status', 'Status')}
                  {th('solvedCount', 'Solved')}
                  {th('minutesOnCurrent', 'Min here')}
                  {th('attemptsHere', 'Attempts')}
                  {th('hints', 'Hints')}
                  {th('totalMs', 'Elapsed')}
                  <th className="px-2 text-left">Phone / GPS</th>
                  <th className="px-2 text-left">Left page</th>
                  <th className="px-2 text-left">Flags</th>
                  <th className="px-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.teamId}
                    className={`border-b border-gray-200 ${r.flag === 'red' ? 'bg-red-100' : r.flag === 'amber' ? 'bg-amber-100' : ''}`}
                  >
                    <td className="px-2 py-1.5 font-semibold">
                      <Link href={`/admin/team/${r.teamId}`} className="underline">
                        {r.teamId}
                      </Link>{' '}
                      <span className="font-normal text-gray-600">{r.name}</span>
                    </td>
                    <td className="px-2">
                      {r.batch}
                    </td>
                    <td className="px-2">{statusLabel(r)}</td>
                    <td className="px-2">
                      {r.solvedCount}/{data.total}
                    </td>
                    <td className="px-2 font-semibold">
                      {r.minutesOnCurrent ? Math.floor(r.minutesOnCurrent) : '–'}
                      {r.flag === 'red' ? ' STUCK' : r.flag === 'amber' ? ' slow' : ''}
                    </td>
                    <td className="px-2">{r.status === 'puzzle' ? r.attemptsHere : '–'}</td>
                    <td className="px-2">{r.hints}</td>
                    <td className="px-2 font-mono">{r.startedAt ? formatMs(r.totalMs) : '–'}</td>
                    <td className="whitespace-nowrap px-2">
                      {!r.loggedIn ? (
                        <span className="text-gray-500">No phone</span>
                      ) : r.location ? (
                        <a
                          href={`https://www.google.com/maps?q=${r.location.lat},${r.location.lng}`}
                          target="_blank"
                          rel="noopener"
                          className="underline"
                          title={r.device ?? ''}
                        >
                          <span style={{ color: markerColor(r, now) }}>●</span> ±{r.location.accuracy}m · {Math.round((now - r.location.at) / 1000)}s
                        </a>
                      ) : (
                        <span className={r.locationDenied ? 'font-semibold text-red-700' : 'text-amber-700'}>{r.locationDenied ? 'GPS denied' : 'No fix yet'}</span>
                      )}
                      {r.blockedLogins > 0 && <span className="ml-1 text-red-700" title="Other phones tried to log in">+{r.blockedLogins} blocked</span>}
                    </td>
                    <td className={`whitespace-nowrap px-2 ${r.awayNow ? 'bg-red-600 font-bold text-white' : r.tabSwitches ? 'font-semibold text-red-700' : ''}`}>
                      {r.awayNow ? 'AWAY NOW' : r.tabSwitches ? `${r.tabSwitches}× · ${Math.round(r.awayMs / 1000)}s` : '–'}
                    </td>
                    <td className="px-2">{r.mismatches > 0 && <span className="font-semibold text-red-700">⚠ {r.mismatches} offline mismatch</span>}</td>
                    <td className="px-2">
                      <select
                        value=""
                        onChange={(e) => {
                          const a = ACTIONS.find((x) => x.action === e.target.value);
                          if (a) setPending({ action: a.action, teamId: r.teamId, label: `${a.label}: ${r.teamId}` });
                        }}
                        className="h-8 rounded border border-gray-300 px-1"
                        aria-label={`Actions for ${r.teamId}`}
                      >
                        <option value="">Action…</option>
                        {ACTIONS.map((a) => (
                          <option key={a.action} value={a.action}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="mt-6">
            <h2 className="mb-2 text-base font-bold">VR queue ({vrQueue.length})</h2>
            {vrQueue.length === 0 ? (
              <p className="text-gray-600">Nobody waiting.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {vrQueue.map((r) => (
                  <li key={r.teamId} className="flex items-center gap-3">
                    <span className="w-6 font-semibold">{r.vrQueuePosition}.</span>
                    <span className="w-40">
                      {r.teamId} {r.name}
                    </span>
                    <button
                      onClick={() => setPending({ action: 'vr-complete', teamId: r.teamId, label: `Confirm VR complete: ${r.teamId}` })}
                      className="h-8 rounded bg-gray-900 px-3 text-white"
                    >
                      VR complete, stop clock
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <p className="mt-6 text-gray-500">
            Amber at {data.settings.amberMinutes} min on one step, red at {data.settings.redMinutes}. Hint penalty {data.settings.hintPenaltyMinutes} min.
            Refreshes every 5s.
          </p>
        </>
      )}

      {pending && (
        <OverrideDialog
          pending={pending}
          onClose={() => setPending(null)}
          onDone={(msg) => {
            setPending(null);
            setToast(msg);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function OverrideDialog({ pending, onClose, onDone }: { pending: Pending; onClose: () => void; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const needsMinutes = pending.action === 'adjust-time';
  const danger = pending.action === 'reset';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: pending.action,
        teamId: pending.teamId,
        batch: pending.batch,
        reason,
        minutes: needsMinutes ? Number(minutes) : undefined,
      }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok) onDone(`Done: ${pending.label}${data?.affected?.length > 1 ? ` (${data.affected.length} teams)` : ''}`);
    else {
      setError(data?.error ?? 'Network error');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="flex w-full max-w-md flex-col gap-3 rounded bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold">{pending.label}</h2>
        {danger && <p className="font-semibold text-red-700">This clears all progress and the clock for this team. The event log keeps the history.</p>}
        {needsMinutes && (
          <label className="flex flex-col gap-1">
            Minutes (negative subtracts)
            <input type="number" step="0.5" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="h-10 rounded border border-gray-300 px-2" autoFocus />
          </label>
        )}
        <label className="flex flex-col gap-1">
          Reason (goes in the event log)
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="h-10 rounded border border-gray-300 px-2" autoFocus={!needsMinutes} placeholder="e.g. QR at CP3 torn" />
        </label>
        {error && <p className="text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button
            disabled={busy || !reason.trim() || (needsMinutes && !Number(minutes))}
            className={`h-10 flex-1 rounded font-semibold text-white disabled:opacity-40 ${danger ? 'bg-red-700' : 'bg-gray-900'}`}
          >
            {busy ? 'Applying…' : 'Confirm'}
          </button>
          <button type="button" onClick={onClose} className="h-10 flex-1 rounded border border-gray-300">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
