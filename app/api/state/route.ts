import { currentTeamId } from '@/lib/auth';
import { fail, ok } from '@/lib/http';
import { buildState } from '@/lib/play';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const teamId = await currentTeamId();
  if (!teamId) return fail(401, 'Not logged in');
  const state = await buildState(teamId);
  if (!state) return fail(401, 'Unknown team');
  return ok(state);
}
