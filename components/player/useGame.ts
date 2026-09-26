'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '@/lib/types';
import { flushQueue, load, queued, save } from '@/lib/offline-client';

const POLL_MS = 8000;

/**
 * Server state with an offline fallback: the last good state is kept in
 * localStorage, the answer queue is flushed before every refresh, and polling
 * is quiet — nothing flashes while a player is reading.
 */
export function useGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const [skew, setSkew] = useState(0);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await flushQueue();
      const t0 = Date.now();
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as GameState;
      setSkew(data.serverNow - Math.round((t0 + Date.now()) / 2));
      setState(data);
      save('echo:state', data);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setPending((await queued()).length);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const cached = load<GameState>('echo:state');
    if (cached) setState(cached);
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    const onOnline = () => refresh();
    const onOffline = () => setOffline(true);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const bumpPending = useCallback(async () => setPending((await queued()).length), []);

  return { state, offline, setOffline, pending, bumpPending, skew, refresh };
}
