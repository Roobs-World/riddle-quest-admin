import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp, FieldValue} from "firebase-admin/firestore";
import {raceDeadlineAtMs, applyRaceSkip, raceOutcome, type RaceRunRecord} from "../../race/raceEngine";
import {getRaceOutcomeForUser} from "../../race/raceReadService";
import {resumeRaceRunForUser} from "../../race/raceService";
import {settleRaceRun} from "../../race/raceSettlement";
import {deliverRaceSettlement} from "../../race/raceSettlementDelivery";
import {processRaceSettlementJobs} from "../../race/raceSettlementJobs";
import {deliverRacePerformance} from "../../race/racePerformanceDelivery";
import {processRaceDeadline, replayRaceDeadline} from "../../race/raceDeadlineRecovery";
import {replayRaceDelivery} from "../../race/raceDeliveryRecovery";
import {emptyRaceMatchProfile} from "../../race/raceMatchPerformance";
import {parseRaceMatchOffer} from "../../race/raceMatchOfferRecord";
import {readRaceMatchOffer} from "../../race/raceMatchOffer";
import {parseRunRecord} from "../../race/raceSetupService";
import {issueFacebookReferralToken, bindFacebookReferralToken} from "../../facebook/facebookReferrals";

/** Independent demo-project database; these tests never contact production. */
let db: FirebaseFirestore.Firestore;
/** Canonical active challenger fixture with a ten-second recorded opponent. */
const fixture = (overrides: Partial<RaceRunRecord> = {}): RaceRunRecord => ({
  runId: "run-1", userId: "player-1", challengeId: "challenge-1", role: "challenger", status: "active",
  categoryId: "history", locale: "en", rulesVersion: "race10_v1", deckId: "deck-1",
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position + 1}`, canonicalRiddleId: `q:${position + 1}`,
    text: "A test clue", answer: "test", position})),
  currentPosition: 0, correctCount: 0, guessesUsed: 0, hintUsed: false, revealedLetters: [],
  startedAtMs: 1_000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: [],
  opponent: {subjectUserId: "creator-1", displayName: "Creator", adjustedFinishMs: 10_000, events: []},
  ...overrides,
});

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("settlement-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all(["raceRuns", "users", "raceSettlementOutbox", "racePerformanceOutbox", "raceDeadlineFailures", "raceMatchOffers", "raceMaintenance", "jestAccountDeletionTombstones",
    "facebookReferralTokens", "facebookReferralBindings", "facebookReferralSettlements", "facebookReferralDailyCaps"].map(
    (name) => db.recursiveDelete(db.collection(name)),
  ));
  await db.doc("users/player-1").set({displayName: "Challenger", coins: 0});
  await db.doc("users/creator-1").set({displayName: "Creator", coins: 0});
  /** Provides run behavior. */
  const run = fixture();
  await db.doc("raceRuns/run-1").set({...run, ...(run.status === "active" ? {deadlineAtMs: raceDeadlineAtMs(run)} : {}), expiresAt: Timestamp.fromMillis(1_000_000)});
});

it.each(["owner", "creator"] as const)("delivers a Facebook %s first-win referral once across concurrent race delivery", async role => {
  /** The referral binds before any solo or multiplayer progress is established. */
  const invitee = `facebook_${"b".repeat(40)}`;
  /** Stores inviter for this isolated provider verification. */
  const inviter = `facebook_${"a".repeat(40)}`;
  await db.doc(`users/${inviter}`).set({coins: 300, hasPurchasedApp: false, stats: {gamesPlayed: 1, wins: 1}});
  await db.doc(`users/${invitee}`).set({coins: 300, hasPurchasedApp: false, stats: {gamesPlayed: 0, wins: 0}});
  /** Stores token for this isolated provider verification. */
  const {token} = await issueFacebookReferralToken(inviter, 100, () => "t".repeat(43), db);
  await bindFacebookReferralToken(invitee, token, 101, db);
  /** Stores ownerId for this isolated provider verification. */
  const ownerId = role === "owner" ? invitee : "player-1";
  /** Stores run for this isolated provider verification. */
  const run = fixture({userId: ownerId,
    opponent: {subjectUserId: role === "creator" ? invitee : "creator-1", displayName: "Opponent", adjustedFinishMs: 10_000, events: []},
    ...(role === "owner" ? {status: "completed", result: "player_win", correctCount: 10, currentPosition: 9, wallFinishMs: 9000, finishedAtMs: 10000} : {})});
  await db.doc("raceRuns/run-1").set({...run, ...(run.status === "active" ? {deadlineAtMs: raceDeadlineAtMs(run)} : {}), expiresAt: Timestamp.fromMillis(1_000_000)});
  await getRaceOutcomeForUser(ownerId, "run-1", {db, nowMs: role === "owner" ? 10001 : 12000});
  /** Stores delivery for this isolated provider verification. */
  const delivery = role === "owner" ? deliverRacePerformance : deliverRaceSettlement;
  /** Stores before for this isolated provider verification. */
  const before = (await db.doc(`users/${invitee}`).get()).data()!.coins;
  await Promise.all([delivery("run-1", db, 12001), delivery("run-1", db, 12001)]);
  /** Stores after for this isolated provider verification. */
  const after = (await db.doc(`users/${invitee}`).get()).data()!;
  expect(after.stats.multiplayerWins).toBe(1);
  expect(after.coins).toBeGreaterThanOrEqual(before + 100);
  expect((await db.doc(`users/${inviter}`).get()).data()?.coins).toBe(400);
  expect((await db.collection("facebookReferralSettlements").get()).size).toBe(1);
  await delivery("run-1", db, 12002);
  expect((await db.doc(`users/${invitee}`).get()).data()).toEqual(after);
  if (role === "owner") expect((await db.doc(`users/${invitee}/raceMatchProfiles/en`).get()).data()?.overall.evidence).toBe(1);
});

it.each(["grant", "acknowledgement"] as const)("recovers a Facebook referral %s failure without duplicating race performance or coins", async stage => {
  /** Stores invitee for this isolated provider verification. */
  const invitee = `facebook_${"b".repeat(40)}`;
  /** Stores inviter for this isolated provider verification. */
  const inviter = `facebook_${"a".repeat(40)}`;
  await db.doc(`users/${inviter}`).set({coins: 300, hasPurchasedApp: false, stats: {gamesPlayed: 1, wins: 1}});
  await db.doc(`users/${invitee}`).set({coins: 300, hasPurchasedApp: false, stats: {gamesPlayed: 0, wins: 0}});
  /** Stores token for this isolated provider verification. */
  const {token} = await issueFacebookReferralToken(inviter, 100, () => "t".repeat(43), db);
  await bindFacebookReferralToken(invitee, token, 101, db);
  /** Stores run for this isolated provider verification. */
  const run = fixture({userId: invitee, status: "completed", result: "player_win", correctCount: 10, currentPosition: 9,
    wallFinishMs: 9000, finishedAtMs: 10000});
  await db.doc("raceRuns/run-1").set({...run, ...(run.status === "active" ? {deadlineAtMs: raceDeadlineAtMs(run)} : {}), expiresAt: Timestamp.fromMillis(1_000_000)});
  await getRaceOutcomeForUser(invitee, "run-1", {db, nowMs: 10001});
  /** Stores before for this isolated provider verification. */
  const before = (await db.doc(`users/${invitee}`).get()).data()!.coins;
  /** Stores realTransaction for this isolated provider verification. */
  const realTransaction = db.runTransaction.bind(db);
  /** Stores failure for this isolated provider verification. */
  const failure = jest.spyOn(db, "runTransaction").mockImplementationOnce(realTransaction);
  if (stage === "acknowledgement") failure.mockImplementationOnce(realTransaction);
  failure.mockRejectedValueOnce(new Error("temporary-referral-storage-failure"));
  await expect(deliverRacePerformance("run-1", db, 10002)).rejects.toThrow("temporary-referral-storage-failure");
  failure.mockRestore();
  /** Stores receipt for this isolated provider verification. */
  const receipt = (await db.doc("racePerformanceOutbox/run-1").get()).data()!;
  expect(receipt).toMatchObject({delivered: false, facebookPerformanceRecorded: true, deliveryState: "pending", deliveryAttempts: 1});
  await deliverRacePerformance("run-1", db, receipt.nextAttemptAtMs - 1);
  expect((await db.doc("racePerformanceOutbox/run-1").get()).data()?.delivered).toBe(false);
  await Promise.all([deliverRacePerformance("run-1", db, receipt.nextAttemptAtMs), deliverRacePerformance("run-1", db, receipt.nextAttemptAtMs)]);
  expect((await db.doc("racePerformanceOutbox/run-1").get()).data()?.delivered).toBe(true);
  expect((await db.doc(`users/${invitee}/raceMatchProfiles/en`).get()).data()?.overall.evidence).toBe(1);
  expect((await db.doc(`users/${invitee}`).get()).data()?.coins).toBe(before + 100);
  expect((await db.doc(`users/${inviter}`).get()).data()?.coins).toBe(400);
});

it.each(["raceSettlementOutbox", "racePerformanceOutbox"] as const)("backs off transient %s failures and delivers exactly once when due", async collection => {
  await db.doc("raceRuns/run-1").update({status: "completed", result: "player_win", correctCount: 10, currentPosition: 9,
    wallFinishMs: 9000, finishedAtMs: 10000});
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 10001});
  /** Provides deliver behavior. */
  const deliver = collection === "raceSettlementOutbox" ? deliverRaceSettlement : deliverRacePerformance;
  jest.spyOn(db, "runTransaction").mockRejectedValueOnce(new Error("temporary-storage-failure"));
  await expect(deliver("run-1", db, 10002)).rejects.toThrow("temporary-storage-failure");
  jest.restoreAllMocks();
  /** Provides receipt behavior. */
  const receipt = (await db.doc(`${collection}/run-1`).get()).data()!;
  expect(receipt).toMatchObject({delivered: false, deliveryState: "pending", deliveryAttempts: 1, createdAtMs: 10001});
  expect(receipt.nextAttemptAtMs).toBeGreaterThan(10002);
  expect(await deliver("run-1", db, receipt.nextAttemptAtMs - 1)).toBe(false);
  expect(await deliver("run-1", db, receipt.nextAttemptAtMs)).toBe(true);
  expect(await deliver("run-1", db, receipt.nextAttemptAtMs + 1)).toBe(false);
  expect((await db.doc("users/player-1").get()).data()?.stats.multiplayerGamesPlayed).toBe(1);
  if (collection === "raceSettlementOutbox") expect((await db.collection("users/creator-1/raceInbox").get()).size).toBe(1);
  else expect((await db.doc("users/player-1/raceMatchProfiles/en").get()).data()?.overall.evidence).toBe(1);
});

it.each(["raceSettlementOutbox", "racePerformanceOutbox"] as const)("validates repair before replaying %s and survives concurrent retries", async collection => {
  await db.doc("raceRuns/run-1").update({status: "completed", result: "player_win", correctCount: 10, currentPosition: 9,
    wallFinishMs: 9000, finishedAtMs: 10000});
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 10001});
  /** Provides ref behavior. */
  const ref = db.doc(`${collection}/run-1`);
  /** Provides original behavior. */
  const original = (await ref.get()).data()!;
  await ref.update({createdAtMs: 123});
  /** Provides deliver behavior. */
  const deliver = collection === "raceSettlementOutbox" ? deliverRaceSettlement : deliverRacePerformance;
  expect(await deliver("run-1", db, 10002)).toBe(false);
  expect((await ref.get()).data()).toMatchObject({deliveryState: "quarantined", delivered: true});
  await expect(replayRaceDelivery(db, collection, "run-1", 10003)).rejects.toMatchObject({code: "data-loss"});
  expect((await ref.get()).data()?.deliveryState).toBe("quarantined");
  await ref.update({createdAtMs: original.createdAtMs});
  expect(await replayRaceDelivery(db, collection, "run-1", 10004, {dryRun: true})).toBe(false);
  expect((await ref.get()).data()?.deliveryState).toBe("quarantined");
  /** Provides results behavior. */
  const results = await Promise.all(Array.from({length: 6}, () => replayRaceDelivery(db, collection, "run-1", 10004)));
  expect(results.filter(Boolean)).toHaveLength(1);
  /** Concurrent and repeated replay invocations retain the identity of the actual release. */
  const replayId = (await ref.get()).data()?.replayId;
  expect(replayId).toMatch(/^[0-9a-f-]{36}$/);
  expect(await replayRaceDelivery(db, collection, "run-1", 10005)).toBe(false);
  expect((await ref.get()).data()?.replayId).toBe(replayId);
  expect((await ref.get()).data()).toMatchObject({deliveryState: "delivered", createdAtMs: original.createdAtMs});
  expect((await ref.get()).data()?.expiresAt.toMillis()).toBe(original.expiresAt.toMillis());
  if (collection === "raceSettlementOutbox") expect((await db.collection("users/creator-1/raceInbox").get()).size).toBe(1);
  else expect((await db.doc("users/player-1/raceMatchProfiles/en").get()).data()?.overall.evidence).toBe(1);
});

it.each(["missing", "expired-source", "expired-receipt", "unsettled", "not-quarantined", "wrong-owner", "wrong-creator"])("rejects unsafe delivery replay: %s", async reason => {
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12000});
  /** Provides event behavior. */
  const event = db.doc("raceSettlementOutbox/run-1");
  await event.update({delivered: true, deliveryState: "quarantined", quarantined: true});
  if (reason === "missing") await db.doc("raceRuns/run-1").delete();
  if (reason === "expired-source") await db.doc("raceRuns/run-1").update({expiresAt: Timestamp.fromMillis(12001)});
  if (reason === "expired-receipt") await event.update({expiresAt: Timestamp.fromMillis(12001)});
  if (reason === "unsettled") await db.doc("raceRuns/run-1").update({settledOutcome: FieldValue.delete()});
  if (reason === "not-quarantined") await event.update({delivered: false, deliveryState: "pending", quarantined: FieldValue.delete()});
  if (reason === "wrong-owner") await event.update({userId: "different-owner"});
  if (reason === "wrong-creator") await event.update({creatorId: "different-creator"});
  await expect(replayRaceDelivery(db, "raceSettlementOutbox", "run-1", 12002)).rejects.toThrow();
  expect((await db.collection("users/creator-1/raceInbox").get()).empty).toBe(true);
});

it.each(["block", "deletion"])("replay rechecks %s without granting creator rewards", async reason => {
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12000});
  await db.doc("raceSettlementOutbox/run-1").update({delivered: true, deliveryState: "quarantined", quarantined: true});
  if (reason === "block") await db.doc("users/creator-1/blockedRivals/player-1").set({blocked: true});
  else await db.doc("jestAccountDeletionTombstones/creator-1").set({deleted: true});
  expect(await replayRaceDelivery(db, "raceSettlementOutbox", "run-1", 12001)).toBe(false);
  expect((await db.doc("raceSettlementOutbox/run-1").get()).data()?.deliveryState).toBe("suppressed");
  expect((await db.doc("users/creator-1").get()).data()?.coins).toBe(0);
});

it("quarantines creator delivery when canonical run identity differs from the source document", async () => {
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12000});
  await db.doc("raceRuns/run-1").update({runId: "different-run"});
  expect(await deliverRaceSettlement("run-1", db, 12001)).toBe(false);
  expect((await db.doc("raceSettlementOutbox/run-1").get()).data()?.deliveryState).toBe("quarantined");
  expect((await db.collection("users/creator-1/raceInbox").get()).empty).toBe(true);
  expect((await db.doc("users/creator-1").get()).data()?.coins).toBe(0);
});

it("requires a repaired performance profile before dry-run can approve quarantined delivery", async () => {
  await db.doc("raceRuns/run-1").update({status: "completed", result: "player_win", correctCount: 10, currentPosition: 9,
    wallFinishMs: 9000, finishedAtMs: 10000});
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 10001});
  await db.doc("users/player-1/raceMatchProfiles/en").set({version: 999});
  expect(await deliverRacePerformance("run-1", db, 10002)).toBe(false);
  await expect(replayRaceDelivery(db, "racePerformanceOutbox", "run-1", 10003, {dryRun: true}))
    .rejects.toMatchObject({code: "data-loss", message: "Stored race performance profile is invalid."});
  expect((await db.doc("racePerformanceOutbox/run-1").get()).data()?.deliveryState).toBe("quarantined");
  await db.doc("users/player-1/raceMatchProfiles/en").set(emptyRaceMatchProfile());
  expect(await replayRaceDelivery(db, "racePerformanceOutbox", "run-1", 10004, {dryRun: true})).toBe(false);
  expect(await replayRaceDelivery(db, "racePerformanceOutbox", "run-1", 10005)).toBe(true);
  expect((await db.doc("users/player-1/raceMatchProfiles/en").get()).data()?.overall.evidence).toBe(1);
});

it("records the challenger's performance once without changing the fixed ghost creator's estimate", async () => {
  await db.doc("raceRuns/run-1").update({status: "completed", result: "player_win", correctCount: 10, currentPosition: 9,
    wallFinishMs: 9_000, finishedAtMs: 10_000});
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 10_001});
  /** Provides delivered behavior. */
  const delivered = await Promise.all(Array.from({length: 6}, () => deliverRacePerformance("run-1", db, 10_002)));
  expect(delivered.filter(Boolean)).toHaveLength(1);
  expect((await db.doc("users/player-1/raceMatchProfiles/en").get()).data()).toMatchObject({version: 2,
    overall: {evidence: 1, updatedAtMs: 10000}, categories: {history: {evidence: 1}},
    completion: {challenger: {overall: {finished: 1, unfinished: 0, updatedAtMs: 10000}}}});
  expect((await db.doc("users/creator-1/raceMatchProfiles/en").get()).exists).toBe(false);
});

it.each([0, 5])("records completion once for a ghost loss with %i correct answers without extrapolating speed", async correctCount => {
  await db.doc("raceRuns/run-1").update({correctCount, currentPosition: correctCount});
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12000});
  /** Concurrent and delayed delivery folds exactly one actual opportunity. */
  const delivered = await Promise.all(Array.from({length: 6}, () => deliverRacePerformance("run-1", db, 20000)));
  expect(delivered.filter(Boolean)).toHaveLength(1);
  /** Idle and partial losses keep fully observed speed confidence separate. */
  const profile = (await db.doc("users/player-1/raceMatchProfiles/en").get()).data()!;
  expect(profile).toMatchObject({version: 2, overall: {evidence: 0}, completion: {
    challenger: {overall: {finished: 0, unfinished: 1, updatedAtMs: 11000}, categories: {history: {unfinished: 1}}},
  }});
  if (correctCount) expect(profile.overall.censored).toMatchObject({logMs: Math.log(10000), evidence: 0.25, updatedAtMs: 11000});
  else expect(profile.overall.censored).toBeUndefined();
  expect((await db.doc("users/creator-1/raceMatchProfiles/en").get()).exists).toBe(false);
  expect(await deliverRacePerformance("run-1", db, 21000)).toBe(false);
});

it("lazily upgrades a legacy profile during authoritative performance delivery", async () => {
  await db.doc("users/player-1/raceMatchProfiles/en").set({version: 1, overall: {logMs: Math.log(40000), evidence: 20, updatedAtMs: 12000},
    categories: {}, recentOpponents: ["a".repeat(64)], exposedRiddleIds: ["retained-question"]});
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12000});
  expect(await deliverRacePerformance("run-1", db, 12001)).toBe(true);
  expect((await db.doc("users/player-1/raceMatchProfiles/en").get()).data()).toMatchObject({version: 2,
    overall: {evidence: 1}, completion: {challenger: {overall: {finished: 0, unfinished: 1}}},
    recentOpponents: ["a".repeat(64)], exposedRiddleIds: ["retained-question"]});
});

it("quarantines a future finish timestamp rather than creating fresh performance evidence", async () => {
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12000});
  await db.doc("raceRuns/run-1").update({finishedAtMs: 12001});
  expect(await deliverRacePerformance("run-1", db, 12002)).toBe(false);
  expect((await db.doc("racePerformanceOutbox/run-1").get()).data()?.deliveryState).toBe("quarantined");
  expect((await db.doc("users/player-1/raceMatchProfiles/en").get()).exists).toBe(false);
  await expect(replayRaceDelivery(db, "racePerformanceOutbox", "run-1", 12003, {dryRun: true}))
    .rejects.toMatchObject({code: "data-loss", message: "Stored Race to 10 run is invalid."});
});

it.each([{runId: "another-run"}, {challengeId: "another-challenge"}, {result: "player_win"}, {adjustedFinishMs: 9999}])(
  "rejects a contradictory canonical settled outcome across reads and performance recovery: %j", async corruption => {
    await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12000});
    /** Existing canonical rewards cannot be changed by a later contradictory outcome payload. */
    const ownerBefore = (await db.doc("users/player-1").get()).data();
    /** Corrupt only one owned outcome field, preserving valid outer record shape. */
    const snapshot = (await db.doc("raceRuns/run-1").get()).data()!;
    await db.doc("raceRuns/run-1").update({settledOutcome: {...snapshot.settledOutcome, ...corruption}});
    await expect(resumeRaceRunForUser("player-1", "run-1", {db, nowMs: 12001})).rejects.toMatchObject({code: "data-loss"});
    await expect(getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12001})).rejects.toMatchObject({code: "data-loss"});
    expect(await deliverRacePerformance("run-1", db, 12002)).toBe(false);
    expect((await db.doc("racePerformanceOutbox/run-1").get()).data()?.deliveryState).toBe("quarantined");
    await expect(replayRaceDelivery(db, "racePerformanceOutbox", "run-1", 12003, {dryRun: true})).rejects.toMatchObject({code: "data-loss"});
    expect((await db.doc("users/player-1").get()).data()).toEqual(ownerBefore);
    expect((await db.doc("users/player-1/raceMatchProfiles/en").get()).exists).toBe(false);
  });

it("settles rewards despite corrupt derived attribution and never writes another owner's offer", async () => {
  /** Provides offer id behavior. */
  const offerId = "a".repeat(64);
  await db.doc("raceRuns/run-1").update({matchOfferId: offerId});
  await db.doc(`raceMatchOffers/${offerId}`).set({userId: "another-owner", challengeId: "challenge-1", acceptedRunId: "run-1"});
  expect((await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12000})).result).toBe("ghost_win");
  expect((await db.doc("users/player-1").get()).data()?.coins).toBe(25);
  expect((await db.doc(`raceMatchOffers/${offerId}`).get()).data()?.terminalStatus).toBeUndefined();
  expect(await deliverRaceSettlement("run-1", db, 12001)).toBe(true);
});

it("suppresses pending performance projection after owner deletion", async () => {
  await db.doc("raceRuns/run-1").update({status: "completed", result: "player_win", correctCount: 10, currentPosition: 9,
    wallFinishMs: 9_000, finishedAtMs: 10_000});
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 10_001});
  await db.doc("jestAccountDeletionTombstones/player-1").set({deleted: true});
  expect(await deliverRacePerformance("run-1", db, 10_002)).toBe(false);
  expect((await db.doc("users/player-1/raceMatchProfiles/en").get()).exists).toBe(false);
});

it("settles an idle ghost loss as a creator win rather than a zero-delta tie", async () => {
  /** Provides outcome behavior. */
  const outcome = await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12_000});
  expect(outcome.result).toBe("ghost_win");
  expect(await deliverRaceSettlement("run-1", db, 12_001)).toBe(true);
  /** Provides inbox behavior. */
  const inbox = await db.collection("users/creator-1/raceInbox").get();
  expect(inbox.docs[0].data()).toMatchObject({result: "win", adjustedDeltaMs: 0});
  expect((await db.doc("raceRuns/run-1").get()).data()).toMatchObject({status: "completed", settledAtMs: 12_000});
});

it("settles via resume and repeated outcome reads without duplicate owner rewards", async () => {
  await resumeRaceRunForUser("player-1", "run-1", {db, nowMs: 12_000});
  /** Provides results behavior. */
  const results = await Promise.all(Array.from({length: 6}, () => getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12_001})));
  expect(results.every((outcome) => outcome.result === "ghost_win")).toBe(true);
  expect(results.filter((outcome) => outcome.achievementCoinsAwarded > 0)).toHaveLength(1);
  expect((await db.doc("users/player-1").get()).data()).toMatchObject({coins: 25, stats: {multiplayerGamesPlayed: 1}});
  expect((await db.collection("raceSettlementOutbox").get()).size).toBe(1);
});

it("delivers concurrent/replayed outbox events once, including creator currency grants", async () => {
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12_000});
  /** Provides results behavior. */
  const results = await Promise.all(Array.from({length: 8}, () => deliverRaceSettlement("run-1", db, 12_001)));
  expect(results.filter(Boolean)).toHaveLength(1);
  expect((await db.collection("users/creator-1/raceInbox").get()).size).toBe(1);
  expect((await db.doc("users/creator-1").get()).data()).toMatchObject({coins: 50, stats: {multiplayerGamesPlayed: 1, multiplayerWins: 1}});
});

it.each(["block", "creator-deletion", "challenger-deletion"])("suppresses delayed identity/reward delivery after %s", async (reason) => {
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12_000});
  if (reason === "block") await db.doc("users/creator-1/blockedRivals/player-1").set({blocked: true});
  else await db.doc(`jestAccountDeletionTombstones/${reason === "creator-deletion" ? "creator-1" : "player-1"}`).set({deleted: true});
  expect(await deliverRaceSettlement("run-1", db, 12_001)).toBe(false);
  expect((await db.collection("users/creator-1/raceInbox").get()).empty).toBe(true);
  expect((await db.doc("users/creator-1").get()).data()?.coins).toBe(0);
  expect((await db.doc("raceSettlementOutbox/run-1").get()).data()).toMatchObject({delivered: true, suppressed: true});
});

it("settles unattended deadlines and retries missed event delivery with a bounded worker", async () => {
  await processRaceSettlementJobs(db, 12_000);
  expect((await db.doc("raceRuns/run-1").get()).data()?.settledOutcome.result).toBe("ghost_win");
  expect((await db.doc("raceSettlementOutbox/run-1").get()).data()?.delivered).toBe(true);
  await processRaceSettlementJobs(db, 12_100);
  expect((await db.doc("users/player-1").get()).data()?.stats.multiplayerGamesPlayed).toBe(1);
});

it("expires unattended preparation without creating rewards or opponent delivery", async () => {
  await db.doc("raceRuns/run-1").update({status: "prepared", startedAtMs: 0,
    preparationExpiresAtMs: 12_000, deadlineAtMs: 12_000});
  await processRaceSettlementJobs(db, 12_000);
  expect((await db.doc("raceRuns/run-1").get()).data()).toMatchObject({status: "abandoned", result: null, wallFinishMs: 0});
  expect((await db.doc("users/player-1").get()).data()?.coins).toBe(0);
  expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
});

it("quarantines a poison event and continues delivering valid deadline results", async () => {
  await db.doc("raceSettlementOutbox/poison").set({userId: 123, delivered: false, createdAtMs: 0});
  await processRaceSettlementJobs(db, 12_000);
  expect((await db.doc("raceSettlementOutbox/poison").get()).data()).toMatchObject({delivered: true, quarantined: true, failureCode: "data-loss"});
  expect((await db.doc("raceSettlementOutbox/run-1").get()).data()?.delivered).toBe(true);
  expect((await db.doc("users/creator-1").get()).data()?.stats.multiplayerWins).toBe(1);
  await processRaceSettlementJobs(db, 12_100);
  expect((await db.doc("users/creator-1").get()).data()?.stats.multiplayerWins).toBe(1);
});

it("drains a full page of corrupt deadlines and safely replays a repaired source", async () => {
  /** Earlier malformed entries occupy the entire first indexed page. */
  const batch = db.batch();
  for (let index = 0; index < 100; index++) batch.set(db.doc(`raceRuns/corrupt-${index}`), {status: "active", deadlineAtMs: 0});
  await batch.commit();
  await processRaceSettlementJobs(db, 12_000);
  expect((await db.collection("raceDeadlineFailures").get()).size).toBe(100);
  expect((await db.doc("raceRuns/run-1").get()).data()?.settledAtMs).toBeUndefined();
  await processRaceSettlementJobs(db, 12_001);
  expect((await db.doc("raceRuns/run-1").get()).data()?.settledOutcome.result).toBe("ghost_win");
  await expect(replayRaceDeadline(db, "corrupt-0", 12_002)).rejects.toThrow();
  await db.doc("raceRuns/corrupt-0").set(fixture({runId: "corrupt-0"}));
  await replayRaceDeadline(db, "corrupt-0", 12_003);
  await processRaceSettlementJobs(db, 12_004);
  expect((await db.doc("raceRuns/corrupt-0").get()).data()?.settledOutcome.result).toBe("ghost_win");
  expect((await db.doc("raceDeadlineFailures/corrupt-0").get()).data()?.state).toBe("replayed");
});

it("backs off a transient storage failure without granting extra solving time", async () => {
  /** Only the first processing transaction fails; retry bookkeeping uses real storage. */
  const failure = jest.spyOn(db, "runTransaction").mockRejectedValueOnce(new Error("storage-unavailable"));
  await expect(processRaceDeadline(db, db.doc("raceRuns/run-1"), 12_000)).rejects.toThrow("storage-unavailable");
  failure.mockRestore();
  expect((await db.doc("raceRuns/run-1").get()).data()).toMatchObject({deadlineAtMs: 42_000,
    deadlineRecovery: {attempts: 1, nextAttemptAtMs: 42_000}});
  await processRaceSettlementJobs(db, 12_001);
  expect((await db.doc("raceRuns/run-1").get()).data()?.settledAtMs).toBeUndefined();
  /** Provides outcome behavior. */
  const outcome = await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12_002});
  expect(outcome.result).toBe("ghost_win");
  expect(outcome.adjustedFinishMs).toBe(10_000);
});

it("settles maximum-time expiry independently of ghost completion", async () => {
  await db.doc("raceRuns/run-1").update({opponent: FieldValue.delete()});
  /** Provides outcome behavior. */
  const outcome = await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 301_000});
  expect(outcome.result).toBe("timed_out");
});

it("derives a loss when the tenth clearing action pushes adjusted time past the ghost", async () => {
  /** Nine previously cleared questions place the final scoring event on the tenth owned question. */
  const run = fixture({correctCount: 9, currentPosition: 9,
    riddles: Array.from({length: 10}, (_, position) => ({riddleId: `q-${position + 1}`, canonicalRiddleId: `q:${position + 1}`,
      text: "A test clue", answer: "test", position}))});
  /** Provides completed behavior. */
  const completed = applyRaceSkip(run, {riddleId: "q-10"}, 2_000);
  expect(completed.result).toBe("ghost_win");
  await db.runTransaction(async (transaction) => {await settleRaceRun(transaction, db, completed, 2_000);});
  await deliverRaceSettlement("run-1", db, 2_001);
  expect((await db.collection("users/creator-1/raceInbox").get()).docs[0].data().result).toBe("win");
});

it("never recreates a deleted owner or grants its delayed reward", async () => {
  await db.doc("jestAccountDeletionTombstones/player-1").set({deleted: true});
  await db.doc("users/player-1").delete();
  await processRaceSettlementJobs(db, 12_000);
  expect((await db.doc("users/player-1").get()).exists).toBe(false);
  expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
});

it.each([10, 5, 0])("projects complete-only calibration evidence idempotently for %i solved answers", async correctCount => {
  /** Server-issued receipt ownership links attribution to exactly this accepted run. */
  const offerId = "a".repeat(64);
  /** Partial losses are clamped to the ghost's ten-second finish. */
  const finishMs = correctCount === 10 ? 9000 : 10000;
  await db.doc(`raceMatchOffers/${offerId}`).set({userId: "player-1", challengeId: "challenge-1", acceptedRunId: "run-1", acceptedAtMs: 1000, createdAtMs: 0, expiresAtMs: 60000, fingerprint: JSON.stringify({locale: "en", categoryId: null}), expectedPerformanceMs: 12000});
  await db.doc("raceRuns/run-1").update({matchOfferId: offerId, status: "completed", result: correctCount === 10 ? "player_win" : "ghost_win",
    correctCount, currentPosition: correctCount === 10 ? 9 : correctCount, wallFinishMs: finishMs, finishedAtMs: 1000 + finishMs});
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 1010 + finishMs});
  /** Partial and idle runs never supply an extrapolated finish gap or prediction error. */
  const receipt = (await db.doc(`raceMatchOffers/${offerId}`).get()).data()!;
  expect(receipt).toMatchObject({finishedTen: correctCount === 10, actualPerformanceMs: correctCount === 10 ? 9000 : null,
    finishTimeDeltaMs: correctCount === 10 ? -1000 : null, opponentAdjustedFinishMs: 10000, settlementDelayMs: 10});
  expect(receipt.predictionLogError).toBe(correctCount === 10 ? Math.log(9000 / 12000) : null);
  await Promise.all(Array.from({length: 4}, () => getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 20000})));
  expect((await db.doc(`raceMatchOffers/${offerId}`).get()).data()).toEqual(receipt);
});

it.each(["ghost_win", "tie", "timed_out"] as const)("rejects false %s before internal settlement or public reads can reward it", async result => {
  /** Stored result is false despite coherent individual fields and terminal clocks. */
  const corrupt = fixture({status: result === "timed_out" ? "timed_out" : "completed", result,
    correctCount: 10, currentPosition: 9, wallFinishMs: 5000, finishedAtMs: 6000});
  /** Original accounts are compared in full so stats, achievements and currency cannot change. */
  const users = (await db.collection("users").get()).docs.map(document => document.data());
  for (const hasSettlement of [false, true]) {
    /** Matching forged receipts must never bypass validation of the underlying winner. */
    const stored = hasSettlement ? {...corrupt, settledAtMs: 12000, settledOutcome: raceOutcome(corrupt, 12000)} : corrupt;
    await db.doc("raceRuns/run-1").set(stored);
    await expect(db.runTransaction(transaction => settleRaceRun(transaction, db, stored, 12000)))
      .rejects.toMatchObject({code: "data-loss"});
    await expect(getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12000})).rejects.toMatchObject({code: "data-loss"});
    await expect(resumeRaceRunForUser("player-1", "run-1", {db, nowMs: 12000})).rejects.toMatchObject({code: "data-loss"});
    await processRaceDeadline(db, db.doc("raceRuns/run-1"), 12000);
    expect((await db.doc("raceRuns/run-1").get()).data()).toEqual(stored);
    expect((await db.collection("users").get()).docs.map(document => document.data())).toEqual(users);
    expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
    expect((await db.collection("racePerformanceOutbox").get()).empty).toBe(true);
    expect((await db.collection("users/creator-1/raceInbox").get()).empty).toBe(true);
  }
});

it.each(["raceSettlementOutbox", "racePerformanceOutbox"] as const)("quarantines %s when a matching settled source carries a false winner", async collection => {
  await db.doc("raceRuns/run-1").update({status: "completed", result: "player_win", correctCount: 10, currentPosition: 9,
    wallFinishMs: 5000, finishedAtMs: 6000});
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12000});
  /** Valid settlement creates the delivery receipt before the canonical source is corrupted. */
  const source = (await db.doc("raceRuns/run-1").get()).data()!;
  /** Original owner reward cannot be repeated or altered by deferred delivery. */
  const users = (await db.collection("users").get()).docs.map(document => document.data());
  await db.doc("raceRuns/run-1").update({result: "ghost_win", "settledOutcome.result": "ghost_win"});
  /** Both delivery paths validate the canonical winner before creator or performance writes. */
  const deliver = collection === "raceSettlementOutbox" ? deliverRaceSettlement : deliverRacePerformance;
  expect(await deliver("run-1", db, 12001)).toBe(false);
  expect((await db.doc(`${collection}/run-1`).get()).data()).toMatchObject({deliveryState: "quarantined", failureCode: "data-loss"});
  await expect(replayRaceDelivery(db, collection, "run-1", 12002)).rejects.toMatchObject({code: "data-loss"});
  expect((await db.collection("users").get()).docs.map(document => document.data())).toEqual(users);
  expect((await db.collection("users/creator-1/raceInbox").get()).empty).toBe(true);
  expect((await db.doc("users/player-1/raceMatchProfiles/en").get()).exists).toBe(false);
  await db.doc("raceRuns/run-1").update({result: source.result, "settledOutcome.result": source.settledOutcome.result});
  expect(await replayRaceDelivery(db, collection, "run-1", 12003)).toBe(true);
  expect(await deliver("run-1", db, 12004)).toBe(false);
});

it("rejects a future terminal finish before writing a settlement receipt or rewards", async () => {
  /** A valid winner whose persisted finish lies after the current settlement clock. */
  const future = fixture({status: "completed", result: "player_win", correctCount: 10, currentPosition: 9, wallFinishMs: 5000, finishedAtMs: 6000});
  await db.doc("raceRuns/run-1").set(future);
  /** Full account snapshots catch any achievement, counter or balance mutation. */
  const users = (await db.collection("users").get()).docs.map(document => document.data());
  await expect(getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 5000})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc("raceRuns/run-1").get()).data()).toEqual(future);
  expect((await db.collection("users").get()).docs.map(document => document.data())).toEqual(users);
  expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
  expect((await db.collection("racePerformanceOutbox").get()).empty).toBe(true);
  /** A later valid read settles once; the early rejection does not poison the run. */
  expect((await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 6000})).result).toBe("player_win");
  expect((await db.doc("users/player-1").get()).data()?.stats.multiplayerGamesPlayed).toBe(1);
});

it("rejects a mismatched canonical run identity before settling or overwriting another document", async () => {
  await db.doc("raceRuns/run-1").update({runId: "other-run"});
  await db.doc("raceRuns/other-run").set(fixture({runId: "other-run"}));
  /** Both canonical sources must remain untouched after an unsafe read. */
  const before = (await db.collection("raceRuns").get()).docs.map(document => document.data());
  await expect(getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 20000})).rejects.toMatchObject({code: "data-loss"});
  await expect(resumeRaceRunForUser("player-1", "run-1", {db, nowMs: 20000})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.collection("raceRuns").get()).docs.map(document => document.data())).toEqual(before);
  expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
  expect((await db.collection("racePerformanceOutbox").get()).empty).toBe(true);
});


it("round-trips a genuinely timed-out matchmaking receipt through later attribution reads", async () => {
  /** A canonical accepted offer links the timeout to one recorded search receipt. */
  const offerId = "b".repeat(64);
  await db.doc(`raceMatchOffers/${offerId}`).set({userId: "player-1", challengeId: "challenge-1", acceptedRunId: "run-1",
    acceptedAtMs: 1000, startsAtMs: 1000, createdAtMs: 0, expiresAtMs: 60000,
    fingerprint: JSON.stringify({locale: "en", categoryId: null}), expectedPerformanceMs: 12000});
  await db.doc("raceRuns/run-1").update({matchOfferId: offerId, opponent: FieldValue.delete()});
  /** Maximum adjusted time produces the actual stored timed_out engine state. */
  const outcome = await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 301000});
  expect(outcome.result).toBe("timed_out");
  /** Settlement's writer must produce a receipt accepted by its own reader. */
  const receipt = (await db.doc(`raceMatchOffers/${offerId}`).get()).data()!;
  expect(parseRaceMatchOffer(receipt, offerId)).toMatchObject({terminalStatus: "timed_out", terminalAtMs: 301000,
    correctCount: 0, finishedTen: false, actualPerformanceMs: null, predictionLogError: null, finishTimeDeltaMs: null});
  /** Later canonical attribution reads retain the valid receipt instead of logging corruption and dropping it. */
  const source = await db.doc("raceRuns/run-1").get();
  /** Independently revalidated attribution remains linked to its physical receipt. */
  const reread = await db.runTransaction(transaction => readRaceMatchOffer(transaction, db, parseRunRecord(source.data(), source.id)));
  expect(reread?.id).toBe(offerId);
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 302000});
  expect((await db.doc(`raceMatchOffers/${offerId}`).get()).data()).toEqual(receipt);
});

it.each((["raceSettlementOutbox", "racePerformanceOutbox"] as const).flatMap(collection =>
  (["receipt", "source"] as const).flatMap(target => [12001, 12002].map(deliveryAt => [collection, target, deliveryAt] as const))))(
  "suppresses expired normal %s %s delivery at %i before Firestore TTL deletion", async (collection, target, deliveryAt) => {
    /** Every expiration boundary has an independent canonical fixture and transaction. */
    const runId = "run-1";
    await getRaceOutcomeForUser("player-1", runId, {db, nowMs: 12000});
    /** TTL may leave expired documents physically readable to a later trigger/recovery worker. */
    const ref = db.doc(`${collection}/${runId}`);
    await db.doc(target === "receipt" ? `${collection}/${runId}` : `raceRuns/${runId}`).update({expiresAt: Timestamp.fromMillis(12001)});
    /** Settlement already occurred; deferred delivery must not add downstream account effects. */
    const users = (await db.collection("users").get()).docs.map(document => document.data());
    /** Both independently delivered queues obey the same retention boundary. */
    const deliver = collection === "raceSettlementOutbox" ? deliverRaceSettlement : deliverRacePerformance;
    expect(await deliver(runId, db, deliveryAt)).toBe(false);
    expect((await ref.get()).data()).toMatchObject({delivered: true, deliveryState: "suppressed", suppressed: true, deliveredAtMs: deliveryAt});
    expect((await db.collection("users/creator-1/raceInbox").get()).empty).toBe(true);
    expect((await db.doc("users/player-1/raceMatchProfiles/en").get()).exists).toBe(false);
    expect((await db.collection("users/creator-1/knownRivals").get()).empty).toBe(true);
    expect((await db.collection("users").get()).docs.map(document => document.data())).toEqual(users);
    expect(await deliver(runId, db, deliveryAt + 1)).toBe(false);
  });

it.each(["raceSettlementOutbox", "racePerformanceOutbox"] as const)("delivers unexpired %s and supports source records without a historical expiry", async collection => {
  /** Existing optional legacy source retention does not invent an expiry on absent metadata. */
  const deliver = collection === "raceSettlementOutbox" ? deliverRaceSettlement : deliverRacePerformance;
  for (const legacy of [false, true]) {
    /** Different challenge identity prevents an earlier creator inbox item from masking the control. */
    const runId = `unexpired-${collection}-${legacy}`;
    await db.doc(`raceRuns/${runId}`).set({...fixture({runId, challengeId: `challenge-${runId}`}),
      ...(legacy ? {} : {expiresAt: Timestamp.fromMillis(12001)})});
    await getRaceOutcomeForUser("player-1", runId, {db, nowMs: 12000});
    await db.doc(`${collection}/${runId}`).update({expiresAt: Timestamp.fromMillis(12001)});
    expect(await deliver(runId, db, 12000)).toBe(true);
    expect((await db.doc(`${collection}/${runId}`).get()).data()).toMatchObject({delivered: true, deliveryState: "delivered"});
  }
});
