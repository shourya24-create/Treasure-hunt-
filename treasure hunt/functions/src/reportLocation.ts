/**
 * reportLocation.ts — Heartbeat from the team's one phone, with its GPS fix
 * when location is available (GAMEPLAY.md §4.1, §10).
 *
 * Always stamps `lastSeenAt`, which is how the admin dashboard knows a phone
 * is online. `lat`/`lng` are optional: a phone that has denied location still
 * sends the heartbeat. Writes only these two fields, so it never touches game
 * progress and does not need the team transaction.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { parseTeamId, requireAuth } from "./lib/guards.js";
import { teamRef } from "./lib/store.js";
import type { TeamLocation } from "./schema.js";

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export const reportLocation = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data as {
    teamId?: unknown;
    lat?: unknown;
    lng?: unknown;
    accuracy?: unknown;
  };
  const teamId = parseTeamId(data.teamId);

  const ref = teamRef(getFirestore(), teamId);
  const snap = await ref.get();
  if (snap.data()?.deviceUid !== uid) {
    throw new HttpsError(
      "permission-denied",
      "This phone is not logged in for this team."
    );
  }

  const now = Timestamp.now();
  if (data.lat == null && data.lng == null) {
    await ref.update({ lastSeenAt: now });
    return { ok: true, serverTime: now.toMillis() };
  }

  if (!inRange(data.lat, -90, 90) || !inRange(data.lng, -180, 180)) {
    throw new HttpsError("invalid-argument", "lat and lng must be valid coordinates.");
  }
  const location: TeamLocation = {
    lat: data.lat,
    lng: data.lng,
    accuracy: inRange(data.accuracy, 0, 1e6) ? data.accuracy : 0,
    at: now,
  };
  await ref.update({ location, lastSeenAt: now });

  // The phone corrects its countdown with this, in case its own clock is off.
  return { ok: true, serverTime: now.toMillis() };
});
