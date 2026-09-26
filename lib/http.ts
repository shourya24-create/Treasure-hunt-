import { NextResponse } from 'next/server';

export const ok = (data: unknown) => NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
export const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}
