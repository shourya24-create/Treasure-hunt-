import { redirect } from 'next/navigation';
import { currentTeamId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  redirect((await currentTeamId()) ? '/play' : '/login');
}
