import { connectDB } from './db';
import { teamClaims } from './auth';
import { Team } from '@/models';

/**
 * Team ID for this request, but only from the one phone that holds the team's
 * active session. A second phone's cookie (or a session an organiser has
 * unlocked) resolves to null.
 */
export async function currentTeamId(): Promise<string | null> {
  const c = await teamClaims();
  if (!c) return null;
  await connectDB();
  const ok = await Team.exists({ teamId: c.teamId, activeSession: c.sid });
  return ok ? c.teamId : null;
}
