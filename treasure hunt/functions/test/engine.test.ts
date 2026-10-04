/**
 * engine.test.ts — Unit tests for the game rules in src/lib/engine.ts.
 *
 * Pure functions only: no emulator needed. Run via: npm run test:unit
 * Content is all TODO_* placeholders, so the tests type the placeholders
 * themselves as codes and answers.
 */

import { expect } from "chai";
import { Timestamp } from "firebase-admin/firestore";
import {
  CODE_ATTEMPTS,
  CODE_LOCK_MS,
  GAME_DURATION_MS,
  applyAckReward,
  applyArrival,
  applyArrivedFinal,
  applyCancelViewing,
  applyClaim,
  applyDecision,
  applyForceComplete,
  applyGateCode,
  applyHelpRequest,
  applyHint,
  applyMoveToEnd,
  applyPause,
  applyReopen,
  applyReset,
  applyResolveHelp,
  applySolve,
  applyStartViewing,
  applySwapNext,
  applyUndoHint,
  assertDevice,
  buildView,
  campusClosed,
  newGame,
  newTeam,
  nextCheckpoint,
  pointsOf,
  routeOrder,
} from "../src/lib/engine";
import { contentStatus } from "../src/lib/contentStatus";
import { TEAMS } from "../src/content/teams";
import {
  TEAM_IDS,
  type CampusCheckpointId,
  type GameState,
  type TeamDoc,
  type TeamId,
} from "../src/schema";

const now = () => Timestamp.now();
const PHONE = "phone-1";

/** GAMEPLAY.md §5.3, typed out by hand so the derivation is checked against it. */
const ROUTE_TABLE: Record<TeamId, string> = {
  T1: "CP2 CP3 CP4 CP5 CP6 CP7 CP8",
  T2: "CP3 CP4 CP5 CP6 CP7 CP8 CP2",
  T3: "CP4 CP5 CP6 CP7 CP8 CP2 CP3",
  T4: "CP5 CP6 CP7 CP8 CP2 CP3 CP4",
  T5: "CP6 CP7 CP8 CP2 CP3 CP4 CP5",
  T6: "CP7 CP8 CP2 CP3 CP4 CP5 CP6",
  T7: "CP8 CP2 CP3 CP4 CP5 CP6 CP7",
  T8: "CP2 CP8 CP7 CP6 CP5 CP4 CP3",
  T9: "CP4 CP3 CP2 CP8 CP7 CP6 CP5",
  T10: "CP6 CP5 CP4 CP3 CP2 CP8 CP7",
  T11: "CP8 CP7 CP6 CP5 CP4 CP3 CP2",
  T12: "CP3 CP2 CP8 CP7 CP6 CP5 CP4",
};

/** A game the admin started a minute ago. */
function runningGame(): GameState {
  return { ...newGame(now()), startedAt: Timestamp.fromMillis(Date.now() - 60_000) };
}

/** A team that has logged in and passed CP1. */
function startedTeam(id: TeamId): TeamDoc {
  const team = newTeam(id, now());
  applyClaim(team, PHONE, TEAMS[id].loginCode, now());
  applyGateCode(team, runningGame(), TEAMS[id].gateCode, now());
  return team;
}

/** Scans and solves the team's next checkpoint. */
function solveNext(team: TeamDoc) {
  const cp = nextCheckpoint(team) as CampusCheckpointId;
  applyArrival(team, runningGame(), cp, PHONE, now());
  return applySolve(team, runningGame(), cp, `TODO_ANSWER_${cp}`, now());
}

function expectThrows(fn: () => unknown, message: RegExp) {
  expect(fn).to.throw(message);
}

// ── Routes ────────────────────────────────────────────────────────────────────

