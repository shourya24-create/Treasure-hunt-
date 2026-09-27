import { cookies } from 'next/headers';
import { TEAM_COOKIE, teamClaims } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { ok } from '@/lib/http';
import { Team } from '@/models';

export const runtime = 'nodejs';

export async function POST() {
  const c = await teamClaims();
  if (c) {
    // Frees the team for another phone, but only if this phone held it.
    await connectDB();
    await Team.updateOne({ teamId: c.teamId, activeSession: c.sid }, { $set: { activeSession: null } });
  }
  cookies().delete(TEAM_COOKIE);
  return ok({ ok: true });
}
