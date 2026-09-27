import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// jose works in both Node and Edge runtimes, so middleware can use it too.
export const TEAM_COOKIE = 'echo_team';
export const ADMIN_COOKIE = 'echo_admin';
const TEAM_TTL_S = 5 * 60 * 60; // a batch plus overrun
const ADMIN_TTL_S = 14 * 60 * 60; // the whole event day

function key(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return new TextEncoder().encode(s);
}

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});

export async function signTeam(teamId: string, sid: string): Promise<void> {
  const token = await new SignJWT({ role: 'team', sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(teamId)
    .setIssuedAt()
    .setExpirationTime(`${TEAM_TTL_S}s`)
    .sign(key());
  cookies().set(TEAM_COOKIE, token, cookieOpts(TEAM_TTL_S));
}

export async function signAdmin(name: string): Promise<void> {
  const token = await new SignJWT({ role: 'admin', name })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TTL_S}s`)
    .sign(key());
  cookies().set(ADMIN_COOKIE, token, cookieOpts(ADMIN_TTL_S));
}

export async function verifyToken(token: string | undefined, role: 'team' | 'admin') {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload.role === role ? payload : null;
  } catch {
    return null;
  }
}

/** Raw team session claims from the cookie (signature checked, device not). Use lib/session.ts. */
export async function teamClaims(): Promise<{ teamId: string; sid: string } | null> {
  const p = await verifyToken(cookies().get(TEAM_COOKIE)?.value, 'team');
  return typeof p?.sub === 'string' && typeof p.sid === 'string' ? { teamId: p.sub, sid: p.sid } : null;
}

/** Organiser name from the admin cookie, or null. */
export async function currentAdmin(): Promise<string | null> {
  const p = await verifyToken(cookies().get(ADMIN_COOKIE)?.value, 'admin');
  return p ? String(p.name ?? 'admin') : null;
}
