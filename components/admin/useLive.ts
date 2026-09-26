'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LiveData } from '@/lib/admin';

const POLL_MS = 5000;
const STALE_MS = 15_000;

/** Polls /api/admin/live. Keeps the last good data on screen if polling fails. */
export function useLive(batch: string) {
  const [data, setData] = useState<LiveData | null>(null);
  const [lastOk, setLastOk] = useState(0);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/live?batch=${batch}`, { cache: 'no-store' });
      if (res.status === 401) {
        window.location.assign(`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
      setLastOk(Date.now());
    } catch {
      /* stale banner covers it */
    }
  }, [batch]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(id);
      clearInterval(tick);
    };
  }, [refresh]);

  return { data, refresh, stale: lastOk > 0 && now - lastOk > STALE_MS, lastOk };
}
