import { createCipheriv, createHash, randomBytes } from 'crypto';
import { norm } from './norm';

// Offline checking without ever sending plaintext answers (feature.md §18).
// answerHash = sha256(salt:normalised answer). The fragment and next location
// are AES-GCM sealed with a key derived from the answer, so a phone can only
// open them by typing a correct answer. Mirrored in lib/offline-client.ts.

export function answerHash(salt: string, answer: string): string {
  return createHash('sha256').update(`${salt}:${norm(answer)}`).digest('hex');
}

function keyFor(salt: string, answer: string): Buffer {
  return createHash('sha256').update(`key:${salt}:${norm(answer)}`).digest();
}

export type Sealed = { hash: string; iv: string; data: string };

/** One sealed copy per accepted answer variant. */
export function sealForAnswers(salt: string, answers: string[], payload: unknown): Sealed[] {
  const plain = Buffer.from(JSON.stringify(payload), 'utf8');
  const seen = new Set<string>();
  const out: Sealed[] = [];
  for (const a of answers) {
    const n = norm(a);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', keyFor(salt, a), iv);
    const enc = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
    out.push({ hash: answerHash(salt, a), iv: iv.toString('base64'), data: enc.toString('base64') });
  }
  return out;
}
