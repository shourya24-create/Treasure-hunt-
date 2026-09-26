'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <h1 className={`font-bold tracking-[0.3em] text-echo ${small ? 'text-base' : 'text-4xl'}`} aria-label="ECHO">
      ECHO<span className="text-muted">_</span>
    </h1>
  );
}

export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded border border-line bg-panel p-4 ${className}`}>{children}</section>;
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'warn' };
export function Button({ variant = 'primary', className = '', ...rest }: BtnProps) {
  const styles = {
    primary: 'bg-echo text-bg font-bold',
    ghost: 'border border-line text-ink',
    warn: 'border border-amber text-amber',
  }[variant];
  return (
    <button
      {...rest}
      className={`min-h-touch w-full rounded px-4 transition-opacity active:opacity-70 disabled:opacity-40 ${styles} ${className}`}
    />
  );
}

export function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-h-touch w-full items-center justify-center rounded border border-line px-4 text-ink active:opacity-70">
      {children}
    </Link>
  );
}

/** Colour is never the only signal: every chip carries an icon and words. */
export function Chip({ tone, icon, children }: { tone: 'amber' | 'echo' | 'muted'; icon: string; children: React.ReactNode }) {
  const c = { amber: 'border-amber text-amber', echo: 'border-echo text-echo', muted: 'border-line text-muted' }[tone];
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-sm ${c}`}>
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  );
}

/** Re-renders every second; `skew` converts local time to server time. */
export function useNow(skew = 0, active = true): number {
  const [now, setNow] = useState(() => Date.now() + skew);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now() + skew);
    const id = setInterval(() => setNow(Date.now() + skew), 250);
    return () => clearInterval(id);
  }, [skew, active]);
  return now;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Short type-on reveal, ~800ms regardless of length. */
export function TypeOn({ text, onDone }: { text: string; onDone?: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setN(text.length);
      onDone?.();
      return;
    }
    const step = Math.max(1, Math.ceil(text.length / 40));
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(text.length, i + step);
      setN(i);
      if (i >= text.length) {
        clearInterval(id);
        onDone?.();
      }
    }, 20);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <p className={`whitespace-pre-wrap leading-relaxed ${n < text.length ? 'caret' : ''}`}>
      {text.slice(0, n)}
      <span className="sr-only">{text.slice(n)}</span>
    </p>
  );
}
