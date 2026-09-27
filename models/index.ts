import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

// ---- Team ----------------------------------------------------------------
const TeamSchema = new Schema({
  teamId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  batch: { type: Number, required: true, index: true },
  routeOffset: { type: Number, required: true, min: 0 },
  reverse: { type: Boolean, default: false },
  passcodeHash: { type: String, required: true },
  startedAt: { type: Date, default: null },
  vrReadyAt: { type: Date, default: null },
  finishedAt: { type: Date, default: null },
  vrCompleted: { type: Boolean, default: false },
  lastFinalAttemptAt: { type: Date, default: null },
  // One phone per team: the session id of the only device allowed in.
  activeSession: { type: String, default: null },
  sessionAt: { type: Date, default: null },
  device: { type: String, default: null },
  // Latest GPS fix and heartbeat from that phone.
  location: {
    lat: Number,
    lng: Number,
    accuracy: Number,
    at: Date,
  },
  lastSeenAt: { type: Date, default: null },
});

// ---- Checkpoint (all content comes from data/checkpoints.json) -------------
const CheckpointSchema = new Schema({
  cpId: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  locationHint: { type: String, required: true },
  hook: { type: String, default: '' },
  type: { type: String, enum: ['text', 'audio', 'image', 'physical', 'ar'], default: 'text' },
  prompt: { type: String, required: true },
  media: {
    audio: String,
    image: String,
    arUrl: String,
    transcript: String,
  },
  answers: { type: [String], required: true },
  // Optional per-batch overrides, e.g. { "2": ["other answer"] }.
  answersByBatch: { type: Schema.Types.Mixed, default: undefined },
  salt: { type: String, required: true },
  answerHash: { type: [String], default: [] },
  hints: { type: [String], default: [] },
  fragment: { type: String, required: true },
});

// ---- Progress (one row per team per opened checkpoint) --------------------
const ProgressSchema = new Schema({
  teamId: { type: String, required: true },
  cpId: { type: Number, required: true },
  status: { type: String, enum: ['open', 'solved'], required: true },
  attempts: { type: Number, default: 0 },
  hintsUsed: { type: Number, default: 0 },
  openedAt: { type: Date, required: true },
  solvedAt: { type: Date, default: null },
  lastAttemptAt: { type: Date, default: null },
  solvedVia: { type: String, enum: ['answer', 'offline', 'override', null], default: null },
});
ProgressSchema.index({ teamId: 1, cpId: 1 }, { unique: true });

// ---- Event (append-only; rankings are computed from this) -----------------
export const EVENT_TYPES = [
  'login', 'scan', 'scan-rejected', 'attempt', 'solve', 'hint',
  'final-attempt', 'final', 'override', 'offline-mismatch', 'reset',
  'tab-hidden', 'tab-return', 'login-blocked', 'location-denied',
] as const;
const EventSchema = new Schema({
  teamId: { type: String, required: true },
  cpId: { type: Number, default: null },
  type: { type: String, enum: EVENT_TYPES, required: true },
  payload: { type: Schema.Types.Mixed, default: {} },
  at: { type: Date, required: true, default: () => new Date() },
});
EventSchema.index({ teamId: 1, at: -1 });

// ---- Settings (singleton, from data/game.json) -----------------------------
const SettingsSchema = new Schema({
  key: { type: String, required: true, unique: true, default: 'game' },
  title: String,
  intro: String,
  finalPrompt: String,
  finalAnswers: { type: [String], required: true },
  councilRoom: String,
  hintPenaltyMinutes: { type: Number, default: 3 },
  cooldownSeconds: { type: Number, default: 30 },
  amberMinutes: { type: Number, default: 8 },
  redMinutes: { type: Number, default: 12 },
  locationIntervalSeconds: { type: Number, default: 10 },
  sirenGraceSeconds: { type: Number, default: 0 },
  sirenSeconds: { type: Number, default: 5 },
  campusCenter: { type: [Number], default: [19.0728, 72.8998] },
});

// ---- Location trail (one phone per team; auto-deletes after 7 days) --------
const LocationSchema = new Schema({
  teamId: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  accuracy: { type: Number, required: true },
  at: { type: Date, required: true, default: () => new Date(), expires: 7 * 24 * 3600 },
});
LocationSchema.index({ teamId: 1, at: -1 });

// ---- Login attempts (rate limiting, auto-expire after a minute) ------------
const LoginAttemptSchema = new Schema({
  ip: { type: String, required: true, index: true },
  at: { type: Date, required: true, default: () => new Date(), expires: 60 },
});

function model<T extends Schema>(name: string, schema: T) {
  return (mongoose.models[name] as Model<InferSchemaType<T>>) ?? mongoose.model(name, schema);
}

export const Team = model('Team', TeamSchema);
export const Checkpoint = model('Checkpoint', CheckpointSchema);
export const Progress = model('Progress', ProgressSchema);
export const GameEvent = model('Event', EventSchema);
export const Settings = model('Settings', SettingsSchema);
export const LoginAttempt = model('LoginAttempt', LoginAttemptSchema);
export const Location = model('Location', LocationSchema);

export type TeamDoc = InferSchemaType<typeof TeamSchema>;
export type CheckpointDoc = InferSchemaType<typeof CheckpointSchema>;
export type ProgressDoc = InferSchemaType<typeof ProgressSchema>;
export type EventDoc = InferSchemaType<typeof EventSchema>;
export type SettingsDoc = InferSchemaType<typeof SettingsSchema>;

export async function logEvent(
  teamId: string,
  type: (typeof EVENT_TYPES)[number],
  cpId: number | null = null,
  payload: Record<string, unknown> = {},
) {
  await GameEvent.create({ teamId, type, cpId, payload, at: new Date() });
}
