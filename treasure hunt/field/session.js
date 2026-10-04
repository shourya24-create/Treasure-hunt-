/**
 * session.js — Who is holding this phone, and how the field pages talk to the game.
 *
 * The Flutter app and these pages are on one site, so the Firebase login the
 * team made in the app is already here (UI.md §5). Nothing is typed again.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-lite.js";

import { API_BASE, FIREBASE } from "./config.js";

const app = initializeApp(FIREBASE);
const auth = getAuth(app);
const db = getFirestore(app);

/** The signed-in user, or null. Waits for the stored login to load. */
function currentUser() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(user);
    });
  });
}

/**
 * The team this phone plays for: `{ id, activeCheckpoint, status, ... }`.
 * Null when the phone is not logged in or holds no team.
 */
export async function loadTeam() {
  const user = await currentUser();
  if (!user) return null;
  // The rules let a phone read only the view it has claimed.
  const found = await getDocs(
    query(collection(db, "teamViews"), where("deviceUid", "==", user.uid), limit(1))
  );
  if (found.empty) return null;
  const doc = found.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Calls one of the game's callables and returns its result. Throws an Error
 * whose message is safe to show when the game refuses the call.
 */
export async function callGame(name, data) {
  const user = auth.currentUser;
  if (!user) throw new Error("This phone is not logged in.");
  const response = await fetch(`${API_BASE}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify({ data }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || "The game did not answer. Try again.");
  }
  return body.result;
}

/** Back to the Flutter app. */
export function backToApp() {
  window.location.href = "/";
}
