import { timingSafeEqual } from 'crypto';
import { connectDB } from '@/lib/db';
import { signAdmin } from '@/lib/auth';
import { clientIp, fail, ok } from '@/lib/http';
import { LoginAttempt } from '@/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim().slice(0, 40);
  const password = String(body.password ?? '');
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return fail(500, 'ADMIN_PASSWORD is not set');
  if (!name) return fail(400, 'Enter your name, overrides are logged against it');

  await connectDB();
  const ip = `admin:${clientIp(req)}`;
  const recent = await LoginAttempt.countDocuments({ ip, at: { $gt: new Date(Date.now() - 60_000) } });
  if (recent >= 10) return fail(429, 'Too many attempts. Wait a minute.');
  await LoginAttempt.create({ ip });

  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail(401, 'Wrong password');
  await signAdmin(name);
  return ok({ ok: true });
}
