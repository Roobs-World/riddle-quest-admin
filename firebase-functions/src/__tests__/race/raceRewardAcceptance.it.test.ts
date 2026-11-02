import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue, Timestamp} from "firebase-admin/firestore";
import {RACE_RULES, RACE_ACHIEVEMENT_IDS} from "@riddle-quest/core/race";
import {getRaceOutcomeForUser, resumeRaceRunForUser, publishRaceChallengeForUser} from "../../race/raceService";
import {raceOutcome, type RaceRunRecord} from "../../race/raceEngine";
import {deliverRaceSettlement} from "../../race/raceSettlementDelivery";
import {replayRaceDelivery} from "../../race/raceDeliveryRecovery";

/** All destructive fixtures require a dedicated local demo emulator. */
let db: FirebaseFirestore.Firestore;
/** Canonical terminal challenger awaiting exactly-once achievement settlement. */
const fixture = (): RaceRunRecord => ({runId: "reward-run", userId: "reward-player", role: "challenger", status: "completed",
  result: "player_win", categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version, deckId: "reward-deck",
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
    text: "A clue", answer: "test", position})), currentPosition: 9, correctCount: 10, guessesUsed: 0,
  hintUsed: false, revealedLetters: [], startedAtMs: 1000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: [],
  wallFinishMs: 5000, finishedAtMs: 6000, challengeId: "reward-challenge",
  opponent: {displayName: "Creator", subjectUserId: "reward-creator", adjustedFinishMs: 10000, events: []}});
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("reward-acceptance-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all(["raceRuns", "users", "raceDecks", "raceChallenges", "raceMatchCandidates", "racePerformanceOutbox", "raceSettlementOutbox", "jestAccountDeletionTombstones"]
    .map(name => db.recursiveDelete(db.collection(name))));
  await db.doc("users/reward-player").set({displayName: "Player", coins: 100});
  await db.doc("raceRuns/reward-run").set({...fixture(), expiresAt: Timestamp.fromMillis(100000)});
  await db.doc("raceDecks/reward-deck").set({deckId: "reward-deck", categoryId: "history", locale: "en",
    canonicalRiddleIds: fixture().riddles.map(riddle => riddle.canonicalRiddleId), contentVersion: "reward-content",
    rulesVersion: RACE_RULES.version, createdAtMs: 1000});
});

it.each([-1, 1.5, "100", null, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER])(
  "rejects invalid or overflowing currency before settlement or outcome acknowledgement: %s", async coins => {
    await db.doc("users/reward-player").update({coins});
    /** Retain complete state to prove no balance normalization or reward receipt was committed. */
    const account = (await db.doc("users/reward-player").get()).data();
    /** The full source includes absent settlement and presentation markers. */
    const run = (await db.doc("raceRuns/reward-run").get()).data();
    /** Capture both accepted and rejected calls so their committed authority can be checked first. */
    const error = await getRaceOutcomeForUser("reward-player", "reward-run", {db, nowMs: 7000}).then(() => null, failure => failure);
    expect((await db.doc("users/reward-player").get()).data()).toEqual(account);
    expect((await db.doc("raceRuns/reward-run").get()).data()).toEqual(run);
    expect((await db.collection("racePerformanceOutbox").get()).empty).toBe(true);
    expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
    expect(error).toMatchObject({code: "data-loss"});
  });

it.each([
  {ids: ["unknown-award"], coins: 25},
  {ids: ["race_debut", "race_debut"], coins: 50},
  {ids: ["race_debut"], coins: 0},
])("does not consume an invalid stored award presentation: %j", async awards => {
  /** Valid immutable outcome can coexist with a corrupt optional presentation receipt. */
  const run = fixture();
  await db.doc("raceRuns/reward-run").update({settledAtMs: 7000, settledOutcome: raceOutcome(run, 7000),
    achievementProgressRecordedAtMs: 7000, settlementAwards: {newlyUnlockedAchievementIds: awards.ids, achievementCoinsAwarded: awards.coins}});
  /** A failed read must leave its presentation acknowledgement unconsumed. */
  const before = (await db.doc("raceRuns/reward-run").get()).data();
  /** Prior decoding happened after this acknowledgement was already committed. */
  const error = await getRaceOutcomeForUser("reward-player", "reward-run", {db, nowMs: 8000}).then(() => null, failure => failure);
  expect((await db.doc("raceRuns/reward-run").get()).data()).toEqual(before);
  expect(error).toMatchObject({code: "data-loss"});
  await db.doc("raceRuns/reward-run").update({settlementAwards: {newlyUnlockedAchievementIds: ["race_debut"], achievementCoinsAwarded: 25}});
  /** Repair unlocks exactly one pending acknowledgement without rewriting a previously settled balance. */
  const response = await getRaceOutcomeForUser("reward-player", "reward-run", {db, nowMs: 9000});
  expect(response).toMatchObject({newlyUnlockedAchievementIds: ["race_debut"], achievementCoinsAwarded: 25, newCoins: 100});
  expect((await getRaceOutcomeForUser("reward-player", "reward-run", {db, nowMs: 10000})).achievementCoinsAwarded).toBe(0);
});

