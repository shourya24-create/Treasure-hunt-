import { randomBytes } from 'crypto';
import { connectDB } from '@/lib/db';
import { signTeam, teamClaims } from '@/lib/auth';
import { checkPasscode } from '@/lib/passcode';
import { clientIp, fail, ok } from '@/lib/http';
import { LoginAttempt, Team, logEvent } from '@/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Only failed attempts count. Every phone on campus wifi shares one public IP,
// so counting successes per IP would lock teams out at the release moment.
const MAX_FAILS_PER_TEAM = 10; // per minute: stops guessing one team's passcode
const MAX_FAILS_PER_IP = 60; // per minute: stops spraying across team IDs

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const teamId = String(body.teamId ?? '').trim().toUpperCase().slice(0, 20);
  const passcode = String(body.passcode ?? '');
  if (!teamId || !passcode) return fail(400, 'Team ID or passcode is wrong');

  await connectDB();
  const ip = clientIp(req);
  const since = new Date(Date.now() - 60_000);
  const [teamFails, ipFails] = await Promise.all([
    LoginAttempt.countDocuments({ ip: `team:${teamId}`, at: { $gt: since } }),
    LoginAttempt.countDocuments({ ip: `ip:${ip}`, at: { $gt: since } }),
  ]);
  if (teamFails >= MAX_FAILS_PER_TEAM || ipFails >= MAX_FAILS_PER_IP) {
    return fail(429, 'Too many wrong attempts. Wait a minute.');
  }

  const team = await Team.findOne({ teamId }).lean();
  if (!team || !checkPasscode(passcode, team.passcodeHash)) {
    await LoginAttempt.insertMany([{ ip: `team:${teamId}` }, { ip: `ip:${ip}` }]);
    return fail(401, 'Team ID or passcode is wrong');
  }

  // One phone per team: the first login claims the team atomically. Any other
  // phone is refused until an organiser uses "Unlock login".
  const existing = await teamClaims();
  if (existing && existing.teamId === team.teamId && existing.sid === team.activeSession) {
    // The phone that already holds the team, logging in again.
    await signTeam(team.teamId, existing.sid);
    return ok({ ok: true, teamId: team.teamId });
  }
  const sid = randomBytes(16).toString('hex');
  const device = (req.headers.get('user-agent') ?? 'unknown').slice(0, 160);
  const claimed = await Team.updateOne(
    { teamId: team.teamId, activeSession: null },
    { $set: { activeSession: sid, sessionAt: new Date(), device, lastSeenAt: new Date() } },
  );
  if (!claimed.modifiedCount) {
    await logEvent(team.teamId, 'login-blocked', null, { ip, device });
    return fail(409, 'Your team is already logged in on another phone. Only one phone per team is allowed. Ask an organiser if you need to switch.');
  }

  await signTeam(team.teamId, sid);
  await logEvent(team.teamId, 'login', null, { ip, device });
  return ok({ ok: true, teamId: team.teamId });
}
