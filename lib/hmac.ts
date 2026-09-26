import { createHmac, timingSafeEqual } from 'crypto';

// Signs checkpoint URLs so /c/5 can't be hand-typed. Not the primary
// anti-cheat — the sequence check is (architecture.md §4.4).
function secret(): string {
  const s = process.env.QR_SECRET;
  if (!s) throw new Error('QR_SECRET is not set');
  return s;
}

export function signCp(cpId: number): string {
  return createHmac('sha256', secret()).update(`cp:${cpId}`).digest('base64url').slice(0, 16);
}

export function verifyCp(cpId: number, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(signCp(cpId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
