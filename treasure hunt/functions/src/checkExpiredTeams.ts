/**
 * checkExpiredTeams.ts — Scheduled function: marks teams "finished" when time runs out.
 *
 * Runs every minute. For each team in "playing" status, checks whether
 * startedAt + timeLimit - pausedDuration <= now. If so, sets status to "finished".
 *
 * Phase 3 — Timer mechanic.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

export const checkExpiredTeams = onSchedule("every 1 minutes", async () => {
  const db = getFirestore();
  const now = Timestamp.now();

  const playingTeams = await db
    .collection("teams")
    .where("status", "==", "playing")
    .get();

  const expirations: Promise<void>[] = [];

  for (const doc of playingTeams.docs) {
    const data = doc.data();
    const startedAt: Timestamp | undefined = data.startedAt;
    const timeLimit: number = data.timeLimit ?? 3600;
    const pausedDuration: number = data.pausedDuration ?? 0;

    if (!startedAt) continue;

    const elapsedSeconds = now.seconds - startedAt.seconds - pausedDuration;
    if (elapsedSeconds >= timeLimit) {
      expirations.push(
        doc.ref.update({ status: "finished" }).then(() => {
          console.log(`Team ${doc.id} expired after ${elapsedSeconds}s (limit: ${timeLimit}s).`);
        })
      );
    }
  }

  await Promise.all(expirations);
});
