import { redirect } from 'next/navigation';
import { currentTeamId } from '@/lib/session';
import { ArchiveClient } from '@/components/player/ArchiveClient';

export const dynamic = 'force-dynamic';

export default async function ArchivePage() {
  if (!(await currentTeamId())) redirect('/login?next=/archive');
  return <ArchiveClient />;
}
