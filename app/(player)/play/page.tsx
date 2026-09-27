import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { currentTeamId } from '@/lib/session';
import { PlayClient } from '@/components/player/PlayClient';

export const dynamic = 'force-dynamic';

export default async function PlayPage() {
  if (!(await currentTeamId())) redirect('/login?next=/play');
  return (
    <Suspense>
      <PlayClient />
    </Suspense>
  );
}
