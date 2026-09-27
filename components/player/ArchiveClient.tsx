'use client';

import Link from 'next/link';
import { useGame } from './useGame';
import { Guardian } from './Guardian';
import { ButtonLink, Chip, Panel, Wordmark } from './ui';

export function ArchiveClient() {
  const { state, offline } = useGame();
  if (!state) return <p className="pulse-slow m-auto text-muted">Loading archive…</p>;

  const locked = Math.max(0, state.total - state.fragments.length);
  const complete = locked === 0;

  return (
    <div className="flex flex-1 flex-col gap-4 pb-8">
      <Guardian phase={state.phase} game={state.game} />
      <header className="flex items-center justify-between border-b border-line pb-3">
        <Wordmark small />
        <Link href="/play" className="flex min-h-touch items-center text-sm text-muted">
          ← Back
        </Link>
      </header>
      <h2 className="text-xl font-bold">
        Story archive <span className="text-muted">{state.fragments.length}/{state.total}</span>
      </h2>
      {offline && <Chip tone="amber" icon="⚠">Signal lost. Showing saved fragments</Chip>}
      <ol className="flex flex-col gap-3">
        {state.fragments.map((f) => (
          <li key={f.cpId}>
            <Panel>
              <p className="text-sm text-echo">
                #{f.order} · {f.title}
              </p>
              <p className="mt-2 leading-relaxed">{f.text}</p>
            </Panel>
          </li>
        ))}
        {Array.from({ length: locked }, (_, i) => (
          <li key={`locked-${i}`}>
            <Panel>
              <p className="text-sm text-muted">#{state.fragments.length + i + 1} · Not recovered</p>
              <p className="redacted mt-2 rounded" aria-label="Locked fragment">
                ████████████ ███████ █████████ ████
              </p>
            </Panel>
          </li>
        ))}
      </ol>
      {complete && state.phase === 'final' && <ButtonLink href="/play">Enter the final sequence →</ButtonLink>}
    </div>
  );
}
