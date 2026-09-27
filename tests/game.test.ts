import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjustmentMs, elapsedMs, hintCount, nextCheckpoint, orderFor, rank, wrongAttempts } from '../lib/game';
import { matches, norm } from '../lib/norm';
import { answerHash, sealForAnswers } from '../lib/seal';
import { checkLocal } from '../lib/offline-client';

const at = (min: number) => new Date(Date.UTC(2026, 9, 10, 10, 0) + min * 60_000);

test('orderFor rotates the 8 checkpoints by offset', () => {
  assert.deepEqual(orderFor(0), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(orderFor(3), [4, 5, 6, 7, 8, 1, 2, 3]);
  assert.deepEqual(orderFor(7), [8, 1, 2, 3, 4, 5, 6, 7]);
});

test('reverse routes walk the loop backwards from the same start', () => {
  assert.deepEqual(orderFor({ routeOffset: 1, reverse: true }), [2, 1, 8, 7, 6, 5, 4, 3]);
  assert.deepEqual(orderFor({ routeOffset: 1, reverse: false }), [2, 3, 4, 5, 6, 7, 8, 1]);
  assert.equal(nextCheckpoint({ routeOffset: 1, reverse: true }, [2]), 1);
  // 12 teams in a batch: no two share a whole route, and after the first stop no two stand at the same checkpoint.
  const routes = [0, 1, 2, 3, 4, 5, 6, 7].map((o) => orderFor(o)).concat([1, 3, 5, 7].map((o) => orderFor({ routeOffset: o, reverse: true })));
  assert.equal(new Set(routes.map((r) => r.join())).size, 12);
  assert.equal(new Set(routes.map((r) => r[0])).size, 8);
});

test('nextCheckpoint skips solved ones, including out-of-order overrides', () => {
  assert.equal(nextCheckpoint(2, []), 3);
  assert.equal(nextCheckpoint(2, [3]), 4);
  assert.equal(nextCheckpoint(2, [3, 5]), 4); // 5 marked solved by an organiser
  assert.equal(nextCheckpoint(2, [3, 4]), 5);
  assert.equal(nextCheckpoint(2, [3, 4, 5]), 6);
  assert.equal(nextCheckpoint(0, [1, 2, 3, 4, 5, 6, 7, 8]), null);
});

test('norm strips case, spacing, punctuation and accents', () => {
  assert.equal(norm('  The Clock-Tower! '), 'theclocktower');
  assert.equal(norm('Café'), 'cafe');
  assert.ok(matches('SEVEN', ['seven', '7']));
  assert.ok(matches(' 7 ', ['seven', '7']));
  assert.ok(!matches('', ['']));
  assert.ok(!matches('eight', ['seven']));
});

test('elapsed = finish − start + hints × penalty + adjustments; resets start a new run', () => {
  const penalty = 3 * 60_000;
  const events = [
    { type: 'hint', at: at(5) }, // before reset: ignored
    { type: 'reset', at: at(6) },
    { type: 'hint', at: at(10) },
    { type: 'hint', at: at(20) },
    { type: 'attempt', at: at(21), payload: { correct: false } },
    { type: 'attempt', at: at(22), payload: { correct: false } },
    { type: 'attempt', at: at(23), payload: { correct: true } },
    { type: 'final-attempt', at: at(90), payload: { correct: false } },
    { type: 'override', at: at(95), payload: { action: 'adjust-time', deltaMs: -60_000 } },
  ];
  assert.equal(hintCount(events), 2);
  assert.equal(wrongAttempts(events), 3);
  assert.equal(adjustmentMs(events), -60_000);
  const ms = elapsedMs({ startedAt: at(7), finishedAt: at(107) }, events, penalty);
  assert.equal(ms, 100 * 60_000 + 2 * penalty - 60_000); // 105 min
  assert.equal(elapsedMs({ startedAt: null }, events, penalty), 0);
  assert.equal(elapsedMs({ startedAt: at(0), finishedAt: null }, [], penalty, at(30)), 30 * 60_000);
});

test('rank: finishers by time, ties by fewest wrong attempts, unfinished last', () => {
  const r = rank([
    { teamId: 'A', finished: true, totalMs: 5000, wrongAttempts: 4, solvedCount: 8 },
    { teamId: 'B', finished: false, totalMs: 1000, wrongAttempts: 0, solvedCount: 5 },
    { teamId: 'C', finished: true, totalMs: 5000, wrongAttempts: 1, solvedCount: 8 },
    { teamId: 'D', finished: true, totalMs: 3000, wrongAttempts: 9, solvedCount: 8 },
    { teamId: 'E', finished: false, totalMs: 900, wrongAttempts: 0, solvedCount: 7 },
  ]);
  assert.deepEqual(r.map((x) => [x.teamId, x.rank]), [['D', 1], ['C', 2], ['A', 3], ['E', null], ['B', null]]);
});

test('offline seal: server-sealed reveal opens only with a correct answer (WebCrypto side)', async () => {
  const salt = 'abc123';
  const payload = { fragment: 'FRAGMENT I', title: 'The Archive', next: null };
  const sealed = sealForAnswers(salt, ['Keyboard', 'a keyboard', 'KEYBOARD'], payload);
  assert.equal(sealed.length, 2); // duplicates after normalisation collapse
  assert.equal(sealed[0].hash, answerHash(salt, 'keyboard'));
  assert.ok(!JSON.stringify(sealed).includes('keyboard'));
  assert.deepEqual(await checkLocal('  KEY-board ', salt, sealed), payload);
  assert.deepEqual(await checkLocal('A Keyboard', salt, sealed), payload);
  assert.equal(await checkLocal('mouse', salt, sealed), null);
  assert.equal(await checkLocal('keyboard', 'other-salt', sealed), null);
});
