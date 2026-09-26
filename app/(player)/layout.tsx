import { RegisterSW } from '@/components/player/RegisterSW';

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="player font-mono text-base">
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col px-4 py-5">{children}</main>
      <RegisterSW />
    </div>
  );
}
