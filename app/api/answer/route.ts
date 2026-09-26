import { currentTeamId } from '@/lib/auth';
import { fail, ok } from '@/lib/http';
import { submitAnswer } from '@/lib/play';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const teamId = await currentTeamId();
  if (!teamId) return fail(401, 'Not logged in');
  const body = await req.json().catch(() => ({}));
  const answer = String(body.answer ?? '');
  const cpId = Number(body.cpId);
  if (!answer.trim() || !Number.isInteger(cpId)) return fail(400, 'Answer required');
  const { status, ...result } = await submitAnswer(teamId, {
    cpId,
    answer,
    offline: body.offline === true,
    localVerdict: body.localVerdict === 'correct' ? 'correct' : body.localVerdict === 'wrong' ? 'wrong' : undefined,
    offlineWrong: Number.isInteger(body.offlineWrong) ? body.offlineWrong : undefined,
    clientAt: Number.isFinite(body.clientAt) ? body.clientAt : undefined,
  });
  return status === 200 ? ok(result) : fail(status, 'error' in result ? result.error : 'Error', result);
}
