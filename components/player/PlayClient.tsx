'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { GameState, LocateInfo, PuzzleInfo } from '@/lib/types';
import { checkLocal, load, queueSubmission, save, type Reveal } from '@/lib/offline-client';
import { useGame } from './useGame';
import { Guardian } from './Guardian';
import { Scanner } from './Scanner';
import { Button, ButtonLink, Chip, Panel, TypeOn, Wordmark, useNow } from './ui';

const SCAN_MESSAGES: Record<string, string> = {
  invalid: "That code didn't verify. Scan the printed QR again, or find a volunteer.",
  'not-started': "Your team hasn't been released yet. Hold position.",
  already: "You've already recovered this fragment.",
  wrong: "This isn't your next location.",
  done: 'All fragments recovered. Assemble the sequence.',
  'unknown-team': 'Session not recognised. Log in again.',
};

/** A checkpoint solved on the phone while offline, not yet confirmed by the server. */
type Advance = { fromCp: number; reveal: Reveal };

export function PlayClient() {
  const { state, offline, setOffline, pending, bumpPending, skew, refresh } = useGame();
  const params = useSearchParams();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ data: Reveal; local: boolean } | null>(null);
  const [advance, setAdvance] = useState<Advance | null>(null);
  const [scanning, setScanning] = useState(false);

  const onScan = useCallback(
    async (r: { cpId: number; t: string }) => {
      setScanning(false);
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(r),
        });
        if (res.status === 401) {
          window.location.assign('/login?next=/play');
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (data.result !== 'ok') setNotice(SCAN_MESSAGES[data.result] ?? 'Scan not accepted.');
        else setNotice(null);
      } catch {
        setNotice('No signal. Move somewhere with coverage and scan again.');
      }
      refresh();
    },
    [refresh],
  );

  // Scan results arrive as ?scan=...; show once, then clean the URL.
  useEffect(() => {
    const s = params.get('scan');
    if (s) {
      setNotice(SCAN_MESSAGES[s] ?? 'Scan not accepted.');
      router.replace('/play');
    }
  }, [params, router]);

  useEffect(() => setAdvance(load<Advance>('echo:advance')), []);

  // Drop the offline advance once the server has caught up.
  useEffect(() => {
    if (!advance || !state || offline) return;
    const serverStillOnIt = state.phase === 'puzzle' && state.puzzle?.cpId === advance.fromCp;
    if (!serverStillOnIt && pending === 0) {
      save('echo:advance', null);
      setAdvance(null);
    }
  }, [advance, state, offline, pending]);

  if (!state) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="pulse-slow text-muted">{offline ? 'Signal lost. Waiting for coverage…' : 'Connecting to ECHO…'}</p>
      </div>
    );
  }

  const onSolved = (data: Reveal, local: boolean) => {
    setReveal({ data, local });
    if (local && state.puzzle) {
      const a = { fromCp: state.puzzle.cpId, reveal: data };
      save('echo:advance', a);
      setAdvance(a);
    }
  };

  let body: React.ReactNode;
  if (reveal) {
    body = (
      <RevealView
        reveal={reveal.data}
        local={reveal.local}
        onContinue={() => {
          setReveal(null);
          refresh();
        }}
      />
    );
  } else if (advance && state.phase === 'puzzle' && state.puzzle?.cpId === advance.fromCp) {
    body = advance.reveal.next ? (
      <LocateView current={advance.reveal.next} offline={offline} onScan={() => setScanning(true)} />
    ) : (
      <Panel>
        <p>All eight fragments recovered on this phone.</p>
        <p className="mt-2 text-muted">Get to signal so ECHO can confirm them, then enter the final sequence.</p>
      </Panel>
    );
  } else {
    body = (
      <PhaseView
        state={state}
        offline={offline}
        skew={skew}
        onSolved={onSolved}
        markOffline={() => setOffline(true)}
        bumpPending={bumpPending}
        refresh={refresh}
        onScan={() => setScanning(true)}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-8">
      <Guardian phase={state.phase} game={state.game} />
      {scanning && <Scanner onResult={onScan} onClose={() => setScanning(false)} />}
      <Header state={state} />
      {(offline || pending > 0) && (
        <div className="flex flex-wrap gap-2">
          {offline && <Chip tone="amber" icon="⚠">Signal lost. Working offline</Chip>}
          {pending > 0 && <Chip tone="amber" icon="⟳">Saved. Will sync</Chip>}
        </div>
      )}
      {notice && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded border border-amber p-3 text-amber">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="min-h-touch min-w-[48px] -my-3 -mr-2" aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      {body}
    </div>
  );
}

function Header({ state }: { state: GameState }) {
  return (
    <header className="flex items-center justify-between border-b border-line pb-3">
      <div className="flex items-baseline gap-3">
        <Wordmark small />
        <span className="text-sm text-muted">{state.team.teamId}</span>
      </div>
      <Link href="/archive" className="flex min-h-touch items-center text-sm text-muted underline-offset-4 hover:underline">
        Fragments {state.solvedCount}/{state.total}
      </Link>
    </header>
  );
}

type PhaseProps = {
  state: GameState;
  offline: boolean;
  skew: number;
  onSolved: (r: Reveal, local: boolean) => void;
  markOffline: () => void;
  bumpPending: () => void;
  refresh: () => void;
  onScan: () => void;
};

function PhaseView({ state, offline, skew, onSolved, markOffline, bumpPending, refresh, onScan }: PhaseProps) {
  switch (state.phase) {
    case 'waiting':
      return (
        <div className="flex flex-1 flex-col justify-center gap-6">
          <p className="text-muted">{state.team.name}</p>
          <p className="leading-relaxed">{state.game.intro}</p>
          <p className="pulse-slow text-echo">Awaiting transmission…</p>
        </div>
      );
    case 'locate':
      return <LocateView current={state.current!} offline={offline} onScan={onScan} />;
    case 'puzzle':
      return (
        <PuzzleView
          key={state.puzzle!.cpId}
          puzzle={state.puzzle!}
          current={state.current!}
          penalty={state.game.hintPenaltyMinutes}
          cooldownSeconds={state.game.cooldownSeconds}
          offline={offline}
          skew={skew}
          onSolved={onSolved}
          markOffline={markOffline}
          bumpPending={bumpPending}
          refresh={refresh}
        />
      );
    case 'final':
      return <FinalView state={state} offline={offline} skew={skew} refresh={refresh} />;
    case 'vr-ready':
      return (
        <div className="flex flex-1 flex-col justify-center gap-6 text-center">
          <p className="glitch text-3xl font-bold tracking-widest text-echo">ECHO ACTIVATED</p>
          <p className="text-lg">Report to {state.game.councilRoom ?? 'the Council Room'}.</p>
          {state.queuePosition && state.queuePosition > 1 ? (
            <p className="text-muted">
              Headsets are busy. You&apos;re number {state.queuePosition} in the queue. Wait for your slot.
            </p>
          ) : (
            <p className="text-muted">You&apos;re next. Show this screen to the volunteer.</p>
          )}
        </div>
      );
    case 'finished':
      return (
        <div className="flex flex-1 flex-col justify-center gap-6 text-center">
          <p className="text-3xl font-bold tracking-widest text-echo">PROTOCOL COMPLETE</p>
          <p className="text-muted">ECHO remembers {state.team.name}. Results at the closing ceremony.</p>
        </div>
      );
  }
}

function LocateView({ current, offline, onScan }: { current: LocateInfo; offline: boolean; onScan: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-sm text-muted">
        Fragment {current.index} of {current.total}
      </p>
      <Panel>
        <p className="text-xl leading-relaxed">{current.locationHint}</p>
        {current.hook && <p className="mt-4 text-echo">&gt; {current.hook}</p>}
      </Panel>
      <div className="mt-auto flex flex-col gap-3">
        <p className="text-center text-muted">Scan the code when you&apos;re there.</p>
        <Button onClick={onScan} disabled={offline}>
          {offline ? 'Scanning needs signal' : 'Scan checkpoint code'}
        </Button>
        <p className="text-center text-xs text-muted">Scan here, not with the camera app. Leaving this page sets off the alarm.</p>
      </div>
    </div>
  );
}

type PuzzleProps = {
  puzzle: PuzzleInfo;
  current: LocateInfo;
  penalty: number;
  cooldownSeconds: number;
  offline: boolean;
  skew: number;
  onSolved: (r: Reveal, local: boolean) => void;
  markOffline: () => void;
  bumpPending: () => void;
  refresh: () => void;
};

function PuzzleView({ puzzle, current, penalty, cooldownSeconds, offline, skew, onSolved, markOffline, bumpPending, refresh }: PuzzleProps) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const localCooldownKey = `echo:cooldown:${puzzle.cpId}`;
  const [cooldownUntil, setCooldownUntil] = useState(() => Math.max(puzzle.cooldownUntil, load<number>(localCooldownKey) ?? 0));
  const [hints, setHints] = useState(puzzle.hints);
  const [attempts, setAttempts] = useState(puzzle.attempts);
  const now = useNow(skew, cooldownUntil > Date.now() + skew - 1000);
  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  useEffect(() => setCooldownUntil((c) => Math.max(c, puzzle.cooldownUntil)), [puzzle.cooldownUntil]);
  useEffect(() => setHints((h) => (puzzle.hints.length > h.length ? puzzle.hints : h)), [puzzle.hints]);
  useEffect(() => setAttempts((a) => Math.max(a, puzzle.attempts)), [puzzle.attempts]);

  function wrong(msg: string, until: number) {
    setMessage(msg);
    setShakeKey((k) => k + 1);
    setCooldownUntil(until);
    save(localCooldownKey, until);
  }

  async function solveOffline() {
    const r = await checkLocal(answer, puzzle.offline.salt, puzzle.offline.sealed);
    const wrongKey = `echo:offwrong:${puzzle.cpId}`;
    if (r) {
      await queueSubmission({
        cpId: puzzle.cpId,
        answer,
        localVerdict: 'correct',
        offlineWrong: load<number>(wrongKey) ?? 0,
        clientAt: Date.now(),
      });
      save(wrongKey, null);
      bumpPending();
      onSolved(r, true);
    } else {
      save(wrongKey, (load<number>(wrongKey) ?? 0) + 1);
      setAttempts((a) => a + 1);
      wrong('Not quite. Checked on your phone.', Date.now() + skew + cooldownSeconds * 1000);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || remaining > 0 || busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (offline) {
        await solveOffline();
        return;
      }
      let res: Response;
      try {
        res = await fetch('/api/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cpId: puzzle.cpId, answer }),
        });
      } catch {
        markOffline();
        await solveOffline();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.correct) {
        onSolved({ fragment: data.fragment, title: data.title, next: data.next }, false);
      } else if (res.ok) {
        setAttempts(data.attempts ?? attempts + 1);
        wrong('Not quite.', data.cooldownUntil);
      } else if (res.status === 429) {
        wrong('A teammate just tried. The cooldown is shared by your whole team.', data.cooldownUntil);
      } else if (res.status === 401) {
        window.location.assign('/login?next=/play');
      } else {
        refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <p className="text-sm text-muted">
          Fragment {current.index} of {current.total}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-echo">{puzzle.title}</h2>
      </div>
      <Panel>
        <p className="whitespace-pre-wrap text-lg leading-relaxed">{puzzle.prompt}</p>
        <Media puzzle={puzzle} />
      </Panel>

      <form key={shakeKey} onSubmit={submit} className={`flex flex-col gap-3 ${shakeKey ? 'shake' : ''}`}>
        <label className="sr-only" htmlFor="answer">
          Answer
        </label>
        <input
          id="answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="send"
          placeholder="Your answer"
          disabled={busy}
          className="min-h-touch rounded border border-line bg-panel px-3 text-ink outline-none focus:border-echo"
        />
        {remaining > 0 ? (
          <div role="timer" className="flex min-h-touch items-center justify-center rounded border border-amber text-amber">
            Try again in {remaining}s
          </div>
        ) : (
          <Button type="submit" disabled={!answer.trim() || busy}>
            {busy ? 'Transmitting…' : 'Submit'}
          </Button>
        )}
        {message && <p className="text-muted">{message}</p>}
        {offline && <p className="text-sm text-amber">⚠ Checked on your phone. ECHO will confirm when signal returns.</p>}
      </form>

      <Hints
        cpId={puzzle.cpId}
        hints={hints}
        total={puzzle.hintsTotal}
        penalty={penalty}
        offline={offline}
        onHint={(h) => setHints((prev) => [...prev, h])}
        refresh={refresh}
      />
      <p className="mt-auto text-sm text-muted">Attempts here: {attempts}</p>
    </div>
  );
}

function Media({ puzzle }: { puzzle: PuzzleInfo }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [imgKey, setImgKey] = useState(0);
  const [arOpen, setArOpen] = useState(false);
  const m = puzzle.media;
  return (
    <>
      {m.audio && (
        <div className="mt-4 flex flex-col gap-2">
          {/* Never autoplay: iOS blocks it and it startles people. */}
          <audio controls preload="none" src={m.audio} className="w-full" />
          {m.transcript && (
            <button onClick={() => setShowTranscript((s) => !s)} className="min-h-touch self-start text-sm text-muted underline">
              {showTranscript ? 'Hide transcript' : "Can't hear it?"}
            </button>
          )}
          {showTranscript && <p className="text-sm text-muted">{m.transcript}</p>}
        </div>
      )}
      {m.image &&
        (imgFailed ? (
          <p className="mt-4 text-sm text-amber">
            Image didn&apos;t load.{' '}
            <button
              className="min-h-touch underline"
              onClick={() => {
                setImgFailed(false);
                setImgKey((k) => k + 1);
              }}
            >
              Retry
            </button>
          </p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={imgKey} src={m.image} alt="Puzzle image" onError={() => setImgFailed(true)} className="mt-4 w-full rounded border border-line" />
        ))}
      {m.arUrl && (
        <button onClick={() => setArOpen(true)} className="mt-4 flex min-h-touch w-full items-center justify-center rounded border border-echo text-echo">
          Open the AR lens
        </button>
      )}
      {/* In-page, not a new tab: leaving the page sets off the alarm. */}
      {arOpen && m.arUrl && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black">
          <iframe src={m.arUrl} title="AR lens" allow="camera; gyroscope; accelerometer; fullscreen" className="w-full flex-1 border-0" />
          <button onClick={() => setArOpen(false)} className="min-h-touch bg-bg text-ink">
            Close the lens
          </button>
        </div>
      )}
    </>
  );
}

