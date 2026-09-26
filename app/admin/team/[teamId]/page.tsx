import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connectDB } from '@/lib/db';
import { orderFor } from '@/lib/game';
import { GameEvent, Progress, Team } from '@/models';

export const dynamic = 'force-dynamic';

// Per-team event log, for settling disputes: exactly what happened, in order.
export default async function TeamLog({ params }: { params: { teamId: string } }) {
  await connectDB();
  const teamId = params.teamId.toUpperCase();
  const team = await Team.findOne({ teamId }).lean();
  if (!team) notFound();
  const [events, progress] = await Promise.all([
    GameEvent.find({ teamId }).sort({ at: 1 }).lean(),
    Progress.find({ teamId }).lean(),
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
            <tr key={String(e._id)} className={`border-b border-gray-200 ${e.type === 'override' || e.type === 'reset' ? 'bg-blue-50' : e.type === 'offline-mismatch' ? 'bg-red-100' : ''}`}>
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
