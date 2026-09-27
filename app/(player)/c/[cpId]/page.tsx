import { redirect } from 'next/navigation';
import { currentTeamId } from '@/lib/session';
import { scan } from '@/lib/play';

export const dynamic = 'force-dynamic';

// A printed QR opens this URL in the phone's normal browser. The sequence
// check inside scan() is the real lock; the signature only stops hand-typing.
export default async function CheckpointLanding({
  params,
  searchParams,
}: {
  params: { cpId: string };
  searchParams: { t?: string };
}) {
  const cpId = Number(params.cpId);
  const t = searchParams.t ?? '';
  const teamId = await currentTeamId();
  if (!teamId) {
    // Preserve the checkpoint URL so one login returns them right here.
    redirect(`/login?next=${encodeURIComponent(`/c/${params.cpId}?t=${t}`)}`);
  }
  const result = await scan(teamId, cpId, t);
  redirect(result === 'ok' ? '/play' : `/play?scan=${result}`);
}