describe("routes", () => {
  it("derives every team's order exactly as the GAMEPLAY.md table", () => {
    for (const id of TEAM_IDS) {
      expect(routeOrder(TEAMS[id].route).join(" "), id).to.equal(ROUTE_TABLE[id]);
    }
  });

  it("puts at most 2 teams on a checkpoint at any step", () => {
    for (let step = 0; step < 7; step++) {
      const count: Record<string, number> = {};
      for (const id of TEAM_IDS) {
        const cp = routeOrder(TEAMS[id].route)[step];
        count[cp] = (count[cp] ?? 0) + 1;
      }
      expect(Math.max(...Object.values(count)), `step ${step + 1}`).to.be.at.most(2);
    }
  });

  it("lets any two teams share a checkpoint at most once", () => {
    for (const a of TEAM_IDS) {
      for (const b of TEAM_IDS) {
        if (a >= b) continue;
        const ra = routeOrder(TEAMS[a].route);
        const rb = routeOrder(TEAMS[b].route);
        const shared = ra.filter((cp, i) => rb[i] === cp).length;
        expect(shared, `${a}+${b}`).to.be.at.most(1);
      }
    }
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe("one phone per team", () => {
  it("refuses a second phone and a wrong password", () => {
    const team = newTeam("T1", now());
    expect(applyClaim(team, PHONE, "WRONG", now())).to.deep.equal({
      claimed: false, message: "Invalid team ID or password.",
    });
    expect(team.deviceUid).to.be.null;

    expect(applyClaim(team, PHONE, "TODO_LOGIN_T1", now())).to.deep.equal({ claimed: true });
    expect(applyClaim(team, PHONE, "todo_login_t1", now())).to.deep.equal({ claimed: true }); // same phone again is fine
    expect(applyClaim(team, "phone-2", "TODO_LOGIN_T1", now())).to.deep.include({ claimed: false });
    expect(team.deviceUid).to.equal(PHONE);
    expectThrows(() => assertDevice(team, "phone-2"), /not logged in for this team/);
  });

  it("locks for a short while after several wrong passwords in a row", () => {
    const team = newTeam("T1", now());
    for (let i = 0; i < CODE_ATTEMPTS; i++) applyClaim(team, PHONE, "WRONG", now());

    // Even the right password must wait out the lock.
    expectThrows(() => applyClaim(team, PHONE, "TODO_LOGIN_T1", now()), /Too many wrong codes/);
    const later = Timestamp.fromMillis(Date.now() + CODE_LOCK_MS + 1000);
    expect(applyClaim(team, PHONE, "TODO_LOGIN_T1", later)).to.deep.equal({ claimed: true });
    expect(team.loginGuard).to.deep.equal({ failures: 0, lockedUntil: null });
  });
});

// ── CP1 ───────────────────────────────────────────────────────────────────────

describe("CP1 gate code", () => {
  it("stays locked until the admin starts the game", () => {
    const team = newTeam("T2", now());
    expectThrows(
      () => applyGateCode(team, newGame(now()), "TODO_GATE_T2", now()),
      /has not started/
    );
  });

  it("slows down guessing without costing points", () => {
    const team = newTeam("T2", now());
    const game = runningGame();
    for (let i = 0; i < CODE_ATTEMPTS; i++) {
      expect(applyGateCode(team, game, "GUESS", now())).to.deep.equal({ accepted: false });
    }
    expectThrows(() => applyGateCode(team, game, "TODO_GATE_T2", now()), /Too many wrong codes/);
    expect(pointsOf(team)).to.equal(0);
    // Wrong passwords from a stranger never lock the gate.
    expect(team.loginGuard.failures).to.equal(0);

    const later = Timestamp.fromMillis(Date.now() + CODE_LOCK_MS + 1000);
    expect(applyGateCode(team, game, "TODO_GATE_T2", later)).to.deep.equal({ accepted: true });
  });

  it("rejects a wrong code with no penalty, then starts the run", () => {
    const team = newTeam("T2", now());
    const game = runningGame();

    expect(applyGateCode(team, game, "TODO_GATE_T1", now())).to.deep.equal({ accepted: false });
    expect(team.status).to.equal("waiting");
    expect(pointsOf(team)).to.equal(0);

    expect(applyGateCode(team, game, " todo_gate_t2 ", now())).to.deep.equal({ accepted: true });
    expect(team.status).to.equal("playing");
    expect(pointsOf(team)).to.equal(100);

    // Chapter 1 is pending, with the object hint for the first checkpoint but
    // no location clue: the paper already named the place.
    const view = buildView(team);
    expect(view.pendingReward?.stationReaction).to.be.null;
    expect(view.pendingReward?.chapter.n).to.equal(1);
    expect(view.objectHint?.text).to.equal("TODO_OBJECT_HINT_CP3");
    expect(view.locationClue).to.be.null;
  });
});

// ── Campus checkpoints ────────────────────────────────────────────────────────

describe("campus checkpoints", () => {
  it("only accepts the scan object of the team's next checkpoint", () => {
    const team = startedTeam("T2"); // route starts at CP3
    const game = runningGame();

    expect(applyArrival(team, game, "CP5", PHONE, now())).to.deep.equal({ match: false });
    expect(team.arrival).to.be.null;
    expect(applyArrival(team, game, "CP3", PHONE, now())).to.deep.equal({ match: true });
    expect(team.arrival?.cp).to.equal("CP3");
    expect(buildView(team).activeCheckpoint).to.equal("CP3");
  });

  it("will not grade a checkpoint the team has not arrived at", () => {
    const team = startedTeam("T2");
    expectThrows(
      () => applySolve(team, runningGame(), "CP3", "TODO_ANSWER_CP3", now()),
      /Scan this checkpoint's object first/
    );
  });

  it("lets a wrong answer retry, then queues reaction, chapter and clue", () => {
    const team = startedTeam("T2");
    const game = runningGame();
    applyArrival(team, game, "CP3", PHONE, now());

    expect(applySolve(team, game, "CP3", "nope", now())).to.deep.equal({ correct: false });
    expect(pointsOf(team)).to.equal(100);

    expect(applySolve(team, game, "CP3", "todo_answer_cp3", now())).to.deep.equal({ correct: true });
    expect(pointsOf(team)).to.equal(200);
    expect(team.arrival).to.be.null;
    expect(team.checkpointsDone[0].arrivedAt).to.not.be.null;

    const view = buildView(team);
    expect(view.pendingReward?.stationReaction?.text).to.equal("TODO_REACTION_CP3"); // by checkpoint
    expect(view.pendingReward?.chapter.n).to.equal(2); // by step
    expect(view.locationClue).to.equal("TODO_CLUE_CP4"); // by route
    expect(view.objectHint?.text).to.equal("TODO_OBJECT_HINT_CP4");
  });

  it("plays the whole run: 8 chapters in order, then return to base", () => {
    const team = startedTeam("T9"); // reverse route
    const chapters = [buildView(team).pendingReward?.chapter.n];
    for (let step = 1; step <= 7; step++) {
      expect(solveNext(team).correct).to.be.true;
      const view = buildView(team);
      chapters.push(view.pendingReward?.chapter.n);
      expect(view.returnToBase).to.equal(step === 7);
    }
    expect(chapters).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(team.checkpointsDone.map((d) => d.cp).join(" ")).to.equal(ROUTE_TABLE.T9);
    expect(pointsOf(team)).to.equal(800);

    const view = buildView(team);
    expect(view.objectHint).to.be.null;
    expect(view.chapters.map((c) => c.n)).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8]);

    // The archive lists the same 8 completions, with what led to each one.
    expect(view.archive.map((e) => e.n)).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(view.archive.map((e) => e.chapter.n)).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8]);
    const [cp1, first, second] = view.archive;
    expect(cp1.stationReaction).to.be.null;
    expect(cp1.objectHint).to.be.null;
    const [firstCp, secondCp] = team.checkpointsDone.map((d) => d.cp);
    expect(first.locationClue).to.be.null; // the paper named it
    expect(first.objectHint?.text).to.equal(`TODO_OBJECT_HINT_${firstCp}`);
    expect(second.locationClue).to.equal(`TODO_CLUE_${secondCp}`);
    expect(second.stationReaction?.text).to.equal(`TODO_REACTION_${secondCp}`);
  });

  it("gives two teams at different checkpoints the same chapter at the same step", () => {
    const forward = startedTeam("T1");
    const reverse = startedTeam("T11");
    for (let i = 0; i < 3; i++) {
      solveNext(forward);
      solveNext(reverse);
    }
    expect(forward.checkpointsDone[2].cp).to.not.equal(reverse.checkpointsDone[2].cp);
    expect(buildView(forward).pendingReward?.chapter.n).to.equal(4);
    expect(buildView(reverse).pendingReward?.chapter.n).to.equal(4);
  });
});

