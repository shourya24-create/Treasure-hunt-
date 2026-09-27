import { currentTeamId } from '@/lib/session';
import { fail, ok } from '@/lib/http';
import { scan } from '@/lib/play';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const teamId = await currentTeamId();
  if (!teamId) return fail(401, 'Not logged in');
  const body = await req.json().catch(() => ({}));
  const result = await scan(teamId, Number(body.cpId), body.t ? String(body.t) : null);
  return ok({ result });
}
