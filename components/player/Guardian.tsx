'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, Phase } from '@/lib/types';

// Anti-cheat and tracking for the one team phone:
//  - GPS: watchPosition with high accuracy, reported every few seconds.
//  - Wake lock: keeps the screen on so tracking doesn't stop.
//  - Leaving the page (tab switch, app switch, screen off) is reported to the
//    organisers and sets off a siren that keeps going until they come back.
//
// How the siren plays while the page is hidden: browsers refuse to *start*
// sound in a background page, but keep sound that is already playing. So from
// the first tap the siren loops inaudibly, and going hidden only turns it up.
// Nothing a website does can stop the hardware volume buttons.

// Armed from login until the final code: logged in means watched.
const ARMED: Phase[] = ['waiting', 'locate', 'puzzle', 'final'];
const SIREN_SRC = '/media/siren.wav';
const HIDDEN_KEY = 'echo:hiddenAt';
const RELOAD_GRACE_MS = 3000; // a page reload briefly hides the page too

type GeoStatus = 'starting' | 'prompt' | 'granted' | 'denied' | 'unavailable';
type Fix = { lat: number; lng: number; accuracy: number };

function post(url: string, body: unknown) {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => null);
}

/**
 * Presence reports go by sendBeacon: it survives the page being frozen or
 * closed, and the browser retries it once the network wakes back up.
 */
function beacon(body: unknown) {
  const json = JSON.stringify(body);
  if (!navigator.sendBeacon?.('/api/presence', new Blob([json], { type: 'application/json' }))) post('/api/presence', body);
}