function Hints({
  cpId, hints, total, penalty, offline, onHint, refresh,
}: {
  cpId: number; hints: string[]; total: number; penalty: number; offline: boolean;
  onHint: (h: string) => void; refresh: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const left = total - hints.length;

  async function take() {
    setBusy(true);
    try {
      const res = await fetch('/api/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpId, index: hints.length }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) onHint(data.hint);
      else refresh();
    } catch {
      /* offline: button is disabled on the next render */
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {hints.map((h, i) => (
        <Panel key={i} className="border-amber/40">
          <p className="text-sm text-amber">Hint {i + 1}</p>
          <p className="mt-1">{h}</p>
        </Panel>
      ))}
      {total === 0 ? null : left <= 0 ? (
        <p className="text-sm text-muted">No more hints here.</p>
      ) : offline ? (
        <p className="text-sm text-muted">Hints need signal.</p>
      ) : confirming ? (
        <div className="flex gap-3">
          <Button variant="warn" onClick={take} disabled={busy}>
            {busy ? '…' : `Yes, add ${penalty} min`}
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          Need a hint? (+{penalty} min)
        </Button>
      )}
    </div>
  );
}

function RevealView({ reveal, local, onContinue }: { reveal: Reveal; local: boolean; onContinue: () => void }) {
  const [done, setDone] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (done) btn.current?.focus();
  }, [done]);
  return (
    <div className="flex flex-1 flex-col gap-5">
      <p className="text-echo">&gt; Fragment recovered: {reveal.title}</p>
      <Panel className="border-echo/50">
        <TypeOn text={reveal.fragment} onDone={() => setDone(true)} />
      </Panel>
      <p className="text-sm text-muted">Collect the physical story card from the volunteer here.</p>
      {local && <Chip tone="amber" icon="⟳">Checked on your phone. Will confirm when signal returns</Chip>}
      <div className="mt-auto">
        {done && (
          <button
            ref={btn}
            onClick={onContinue}
            className="min-h-touch w-full rounded bg-echo px-4 font-bold text-bg active:opacity-70"
          >
            {reveal.next ? 'Next location →' : 'Assemble the sequence →'}
          </button>
        )}
      </div>
    </div>
  );
}

function FinalView({ state, offline, skew, refresh }: { state: GameState; offline: boolean; skew: number; refresh: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(state.cooldownUntil ?? 0);
  const now = useNow(skew, cooldownUntil > 0);
  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || remaining > 0 || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/final', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.correct) refresh();
      else if (res.ok || res.status === 429) {
        setMessage(res.ok ? 'The sequence was rejected.' : 'Cooling down. Shared by your whole team.');
        setShakeKey((k) => k + 1);
        setCooldownUntil(data.cooldownUntil ?? 0);
      } else refresh();
    } catch {
      setMessage('No signal. The final sequence needs a connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-echo">&gt; {state.game.finalPrompt}</p>
      <details className="rounded border border-line bg-panel p-4">
        <summary className="min-h-touch cursor-pointer leading-[48px]">Read your {state.fragments.length} fragments</summary>
        <ol className="mt-2 flex flex-col gap-3">
          {state.fragments.map((f) => (
            <li key={f.cpId} className="text-sm leading-relaxed">
              {f.text}
            </li>
          ))}
        </ol>
      </details>
      <form key={shakeKey} onSubmit={submit} className={`flex flex-col gap-3 ${shakeKey ? 'shake' : ''}`}>
        <label className="sr-only" htmlFor="code">
          Final sequence
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder="SEQUENCE"
          className="min-h-touch rounded border border-line bg-panel px-3 tracking-[0.3em] text-ink outline-none focus:border-echo"
        />
        {remaining > 0 ? (
          <div role="timer" className="flex min-h-touch items-center justify-center rounded border border-amber text-amber">
            Try again in {remaining}s
          </div>
        ) : (
          <Button type="submit" disabled={!code.trim() || busy || offline}>
            {offline ? 'Needs signal' : busy ? 'Transmitting…' : 'Transmit'}
          </Button>
        )}
        {message && <p className="text-muted">{message}</p>}
      </form>
      <ButtonLink href="/archive">Open the story archive</ButtonLink>
    </div>
  );
}
