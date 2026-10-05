/**
 * npm run loadtest — 20 simultaneous clients (the release-moment spike) log in
 * and hammer /api/state and /api/answer. Reports latency and errors. Run it
 * against the deployed URL before event day to find the Atlas connection
 * ceiling while it's still fixable. Doesn't release teams or change progress.
 *
 *   LOADTEST_URL=https://your-app.vercel.app LOADTEST_CLIENTS=20 LOADTEST_ROUNDS=10 npm run loadtest
 *   Realistic batch (12 team phones, 8s polling + GPS, ~1 min):
 *   LOADTEST_URL=... LOADTEST_CLIENTS=12 LOADTEST_ROUNDS=8 LOADTEST_PACE_MS=8000 npm run loadtest
 */
import { readFileSync } from 'fs';
import path from 'path';

const BASE = (process.env.LOADTEST_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
// One phone per team, so at most one client per seeded team.
const { teams } = JSON.parse(readFileSync(path.join(process.cwd(), 'data/teams.json'), 'utf8')) as { teams: { teamId: string; passcode: string }[] };
const CLIENTS = Math.min(Number(process.env.LOADTEST_CLIENTS ?? 20), teams.length);
const ROUNDS = Number(process.env.LOADTEST_ROUNDS ?? 10);
// Real phones poll every ~8s. PACE_MS > 0 simulates that (with jitter);
// 0 fires back-to-back, which exceeds Atlas M0's ~100 ops/s throughput cap.
const PACE_MS = Number(process.env.LOADTEST_PACE_MS ?? 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const timings: number[] = [];
const errors = new Map<string, number>();

async function timed(url: string, init: RequestInit): Promise<Response | null> {
  const t = performance.now();
  try {
    const res = await fetch(BASE + url, init);
    timings.push(performance.now() - t);
    if (res.status >= 500) errors.set(`${url} ${res.status}`, (errors.get(`${url} ${res.status}`) ?? 0) + 1);
    return res;
  } catch (e) {
    errors.set(`${url} network`, (errors.get(`${url} network`) ?? 0) + 1);
    return null;
  }
}

async function client(i: number) {
  const team = teams[i % teams.length];
  const ip = `10.1.${Math.floor(i / 250)}.${i % 250}`;
  const login = await timed('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ teamId: team.teamId, passcode: team.passcode }),
  });
  const cookie = login?.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ') ?? '';
  const headers = { 'Content-Type': 'application/json', Cookie: cookie, 'X-Forwarded-For': ip };
  for (let r = 0; r < ROUNDS; r++) {
    if (PACE_MS) await sleep(PACE_MS * (0.5 + Math.random()));
    await timed('/api/state', { headers });
    if (PACE_MS) {
      await timed('/api/location', { method: 'POST', headers, body: JSON.stringify({ lat: 19.0728 + Math.random() / 1000, lng: 72.8998 + Math.random() / 1000, accuracy: 8 }) });
    }
    if (!PACE_MS || r % 4 === 0) {
      await timed('/api/answer', { method: 'POST', headers, body: JSON.stringify({ cpId: 1, answer: `load-${r}` }) });
    }
  }
}

/** Frees the teams' one-phone locks before and after, so the test never blocks real players. */
async function unlockAll() {
  const res = await fetch(BASE + '/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'loadtest', password: process.env.ADMIN_PASSWORD }),
  });
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  await Promise.all(
    teams.slice(0, CLIENTS).map((t) =>
      fetch(BASE + '/api/admin/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ action: 'unlock-login', teamId: t.teamId, reason: 'loadtest' }),
      }),
    ),
  );
}

async function main() {
  await unlockAll();
  console.log(`Load test: ${CLIENTS} clients × ${ROUNDS} rounds${PACE_MS ? ` paced ~${PACE_MS}ms` : ''} against ${BASE}`);
  const t0 = performance.now();
  await Promise.all(Array.from({ length: CLIENTS }, (_, i) => client(i)));
  const secs = (performance.now() - t0) / 1000;
  await unlockAll();
  timings.sort((a, b) => a - b);
  const pct = (p: number) => timings[Math.min(timings.length - 1, Math.floor((p / 100) * timings.length))]?.toFixed(0);
  console.log(`\n${timings.length} requests in ${secs.toFixed(1)}s (${(timings.length / secs).toFixed(1)} req/s)`);
  console.log(`latency ms  p50 ${pct(50)}  p95 ${pct(95)}  p99 ${pct(99)}  max ${timings.at(-1)?.toFixed(0)}`);
  if (errors.size) {
    console.log('\nErrors:');
    for (const [k, n] of errors) console.log(`  ${k}: ${n}`);
    process.exit(1);
  }
  console.log('No server errors.');
}

main();