it.each([["resume", "100"], ["publish", "100"], ["publish", Number.MAX_SAFE_INTEGER]] as const)(
  "preserves invalid or overflowing balances through the %s reward writer: %s", async (operation, coins) => {
  await db.doc("users/reward-player").update({coins});
  if (operation === "publish") {
    await db.doc("raceRuns/reward-run").update({role: "creator", result: "recorded", challengeId: FieldValue.delete(),
      opponent: FieldValue.delete()});
  }
  /** Grant writers must never interpret a malformed balance as a zero balance. */
  const account = (await db.doc("users/reward-player").get()).data();
  /** A publication response is otherwise valid and would silently overwrite the malformed balance. */
  const error = await (operation === "resume"
    ? resumeRaceRunForUser("reward-player", "reward-run", {db, nowMs: 7000})
    : publishRaceChallengeForUser("reward-player", {runId: "reward-run", requestId: "reward-publish"}, {db, nowMs: 7000}))
    .then(() => null, failure => failure);
  expect((await db.doc("users/reward-player").get()).data()).toEqual(account);
  expect((await db.collection("raceChallenges").get()).empty).toBe(true);
  expect(error).toMatchObject({code: "data-loss"});
});

it("repairs an invalid balance and presents one exact grant under concurrent result retries", async () => {
  await db.doc("users/reward-player").update({coins: "100"});
  await expect(getRaceOutcomeForUser("reward-player", "reward-run", {db, nowMs: 7000})).rejects.toMatchObject({code: "data-loss"});
  await db.doc("users/reward-player").update({coins: 100});
  /** Concurrent outcome requests share one settlement and presentation acknowledgement. */
  const responses = await Promise.all([7000, 7001].map(nowMs => getRaceOutcomeForUser("reward-player", "reward-run", {db, nowMs})));
  expect(responses.filter(response => response.achievementCoinsAwarded === 75)).toHaveLength(1);
  expect(responses.find(response => response.achievementCoinsAwarded === 75)?.newCoins).toBe(175);
  expect((await db.doc("users/reward-player").get()).data()?.coins).toBe(175);
  expect((await db.collection("racePerformanceOutbox").get()).size).toBe(1);
  expect((await db.collection("raceSettlementOutbox").get()).size).toBe(1);
  expect((await getRaceOutcomeForUser("reward-player", "reward-run", {db, nowMs: 8000})).achievementCoinsAwarded).toBe(0);
});

it.each(["absent", "safe-limit"])("preserves supported %s balances and presents exactly the stored post-grant currency", async balance => {
  if (balance === "absent") await db.doc("users/reward-player").update({coins: FieldValue.delete()});
  else await db.doc("users/reward-player").update({coins: Number.MAX_SAFE_INTEGER, unlockedAchievements: [...RACE_ACHIEVEMENT_IDS]});
  /** Zero grants at the safe limit remain valid, while a missing legacy balance starts at zero. */
  const response = await getRaceOutcomeForUser("reward-player", "reward-run", {db, nowMs: 7000});
  expect(response.newCoins).toBe(balance === "absent" ? 75 : Number.MAX_SAFE_INTEGER);
  expect(response.newCoins).toBe((await db.doc("users/reward-player").get()).data()?.coins);
});

it("leaves an already settled reward presentation available when the current account balance is invalid", async () => {
  await resumeRaceRunForUser("reward-player", "reward-run", {db, nowMs: 7000});
  await db.doc("users/reward-player").update({coins: Number.NaN});
  await expect(getRaceOutcomeForUser("reward-player", "reward-run", {db, nowMs: 8000})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc("raceRuns/reward-run").get()).data()?.achievementOutcomePresentedAtMs).toBeUndefined();
  await db.doc("users/reward-player").update({coins: 200});
  /** A repaired current balance can include unrelated accepted purchases after initial settlement. */
  const response = await getRaceOutcomeForUser("reward-player", "reward-run", {db, nowMs: 9000});
  expect(response).toMatchObject({achievementCoinsAwarded: 75, newCoins: 200});
  expect((await db.doc("users/reward-player").get()).data()?.coins).toBe(200);
});

it("quarantines invalid creator currency without partial social writes, then replays repaired delivery once", async () => {
  await db.doc("users/reward-creator").set({displayName: "Creator", coins: "50"});
  await getRaceOutcomeForUser("reward-player", "reward-run", {db, nowMs: 7000});
  expect(await deliverRaceSettlement("reward-run", db, 8000)).toBe(false);
  expect((await db.doc("users/reward-creator").get()).data()?.coins).toBe("50");
  expect((await db.collection("users/reward-creator/raceInbox").get()).empty).toBe(true);
  expect((await db.collection("users/reward-player/knownRivals").get()).empty).toBe(true);
  expect((await db.collection("users/reward-creator/knownRivals").get()).empty).toBe(true);
  expect((await db.doc("raceSettlementOutbox/reward-run").get()).data()).toMatchObject({deliveryState: "quarantined", quarantined: true});
  await db.doc("users/reward-creator").update({coins: 50});
  expect(await replayRaceDelivery(db, "raceSettlementOutbox", "reward-run", 9000)).toBe(true);
  /** A second delivery cannot repeat creator progress or grant an additional inbox item. */
  const account = (await db.doc("users/reward-creator").get()).data();
  expect(await deliverRaceSettlement("reward-run", db, 10000)).toBe(false);
  expect((await db.doc("users/reward-creator").get()).data()).toEqual(account);
  expect((await db.collection("users/reward-creator/raceInbox").get()).size).toBe(1);
});
