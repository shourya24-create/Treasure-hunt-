'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function AdminLoginForm() {
  const params = useSearchParams();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const raw = params.get('next') ?? '/admin';
  const next = raw.startsWith('/admin') ? raw : '/admin';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    }).catch(() => null);
    if (res?.ok) {
      window.location.assign(next);
      return;
    }
    const data = await res?.json().catch(() => ({}));
    setError(data?.error ?? 'Network error');
    setBusy(false);
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-bold">ECHO Control Room</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Your name (logged on every override)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded border border-gray-300 px-3" autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Admin password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded border border-gray-300 px-3"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-red-700">{error}</p>}
        <button disabled={busy || !name || !password} className="h-12 rounded bg-gray-900 font-semibold text-white disabled:opacity-40">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}
