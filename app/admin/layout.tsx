import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'ECHO Control Room' };

// Deliberately plain: white, dense, system sans. Information, not atmosphere.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin">{children}</div>;
}
