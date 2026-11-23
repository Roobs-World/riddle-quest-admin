import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {RACE_RULES} from "@riddle-quest/core/race";
import {abandonRaceRunForUser, readyRaceRunForUser, resumeRaceRunForUser, submitRaceGuessForUser,
  requestRaceHintForUser, skipRaceRiddleForUser} from "../../race/raceService";
import type {RaceRunRecord} from "../../race/raceEngine";

/** Demo-only canonical storage for readiness and cancellation clock ordering. */
let db: FirebaseFirestore.Firestore;
/** Prepared owned run whose countdown has not yet accepted scoring. */
const fixture = (versioned: boolean): RaceRunRecord => ({runId: "ready-clock-run", userId: "ready-clock-player", role: "challenger",
  ...(versioned ? {recordVersion: 1 as const} : {}), status: "prepared", categoryId: "history", locale: "en",
  rulesVersion: RACE_RULES.version, deckId: "ready-clock-deck", preparationExpiresAtMs: 30000,
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
    text: "A clue", answer: "test", position})), currentPosition: 0, correctCount: 0, guessesUsed: 0,
  hintUsed: false, revealedLetters: [], startedAtMs: 0, hintPenaltyMs: 0, skipPenaltyMs: 0, events: [],
  opponent: {displayName: "Rival", subjectUserId: "ready-clock-rival", adjustedFinishMs: 10000, events: []}});

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("readiness-clock-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all(["raceRuns", "users", "jestAccountDeletionTombstones", "racePerformanceOutbox", "raceSettlementOutbox"]
    .map(name => db.recursiveDelete(db.collection(name))));
  await db.doc("users/ready-clock-player").set({displayName: "Player", coins: 0});
});

describe.each([false, true])("readiness clock ordering, recordVersion1=%s", versioned => {
  beforeEach(async () => {await db.doc("raceRuns/ready-clock-run").set(fixture(versioned));});

  it("does not project an accepted active phase before its fixed start", async () => {
    await readyRaceRunForUser("ready-clock-player", {runId: "ready-clock-run", requestId: "clock-ready"}, {db, nowMs: 5000});
    await resumeRaceRunForUser("ready-clock-player", "ready-clock-run", {db, nowMs: 9000});
    expect((await db.doc("raceRuns/ready-clock-run").get()).data()?.status).toBe("active");
    expect((await resumeRaceRunForUser("ready-clock-player", "ready-clock-run", {db, nowMs: 2000})).run)
      .toMatchObject({status: "active", startsAtMs: 8000, serverNowMs: 8000, wallElapsedMs: 0});
  });

  it("supports old scheduled storage without the new readiness marker", async () => {
    await db.doc("raceRuns/ready-clock-run").set({...fixture(versioned), status: "scheduled", startedAtMs: 8000});
    expect((await resumeRaceRunForUser("ready-clock-player", "ready-clock-run", {db, nowMs: 2000})).run)
      .toMatchObject({status: "scheduled", startsAtMs: 8000, serverNowMs: 5000});
    expect((await abandonRaceRunForUser("ready-clock-player", {runId: "ready-clock-run", requestId: "clock-old-abandon"},
      {db, nowMs: 2000})).run).toMatchObject({status: "abandoned", serverNowMs: 5000, wallElapsedMs: 0});
  });

  it("continues rejecting pre-start scoring without changing canonical state", async () => {
    await readyRaceRunForUser("ready-clock-player", {runId: "ready-clock-run", requestId: "clock-ready"}, {db, nowMs: 5000});
    /** No scoring mutation may consume the countdown or weaken its accepted-clock marker. */
    const before = (await db.doc("raceRuns/ready-clock-run").get()).data();
    for (const operation of [submitRaceGuessForUser, requestRaceHintForUser, skipRaceRiddleForUser]) {
      await expect(operation("ready-clock-player", {runId: "ready-clock-run", riddleId: "q-0", requestId: "clock-score", guess: "test"},
        {db, nowMs: 6000})).rejects.toMatchObject({code: "failed-precondition"});
    }
    expect((await db.doc("raceRuns/ready-clock-run").get()).data()).toEqual(before);
    expect((await db.collection("raceRuns/ready-clock-run/requests").get()).empty).toBe(true);
  });

  it.each(["ready", "resume"])("does not rewind the countdown on an older %s request", async operation => {
    await readyRaceRunForUser("ready-clock-player", {runId: "ready-clock-run", requestId: "clock-ready"}, {db, nowMs: 5000});
    /** The request sampled earlier but observed the already-accepted countdown. */
    const response = operation === "ready"
      ? await readyRaceRunForUser("ready-clock-player", {runId: "ready-clock-run", requestId: "clock-replay"}, {db, nowMs: 2000})
      : await resumeRaceRunForUser("ready-clock-player", "ready-clock-run", {db, nowMs: 2000});
    expect(response.run).toMatchObject({status: "scheduled", startsAtMs: 8000, serverNowMs: 5000, wallElapsedMs: 0});
  });

  it.each([2000, 6000])("accepts abandonment during countdown with sampled clock %s", async sampledAtMs => {
    await readyRaceRunForUser("ready-clock-player", {runId: "ready-clock-run", requestId: "clock-ready"}, {db, nowMs: 5000});
    /** Cancellation is valid before scored play; its accepted time cannot precede readiness. */
    const response = await abandonRaceRunForUser("ready-clock-player", {runId: "ready-clock-run", requestId: "clock-abandon"},
      {db, nowMs: sampledAtMs});
    expect(response.run).toMatchObject({status: "abandoned", startsAtMs: 8000, serverNowMs: Math.max(5000, sampledAtMs), wallElapsedMs: 0});
    expect((await db.doc("raceRuns/ready-clock-run").get()).data()).toMatchObject({status: "abandoned",
      finishedAtMs: Math.max(5000, sampledAtMs), lastActionAtMs: Math.max(5000, sampledAtMs), wallFinishMs: 0});
    /** Exact replay and subsequent recovery both remain accepted, without economy or delivery effects. */
    expect(await abandonRaceRunForUser("ready-clock-player", {runId: "ready-clock-run", requestId: "clock-abandon"},
      {db, nowMs: 9000})).toEqual(response);
    expect((await resumeRaceRunForUser("ready-clock-player", "ready-clock-run", {db, nowMs: 2000})).run.status).toBe("abandoned");
    expect((await db.doc("users/ready-clock-player").get()).data()?.coins).toBe(0);
    expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
  });

  it("does not backdate blocked countdown recovery before readiness", async () => {
    await readyRaceRunForUser("ready-clock-player", {runId: "ready-clock-run", requestId: "clock-ready"}, {db, nowMs: 5000});
    await db.doc("users/ready-clock-player/blockedRivals/ready-clock-rival").set({blockedAtMs: 5500});
    expect((await resumeRaceRunForUser("ready-clock-player", "ready-clock-run", {db, nowMs: 2000})).run)
      .toMatchObject({status: "abandoned", serverNowMs: 5000, wallElapsedMs: 0});
    expect((await db.doc("raceRuns/ready-clock-run").get()).data()?.finishedAtMs).toBe(5000);
  });

  it("retains the accepted preparation-expiry clock on older recovery", async () => {
    await readyRaceRunForUser("ready-clock-player", {runId: "ready-clock-run", requestId: "clock-expiry"}, {db, nowMs: 30000});
    expect((await resumeRaceRunForUser("ready-clock-player", "ready-clock-run", {db, nowMs: 2000})).run)
      .toMatchObject({status: "abandoned", serverNowMs: 30000, wallElapsedMs: 0});
  });
});
