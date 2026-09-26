import { connectDB } from '@/lib/db';
import { signTeam } from '@/lib/auth';
import { checkPasscode } from '@/lib/passcode';
import { clientIp, fail, ok } from '@/lib/http';
import { LoginAttempt, Team, logEvent } from '@/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PER_MINUTE = 10;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const teamId = String(body.teamId ?? '').trim().toUpperCase();
  const passcode = String(body.passcode ?? '');
  if (!teamId || !passcode) return fail(400, 'Team ID or passcode is wrong');

  await connectDB();
  const ip = clientIp(req);
  const recent = await LoginAttempt.countDocuments({ ip, at: { $gt: new Date(Date.now() - 60_000) } });
  if (recent >= MAX_PER_MINUTE) return fail(429, 'Too many attempts. Wait a minute.');
  await LoginAttempt.create({ ip });

  const team = await Team.findOne({ teamId }).lean();
  if (!team || !checkPasscode(passcode, team.passcodeHash)) return fail(401, 'Team ID or passcode is wrong');

  await signTeam(team.teamId);
  await logEvent(team.teamId, 'login', null, { ip });
  return ok({ ok: true, teamId: team.teamId });
}
