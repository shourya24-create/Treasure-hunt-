import { currentTeamId } from '@/lib/session';
import { fail, ok } from '@/lib/http';
import { Location, Team, logEvent } from '@/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The team phone reports its GPS fix every few seconds while the game is open.
// Doubles as a heartbeat for the dashboard.
export async function POST(req: Request) {
  const teamId = await currentTeamId();
  if (!teamId) return fail(401, 'Not logged in');
  const body = await req.json().catch(() => ({}));
  const now = new Date();

  if (body.denied === true) {
    await logEvent(teamId, 'location-denied', null, { reason: String(body.reason ?? '').slice(0, 100) });
    await Team.updateOne({ teamId }, { $set: { lastSeenAt: now } });
    return ok({ ok: true });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const accuracy = Number(body.accuracy);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && accuracy >= 0 && accuracy < 100_000)) {
    return fail(400, 'Bad location');
  }
  const fix = { lat, lng, accuracy: Math.round(accuracy), at: now };
  await Promise.all([
    Team.updateOne({ teamId }, { $set: { location: fix, lastSeenAt: now } }),
    Location.create({ teamId, ...fix }),
  ]);
  return ok({ ok: true });
}
