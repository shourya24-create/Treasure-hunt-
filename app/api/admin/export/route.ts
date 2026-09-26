import { liveData, toCsv } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const b = new URL(req.url).searchParams.get('batch');
  const n = b && b !== 'all' ? Number(b) : NaN;
  const batch = Number.isInteger(n) ? n : 'all';
  const data = await liveData(batch);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return new Response(toCsv(data), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="echo-results-batch-${batch}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