// ── Reward ────────────────────────────────────────────────────────────────────

describe("reward sequence", () => {
  it("stays pending across reloads until the phone has played it", () => {
    const team = startedTeam("T1");
    expect(buildView(team).pendingReward?.chapter.n).to.equal(1);
    expect(buildView(team).pendingReward?.chapter.n).to.equal(1); // a reload shows it again

    applyAckReward(team);
    expect(buildView(team).pendingReward).to.be.null;

    solveNext(team);
    expect(buildView(team).pendingReward?.chapter.n).to.equal(2);
    applyAckReward(team);
    applyAckReward(team);
    expect(buildView(team).pendingReward).to.be.null;
    expect(buildView(team).chapters.map((c) => c.n)).to.deep.equal([1, 2]);
  });

  it("does not mark a newer reward as played when an older chapter is acknowledged", () => {
    const team = startedTeam("T1");
    solveNext(team); // chapter 2 pending
    // The phone finishes chapter 2 just as an admin force-completes the next checkpoint.
    applyForceComplete(team, runningGame(), undefined, now());
    applyAckReward(team, 2);
    expect(buildView(team).pendingReward?.chapter.n).to.equal(3);

    applyAckReward(team, 99); // a chapter that does not exist yet acknowledges nothing extra
    applyAckReward(team, 1); // and an old one never moves it backwards
    expect(team.rewardAck).to.equal(3);
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────────

describe("idempotency", () => {
  it("changes nothing when an action that already succeeded is repeated", () => {
    const team = startedTeam("T3");
    const game = runningGame();
    applyArrival(team, game, "CP4", PHONE, now());
    applySolve(team, game, "CP4", "TODO_ANSWER_CP4", now());
    const snapshot = JSON.stringify(team);

    expect(applyGateCode(team, game, "anything", now())).to.deep.equal({ accepted: true });
    expect(applySolve(team, game, "CP4", "whatever", now())).to.deep.equal({ correct: true });
    expect(applyArrival(team, game, "CP4", PHONE, now())).to.deep.equal({ match: false });

    expect(JSON.stringify(team)).to.equal(snapshot);
  });
});

// ── Pause and end ─────────────────────────────────────────────────────────────

describe("pause and the 2-hour mark", () => {
  it("blocks scans and solves while paused", () => {
    const team = startedTeam("T1");
    applyPause(team, true);
    expectThrows(() => applyArrival(team, runningGame(), "CP2", PHONE, now()), /paused/);
    applyPause(team, false);

    const game = { ...runningGame(), paused: true };
    expectThrows(() => applyArrival(team, game, "CP2", PHONE, now()), /paused/);
  });

  it("closes the campus when the admin ends the game or the 2 hours run out", () => {
    const started = Timestamp.fromMillis(Date.now() - GAME_DURATION_MS - 1000);
    expect(campusClosed(runningGame(), now())).to.be.false;
    expect(campusClosed({ ...runningGame(), ended: true }, now())).to.be.true;
    expect(campusClosed({ ...newGame(now()), startedAt: started }, now())).to.be.true;
    expect(campusClosed(newGame(now()), now())).to.be.false; // not started yet
  });

  it("stops campus play once the game has ended, but keeps the points", () => {
    const team = startedTeam("T1");
    solveNext(team);
    const ended = { ...runningGame(), ended: true };

    expectThrows(() => applyArrival(team, ended, "CP3", PHONE, now()), /ended/);
    expectThrows(() => applyForceComplete(team, ended, undefined, now()), /ended/);
    expect(pointsOf(team)).to.equal(200);

    // The team still does the final.
    applyArrivedFinal(team, ended, now());
    applyDecision(team, ended, "KEEP", now());
    expect(team.status).to.equal("finished");
  });
});

// ── Admin actions ─────────────────────────────────────────────────────────────

describe("admin actions", () => {
  it("records a hint as −20 against any checkpoint, and can undo it", () => {
    const team = startedTeam("T1");
    applyHint(team, "CP1", "fac", now());
    applyHint(team, "CP6", "fac", now());
    expect(pointsOf(team)).to.equal(60);

    applyUndoHint(team);
    expect(pointsOf(team)).to.equal(80);
    expect(team.hintsTaken.map((h) => h.cp)).to.deep.equal(["CP1"]);
  });

  it("force-complete counts exactly like a solve", () => {
    const team = newTeam("T4", now());
    const game = runningGame();

    expect(applyForceComplete(team, game, undefined, now())).to.deep.equal({ checkpointId: "CP1" });
    expect(team.status).to.equal("playing");

    expect(applyForceComplete(team, game, undefined, now())).to.deep.equal({ checkpointId: "CP5" });
    expect(pointsOf(team)).to.equal(200);
    expect(team.checkpointsDone[0].via).to.equal("force");
    expect(buildView(team).chapters.map((c) => c.n)).to.deep.equal([1, 2]);
    expect(buildView(team).pendingReward?.chapter.n).to.equal(2);
    expect(nextCheckpoint(team)).to.equal("CP6");
  });

  it("swaps the next checkpoint with a later one and shows the new clue", () => {
    const team = startedTeam("T1"); // CP2 CP3 CP4 …
    applyArrival(team, runningGame(), "CP2", PHONE, now());

    applySwapNext(team, "CP5");
    expect(nextCheckpoint(team)).to.equal("CP5");
    expect(team.arrival).to.be.null;
    expect(buildView(team).locationClue).to.equal("TODO_CLUE_CP5");

    // Every checkpoint is still visited exactly once.
    while (nextCheckpoint(team)) solveNext(team);
    expect(team.checkpointsDone.map((d) => d.cp).join(" ")).to.equal(
      "CP5 CP3 CP4 CP2 CP6 CP7 CP8"
    );
    expectThrows(() => applySwapNext(team, "CP3"), /not on this team's remaining route/);
  });

  it("moves a broken checkpoint to the end of the route", () => {
    const team = startedTeam("T1");
    solveNext(team); // CP2 done
    applyMoveToEnd(team, undefined); // CP3 → end
    while (nextCheckpoint(team)) solveNext(team);
    expect(team.checkpointsDone.map((d) => d.cp).join(" ")).to.equal(
      "CP2 CP4 CP5 CP6 CP7 CP8 CP3"
    );
  });

  it("raises a help request once and clears it when resolved", () => {
    const team = startedTeam("T1");
    applyHelpRequest(team, now());
    const first = team.helpRequestedAt;
    applyHelpRequest(team, now());
    expect(team.helpRequestedAt).to.equal(first);
    expect(buildView(team).helpRequestedAt).to.equal(first);

    applyResolveHelp(team);
    expect(buildView(team).helpRequestedAt).to.be.null;
  });

  it("resets a team for a rehearsal but keeps its phone", () => {
    const team = startedTeam("T1");
    const game = runningGame();
    while (nextCheckpoint(team)) solveNext(team);
    applyArrivedFinal(team, game, now());

    applyReset(team, game, now());
    expect(team.status).to.equal("waiting");
    expect(team.checkpointsDone).to.be.empty;
    expect(team.deviceUid).to.equal(PHONE);
    expect(game.finalQueue).to.be.empty;
  });
});

// ── Final ─────────────────────────────────────────────────────────────────────

describe("final", () => {
  /** A team that has finished all 7 campus checkpoints. */
  function finishedCampus(id: TeamId): TeamDoc {
    const team = startedTeam(id);
    while (nextCheckpoint(team)) solveNext(team);
    return team;
  }

  it("needs all 7 checkpoints before a team can be marked arrived", () => {
    const team = startedTeam("T1");
    expectThrows(
      () => applyArrivedFinal(team, runningGame(), now()),
      /still has checkpoints to visit/
    );
  });

  it("queues teams first come, first served, with one team in the headset", () => {
    const game = runningGame();
    const a = finishedCampus("T3");
    const b = finishedCampus("T7");

    applyArrivedFinal(a, game, now());
    applyArrivedFinal(b, game, now());
    applyArrivedFinal(a, game, now()); // marking twice keeps one place
    expect(game.finalQueue).to.deep.equal(["T3", "T7"]);

    applyStartViewing(a, game, now());
    expect(game.inHeadset).to.equal("T3");
    expectThrows(() => applyStartViewing(b, game, now()), /T3 is in the headset/);

    applyDecision(a, game, "KEEP", now());
    expect(game.finalQueue).to.deep.equal(["T7"]);
    expect(game.inHeadset).to.be.null;
    applyStartViewing(b, game, now());
    expect(game.inHeadset).to.equal("T7");
  });

  it("frees the headset when a viewing is cancelled", () => {
    const game = runningGame();
    const a = finishedCampus("T3");
    const b = finishedCampus("T7");
    applyArrivedFinal(a, game, now());
    applyArrivedFinal(b, game, now());

    applyStartViewing(b, game, now()); // tapped the wrong row
    applyCancelViewing(b, game);
    expect(game.inHeadset).to.be.null;
    expect(game.finalQueue).to.deep.equal(["T3", "T7"]);
    applyStartViewing(a, game, now());
    expect(game.inHeadset).to.equal("T3");
  });

  it("sends a team back on campus when a mistaken END is reopened", () => {
    const ended = { ...runningGame(), ended: true };
    const midway = startedTeam("T4");
    solveNext(midway);
    const done = finishedCampus("T5");
    applyArrivedFinal(midway, ended, now());
    applyArrivedFinal(done, ended, now());

    const reopened = { ...ended, ended: false };
    applyReopen(midway, reopened, now());
    applyReopen(done, reopened, now());

    expect(midway.status).to.equal("playing");
    expect(midway.finalArrivedAt).to.be.null;
    expect(done.status).to.equal("atFinal"); // really finished: stays in the queue
    expect(reopened.finalQueue).to.deep.equal(["T5"]);
    expect(pointsOf(midway)).to.equal(200);
  });

  it("records the decision once, by the admin, after arrival", () => {
    const game = runningGame();
    const team = finishedCampus("T1");

    expectThrows(() => applyDecision(team, game, "DESTROY", now()), /arrived at the final first/);
    applyArrivedFinal(team, game, now());
    expect(team.status).to.equal("atFinal");

    applyDecision(team, game, "DESTROY", now());
    const decidedAt = team.decidedAt;
    expect(team.status).to.equal("finished");

    applyDecision(team, game, "DESTROY", now()); // same decision again changes nothing
    expect(team.decidedAt).to.equal(decidedAt);
    expectThrows(() => applyDecision(team, game, "KEEP", now()), /cannot be changed/);
  });

  it("adds the +100 bonus only for the correct decision", () => {
    const team = startedTeam("T1");
    team.decisionCorrect = false;
    expect(pointsOf(team)).to.equal(100);
    team.decisionCorrect = true;
    expect(pointsOf(team)).to.equal(200);
  });
});

// ── What the phone may see ────────────────────────────────────────────────────

describe("team view", () => {
  it("never carries the route, the points or the decision result", () => {
    const team = startedTeam("T1");
    solveNext(team);
    team.decisionCorrect = true;

    const keys = Object.keys(buildView(team));
    for (const secret of [
      "route", "routeOverride", "checkpointsDone", "decisionCorrect",
      "hintsTaken", "location", "points",
    ]) {
      expect(keys, secret).to.not.include(secret);
    }
  });

  it("shows nothing to chase before CP1", () => {
    const view = buildView(newTeam("T1", now()));
    expect(view.cp1Done).to.be.false;
    expect(view.chapters).to.be.empty;
    expect(view.pendingReward).to.be.null;
    expect(view.objectHint).to.be.null;
    expect(view.returnToBase).to.be.false;
  });
});

// ── Content status ────────────────────────────────────────────────────────────

describe("content status", () => {
  it("reports every content group and never a content value", () => {
    const items = contentStatus();
    expect(items.map((i) => i.total)).to.deep.equal([12, 12, 8, 7, 7, 7, 7, 1]);
    for (const item of items) {
      expect(item.delivered).to.be.within(0, item.total);
      expect(Object.keys(item)).to.have.members(["label", "total", "delivered"]);
    }
  });
});

export { };
