/**
 * activity.js — Placeholder for a checkpoint's activity (see activity.html).
 *
 * Only checks that this phone really has an activity open, so the page
 * cannot be reached by typing its address.
 */

import { backToApp, loadTeam } from "./session.js";

document.getElementById("back").addEventListener("click", backToApp);

async function main() {
  const team = await loadTeam().catch(() => null);
  // No arrival on record: there is nothing to do here.
  if (!team || !team.activeCheckpoint) backToApp();
}

main();
