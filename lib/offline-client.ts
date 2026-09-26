'use client';

import { norm } from './norm';

// Client half of offline play (feature.md §18). Mirrors lib/seal.ts:
// hash = sha256(salt:norm(answer)), key = sha256(key:salt:norm(answer)).

export type Sealed = { hash: string; iv: string; data: string };
export type Reveal = {
  fragment: string;
  title: string;
  next: { cpId: number; index: number; total: number; locationHint: string; hook: string } | null;
};

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Checks an answer on the phone. Returns the unsealed reveal if correct, null if wrong. */
export async function checkLocal(answer: string, salt: string, sealed: Sealed[]): Promise<Reveal | null> {
  const n = norm(answer);
  if (!n || !crypto?.subtle) return null;
  const hash = hex(await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${n}`)));
  const hit = sealed.find((s) => s.hash === hash);
  if (!hit) return null;
  try {
    const raw = await crypto.subtle.digest('SHA-256', enc.encode(`key:${salt}:${n}`));
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(hit.iv) }, key, b64(hit.data));
    return JSON.parse(new TextDecoder().decode(plain)) as Reveal;
  } catch {
    return null;
  }
}

// ---- IndexedDB submission queue --------------------------------------------

export type Queued = {
  id?: number;
  cpId: number;
  answer: string;
  localVerdict: 'correct' | 'wrong';
  offlineWrong: number;
  clientAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('echo', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('queue', mode);
    const req = fn(t.objectStore('queue'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function queueSubmission(item: Queued): Promise<void> {
  await tx('readwrite', (s) => s.add(item));
}

export async function queued(): Promise<Queued[]> {
  try {
    return await tx('readonly', (s) => s.getAll() as IDBRequest<Queued[]>);
  } catch {
    return [];
  }
}

/**
 * Sends queued answers to the server, which re-validates them and stays the
 * source of truth. Stops at the first network failure; anything the server
 * answered (right, wrong or rejected) leaves the queue.
 */
export async function flushQueue(): Promise<number> {
  let sent = 0;
  for (const item of await queued()) {
    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, offline: true, id: undefined }),
      });
      if (res.status === 401) break; // log in again first; keep the queue
      await tx('readwrite', (s) => s.delete(item.id!));
      sent++;
    } catch {
      break;
    }
  }
  return sent;
}

// ---- Small localStorage helpers (always wrapped: private mode can throw) ----

export function load<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export function save(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}
