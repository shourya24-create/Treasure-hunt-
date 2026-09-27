'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Wordmark } from '@/components/player/ui';

function LoginForm() {
  const params = useSearchParams();
  const [teamId, setTeamId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);

  // Only allow same-site relative redirects.
  const raw = params.get('next') ?? '/play';
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/play';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, passcode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Team ID or passcode is wrong');
        setBusy(false);
        return;
      }
      setLeaving(true);
      // Full navigation so the server sees the new cookie immediately.
      setTimeout(() => window.location.assign(next), 350);
    } catch {
      setError('No signal. Move somewhere with coverage and try again.');
      setBusy(false);
    }
  }

  const ready = teamId.trim().length > 0 && passcode.trim().length > 0;

  return (
    <div className={`flex flex-1 flex-col justify-center gap-8 ${leaving ? 'glitch' : ''}`}>
      <div>
        <Wordmark />
        <p className="mt-3 text-echo">&gt; ECHO has been activated.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted">Team ID</span>
          <input
            value={teamId}
            onChange={(e) => setTeamId(e.target.value.toUpperCase())}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="T07"
            className="min-h-touch rounded border border-line bg-panel px-3 uppercase tracking-widest text-ink outline-none focus:border-echo"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted">Passcode</span>
          {/* Plain text on purpose: masking causes typos and nobody is shoulder-surfing. */}
          <input
            value={passcode}
            onChange={(e) => setPasscode(e.target.value.toUpperCase())}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-touch rounded border border-line bg-panel px-3 uppercase tracking-widest text-ink outline-none focus:border-echo"
          />
        </label>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <p className="text-sm leading-relaxed text-muted">
          One phone per team. During the hunt this phone shares its location with the organisers, and leaving this page sets off an alarm.
        </p>
        <button
          type="submit"
          disabled={!ready || busy}
          className="min-h-touch rounded bg-echo font-bold text-bg transition-opacity active:opacity-70 disabled:opacity-40"
        >
          {busy ? 'Connecting…' : 'Connect'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
