/**
 * scan.js — The arrival check (GAMEPLAY.md §4.3, UI.md §5).
 *
 * MindAR watches the camera for the 7 scan objects. When it sees one, the
 * game is asked whether that checkpoint is this team's next one:
 *   yes → arrival is recorded and the team goes back to the app, where
 *         that fragment is now unlocked to solve;
 *   no  → "THIS IS NOT YOUR SIGNAL", and the scanner keeps running.
 * The page never learns the team's route: it only sends what it saw.
 */

import { MindARThree } from "mindar-image-three";

import { TARGETS_FILE, TARGET_CHECKPOINTS } from "./config.js";
import { backToApp, callGame, loadTeam } from "./session.js";

const scanner = document.getElementById("scanner");
const state = document.getElementById("state");
const title = document.getElementById("title");
const message = document.getElementById("message");

/** How long "not your signal" stays up before the scanner listens again. */
const REFUSAL_MS = 2500;

function show(mode, stateText, titleText, messageText) {
  scanner.classList.remove("failed", "locked");
  if (mode) scanner.classList.add(mode);
  state.textContent = stateText;
  title.textContent = titleText;
  message.textContent = messageText;
}

function showScanning() {
  show(null, "Scanning", "Find the scan target", "Point the camera at the object from your fragment.");
}

/** Replaces the scanner with a full-page note. */
function showNote(titleText, text) {
  scanner.hidden = true;
  document.getElementById("note-title").textContent = titleText;
  document.getElementById("note-text").textContent = text;
  document.getElementById("note").hidden = false;
}

/** Back to the app's Fragments tab, where the unlocked fragment is solved. */
function openFragment() {
  window.location.replace("/#/fragments");
}

document.getElementById("exit").addEventListener("click", backToApp);
document.getElementById("note-back").addEventListener("click", backToApp);

async function main() {
  let team;
  try {
    team = await loadTeam();
  } catch {
    showNote("Signal lost", "Could not reach the game. Check your connection and try again.");
    return;
  }
  if (!team) {
    showNote("Not logged in", "Log in with your team in the app first, then open the scanner again.");
    return;
  }
  // Already scanned: the fragment is waiting to be solved.
  if (team.activeCheckpoint) {
    openFragment();
    return;
  }

  const mindar = new MindARThree({
    container: document.getElementById("camera"),
    imageTargetSrc: TARGETS_FILE,
    maxTrack: 1,
    // The page has its own overlay.
    uiLoading: "no",
    uiScanning: "no",
    uiError: "no",
  });

  // One call to the game at a time, and none while a verdict is on screen.
  let busy = false;

  async function onSeen(checkpoint) {
    if (busy) return;
    busy = true;
    show(null, "Checking", "Signal found", "Hold still. Checking it against your fragment.");
    try {
      const { match } = await callGame("recordArrival", {
        teamId: team.id,
        checkpointId: checkpoint,
      });
      if (match) {
        show("locked", "Signal locked", "This is your signal", "Fragment unlocked. Opening it.");
        mindar.stop();
        // Long enough to read, short enough not to feel stuck.
        setTimeout(openFragment, 1200);
        return;
      }
      show("failed", "Wrong signal", "This is not your signal", "Check your clue and look for the right object.");
    } catch (error) {
      show("failed", "Refused", "Scan not accepted", error.message);
    }
    setTimeout(() => {
      busy = false;
      showScanning();
    }, REFUSAL_MS);
  }

  TARGET_CHECKPOINTS.forEach((checkpoint, index) => {
    mindar.addAnchor(index).onTargetFound = () => onSeen(checkpoint);
  });

  scanner.hidden = false;
  showScanning();
  try {
    await mindar.start();
  } catch {
    showNote(
      "Camera blocked",
      "The scanner needs the camera. Allow camera access for this site in your browser settings, then open the scanner again."
    );
    return;
  }
  // Nothing is drawn over the camera, but MindAR tracks on the render loop.
  mindar.renderer.setAnimationLoop(() => mindar.renderer.render(mindar.scene, mindar.camera));
}

main();
