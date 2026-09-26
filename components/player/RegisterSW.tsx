'use client';

import { useEffect } from 'react';

// Registered only in production builds; a service worker caching dev chunks
// makes local development confusing.
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
