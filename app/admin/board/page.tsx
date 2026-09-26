'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatMs } from '@/lib/game';
import { useLive } from '@/components/admin/useLive';

// Projector view, 1920×1080. Separate URL: never opened in front of players mid-hunt.
function Board() {
  const batch = useSearchParams().get('batch') ?? 'all';
  const { data } = useLive(batch);
  const rows = data?.teams ?? [];

  return (
    <div className="min-h-[100dvh] bg-[#0b0d10] px-16 py-12 font-mono text-[#e8ecf1]">
      <h1 className="mb-10 text-6xl font-bold tracking-[0.3em] text-[#4ade80]">
        ECHO<span className="text-[#8b95a3]">_</span> <span className="text-4xl tracking-normal text-[#8b95a3]">{batch === 'all' ? 'All batches' : `Batch ${batch}`}</span>
      </h1>
      <table className="w-full text-3xl">
        <thead className="text-left text-2xl text-[#8b95a3]">
          <tr>
            <th className="w-32 pb-4">Rank</th>
            <th className="pb-4">Team</th>
            <th className="pb-4 text-right">Time</th>
            <th className="w-40 pb-4 text-right">Hints</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.teamId}
              className={`border-t border-[#232830] ${r.rank && r.rank <= 3 ? 'text-5xl font-bold text-[#4ade80]' : ''} ${r.rank ? '' : 'text-[#8b95a3]'}`}
            >
              <td className="py-4">{r.rank ?? '–'}</td>
              <td className="py-4">{r.name}</td>
              <td className="py-4 text-right">{r.rank ? formatMs(r.totalMs) : r.startedAt ? `DNF · ${r.solvedCount}/${data?.total}` : '–'}</td>
              <td className="py-4 text-right">{r.hints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BoardPage() {
  return (
    <Suspense>
      <Board />
    </Suspense>
  );
}
