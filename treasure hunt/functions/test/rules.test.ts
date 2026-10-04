/**
 * rules.test.ts — Firestore security rules tests.
 *
 * Run via: npm test
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

import * as fs from "fs";
import * as path from "path";

import {
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  doc,
  collection,
  addDoc,
  query,
  where,
} from "firebase/firestore";

let testEnv: RulesTestEnvironment;

// Tests run from functions/, one level below firebase.rules.
const RULES_PATH = path.resolve(process.cwd(), "../firebase.rules");

// Hooks live inside this block so they never run for another test file.
describe("Firestore rules", () => {
  // ── Setup ─────────────────────────────────────────────────────────────────────

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "echo-protocol-da7f7",

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

  // Seed a team and its player view while security rules are disabled.
  async function seedTeam(
    teamId: string,
    deviceUid: string | null
  ) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await setDoc(doc(db, "teams", teamId), {
        id: teamId,
        name: teamId,
        route: { start: "CP2", direction: "forward" },
        status: "playing",
        deviceUid,
        points: 100,
      });
      await setDoc(doc(db, "teamViews", teamId), {
        id: teamId,
        name: teamId,
        status: "playing",
        deviceUid,
        points: 100,
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
    it("denies reading a team, a team view and the game state", async () => {
      await seedTeam("T1", "phoneA");

      const db = testEnv.unauthenticatedContext().firestore();

      await assertFails(getDoc(doc(db, "teams", "T1")));
      await assertFails(getDoc(doc(db, "teamViews", "T1")));
      await assertFails(getDoc(doc(db, "game", "state")));
    });
  });

  // ── Test: the team's phone ────────────────────────────────────────────────────

  describe("Team phone access", () => {
    it("allows the claimed phone to read its own team view", async () => {
      await seedTeam("T1", "phoneA");

      const phone = testEnv.authenticatedContext("phoneA").firestore();

      await assertSucceeds(getDoc(doc(phone, "teamViews", "T1")));
      await assertSucceeds(
        getDocs(query(collection(phone, "teamViews"), where("deviceUid", "==", "phoneA")))
      );
    });

    it("denies the phone the server-side team document (route, decision result)", async () => {
      await seedTeam("T1", "phoneA");

      const phone = testEnv.authenticatedContext("phoneA").firestore();

      await assertFails(getDoc(doc(phone, "teams", "T1")));
    });

    it("denies another phone reading the team view", async () => {
      await seedTeam("T1", "phoneA");

      const other = testEnv.authenticatedContext("phoneB").firestore();

      await assertFails(getDoc(doc(other, "teamViews", "T1")));
      await assertFails(getDocs(collection(other, "teamViews")));
    });

    it("denies every client write, even to the phone's own team", async () => {
      await seedTeam("T1", "phoneA");

      const phone = testEnv.authenticatedContext("phoneA").firestore();

      await assertFails(updateDoc(doc(phone, "teamViews", "T1"), { points: 800 }));
      await assertFails(updateDoc(doc(phone, "teams", "T1"), { points: 800 }));
      await assertFails(setDoc(doc(phone, "teams", "T13"), { id: "T13", deviceUid: "phoneA" }));
      await assertFails(setDoc(doc(phone, "game", "state"), { ended: false, paused: false }));
    });

    it("allows any signed-in phone to read the game state", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "game", "state"), { ended: false, paused: false });
      });

      const phone = testEnv.authenticatedContext("phoneA").firestore();

      await assertSucceeds(getDoc(doc(phone, "game", "state")));
    });
  });

  // ── Test: facilitator access ──────────────────────────────────────────────────

  describe("Facilitator access", () => {
    it("allows a facilitator to read every team (watchAllTeams)", async () => {
      await seedTeam("T1", "phoneA");
      await seedTeam("T2", null);
      await seedFacilitator("fac1");

      const fac = testEnv.authenticatedContext("fac1").firestore();

      await assertSucceeds(getDoc(doc(fac, "teams", "T1")));
      await assertSucceeds(getDocs(collection(fac, "teams")));
      await assertSucceeds(getDocs(collection(fac, "facilitatorCommands")));
    });

    it("denies a facilitator writing directly — actions go through the function", async () => {
      await seedTeam("T1", "phoneA");
      await seedFacilitator("fac2");

      const fac = testEnv.authenticatedContext("fac2").firestore();

      await assertFails(updateDoc(doc(fac, "teams", "T1"), { points: 800 }));
      await assertFails(
        addDoc(collection(fac, "facilitatorCommands"), {
          type: "recordHint",
          teamId: "T1",
          checkpointId: "CP2",
          issuedAt: new Date(),
          facilitatorUid: "fac2",
          processed: false,
        })
      );
    });

    it("denies clients reading a facilitator document of another uid", async () => {
      await seedFacilitator("fac3");

      const eve = testEnv.authenticatedContext("eve").firestore();

      await assertFails(getDoc(doc(eve, "facilitators", "fac3")));
    });
  });
});

// Mocha entry point
export { };
