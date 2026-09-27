import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connectDB } from '@/lib/db';
import { orderFor } from '@/lib/game';
import { GameEvent, Location, Progress, Team } from '@/models';

export const dynamic = 'force-dynamic';

// Per-team event log, for settling disputes: exactly what happened, in order.
export default async function TeamLog({ params }: { params: { teamId: string } }) {
  await connectDB();
  const teamId = params.teamId.toUpperCase();
  const team = await Team.findOne({ teamId }).lean();
  if (!team) notFound();
  const [events, progress, trail] = await Promise.all([
    GameEvent.find({ teamId }).sort({ at: 1 }).lean(),
    Progress.find({ teamId }).lean(),
    Location.find({ teamId }).sort({ at: -1 }).limit(40).lean(),
  ]);
  const t = (d: Date | null | undefined) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour12: false }) : '–');

  return (
    <div className="px-4 py-4 text-sm">
      <Link href={`/admin?batch=${team.batch}`} className="underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-xl font-bold">
        {team.teamId} · {team.name}
      </h1>
      <p className="mt-1 text-gray-700">
        Batch {team.batch}, wave {team.wave}, route {orderFor(team.routeOffset).join(' → ')}. Started {t(team.startedAt)}, final code{' '}
        {t(team.vrReadyAt)}, finished {t(team.finishedAt)}.
      </p>
      <p className="mt-1 text-gray-700">
        Progress:{' '}
        {progress
          .sort((a, b) => a.cpId - b.cpId)
          .map((p) => `CP${p.cpId} ${p.status}${p.solvedVia && p.solvedVia !== 'answer' ? ` (${p.solvedVia})` : ''}, ${p.attempts} tries, ${p.hintsUsed} hints`)
          .join(' · ') || 'none'}
      </p>
      <p className="mt-1 text-gray-700">
        Phone: {team.activeSession ? `logged in since ${t(team.sessionAt)}` : 'none logged in'}
        {team.device ? ` · ${team.device}` : ''}. Last seen {t(team.lastSeenAt)}.
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer font-semibold">Location trail (latest {trail.length})</summary>
        <ol className="mt-2 font-mono text-xs">
          {trail.map((p) => (
            <li key={String(p._id)}>
              {t(p.at)}{' '}
              <a className="underline" href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noopener">
                {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
              </a>{' '}
              ±{p.accuracy}m
            </li>
          ))}
        </ol>
      </details>
      <table className="mt-4 w-full border-collapse">
        <thead className="border-b-2 border-gray-900 text-left">
          <tr>
            <th className="px-2 py-1">Time</th>
            <th className="px-2">Type</th>
            <th className="px-2">CP</th>
            <th className="px-2">Details</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={String(e._id)} className={`border-b border-gray-200 ${e.type === 'override' || e.type === 'reset' ? 'bg-blue-50' : e.type === 'offline-mismatch' || e.type === 'tab-hidden' || e.type === 'login-blocked' ? 'bg-red-100' : ''}`}>
              <td className="whitespace-nowrap px-2 py-1 font-mono">{t(e.at)}</td>
              <td className="px-2">{e.type}</td>
              <td className="px-2">{e.cpId ?? ''}</td>
              <td className="px-2 font-mono text-xs">{Object.keys(e.payload ?? {}).length ? JSON.stringify(e.payload) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
