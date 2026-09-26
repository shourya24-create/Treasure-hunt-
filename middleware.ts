import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, verifyToken } from '@/lib/auth';

// Admin is a separate credential and cookie role (architecture.md §8).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/admin/login' || pathname === '/api/admin/login') return NextResponse.next();
  const ok = await verifyToken(req.cookies.get(ADMIN_COOKIE)?.value, 'admin');
  if (ok) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] };
