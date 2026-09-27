import { currentTeamId } from '@/lib/session';
import { fail, ok } from '@/lib/http';
import { Team, logEvent } from '@/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Tab-switch reports. 'hidden' arrives via sendBeacon as the page goes away;
// 'visible' arrives on return with how long the phone was off the game.
export async function POST(req: Request) {
  const teamId = await currentTeamId();
  if (!teamId) return fail(401, 'Not logged in');
  const body = await req.json().catch(() => ({}));
  const now = new Date();
  if (body.event === 'hidden') {
    await logEvent(teamId, 'tab-hidden', null, { phase: String(body.phase ?? '').slice(0, 20) });
  } else if (body.event === 'visible') {
    const hiddenMs = Math.max(0, Math.min(Number(body.hiddenMs) || 0, 24 * 3600_000));
    await logEvent(teamId, 'tab-return', null, { hiddenMs, siren: body.siren === true });
  } else {
    return fail(400, 'Unknown event');
  }
  await Team.updateOne({ teamId }, { $set: { lastSeenAt: now } });
  return ok({ ok: true });
}
