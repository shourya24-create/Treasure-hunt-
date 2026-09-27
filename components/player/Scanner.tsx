'use client';

import { useEffect, useRef, useState } from 'react';

// In-page QR scanner. Opening the phone's camera app would leave the game page
// and set off the siren, so scanning happens here. Uses the built-in
// BarcodeDetector where available (Android Chrome) and jsQR elsewhere (iOS).

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** Pulls cpId and signature out of a checkpoint URL like https://…/c/4?t=abc. */
export function parseCheckpoint(text: string): { cpId: number; t: string } | null {
  try {
    const url = new URL(text, 'https://x.invalid');
    const m = /^\/c\/(\d+)\/?$/.exec(url.pathname);
    const t = url.searchParams.get('t');
    return m && t ? { cpId: Number(m[1]), t } : null;
  } catch {
    return null;
  }
}

export function Scanner({ onResult, onClose }: { onResult: (r: { cpId: number; t: string }) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let lastTry = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        setError('Camera is blocked. Allow camera access for this site in your browser settings, or ask a volunteer to unlock this checkpoint.');
        return;
      }
      if (stopped || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});

      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      const detector = BD ? new BD({ formats: ['qr_code'] }) : null;
      const jsQR = detector ? null : (await import('jsqr')).default;

      const tick = async () => {
        if (stopped) return;
        const v = video.current;
        if (v && v.readyState >= 2 && Date.now() - lastTry > 150) {
          lastTry = Date.now();
          let text: string | null = null;
          try {
            if (detector) {
              const codes = await detector.detect(v);
              text = codes[0]?.rawValue ?? null;
            } else if (jsQR && ctx) {
              // Downscale for speed on low-end phones.
              const scale = Math.min(1, 640 / v.videoWidth);
              canvas.width = Math.round(v.videoWidth * scale);
              canvas.height = Math.round(v.videoHeight * scale);
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              text = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
            }
          } catch {
            /* keep trying */
          }
          if (text) {
            const r = parseCheckpoint(text);
            if (r) {
              navigator.vibrate?.(80);
              stopped = true;
              onResult(r);
              return;
            }
            setHint("That QR isn't an ECHO checkpoint.");
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="aspect-square w-3/4 max-w-xs rounded border-4 border-echo/80" />
        </div>
      </div>
      <div className="flex flex-col gap-3 bg-bg p-4">
        {error ? <p className="text-danger">{error}</p> : <p className="text-center text-muted">{hint || 'Point the camera at the checkpoint QR code.'}</p>}
        <button onClick={onClose} className="min-h-touch rounded border border-line text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}
