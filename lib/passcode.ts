import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

// Passcodes are printed on cards but still stored hashed.
export function hashPasscode(passcode: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(passcode.trim().toUpperCase(), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPasscode(passcode: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const given = scryptSync(passcode.trim().toUpperCase(), salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
