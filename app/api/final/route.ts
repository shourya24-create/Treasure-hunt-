import { currentTeamId } from '@/lib/auth';
import { fail, ok } from '@/lib/http';
import { submitFinal } from '@/lib/play';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const teamId = await currentTeamId();
  if (!teamId) return fail(401, 'Not logged in');
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? '');
  if (!code.trim()) return fail(400, 'Code required');
  const { status, ...result } = await submitFinal(teamId, code);
  return status === 200 ? ok(result) : fail(status, 'error' in result ? result.error : 'Error', result);
}
