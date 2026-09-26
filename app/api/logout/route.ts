import { cookies } from 'next/headers';
import { TEAM_COOKIE } from '@/lib/auth';
import { ok } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST() {
  cookies().delete(TEAM_COOKIE);
  return ok({ ok: true });
}
