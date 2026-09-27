// Shapes shared by the API and the player client.

export type Phase = 'waiting' | 'locate' | 'puzzle' | 'final' | 'vr-ready' | 'finished';

export type LocateInfo = { cpId: number; index: number; total: number; locationHint: string; hook: string };

export type SealedAnswer = { hash: string; iv: string; data: string };

export type PuzzleInfo = {
  cpId: number;
  title: string;
  type: 'text' | 'audio' | 'image' | 'physical' | 'ar';
  prompt: string;
  media: { audio?: string; image?: string; arUrl?: string; transcript?: string };
  hints: string[];
  hintsTotal: number;
  attempts: number;
  cooldownUntil: number;
  offline: { salt: string; sealed: SealedAnswer[] };
};

export type Fragment = { order: number; cpId: number; title: string; text: string };

export type GameState = {
  serverNow: number;
  phase: Phase;
  team: { teamId: string; name: string; batch: number };
  game: {
    title?: string | null;
    intro?: string | null;
    hintPenaltyMinutes: number;
    cooldownSeconds: number;
    finalPrompt?: string | null;
    councilRoom?: string | null;
    locationIntervalSeconds?: number;
    sirenGraceSeconds?: number;
    sirenSeconds?: number;
  };
  solvedCount: number;
  total: number;
  fragments: Fragment[];
  current?: LocateInfo;
  puzzle?: PuzzleInfo;
  queuePosition?: number;
  cooldownUntil?: number;
};