function readHiddenAt(): number {
  try {
    return Number(localStorage.getItem(HIDDEN_KEY)) || 0;
  } catch {
    return 0;
  }
}
function writeHiddenAt(v: number | null) {
  try {
    if (v) localStorage.setItem(HIDDEN_KEY, String(v));
    else localStorage.removeItem(HIDDEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Inaudible but still "playing". iOS ignores .volume, so it uses .muted there. */
function quiet(a: HTMLAudioElement) {
  if (isIOS()) a.muted = true;
  else {
    a.muted = false;
    a.volume = 0.001;
  }
}

function loud(a: HTMLAudioElement) {
  a.muted = false;
  a.volume = 1;
  if (a.paused) a.play().catch(() => {});
}

export function Guardian({ phase, game }: { phase: Phase; game: GameState['game'] }) {
  const armed = ARMED.includes(phase);
  const tracking = phase !== 'finished';
  const intervalMs = Math.max(3, game.locationIntervalSeconds ?? 10) * 1000;
  const graceMs = (game.sirenGraceSeconds ?? 0) * 1000;
  const sirenMs = Math.max(1, game.sirenSeconds ?? 5) * 1000;

  const [geo, setGeo] = useState<GeoStatus>('starting');
  const [fix, setFix] = useState<Fix | null>(null);
  const [alarm, setAlarm] = useState<{ until: number; hiddenMs: number } | null>(null);
  const [sirenReady, setSirenReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const audio = useRef<HTMLAudioElement | null>(null);
  const alarmUntil = useRef(0);
  const lastSent = useRef(0);
  const latest = useRef<Fix | null>(null);
  const armedRef = useRef(armed);
  armedRef.current = armed;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // ---- Siren ---------------------------------------------------------------
  useEffect(() => {
    const a = new Audio(SIREN_SRC);
    a.loop = true;
    a.preload = 'auto';
    quiet(a);
    audio.current = a;

    // Browsers only allow sound after a tap: every tap (re)starts the inaudible loop.
    const arm = () => {
      if (!armedRef.current || !a.paused) return;
      if (Date.now() >= alarmUntil.current) quiet(a);
      a.play().then(() => setSirenReady(true)).catch(() => {});
    };
    // If the OS or the lock-screen media control pauses it, start it again.
    const onPause = () => {
      setSirenReady(false);
      if (armedRef.current) a.play().then(() => setSirenReady(true)).catch(() => {});
    };
    a.addEventListener('pause', onPause);
    window.addEventListener('pointerdown', arm);
    window.addEventListener('keydown', arm);

    const ms = navigator.mediaSession;
    if (ms) {
      try {
        ms.metadata = new MediaMetadata({ title: 'ECHO is watching', artist: 'Keep the game open' });
        const resume = () => {
          a.play().catch(() => {});
        };
        ms.setActionHandler('pause', resume);
        ms.setActionHandler('stop', resume);
      } catch {
        /* not supported */
      }
    }
    return () => {
      a.removeEventListener('pause', onPause);
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
      armedRef.current = false;
      a.pause();
    };
  }, []);

  // Disarm when the hunt is over for this team.
  useEffect(() => {
    if (!armed && audio.current) {
      armedRef.current = false;
      audio.current.pause();
      setSirenReady(false);
    }
  }, [armed]);

  const soundSiren = useCallback(
    (hiddenMs: number) => {
      const a = audio.current;
      if (a) loud(a);
      navigator.vibrate?.([400, 150, 400, 150, 400, 150, 400]);
      alarmUntil.current = Date.now() + sirenMs;
      setAlarm({ until: alarmUntil.current, hiddenMs });
    },
    [sirenMs],
  );

  const endAlarm = useCallback(() => {
    alarmUntil.current = 0;
    if (audio.current) quiet(audio.current);
    setAlarm(null);
  }, []);

  useEffect(() => {
    if (!alarm) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= alarm.until && audio.current && document.visibilityState === 'visible') quiet(audio.current);
    }, 250);
    return () => clearInterval(id);
  }, [alarm]);

  // ---- Leaving the page ----------------------------------------------------
  useEffect(() => {
    // Came back by reopening the page (closed tab, killed browser)?
    const stale = readHiddenAt();
    if (stale) {
      const hiddenMs = Date.now() - stale;
      writeHiddenAt(null);
      const siren = armedRef.current && hiddenMs > Math.max(graceMs, RELOAD_GRACE_MS);
      beacon({ event: 'visible', hiddenMs, siren });
      if (siren) soundSiren(hiddenMs);
    }

    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const onVisibility = () => {
      const a = audio.current;
      if (document.visibilityState === 'hidden') {
        writeHiddenAt(Date.now());
        beacon({ event: 'hidden', phase: phaseRef.current });
        if (armedRef.current && a) {
          // Turn the already-playing loop up: this is what keeps sounding
          // while the phone is in another app or the screen is off.
          const goLoud = () => {
            loud(a);
            navigator.vibrate?.([600, 200, 600, 200, 600]);
          };
          if (graceMs === 0) goLoud();
          else graceTimer = setTimeout(() => document.visibilityState === 'hidden' && goLoud(), graceMs);
        }
      } else {
        clearTimeout(graceTimer);
        const at = readHiddenAt();
        writeHiddenAt(null);
        if (!at) return;
        const hiddenMs = Date.now() - at;
        const siren = armedRef.current && hiddenMs > graceMs;
        beacon({ event: 'visible', hiddenMs, siren });
        // Back on the page: stay loud a few more seconds with the warning, then quiet.
        if (siren) soundSiren(hiddenMs);
        else if (a && Date.now() >= alarmUntil.current) quiet(a);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(graceTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [graceMs, soundSiren]);

  // ---- Keep the screen on ----------------------------------------------------
  useEffect(() => {
    if (!tracking) return;
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null;
      } catch {
        /* not supported or refused */
      }
    };
    request();
    const onVisible = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [tracking]);

  // ---- GPS -----------------------------------------------------------------
  const send = useCallback((f: Fix) => {
    lastSent.current = Date.now();
    post('/api/location', f);
  }, []);

  const startWatch = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeo('unavailable');
      return () => {};
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const f = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        latest.current = f;
        setFix(f);
        setGeo('granted');
        if (Date.now() - lastSent.current >= intervalMs) send(f);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeo('denied');
          post('/api/location', { denied: true, reason: 'permission' });
        }
        // Timeouts and weak signal: keep watching; the dashboard shows the fix going stale.
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [intervalMs, send]);

  useEffect(() => {
    if (!tracking) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      let state: PermissionState | 'unknown' = 'unknown';
      try {
        state = (await navigator.permissions?.query({ name: 'geolocation' as PermissionName }))?.state ?? 'unknown';
      } catch {
        /* Permissions API missing (older iOS): just ask */
      }
      if (cancelled) return;
      if (state === 'denied') setGeo('denied');
      else if (state === 'prompt') setGeo('prompt');
      else stop = startWatch();
    })();
    // Re-send the last fix on a timer even if the phone isn't moving: it's also the heartbeat.
    const beat = setInterval(() => {
      if (latest.current && Date.now() - lastSent.current >= intervalMs) send(latest.current);
    }, intervalMs);
    return () => {
      cancelled = true;
      stop?.();
      clearInterval(beat);
    };
  }, [tracking, startWatch, intervalMs, send]);

  // ---- UI ------------------------------------------------------------------
  if (alarm && now < alarm.until + 250) {
    const left = Math.max(0, Math.ceil((alarm.until - now) / 1000));
    return (
      <div role="alertdialog" aria-live="assertive" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-danger px-6 text-center text-bg">
        <p className="text-6xl" aria-hidden>
          ⚠
        </p>
        <p className="text-3xl font-bold">YOU LEFT ECHO</p>
        <p className="text-lg">
          Your phone was off the game for {Math.round(alarm.hiddenMs / 1000)}s. This has been reported to the organisers.
        </p>
        <button
          disabled={left > 0}
          onClick={endAlarm}
          className="min-h-touch w-full max-w-xs rounded bg-bg px-4 font-bold text-danger disabled:opacity-60"
        >
          {left > 0 ? `Wait ${left}s` : 'Back to the hunt'}
        </button>
      </div>
    );
  }

  if (tracking && (geo === 'prompt' || geo === 'denied' || geo === 'unavailable')) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col justify-center gap-5 bg-bg px-6">
        <p className="text-2xl font-bold text-echo">Location required</p>
        {geo === 'prompt' && (
          <>
            <p className="leading-relaxed">ECHO tracks your team&apos;s phone during the hunt so organisers can see every team. Keep this page open, with the screen on, the whole time.</p>
            <button
              onClick={() => {
                setGeo('starting');
                startWatch();
              }}
              className="min-h-touch rounded bg-echo px-4 font-bold text-bg"
            >
              Turn on location
            </button>
          </>
        )}
        {geo === 'denied' && (
          <>
            <p className="leading-relaxed">Location is blocked for this site, so you can&apos;t play. Allow it and reload:</p>
            <ul className="list-disc pl-5 text-sm leading-relaxed text-muted">
              <li>Android Chrome: tap the icon left of the address, then Permissions, then Location, then Allow.</li>
              <li>iPhone: Settings, then Privacy &amp; Security, then Location Services, then Safari Websites, then While Using. Then tap aA in the address bar, then Website Settings, then Location, then Allow.</li>
            </ul>
            <button onClick={() => window.location.reload()} className="min-h-touch rounded border border-line px-4">
              Reload
            </button>
          </>
        )}
        {geo === 'unavailable' && <p>This browser can&apos;t share location. Use Chrome or Safari, or find an organiser.</p>}
      </div>
    );
  }

  if (!tracking) return null;
  return (
    <p className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-bg/95 py-1 text-center text-xs text-muted" role="status">
      {armed && !sirenReady ? (
        <span className="text-amber">Tap the screen once to arm ECHO</span>
      ) : fix ? (
        <>
          <span aria-hidden>📍</span> Location on · ±{Math.round(fix.accuracy)} m · keep this page open
        </>
      ) : (
        <span className="text-amber">
          <span aria-hidden>📍</span> Finding GPS… step outside if this takes long
        </span>
      )}
    </p>
  );
}
