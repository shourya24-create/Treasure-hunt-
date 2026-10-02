/**
 * seed.ts — One-off setup: creates T1…T12 and, optionally, a facilitator.
 *
 *   npm run seed                              seed the 12 teams + /game/state
 *   npm run seed -- --facilitator <uid> [name]   also allow that Auth user into the dashboard
 *   npm run seed -- --desk <uid> [name]          same, as a desk volunteer (gate + final desks only)
 *
 * Runs against the emulator when FIRESTORE_EMULATOR_HOST is set, otherwise
 * against the project in GOOGLE_APPLICATION_CREDENTIALS / gcloud defaults.
 * Never overwrites an existing team.
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { contentStatus } from "../lib/contentStatus.js";
import { seedTeams } from "../lib/store.js";
import type { FacilitatorDoc } from "../schema.js";

async function main(): Promise<void> {
  initializeApp();
  const db = getFirestore();

  const { created } = await seedTeams(db);
  console.log(
    created.length > 0
      ? `Created ${created.length} team(s): ${created.join(", ")}.`
      : "All 12 teams already exist; nothing created."
  );

  for (const role of ["admin", "desk"] as const) {
    const flag = process.argv.indexOf(role === "admin" ? "--facilitator" : "--desk");
    if (flag < 0) continue;
    const uid = process.argv[flag + 1];
    if (!uid) throw new Error("--facilitator / --desk needs a Firebase Auth UID.");
    const doc: FacilitatorDoc = {
      uid,
      displayName: process.argv[flag + 2] ?? "Facilitator",
      role,
      createdAt: Timestamp.now(),
    };
    await db.collection("facilitators").doc(uid).set(doc);
    console.log(`${uid} can now open the dashboard as ${role}.`);
  }

  for (const item of contentStatus()) {
    if (item.delivered < item.total) {
      console.warn(
        `WARNING: ${item.label}: ${item.total - item.delivered} of ${item.total} still TODO_* placeholders.`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
