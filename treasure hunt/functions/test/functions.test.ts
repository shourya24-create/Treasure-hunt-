/**
 * functions.test.ts — Cloud Functions integration tests via the Firebase emulator.
 *
 * Tests: claimTeam, enterGateCode, recordArrival, submitAnswer, ackReward,
 * requestHelp, reportLocation, facilitatorAction — with placeholder codes and answers.
 *
 * Prerequisites (handled by `npm test`):
 *   firebase emulators:start --only auth,firestore,functions
 */

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { expect } from "chai";

// Initialise the Admin SDK pointed at the local emulator.
if (!getApps().length) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  process.env.FUNCTIONS_EMULATOR_HOST = "127.0.0.1:5001";
  initializeApp({ projectId: "treasure-hunt-38935" });
}

const db = getFirestore();

// Helper: call a Cloud Function via the Admin SDK's internal emulator HTTP endpoint.
async function callFunction<T = Record<string, unknown>>(
  name: string,
  data: unknown,
  uid?: string
): Promise<T> {
  const url = `http://127.0.0.1:5001/treasure-hunt-38935/us-central1/${name}`;

  // Build a minimal Firebase callable request body.
  const body = { data };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (uid) {
    // Mint a custom token and exchange it for an ID token using the Auth emulator.
    const customToken = await getAuth().createCustomToken(uid);

    const tokenRes = await fetch(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-key",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: customToken,
          returnSecureToken: true,
        }),
      }
    );

    const tokenData = (await tokenRes.json()) as {
      idToken: string;
    };

    headers["Authorization"] = `Bearer ${tokenData.idToken}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    result?: T;
    error?: {
      message: string;
    };
  };

  if (json.error) {
    throw new Error(json.error.message);
  }

  return json.result as T;
}

async function expectRejects(promise: Promise<unknown>, message: RegExp | string) {
  try {
    await promise;
  } catch (err: unknown) {
    if (typeof message === "string") {
      expect((err as Error).message).to.include(message);
    } else {
      expect((err as Error).message).to.match(message);
    }
    return;
  }
  expect.fail("Should have thrown");
}

const FAC = "fac-test-1";
const DESK = "desk-test-1";
const admit = (data: Record<string, unknown>) => callFunction("facilitatorAction", data, FAC);
const team = async (id: string) => (await db.collection("teams").doc(id).get()).data()!;
const view = async (id: string) => (await db.collection("teamViews").doc(id).get()).data()!;
const game = async () => (await db.collection("game").doc("state").get()).data()!;

/** Logs `phone` in as `teamId` and passes CP1. */
async function start(teamId: string, phone: string) {
  await callFunction("claimTeam", { teamId, loginCode: `TODO_LOGIN_${teamId}` }, phone);
  await callFunction("enterGateCode", { teamId, code: `TODO_GATE_${teamId}` }, phone);
}

// Hooks live inside this block so they never run for another test file.
describe("Cloud Functions", () => {
  before(async () => {
    await db.collection("facilitators").doc(FAC).set({
      uid: FAC, displayName: "Test Fac", createdAt: Timestamp.now(),
    });
    await db.collection("facilitators").doc(DESK).set({
      uid: DESK, displayName: "Test Desk", role: "desk", createdAt: Timestamp.now(),
    });
    await admit({ type: "seedTeams" });
    await admit({ type: "startGame" });
  });

  // ── seedTeams ─────────────────────────────────────────────────────────────────

  describe("seedTeams", () => {
    it("creates the 12 teams with their routes, and never overwrites them", async () => {
      const teams = await db.collection("teams").get();
      expect(teams.size).to.equal(12);
      expect((await team("T8")).route).to.deep.equal({ start: "CP2", direction: "reverse" });

      const again = await admit({ type: "seedTeams" }) as { created: string[] };
      expect(again.created).to.be.empty;
    });
  });

  // ── claimTeam ─────────────────────────────────────────────────────────────────

  describe("claimTeam", () => {
    it("binds a team to one phone and refuses a second", async () => {
      await callFunction("claimTeam", { teamId: "T1", loginCode: "TODO_LOGIN_T1" }, "phoneA");
      expect((await view("T1")).deviceUid).to.equal("phoneA");

      await expectRejects(
        callFunction("claimTeam", { teamId: "T1", loginCode: "TODO_LOGIN_T1" }, "phoneB"),
        "This team is active on another phone."
      );
    });

    it("rejects a wrong login code and unauthenticated calls", async () => {
      await expectRejects(
        callFunction("claimTeam", { teamId: "T2", loginCode: "WRONG" }, "phoneC"),
        "Invalid team ID or password."
      );
      await expectRejects(
        callFunction("claimTeam", { teamId: "T2", loginCode: "TODO_LOGIN_T2" }),
        "Authentication required."
      );
    });

    it("lets a new phone in after a facilitator releases the device", async () => {
      await callFunction("claimTeam", { teamId: "T3", loginCode: "TODO_LOGIN_T3" }, "phoneD");
      await admit({ type: "releaseDevice", teamId: "T3" });
      await callFunction("claimTeam", { teamId: "T3", loginCode: "TODO_LOGIN_T3" }, "phoneE");
      expect((await team("T3")).deviceUid).to.equal("phoneE");
    });
  });

  // ── the campus run ────────────────────────────────────────────────────────────

  describe("campus run", () => {
    it("gate code → scan → solve, with the view updated at each step", async () => {
      await callFunction("claimTeam", { teamId: "T4", loginCode: "TODO_LOGIN_T4" }, "phone4");

      const wrong = await callFunction("enterGateCode", { teamId: "T4", code: "NOPE" }, "phone4");
      expect(wrong.accepted).to.be.false;

      const gate = await callFunction(
        "enterGateCode", { teamId: "T4", code: "TODO_GATE_T4" }, "phone4"
      );
      expect(gate.accepted).to.be.true;
      expect((await view("T4")).cp1Done).to.be.true;

      // Chapter 1 waits on the view until the phone has played it.
      expect((await view("T4")).pendingReward.chapter.n).to.equal(1);
      await callFunction("ackReward", { teamId: "T4" }, "phone4");
      expect((await view("T4")).pendingReward).to.be.null;

      // T4's route starts at CP5.
      const miss = await callFunction("recordArrival", { teamId: "T4", checkpointId: "CP2" }, "phone4");
      expect(miss.match).to.be.false;
      const hit = await callFunction("recordArrival", { teamId: "T4", checkpointId: "CP5" }, "phone4");
      expect(hit.match).to.be.true;
      expect((await view("T4")).activeCheckpoint).to.equal("CP5");

      const bad = await callFunction(
        "submitAnswer", { teamId: "T4", checkpointId: "CP5", answer: "DEFINITELY_WRONG" }, "phone4"
      );
      expect(bad.correct).to.be.false;

      const good = await callFunction(
        "submitAnswer", { teamId: "T4", checkpointId: "CP5", answer: "TODO_ANSWER_CP5" }, "phone4"
      );
      expect(good.correct).to.be.true;

      const v = await view("T4");
      expect(v.step).to.equal(1);
      expect(v.pendingReward.stationReaction.text).to.equal("TODO_REACTION_CP5");
      expect(v.pendingReward.chapter.n).to.equal(2);
      expect(v.locationClue).to.equal("TODO_CLUE_CP6");
      expect(v.activeCheckpoint).to.be.null;
      expect(v).to.not.have.property("route");
      expect(v).to.not.have.property("points");
      expect((await team("T4")).points).to.equal(200);
    });

    it("rejects a phone that is not logged in for the team", async () => {
      await start("T5", "phone5");
      await expectRejects(
        callFunction("recordArrival", { teamId: "T5", checkpointId: "CP6" }, "intruder"),
        "This phone is not logged in for this team."
      );
      await expectRejects(
        callFunction("reportLocation", { teamId: "T5", lat: 19.07, lng: 72.9, accuracy: 8 }, "intruder"),
        "This phone is not logged in for this team."
      );
    });

    it("counts a checkpoint once when two correct answers race", async () => {
      await start("T6", "phone6");
      await callFunction("recordArrival", { teamId: "T6", checkpointId: "CP7" }, "phone6");
      const submit = () => callFunction(
        "submitAnswer", { teamId: "T6", checkpointId: "CP7", answer: "TODO_ANSWER_CP7" }, "phone6"
      );
      const results = await Promise.all([submit(), submit(), submit()]);
      expect(results.every((r) => r.correct === true)).to.be.true;

      const t = await team("T6");
      expect(t.checkpointsDone).to.have.length(1);
      expect(t.points).to.equal(200);
    });

    it("stores the phone's heartbeat and latest GPS fix", async () => {
      await start("T7", "phone7");
      await callFunction("reportLocation", { teamId: "T7" }, "phone7"); // location denied
      expect((await team("T7")).lastSeenAt).to.not.be.null;
      expect((await team("T7")).location).to.be.null;

      await callFunction("reportLocation", { teamId: "T7", lat: 19.07, lng: 72.9, accuracy: 8 }, "phone7");
      const t = await team("T7");
      expect(t.location.lat).to.equal(19.07);
      expect(t.status).to.equal("playing");
    });

    it("raises a help request until an admin resolves it", async () => {
      await callFunction("requestHelp", { teamId: "T7" }, "phone7");
      expect((await team("T7")).helpRequestedAt).to.not.be.null;
      expect((await view("T7")).helpRequestedAt).to.not.be.null;

      await admit({ type: "resolveHelp", teamId: "T7" });
      expect((await team("T7")).helpRequestedAt).to.be.null;
    });
  });

  // ── facilitatorAction ─────────────────────────────────────────────────────────

  describe("facilitatorAction", () => {
    it("denies a non-facilitator", async () => {
      await expectRejects(
        callFunction("facilitatorAction", { type: "recordHint", teamId: "T8", checkpointId: "CP2" }, "phoneA"),
        "Facilitator access required."
      );
    });

    it("records a hint as −20 and writes the audit trail", async () => {
      await start("T8", "phone8");
      await admit({ type: "recordHint", teamId: "T8", checkpointId: "CP2" });

      const t = await team("T8");
      expect(t.points).to.equal(80);
      expect(t.hintsTaken[0]).to.include({ cp: "CP2", by: FAC });

      const log = await db.collection("facilitatorCommands")
        .where("teamId", "==", "T8").where("type", "==", "recordHint").get();
      expect(log.empty).to.be.false;
      expect(log.docs[0].data().processed).to.be.true;
    });

    it("force-completes, reroutes, and runs the final", async () => {
      await start("T9", "phone9"); // CP4 CP3 CP2 CP8 CP7 CP6 CP5

      await admit({ type: "swapNext", teamId: "T9", checkpointId: "CP8" });
      const forced = await admit({ type: "forceComplete", teamId: "T9" });
      expect(forced.checkpointId).to.equal("CP8");

      await expectRejects(
        admit({ type: "arrivedFinal", teamId: "T9" }),
        "still has checkpoints to visit"
      );
      for (let i = 0; i < 6; i++) await admit({ type: "forceComplete", teamId: "T9" });
      expect((await view("T9")).returnToBase).to.be.true;

      await admit({ type: "arrivedFinal", teamId: "T9" });
      expect(await game()).to.deep.include({ finalQueue: ["T9"], inHeadset: null });
      await admit({ type: "startViewing", teamId: "T9" });
      expect((await game()).inHeadset).to.equal("T9");
      await admit({ type: "recordDecision", teamId: "T9", decision: "DESTROY" });
      expect(await game()).to.deep.include({ finalQueue: [], inHeadset: null });
      await expectRejects(
        admit({ type: "recordDecision", teamId: "T9", decision: "KEEP" }),
        "cannot be changed"
      );

      const t = await team("T9");
      expect(t.status).to.equal("finished");
      expect(t.decidedAt).to.not.be.null;
      expect(t.points).to.equal(800);
      expect(await view("T9")).to.not.have.property("decisionCorrect");
    });

    it("stops campus play for everyone when the game ends", async () => {
      await start("T10", "phone10");
      await admit({ type: "endGame" });
      try {
        await expectRejects(
          callFunction("recordArrival", { teamId: "T10", checkpointId: "CP6" }, "phone10"),
          "The campus game has ended."
        );
        // The team still does the final.
        await admit({ type: "arrivedFinal", teamId: "T10" });
        expect((await team("T10")).status).to.equal("atFinal");
      } finally {
        await admit({ type: "reopenGame" });
      }
      expect((await game()).ended).to.be.false;
    });

    it("limits a desk volunteer to the gate desk and the final desk", async () => {
      const desk = (data: Record<string, unknown>) => callFunction("facilitatorAction", data, DESK);

      const gate = await desk({ type: "listGateCodes" }) as { codes: Record<string, string> };
      expect(gate.codes.T5).to.equal("TODO_GATE_T5");
      await desk({ type: "startViewing", teamId: "T10" });
      await desk({ type: "recordDecision", teamId: "T10", decision: "KEEP" });
      expect((await team("T10")).status).to.equal("finished");

      await expectRejects(
        desk({ type: "recordHint", teamId: "T10", checkpointId: "CP2" }),
        "Admin access required for this action."
      );
      await expectRejects(desk({ type: "endGame" }), "Admin access required for this action.");
    });

    it("reports content status without leaking any content", async () => {
      const status = await admit({ type: "contentStatus" }) as {
        items: { label: string; total: number; delivered: number }[];
      };
      expect(status.items).to.have.length(8);
      expect(JSON.stringify(status)).to.not.include("TODO_");
    });
  });
});

export { };
