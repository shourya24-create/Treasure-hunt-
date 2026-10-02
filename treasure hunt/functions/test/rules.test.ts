/**
 * rules.test.ts — Firestore security rules tests.
 *
 * Run via: npm test
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

import * as fs from "fs";
import * as path from "path";

import {
  setDoc,
  getDoc,
  doc,
  collection,
  addDoc,
} from "firebase/firestore";

let testEnv: RulesTestEnvironment;

const RULES_PATH = path.resolve(__dirname, "../../firebase.rules");

// ── Setup ─────────────────────────────────────────────────────────────────────

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "treasure-hunt-38935",

    firestore: {
      rules: fs.readFileSync(RULES_PATH, "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

// Seed a team while security rules are disabled.
async function seedTeam(
  teamId: string,
  members: string[]
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, "teams", teamId), {
      id: teamId,
      name: "Test Team",
      joinCode: "TTEST",
      status: "playing",
      createdAt: new Date(),
      timeLimit: 3600,
      pausedDuration: 0,
      members,
      currentFragmentIndex: 0,
    });
  });
}

// Seed a facilitator while security rules are disabled.
async function seedFacilitator(
  uid: string
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, "facilitators", uid), {
      uid,
      displayName: "Test Facilitator",
      createdAt: new Date(),
    });
  });
}

// ── Test: unauthenticated access ──────────────────────────────────────────────

describe("Unauthenticated access", () => {

  it("denies reading a team document", async () => {
    await seedTeam("team1", ["userA"]);

    const unauth = testEnv.unauthenticatedContext();

    await assertFails(
      getDoc(doc(unauth.firestore(), "teams", "team1"))
    );
  });

  it("denies writing a new team", async () => {
    const unauth = testEnv.unauthenticatedContext();

    await assertFails(
      setDoc(doc(unauth.firestore(), "teams", "newTeam"), {
        id: "newTeam",
        name: "X",
        joinCode: "XXXXX",
        status: "waiting",
        createdAt: new Date(),
        timeLimit: 3600,
        pausedDuration: 0,
        members: ["nobody"],
        currentFragmentIndex: 0,
      })
    );
  });
});

// ── Test: team member access ──────────────────────────────────────────────────

describe("Team member access", () => {

  it("allows a member to read their own team", async () => {
    await seedTeam("team2", ["alice"]);

    const alice = testEnv.authenticatedContext("alice");

    await assertSucceeds(
      getDoc(doc(alice.firestore(), "teams", "team2"))
    );
  });

  it("denies a non-member reading another team", async () => {
    await seedTeam("team3", ["alice"]);

    const bob = testEnv.authenticatedContext("bob");

    await assertFails(
      getDoc(doc(bob.firestore(), "teams", "team3"))
    );
  });

  it("allows a member to create a team with themselves in members", async () => {
    const charlie = testEnv.authenticatedContext("charlie");

    await assertSucceeds(
      setDoc(doc(charlie.firestore(), "teams", "team4"), {
        id: "team4",
        name: "Charlie",
        joinCode: "CCCCC",
        status: "waiting",
        createdAt: new Date(),
        timeLimit: 3600,
        pausedDuration: 0,
        members: ["charlie"],
        currentFragmentIndex: 0,
      })
    );
  });

  it("denies creating a team without the creator in members", async () => {
    const dave = testEnv.authenticatedContext("dave");

    await assertFails(
      setDoc(doc(dave.firestore(), "teams", "team5"), {
        id: "team5",
        name: "BadTeam",
        joinCode: "BBBBB",
        status: "waiting",
        createdAt: new Date(),
        timeLimit: 3600,
        pausedDuration: 0,
        members: ["someone_else"],
        currentFragmentIndex: 0,
      })
    );
  });
});

// ── Test: facilitator access ──────────────────────────────────────────────────

describe("Facilitator access", () => {

  it("allows a facilitator to read any team (watchAllTeams)", async () => {
    await seedTeam("team6", ["alice"]);
    await seedFacilitator("fac1");

    const fac = testEnv.authenticatedContext("fac1");

    await assertSucceeds(
      getDoc(doc(fac.firestore(), "teams", "team6"))
    );
  });

  it("allows a facilitator to write a facilitatorCommand", async () => {
    await seedFacilitator("fac2");

    const fac = testEnv.authenticatedContext("fac2");

    await assertSucceeds(
      addDoc(
        collection(fac.firestore(), "facilitatorCommands"),
        {
          type: "hint",
          teamId: "anyteam",
          fragmentId: "F01",
          hintLevel: 1,
          issuedAt: new Date(),
          facilitatorUid: "fac2",
          processed: false,
        }
      )
    );
  });

  it("denies a non-facilitator writing a facilitatorCommand", async () => {
    const eve = testEnv.authenticatedContext("eve");

    await assertFails(
      addDoc(
        collection(eve.firestore(), "facilitatorCommands"),
        {
          type: "hint",
          teamId: "anyteam",
          fragmentId: "F01",
          hintLevel: 1,
          issuedAt: new Date(),
          facilitatorUid: "eve",
          processed: false,
        }
      )
    );
  });

  it("denies clients reading a facilitator document of another uid", async () => {
    await seedFacilitator("fac3");

    const eve = testEnv.authenticatedContext("eve");

    await assertFails(
      getDoc(doc(eve.firestore(), "facilitators", "fac3"))
    );
  });
});

// ── Test: hint sub-collection ─────────────────────────────────────────────────

describe("Hint sub-collection", () => {

  it("allows a team member to write a hint request", async () => {
    await seedTeam("team7", ["alice"]);

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await setDoc(
        doc(db, "teams", "team7", "fragments", "F01"),
        {
          fragmentId: "F01",
          status: "active",
          evidence: [],
          hintsUsed: 0,
        }
      );
    });

    const alice = testEnv.authenticatedContext("alice");

    await assertSucceeds(
      addDoc(
        collection(
          alice.firestore(),
          "teams",
          "team7",
          "fragments",
          "F01",
          "hints"
        ),
        {
          level: 1,
          requestedAt: new Date(),
        }
      )
    );
  });

  it("denies a non-member writing a hint request", async () => {
    await seedTeam("team8", ["alice"]);

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await setDoc(
        doc(db, "teams", "team8", "fragments", "F01"),
        {
          fragmentId: "F01",
          status: "active",
          evidence: [],
          hintsUsed: 0,
        }
      );
    });

    const bob = testEnv.authenticatedContext("bob");

    await assertFails(
      addDoc(
        collection(
          bob.firestore(),
          "teams",
          "team8",
          "fragments",
          "F01",
          "hints"
        ),
        {
          level: 1,
          requestedAt: new Date(),
        }
      )
    );
  });
});

// Mocha entry point
export { };

