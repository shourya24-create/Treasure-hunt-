import { applyOverride, type OverrideInput } from '@/lib/admin';
import { currentAdmin } from '@/lib/auth';
import { fail, ok } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return fail(401, 'Admin only');
  const body = (await req.json().catch(() => ({}))) as OverrideInput;
  const result = await applyOverride(admin, body);
  return result.ok ? ok(result) : fail(400, result.error);
}
