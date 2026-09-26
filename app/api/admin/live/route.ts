import { liveData } from '@/lib/admin';
import { ok } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const b = new URL(req.url).searchParams.get('batch');
  const batch = b && b !== 'all' ? Number(b) : NaN;
  return ok(await liveData(Number.isInteger(batch) ? batch : 'all'));
}
