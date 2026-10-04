/**
 * api/index.js — Serves the game's callables from Vercel instead of Cloud Functions.
 *
 * Every function in ../backend (a copy of functions/lib, made by build.sh) is
 * a Firebase `onCall` handler, which is an ordinary (req, res) handler: it
 * checks the caller's Firebase ID token and speaks the callable protocol. So
 * the Flutter app calls /api/<name> exactly as it would call Cloud Functions.
 *
 * Needs the FIREBASE_SERVICE_ACCOUNT environment variable (the service
 * account key, as JSON) so the Admin SDK can reach Firestore and Auth.
 */

const express = require("express");
const backend = require("../backend/index.js");

const app = express();

// onCall expects the parsed body, and the raw bytes next to it.
app.use(
  express.json({
    limit: "100kb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.all("*", (req, res) => {
  // /api/claimTeam → claimTeam
  const name = req.path.split("/").filter(Boolean).pop();
  const handler = name && Object.prototype.hasOwnProperty.call(backend, name)
    ? backend[name]
    : undefined;
  if (typeof handler !== "function") {
    res.status(404).json({ error: { status: "NOT_FOUND", message: "Unknown function." } });
    return;
  }
  handler(req, res);
});

module.exports = app;
