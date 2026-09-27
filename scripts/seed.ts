/**
 * npm run seed                 rebuild checkpoints + settings; rebuild teams if none has started
 * npm run seed -- --force      also rebuild teams even if some have started (wipes their progress)
 * npm run seed -- --wipe-play  also delete all progress and events (fresh event day)
 *
 * Refuses to run on invalid content, so a typo never reaches the database.
 */
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDB } from '../lib/db';
import { CP_COUNT } from '../lib/game';
import { norm } from '../lib/norm';
import { hashPasscode } from '../lib/passcode';
import { answerHash } from '../lib/seal';
import { Checkpoint, GameEvent, Location, LoginAttempt, Progress, Settings, Team } from '../models';

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const wipePlay = args.has('--wipe-play');

type CpIn = {
  cpId: number; title: string; locationHint: string; hook?: string; type?: string; prompt: string;
  media?: Record<string, string>; answers: string[]; answersByBatch?: Record<string, string[]>;
  hints?: string[]; fragment: string;
};
type TeamIn = { teamId: string; name: string; batch: number; wave: number; routeOffset: number; passcode: string };

const read = <T>(file: string): T => JSON.parse(readFileSync(path.join(process.cwd(), 'data', file), 'utf8'));

function validate(cps: CpIn[], teams: TeamIn[], game: Record<string, unknown>): string[] {
  const errs: string[] = [];
  if (cps.length !== CP_COUNT) errs.push(`Expected ${CP_COUNT} checkpoints, found ${cps.length}`);
  const ids = cps.map((c) => c.cpId);
  if (new Set(ids).size !== ids.length) errs.push(`Duplicate checkpoint IDs: ${ids.join(', ')}`);
  for (let i = 1; i <= CP_COUNT; i++) if (!ids.includes(i)) errs.push(`Checkpoint ${i} is missing (IDs must be 1..${CP_COUNT})`);
  const types = ['text', 'audio', 'image', 'physical', 'ar'];
  for (const c of cps) {
    const tag = `Checkpoint ${c.cpId}`;
    for (const f of ['title', 'locationHint', 'prompt', 'fragment'] as const) if (!c[f]?.trim()) errs.push(`${tag}: missing ${f}`);
    if (!c.answers?.length || !c.answers.some((a) => norm(a))) errs.push(`${tag}: no accepted answers`);
    if (c.type && !types.includes(c.type)) errs.push(`${tag}: unknown type "${c.type}"`);
    if (c.type === 'audio' && !c.media?.audio) errs.push(`${tag}: audio type needs media.audio`);
    if (c.type === 'audio' && !c.media?.transcript) errs.push(`${tag}: audio needs a transcript (accessibility)`);
    if (c.type === 'ar' && !c.media?.arUrl) errs.push(`${tag}: ar type needs media.arUrl`);
  }
  const tids = teams.map((t) => t.teamId);
  if (new Set(tids).size !== tids.length) errs.push('Duplicate team IDs');
  for (const t of teams) {
    if (!/^[A-Z0-9]+$/.test(t.teamId)) errs.push(`${t.teamId}: team IDs must be uppercase letters/digits`);
    if (!t.passcode?.trim()) errs.push(`${t.teamId}: missing passcode`);
    if (!Number.isInteger(t.routeOffset) || t.routeOffset < 0 || t.routeOffset >= CP_COUNT) errs.push(`${t.teamId}: routeOffset must be 0..${CP_COUNT - 1}`);
    if (!Number.isInteger(t.batch) || !Number.isInteger(t.wave)) errs.push(`${t.teamId}: batch and wave must be integers`);
  }
  const fa = game.finalAnswers as string[] | undefined;
  if (!fa?.length || !fa.some((a) => norm(a))) errs.push('game.json: finalAnswers is empty');
  return errs;
}

function warnings(teams: TeamIn[]): string[] {
  const out: string[] = [];
  const seen = new Map<string, string>();
  for (const t of teams) {
    const k = `${t.batch}:${t.wave}:${t.routeOffset}`;
    if (seen.has(k)) out.push(`${t.teamId} and ${seen.get(k)} share offset ${t.routeOffset} in batch ${t.batch} wave ${t.wave} — they'll walk together`);
    else seen.set(k, t.teamId);
  }
  return out;
}

async function main() {
  const { checkpoints } = read<{ checkpoints: CpIn[] }>('checkpoints.json');
  const { teams } = read<{ teams: TeamIn[] }>('teams.json');
  const game = read<Record<string, unknown>>('game.json');

  const errs = validate(checkpoints, teams, game);
  if (errs.length) {
    console.error('Refusing to seed:\n  - ' + errs.join('\n  - '));
    process.exit(1);
  }
  for (const w of warnings(teams)) console.warn(`warning: ${w}`);

  await connectDB();
  const db = mongoose.connection.db!;
  console.log(`Connected to ${db.databaseName}`);
  await Promise.all([Team, Checkpoint, Progress, GameEvent, Settings, LoginAttempt, Location].map((m) => m.syncIndexes()));

  // Checkpoints: always safe to rebuild. Keep existing salts so offline
  // hashes already on players' phones stay valid mid-event.
  const existing = new Map((await Checkpoint.find({}, { cpId: 1, salt: 1 }).lean()).map((c) => [c.cpId, c.salt]));
  await Checkpoint.deleteMany({});
  await Checkpoint.insertMany(
    checkpoints.map((c) => {
      const salt = existing.get(c.cpId) ?? randomBytes(16).toString('hex');
      return {
        ...c,
        hook: c.hook ?? '',
        type: c.type ?? 'text',
        hints: c.hints ?? [],
        salt,
        answerHash: c.answers.map((a) => answerHash(salt, a)),
      };
    }),
  );
  console.log(`Seeded ${checkpoints.length} checkpoints`);

  const { _note, ...settings } = game;
  void _note;
  await Settings.findOneAndReplace({ key: 'game' }, { key: 'game', ...settings }, { upsert: true });
  console.log('Seeded game settings');

  const started = await Team.countDocuments({ startedAt: { $ne: null } });
  if (started && !force && !wipePlay) {
    console.warn(`Skipped teams: ${started} team(s) have started. Re-run with --force to rebuild teams anyway.`);
  } else {
    await Team.deleteMany({});
    await Team.insertMany(
      teams.map(({ passcode, ...t }) => ({ ...t, teamId: t.teamId.toUpperCase(), passcodeHash: hashPasscode(passcode) })),
    );
    await Progress.deleteMany({});
    console.log(`Seeded ${teams.length} teams (progress cleared)`);
  }

  if (wipePlay) {
    await Promise.all([Progress.deleteMany({}), GameEvent.deleteMany({}), LoginAttempt.deleteMany({}), Location.deleteMany({})]);
    await Team.updateMany({}, { $set: { activeSession: null, location: null, lastSeenAt: null } });
    console.log('Wiped all progress, events, locations and phone sessions');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
