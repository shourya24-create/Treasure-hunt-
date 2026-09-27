'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { Map as LMap, LayerGroup } from 'leaflet';
import type { LiveRow } from '@/lib/admin';

const FRESH_MS = 30_000;
const STALE_MS = 120_000;

/** Marker colour: red if the phone is off the game page, else by fix age. */
export function markerColor(r: LiveRow, now: number): string {
  if (r.awayNow) return '#dc2626';
  if (!r.location) return '#9ca3af';
  const age = now - r.location.at;
  return age < FRESH_MS ? '#16a34a' : age < STALE_MS ? '#d97706' : '#6b7280';
}

export function TeamMap({ rows, center, now, onSelect }: { rows: LiveRow[]; center?: [number, number]; now: number; onSelect?: (teamId: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const fitted = useRef(false);
  const L = useRef<typeof import('leaflet') | null>(null);

  // Leaflet touches `window`, so it's loaded on the client only.
  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((mod) => {
      if (cancelled || !el.current || map.current) return;
      L.current = mod;
      map.current = mod.map(el.current, { zoomControl: true }).setView(center ?? [19.0728, 72.8998], 17);
      mod
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 20,
          maxNativeZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        })
        .addTo(map.current);
      layer.current = mod.layerGroup().addTo(map.current);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mod = L.current;
    if (!mod || !map.current || !layer.current) return;
    layer.current.clearLayers();
    const pts: [number, number][] = [];
    for (const r of rows) {
      if (!r.location) continue;
      const pos: [number, number] = [r.location.lat, r.location.lng];
      pts.push(pos);
      const color = markerColor(r, now);
      mod.circle(pos, { radius: r.location.accuracy, color, weight: 1, fillOpacity: 0.08 }).addTo(layer.current);
      const ageS = Math.round((now - r.location.at) / 1000);
      mod
        .circleMarker(pos, { radius: 9, color: '#111827', weight: 2, fillColor: color, fillOpacity: 1 })
        .bindTooltip(`${r.teamId}${r.awayNow ? ' AWAY' : ''}`, { permanent: true, direction: 'right', offset: [8, 0], className: 'font-semibold' })
        .bindPopup(`<b>${r.teamId}</b> ${r.name}<br>±${r.location.accuracy} m · ${ageS}s ago<br>${r.solvedCount}/8 solved · left page ${r.tabSwitches}×`)
        .on('click', () => onSelect?.(r.teamId))
        .addTo(layer.current);
    }
    if (!fitted.current && pts.length) {
      map.current.fitBounds(pts, { padding: [40, 40], maxZoom: 18 });
      fitted.current = true;
    }
  }, [rows, now, onSelect]);

  return <div ref={el} className="h-[420px] w-full rounded border border-gray-300" />;
}
