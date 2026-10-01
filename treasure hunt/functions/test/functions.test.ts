/**
 * functions.test.ts — Cloud Functions integration tests via the Firebase emulator.
 *
 * Tests: createTeam, joinTeam, submitAnswer (with placeholder answers), facilitatorAction.
 *
 * Prerequisites (handled by `npm test`):
 *   firebase emulators:start --only auth,firestore,functions
 */

import * as admin from "firebase-admin";
import { expect } from "chai";

// Initialise the Admin SDK pointed at the local emulator.
if (!admin.apps.length) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  process.env.FUNCTIONS_EMULATOR_HOST = "127.0.0.1:5001";
  admin.initializeApp({ projectId: "treasure-hunt-38935" });
}

const db = admin.firestore();

// Helper: call a Cloud Function via the Admin SDK's internal emulator HTTP endpoint.
async function callFunction(
  name: string,
  data: unknown,
  uid?: string
): Promise<unknown> {
  const url = `http://127.0.0.1:5001/treasure-hunt-38935/us-central1/${name}`;

  // Build a minimal Firebase callable request body.
  const body = { data };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (uid) {
    // Mint a custom token and exchange it for an ID token using the Auth emulator.
    const customToken = await admin.auth().createCustomToken(uid);

    const tokenRes = await fetch(
      `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-key`,
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
    result?: unknown;
    error?: {
      message: string;
    };
  };

  if (json.error) {
    throw new Error(json.error.message);
  }

  return json.result;
}

// Helper: seed a facilitator doc via Admin SDK.
async function seedFacilitator(uid: string) {
  await db.collection("facilitators").doc(uid).set({
    uid, displayName: "Test Fac", createdAt: admin.firestore.Timestamp.now(),
  });
}

// ── createTeam ─────────────────────────────────────────────────────────────────

describe("createTeam", () => {
  it("creates a team and returns teamId + joinCode", async () => {
    const result = await callFunction("createTeam", { teamName: "Echo Squad" }, "user1") as {
      teamId: string;
      joinCode: string;
    };

    expect(result).to.have.property("teamId").that.is.a("string");
    expect(result).to.have.property("joinCode").that.has.length(5);

    const snap = await db.collection("teams").doc(result.teamId).get();
    expect(snap.exists).to.be.true;
    expect(snap.data()?.members).to.include("user1");
  });

  it("rejects unauthenticated createTeam calls", async () => {
    try {
      await callFunction("createTeam", { teamName: "Ghost" });
      expect.fail("Should have thrown");
    } catch (err: unknown) {
      expect((err as Error).message).to.include("Authentication required.");
    }
  });
});

// ── joinTeam ──────────────────────────────────────────────────────────────────

describe("joinTeam", () => {
  it("adds a second member to an existing team", async () => {
    // Create a team with user2.
    const created = await callFunction("createTeam", { teamName: "Join Test" }, "user2") as {
      teamId: string;
      joinCode: string;
    };

    // user3 joins via the join code.
    const joinResult = await callFunction(
      "joinTeam",
      { joinCode: created.joinCode },
      "user3"
    ) as { teamId: string; alreadyMember: boolean };

    expect(joinResult.teamId).to.equal(created.teamId);
    expect(joinResult.alreadyMember).to.be.false;

    const snap = await db.collection("teams").doc(created.teamId).get();
    expect(snap.data()?.members).to.include.members(["user2", "user3"]);
  });

  it("returns alreadyMember=true when calling joinTeam twice", async () => {
    const created = await callFunction("createTeam", { teamName: "Idempotent" }, "user4") as {
      teamId: string;
      joinCode: string;
    };

    const r1 = await callFunction("joinTeam", { joinCode: created.joinCode }, "user5") as {
      alreadyMember: boolean;
    };
    const r2 = await callFunction("joinTeam", { joinCode: created.joinCode }, "user5") as {
      alreadyMember: boolean;
    };

    expect(r1.alreadyMember).to.be.false;
    expect(r2.alreadyMember).to.be.true;
  });
});

// ── submitAnswer ──────────────────────────────────────────────────────────────

describe("submitAnswer", () => {
  it("returns correct=false for a wrong answer (placeholder-safe)", async () => {
    const created = await callFunction("createTeam", { teamName: "Answer Test" }, "user6") as {
      teamId: string;
    };

    const result = await callFunction(
      "submitAnswer",
      { teamId: created.teamId, fragmentId: "F01", answer: "DEFINITELY_WRONG" },
      "user6"
    ) as { correct: boolean };

    // Placeholder answer is "TODO_ANSWER_F01" so any other string → incorrect.
    expect(result.correct).to.be.false;
  });

  it("rejects submitAnswer from a non-member", async () => {
    const created = await callFunction("createTeam", { teamName: "Non-member Test" }, "user7") as {
      teamId: string;
    };

    try {
      await callFunction(
        "submitAnswer",
        { teamId: created.teamId, fragmentId: "F01", answer: "anything" },
        "user8"  // not a member of this team
      );
      expect.fail("Should have thrown");
    } catch (err: unknown) {
      expect((err as Error).message).to.match(/You are not a member of this team\./);
    }
  });
});

// ── facilitatorAction ─────────────────────────────────────────────────────────

describe("facilitatorAction", () => {
  it("allows a facilitator to deliver a hint", async () => {
    await seedFacilitator("fac-test-1");

    const created = await callFunction("createTeam", { teamName: "Hint Test" }, "userA") as {
      teamId: string;
    };

    const result = await callFunction(
      "facilitatorAction",
      { type: "hint", teamId: created.teamId, fragmentId: "F01", hintLevel: 1 },
      "fac-test-1"
    ) as { success: boolean };

    expect(result.success).to.be.true;

    // Verify a hint document was written.
    const hints = await db
      .collection("teams").doc(created.teamId)
      .collection("fragments").doc("F01")
      .collection("hints")
      .get();
    expect(hints.empty).to.be.false;
    expect(hints.docs[0].data().text).to.equal("TODO_HINT_F01_L1");
  });

  it("denies a non-facilitator from calling facilitatorAction", async () => {
    const created = await callFunction("createTeam", { teamName: "Deny Test" }, "userB") as {
      teamId: string;
    };

    try {
      await callFunction(
        "facilitatorAction",
        { type: "hint", teamId: created.teamId, fragmentId: "F01", hintLevel: 1 },
        "userB"  // not a facilitator
      );
      expect.fail("Should have thrown");
    } catch (err: unknown) {
      expect((err as Error).message).to.include("Facilitator access required.");
    }
  });
});

export { };
