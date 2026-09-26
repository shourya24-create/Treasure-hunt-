import { cookies } from 'next/headers';
import { ADMIN_COOKIE } from '@/lib/auth';
import { ok } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST() {
  cookies().delete(ADMIN_COOKIE);
  return ok({ ok: true });
}
