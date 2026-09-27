/**
 * npm run playtest — plays one team through the whole hunt over HTTP against
 * a running server, checking the rules along the way: sequence lock, QR
 * signatures, cooldown, simultaneous submissions, hints, offline sync, final
 * code, VR completion and the computed time. Uses T12 by default and resets
 * it at the end.
 *
 *   PLAYTEST_URL=http://localhost:3000 PLAYTEST_TEAM=T12 npm run playtest
 */
import { readFileSync } from 'fs';
import path from 'path';
import { signCp } from '../lib/hmac';
import { orderFor } from '../lib/game';

const BASE = (process.env.PLAYTEST_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const TEAM = process.env.PLAYTEST_TEAM ?? 'T12';

type Cp = { cpId: number; answers: string[]; hints: string[] };
const { checkpoints } = JSON.parse(readFileSync(path.join(process.cwd(), 'data/checkpoints.json'), 'utf8')) as { checkpoints: Cp[] };
const { teams } = JSON.parse(readFileSync(path.join(process.cwd(), 'data/teams.json'), 'utf8')) as { teams: { teamId: string; passcode: string; routeOffset: number; batch: number }[] };
const game = JSON.parse(readFileSync(path.join(process.cwd(), 'data/game.json'), 'utf8'));
const team = teams.find((t) => t.teamId === TEAM)!;

class Client {
  jar = new Map<string, string>();
  async req(method: string, url: string, body?: unknown, redirect: RequestRedirect = 'follow') {
    const res = await fetch(BASE + url, {
      method,
      redirect,
      headers: {
        'Content-Type': 'application/json',
        Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '),
        'X-Forwarded-For': `10.0.0.${Math.floor(Math.random() * 250)}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const [k, v] = kv.split('=');
      if (v) this.jar.set(k, v);
      else this.jar.delete(k);
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: res.status, json, text, location: res.headers.get('location') };
  }
}

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? '  ok ' : '  FAIL'}  ${label}${!cond && detail !== undefined ? `\n        ${JSON.stringify(detail)}` : ''}`);
  if (!cond) failures++;
}

async function main() {
  console.log(`Playtest against ${BASE} as ${TEAM}\n`);
  const admin = new Client();
  const override = (action: string, extra: Record<string, unknown> = {}) =>
    admin.req('POST', '/api/admin/override', { action, teamId: TEAM, reason: 'playtest', ...extra });

  check('admin API rejects anonymous callers', (await new Client().req('GET', '/api/admin/live')).status === 401);
  check('admin login', (await admin.req('POST', '/api/admin/login', { name: 'playtest', password: process.env.ADMIN_PASSWORD })).status === 200);
  await override('reset');
  await override('unlock-login');

  const p = new Client();
  check('wrong passcode rejected', (await p.req('POST', '/api/login', { teamId: TEAM, passcode: 'NOPE' })).status === 401);
  check('team login', (await p.req('POST', '/api/login', { teamId: TEAM.toLowerCase(), passcode: team.passcode })).status === 200);
  let s = (await p.req('GET', '/api/state')).json;
  check('holding screen before release', s.phase === 'waiting', s.phase);

  // One phone per team.
  const phone2 = new Client();
  const blocked = await phone2.req('POST', '/api/login', { teamId: TEAM, passcode: team.passcode });
  check('second phone is refused (one phone per team)', blocked.status === 409, blocked.json);
  check('second phone gets no access', (await phone2.req('GET', '/api/state')).status === 401);
  check('same phone can log in again', (await p.req('POST', '/api/login', { teamId: TEAM, passcode: team.passcode })).status === 200);

  // Location + presence.
  check('location report accepted', (await p.req('POST', '/api/location', { lat: 19.07284, lng: 72.89983, accuracy: 7.4 })).status === 200);
  check('bad location rejected', (await p.req('POST', '/api/location', { lat: 999, lng: 0, accuracy: 5 })).status === 400);
  await p.req('POST', '/api/presence', { event: 'hidden', phase: 'waiting' });
  let row = (await admin.req('GET', `/api/admin/live?batch=${team.batch}`)).json.teams.find((t: any) => t.teamId === TEAM);
  check('dashboard shows phone, fix and AWAY NOW', row.loggedIn && row.location?.accuracy === 7 && row.awayNow === true && row.blockedLogins === 1, row);
  await p.req('POST', '/api/presence', { event: 'visible', hiddenMs: 12_000, siren: true });
  row = (await admin.req('GET', `/api/admin/live?batch=${team.batch}`)).json.teams.find((t: any) => t.teamId === TEAM);
  check('return logged with time away', row.awayNow === false && row.tabSwitches === 1 && row.awayMs === 12_000, row);

  const order = orderFor(team.routeOffset);
  const first = order[0];
  check('scan before release is refused', (await p.req('POST', '/api/scan', { cpId: first, t: signCp(first) })).json.result === 'not-started');
  check('release team', (await override('release')).status === 200);

  s = (await p.req('GET', '/api/state')).json;
  check('location card after release', s.phase === 'locate' && s.current.cpId === first, s);
  check('location card shows no route', !('route' in s) && !JSON.stringify(s).includes('routeOffset'));

  const ahead = order[1];
  check('scanning ahead is rejected', (await p.req('POST', '/api/scan', { cpId: ahead, t: signCp(ahead) })).json.result === 'wrong');
  check('unsigned QR is rejected', (await p.req('POST', '/api/scan', { cpId: first, t: 'forged' })).json.result === 'invalid');
  const landing = await p.req('GET', `/c/${first}?t=${signCp(first)}`, undefined, 'manual');
  check('QR landing opens checkpoint and redirects to /play', landing.status === 307 && landing.location?.endsWith('/play') === true, landing);

  const anon = await new Client().req('GET', `/c/${first}?t=${signCp(first)}`, undefined, 'manual');
  check('QR landing without session keeps the URL through login', !!anon.location?.includes(`next=${encodeURIComponent(`/c/${first}`)}`), anon.location);

  let expectedHints = 0;
  let expectedWrong = 0;
  for (let i = 0; i < order.length; i++) {
    const cpId = order[i];
    const cp = checkpoints.find((c) => c.cpId === cpId)!;
    if (i > 0) {
      const r = await p.req('POST', '/api/scan', { cpId, t: signCp(cpId) });
      check(`CP${cpId} scan`, r.json.result === 'ok', r.json);
    }
    s = (await p.req('GET', '/api/state')).json;
    check(`CP${cpId} puzzle open`, s.phase === 'puzzle' && s.puzzle.cpId === cpId, s.phase);
    const blob = JSON.stringify(s);
    const leaked = cp.answers.filter((a) => a.length > 3 && blob.toLowerCase().includes(`"${a.toLowerCase()}"`));
    check(`CP${cpId} state leaks no plaintext answer`, leaked.length === 0, leaked);

    if (i === 0) {
      // Wrong answer, then the shared cooldown.
      const w = await p.req('POST', '/api/answer', { cpId, answer: 'definitely wrong' });
      expectedWrong++;
      check('wrong answer reported', w.status === 200 && w.json.correct === false && w.json.cooldownUntil > Date.now(), w.json);
      const again = await p.req('POST', '/api/answer', { cpId, answer: cp.answers[0] });
      check('second try inside 30s is rejected', again.status === 429, again.json);

      // Four phones tapping "hint 1" at once: one hint, one penalty.
      const taps = await Promise.all([0, 1, 2, 3].map(() => p.req('POST', '/api/hint', { cpId, index: 0 })));
      check('4 simultaneous hint taps all get hint 1', taps.every((t) => t.status === 200 && t.json.hint === cp.hints[0]), taps.map((t) => t.json));
      expectedHints++;
      const h2 = await p.req('POST', '/api/hint', { cpId, index: 1 });
      check('hint 2', h2.status === 200 && h2.json.hint === cp.hints[1], h2.json);
      expectedHints++;
      const h3 = await p.req('POST', '/api/hint', { cpId, index: 2 });
      check('no hint 3', h3.status === 409);
      s = (await p.req('GET', '/api/state')).json;
      check('state carries revealed hints only', s.puzzle.hints.length === 2);

      // Solved "offline": queued answer synced later, cooldown not applied.
      const off = await p.req('POST', '/api/answer', { cpId, answer: cp.answers[0], offline: true, localVerdict: 'correct', offlineWrong: 1 });
      check('offline-queued answer syncs and solves', off.status === 200 && off.json.correct === true, off.json);
      continue;
    }

    if (i === 1) {
      // Four phones submitting the right answer at once.
      const subs = await Promise.all([0, 1, 2, 3].map(() => p.req('POST', '/api/answer', { cpId, answer: cp.answers[0].toUpperCase() + '!' })));
      check('4 simultaneous correct answers all see success', subs.every((r) => r.status === 200 && r.json.correct === true), subs.map((r) => [r.status, r.json]));
      if (i < order.length - 1) check('success returns next location', subs[0].json.next?.cpId === order[i + 1], subs[0].json.next);
      continue;
    }

    if (i === 2) {
      const h = await p.req('POST', '/api/hint', { cpId, index: 0 });
      check('hint on CP3', h.status === 200);
      expectedHints++;
    }
    const r = await p.req('POST', '/api/answer', { cpId, answer: ` ${cp.answers[cp.answers.length - 1]} ` });
    check(`CP${cpId} solved`, r.status === 200 && r.json.correct === true, r.json);
    const again = await p.req('POST', '/api/scan', { cpId, t: signCp(cpId) });
    check(`CP${cpId} rescan says already solved`, again.json.result === 'already', again.json);
  }

  s = (await p.req('GET', '/api/state')).json;
  check('final code screen after 8', s.phase === 'final' && s.fragments.length === 8, s.phase);
  const f = await p.req('POST', '/api/final', { code: game.finalAnswers[0].toLowerCase() });
  check('final code accepted', f.status === 200 && f.json.correct === true, f.json);
  s = (await p.req('GET', '/api/state')).json;
  check('VR-ready with queue position', s.phase === 'vr-ready' && s.queuePosition >= 1, s);

  check('adjust time −1 min', (await override('adjust-time', { minutes: -1 })).status === 200);
  check('reason is required', (await admin.req('POST', '/api/admin/override', { action: 'adjust-time', teamId: TEAM, minutes: 1 })).status === 400);
  check('VR complete', (await override('vr-complete')).status === 200);
  s = (await p.req('GET', '/api/state')).json;
  check('player sees finished', s.phase === 'finished', s.phase);

  const live = (await admin.req('GET', `/api/admin/live?batch=${team.batch}`)).json;
  row = live.teams.find((t: any) => t.teamId === TEAM);
  const expectedMs = row.finishedAt - row.startedAt + expectedHints * game.hintPenaltyMinutes * 60_000 - 60_000;
  check(`hints counted once each (${expectedHints})`, row.hints === expectedHints, row.hints);
  check(`wrong attempts (${expectedWrong})`, row.wrongAttempts === expectedWrong, row.wrongAttempts);
  check('total time = finish − start + hints × 3 min − 1 min', row.totalMs === expectedMs, { got: row.totalMs, expectedMs });
  check('finished team is ranked', row.rank !== null && row.status === 'finished', row);

  const csv = await admin.req('GET', `/api/admin/export?batch=${team.batch}`);
  check('CSV export includes the team', csv.status === 200 && csv.text.includes(TEAM));

  await override('reset');
  s = (await p.req('GET', '/api/state')).json;
  check('reset returns team to holding screen', s.phase === 'waiting' && s.solvedCount === 0, s.phase);

  check('organiser unlocks login', (await override('unlock-login')).status === 200);
  check('old phone is signed out after unlock', (await p.req('GET', '/api/state')).status === 401);
  check('new phone can log in after unlock', (await phone2.req('POST', '/api/login', { teamId: TEAM, passcode: team.passcode })).status === 200);
  await override('unlock-login');

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
