/**
 * config.js — What the scanner page needs to know about the project.
 *
 * FIREBASE must match flutter_app/lib/firebase_options.dart (web): the
 * scanner runs on the same site as the Flutter app and reuses its login.
 */

export const FIREBASE = {
  apiKey: "AIzaSyDzJSiLCLsrqFVGYtEtFeEofs-7NFJ03c0",
  appId: "1:648716688016:web:fb69ad0ed2711995771615",
  messagingSenderId: "648716688016",
  projectId: "echo-protocol-da7f7",
  authDomain: "echo-protocol-da7f7.firebaseapp.com",
  storageBucket: "echo-protocol-da7f7.firebasestorage.app",
};

/** Where the game's callables are served (see ../vercel/api/index.js). */
export const API_BASE = "/api";

/** The compiled MindAR image targets: all 7 scan objects in one file. */
export const TARGETS_FILE = "/field/targets/targets.mind";

/**
 * Which checkpoint each image target stands for, in the order the images
 * were compiled into TARGETS_FILE. Target 0 is the first image, and so on.
 * If the .mind file is recompiled in another order, change this to match.
 */
export const TARGET_CHECKPOINTS = ["CP2", "CP3", "CP4", "CP5", "CP6", "CP7", "CP8"];
