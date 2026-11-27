import {logger} from "firebase-functions";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {RACE_RULES} from "../../../../src/races/contracts/index.js";
import {migrateRaceArchitecturePage} from "../../race/recovery/raceArchitectureMigration";
import {raceChallengeEligibility} from "../../race/access/raceEligibility";
import {raceDeckContentVersion} from "../../race/runs/raceDeckSnapshot";
import {parseChallengeRecord, resolveChallengeRiddles} from "../../race/raceSetupService";
import {findRecordedRaceMatch} from "../../race/matchmaking/raceMatchmaking";
import {getRaceOutcomeForUser} from "../../race/raceReadService";
import {processRaceSettlementJobs} from "../../race/settlement/raceSettlementJobs";
import {processRaceProjectionReconciliation, reconcileRaceCandidatePage, RACE_RECONCILIATION_LEASE_MS} from "../../race/recovery/raceProjectionReconciliation";
import {parseRaceMatchCandidate} from "../../race/matchmaking/raceMatchCandidates";
import {reserveRaceInviteForUser, publishRaceChallengeForUser, claimRaceInviteForUser,
  startRaceRunForUser, readyRaceRunForUser, abandonRaceRunForUser, resumeRaceRunForUser} from "../../race/raceService";

/** Fixed clock keeps legacy expiration and migration expectations deterministic. */
const NOW = 30_000;
/** Canonical creator and requester from the same authenticated provider pool. */
const CREATOR = `reddit_${"a".repeat(40)}`;
/** Independent requester identity. */
const PLAYER = `reddit_${"b".repeat(40)}`;
/** Archived original content, never loaded from a mutable catalog. */
const RIDDLES = Array.from({length: 15}, (_, position) => ({position, riddleId: `q-${position}`,
  canonicalRiddleId: `canonical-${position}`, text: "Original clue", answer: "test"}));
/** Emulator database shared by fixtures and the production migration interface. */
let db: FirebaseFirestore.Firestore;

/** Legacy publication without an immutable archive or candidate projection. */
const challenge = (id: string) => ({challengeId: id, creatorId: CREATOR, creatorRunId: "recording", locale: "en",
  creatorSnapshot: {displayName: "Creator"}, categoryId: "history", deckId: "deck", canonicalRiddleIds: RIDDLES.map((riddle) => riddle.canonicalRiddleId),
  targetCorrect: 10, creatorWallFinishMs: 20_000, creatorHintPenaltyMs: 0, creatorSkipPenaltyMs: 0,
  creatorTotalPenaltyMs: 0, creatorAdjustedFinishMs: 20_000, ghostEvents: [], rules: RACE_RULES,
  contentVersion: "legacy-catalog-version", status: "active", createdAtMs: 25_000, expiresAtMs: 100_000,
  expiresAt: Timestamp.fromMillis(100_000)});

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("migration-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all(["raceChallenges", "raceRuns", "raceDecks", "racePublishRequests", "raceStartRequests", "raceInviteRequests", "raceMatchCandidates", "raceMatchOffers", "raceInviteLobbies",
    "raceAttempts", "users", "jestAccountDeletionTombstones", "raceMaintenance"].map((name) => db.recursiveDelete(db.collection(name))));
  await db.doc("raceConfig/maintenance").delete();
  await db.doc("raceConfig/matchPolicy").delete();
  await db.doc("raceRuns/recording").set({runId: "recording", userId: CREATOR, role: "creator", status: "completed", result: "recorded",
    locale: "en", categoryId: "history", rulesVersion: RACE_RULES.version, deckId: "deck", riddles: RIDDLES,
    currentPosition: 9, correctCount: 10, guessesUsed: 0, hintUsed: false, revealedLetters: [], startedAtMs: 1000,
    wallFinishMs: 20000, finishedAtMs: 21000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: []});
});

it("keeps reconciliation idle until enabled and recovers an expired worker lease", async () => {
  await expect(processRaceProjectionReconciliation(db, NOW)).resolves.toEqual({status: "disabled"});
  await db.doc("raceConfig/maintenance").set({projectionReconciliationEnabled: true});
  await db.doc("raceMaintenance/projectionReconciliation").set({phase: "challenges", afterId: null,
    leaseId: "interrupted-worker", leaseUntilMs: NOW + RACE_RECONCILIATION_LEASE_MS});
  await expect(processRaceProjectionReconciliation(db, NOW)).resolves.toEqual({status: "leased"});
  await expect(processRaceProjectionReconciliation(db, NOW + RACE_RECONCILIATION_LEASE_MS)).resolves.toMatchObject({status: "processed"});
  expect((await db.doc("raceMaintenance/projectionReconciliation").get()).data())
    .toMatchObject({phase: "candidates", afterId: null, leaseId: null, leaseUntilMs: 0});
});

it.each([
  {player: "legacy-player", creator: CREATOR},
  {player: PLAYER, creator: "legacy-creator"},
  {player: `facebook_${"c".repeat(40)}`, creator: CREATOR},
  {player: `reddit_${"c".repeat(64)}`, creator: CREATOR},
])("prevents direct acceptance from crossing recognized provider and legacy namespaces: %j", async identities => {
  /** Existing legacy fixtures remain readable, but cannot impersonate a recognized provider pool. */
  const record = parseChallengeRecord({...challenge("provider-scoped"), creatorId: identities.creator, riddles: RIDDLES});
  await expect(db.runTransaction(tx => raceChallengeEligibility(tx, db, identities.player, record, "en", NOW)))
    .resolves.toBe("provider");
});

it("retains the prior checkpoint after infrastructure failure and replays the page safely", async () => {
  await db.doc("raceConfig/maintenance").set({projectionReconciliationEnabled: true});
  await db.doc("raceChallenges/b").set(challenge("b"));
  await db.doc("raceMaintenance/projectionReconciliation").set({phase: "challenges", afterId: "a"});
  /** Actual transactions remain authoritative except for the simulated failed page read. */
  const original = db.runTransaction.bind(db);
  /** Fail the first per-record transaction after successful lease acquisition. */
  let calls = 0;
  /** Scoped storage failure leaves no partial cursor advancement. */
  const failure = jest.spyOn(db, "runTransaction").mockImplementation((operation, options) => {
    calls++;
    if (calls === 2) return Promise.reject(new Error("simulated-unavailable"));
    return original(operation, options);
  });
  try {await expect(processRaceProjectionReconciliation(db, NOW)).rejects.toThrow("simulated-unavailable");}
  finally {failure.mockRestore();}
  expect((await db.doc("raceMaintenance/projectionReconciliation").get()).data())
    .toMatchObject({phase: "challenges", afterId: "a", leaseId: null, leaseUntilMs: 0, lastFailureCode: "internal"});
  await expect(processRaceProjectionReconciliation(db, NOW + 1)).resolves.toMatchObject({status: "processed", report: {changed: 1}});
  expect((await db.doc("raceMatchCandidates/b").get()).exists).toBe(true);
});

it("does not overwrite a newer worker checkpoint after its lease is superseded", async () => {
  await db.doc("raceConfig/maintenance").set({projectionReconciliationEnabled: true});
  await db.doc("raceChallenges/b").set(challenge("b"));
  /** Real transaction execution with a lease takeover before this worker completes its page. */
  const original = db.runTransaction.bind(db);
  /** Second transaction is the first canonical record repair. */
  let calls = 0;
  /** Newer checkpoint is installed before the older worker attempts its final checkpoint. */
  const takeover = jest.spyOn(db, "runTransaction").mockImplementation(async (operation, options) => {
    calls++;
    if (calls === 2) await db.doc("raceMaintenance/projectionReconciliation").update({leaseId: "newer-worker", afterId: "z"});
    return original(operation, options);
  });
  try {await expect(processRaceProjectionReconciliation(db, NOW)).resolves.toMatchObject({status: "superseded"});}
  finally {takeover.mockRestore();}
  expect((await db.doc("raceMaintenance/projectionReconciliation").get()).data()).toMatchObject({leaseId: "newer-worker", afterId: "z"});
});

it("reconciles bounded pages through both passes and revisits publications inserted before a prior cursor", async () => {
  await db.doc("raceConfig/maintenance").set({projectionReconciliationEnabled: true});
  for (const id of ["b", "c", "d"]) await db.doc(`raceChallenges/${id}`).set(challenge(id));
  await expect(processRaceProjectionReconciliation(db, NOW, 2)).resolves.toMatchObject({status: "processed", report: {scanned: 2, complete: false}});
  expect((await db.doc("raceMaintenance/projectionReconciliation").get()).data()?.afterId).toBe("c");
  await db.doc("raceChallenges/a").set(challenge("a"));
  await processRaceProjectionReconciliation(db, NOW + 1, 2);
  expect((await db.doc("raceMaintenance/projectionReconciliation").get()).data()?.phase).toBe("candidates");
  await processRaceProjectionReconciliation(db, NOW + 2, 2);
  await processRaceProjectionReconciliation(db, NOW + 3, 2);
  expect((await db.doc("raceMaintenance/projectionReconciliation").get()).data()?.phase).toBe("challenges");
  await processRaceProjectionReconciliation(db, NOW + 4, 2);
  expect((await db.doc("raceMatchCandidates/a").get()).exists).toBe(true);
});

it("retains unavailable-source observations across healthy pages and replaces them only after a complete new cycle", async () => {
  await db.doc("raceConfig/maintenance").set({projectionReconciliationEnabled: true});
  await db.doc("raceChallenges/b").set({...challenge("b"), challengeId: "corrupt-identity"});
  await db.doc("raceChallenges/d").set(challenge("d"));
  await processRaceProjectionReconciliation(db, NOW, 1);
  await processRaceProjectionReconciliation(db, NOW + 1, 1);
  expect((await db.doc("raceMaintenance/projectionReconciliation").get()).data())
    .toMatchObject({cycleUnavailable: 1, lastReport: {unavailable: 0}});
  for (let index = 2; index < 5; index++) await processRaceProjectionReconciliation(db, NOW + index, 1);
  expect((await db.doc("raceMaintenance/projectionReconciliation").get()).data())
    .toMatchObject({phase: "challenges", afterId: null, lastCycleUnavailable: 1, lastCycleCompletedAtMs: NOW + 4});
  await db.doc("raceChallenges/b").delete();
  await processRaceProjectionReconciliation(db, NOW + 5, 1);
  expect((await db.doc("raceMaintenance/projectionReconciliation").get()).data())
    .toMatchObject({cycleUnavailable: 0, lastCycleUnavailable: 1});
  for (let index = 6; index < 9; index++) await processRaceProjectionReconciliation(db, NOW + index, 1);
  expect((await db.doc("raceMaintenance/projectionReconciliation").get()).data())
    .toMatchObject({lastCycleUnavailable: 0, lastCycleCompletedAtMs: NOW + 8});
});

it("does not invent a full-cycle observation when resuming a legacy candidate-only checkpoint", async () => {
  await db.doc("raceConfig/maintenance").set({projectionReconciliationEnabled: true});
  await db.doc("raceMaintenance/projectionReconciliation").set({phase: "candidates", afterId: null});
  await processRaceProjectionReconciliation(db, NOW);
  expect((await db.doc("raceMaintenance/projectionReconciliation").get()).data()?.lastCycleCompletedAtMs).toBeUndefined();
  await processRaceProjectionReconciliation(db, NOW + 1);
  await processRaceProjectionReconciliation(db, NOW + 2);
  expect((await db.doc("raceMaintenance/projectionReconciliation").get()).data()?.lastCycleCompletedAtMs).toBe(NOW + 2);
});

it("removes orphan, corrupt and private projections while repairing valid query keys", async () => {
  for (const id of ["valid", "private", "corrupt"]) await db.doc(`raceChallenges/${id}`).set(challenge(id));
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  await db.doc("raceChallenges/private").update({scope: "invitation"});
  await db.doc("raceChallenges/corrupt").update({riddles: [{answer: "bad"}]});
  await db.doc("raceMatchCandidates/orphan").set({status: "active"});
  await db.doc("raceMatchCandidates/valid").update({performanceBucket: 99, extra: "unsupported"});
  await expect(reconcileRaceCandidatePage(db, {}, NOW)).resolves.toMatchObject({scanned: 4, changed: 3, unavailable: 1});
  expect((await db.doc("raceMatchCandidates/orphan").get()).exists).toBe(true);
  await expect(reconcileRaceCandidatePage(db, {dryRun: false}, NOW)).resolves.toMatchObject({scanned: 4, changed: 3, unavailable: 1});
  expect((await db.collection("raceMatchCandidates").get()).docs.map(document => document.id)).toEqual(["valid"]);
  expect(parseRaceMatchCandidate((await db.doc("raceMatchCandidates/valid").get()).data(), "valid")).not.toBeNull();
  await expect(reconcileRaceCandidatePage(db, {dryRun: false}, NOW)).resolves.toMatchObject({changed: 0, skipped: 1});
});

it.each([{categoryId: "unsupported"}, {performanceBucket: 99}, {selectionKey: "a".repeat(64)},
  {matchPolicyVersion: 99}, {creatorId: PLAYER, provider: "facebook"}, {canonicalRiddleIds: ["duplicate", "duplicate"]},
  {expiresAt: Timestamp.fromMillis(1)}, {challengeId: "wrong-document"}, {extra: "unsupported"}])("rejects malformed candidate projection %j before ranking", async corruptFields => {
    await db.doc("raceChallenges/valid").set(challenge("valid"));
    await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
    /** Complete valid record comes from the real publication projection. */
    const valid = (await db.doc("raceMatchCandidates/valid").get()).data()!;
    expect(parseRaceMatchCandidate(valid, "valid")).not.toBeNull();
    expect(parseRaceMatchCandidate({...valid, ...corruptFields}, "valid")).toBeNull();
  });

it("publishes before recipient arrival, preserves publication when claimed, and schedules only the claimed seat", async () => {
  await db.doc("users/" + CREATOR).set({displayName: "Creator", coins: 0});
  await db.doc("raceRuns/recording").set({runId: "recording", userId: CREATOR, role: "creator", status: "completed",
    result: "recorded", locale: "en", categoryId: "history", rulesVersion: RACE_RULES.version,
    deckId: "deck", riddles: RIDDLES, events: [], startedAtMs: 1_000, finishedAtMs: 9_000,
    wallFinishMs: 8_000, currentPosition: 9, correctCount: 10, guessesUsed: 0, hintUsed: false,
    revealedLetters: [], hintPenaltyMs: 0, skipPenaltyMs: 0});
  await db.doc("raceDecks/deck").set({canonicalRiddleIds: RIDDLES.map((riddle) => riddle.canonicalRiddleId), contentVersion: "legacy"});
  /** Provides reserved behavior. */
  const reserved = await reserveRaceInviteForUser(CREATOR, {locale: "en", requestId: "private-reserve"}, {db, nowMs: NOW});
  /** Provides published behavior. */
  const published = await publishRaceChallengeForUser(CREATOR,
    {runId: "recording", reservedChallengeId: reserved.challengeId, requestId: "private-publish"}, {db, nowMs: NOW + 1_000});
  expect(published.preview.expiresAtMs).toBe(reserved.expiresAtMs);
  await claimRaceInviteForUser(PLAYER, reserved.challengeId, "en", {db, nowMs: NOW + 2_000});
  expect((await db.doc(`raceInviteLobbies/${reserved.challengeId}`).get()).data()).toMatchObject({status: "published", recipientId: PLAYER});
  expect((await db.doc(`raceMatchCandidates/${reserved.challengeId}`).get()).exists).toBe(false);
  /** Provides prepared behavior. */
  const prepared = await startRaceRunForUser(PLAYER,
    {locale: "en", challengeId: reserved.challengeId, requestId: "private-start", prepare: true}, {db, nowMs: NOW + 3_000});
  /** Provides scheduled behavior. */
  const scheduled = await readyRaceRunForUser(PLAYER, {runId: prepared.run.runId, requestId: "private-ready"}, {db, nowMs: NOW + 4_000});
  expect(scheduled.run).toMatchObject({status: "scheduled", startsAtMs: NOW + 7_000});
  await expect(startRaceRunForUser(`reddit_${"c".repeat(40)}`,
    {locale: "en", challengeId: reserved.challengeId, requestId: "unclaimed-start"}, {db, nowMs: NOW + 5_000})).rejects.toMatchObject({code: "permission-denied"});
});

it("dry-runs legacy archives and projections without changing storage", async () => {
  await db.doc("raceChallenges/public").set(challenge("public"));
  await expect(migrateRaceArchitecturePage(db, {collection: "challenges"}, NOW)).resolves.toMatchObject({changed: 1, scanned: 1, complete: true});
  expect((await db.doc("raceChallenges/public").get()).data()?.riddles).toBeUndefined();
  expect((await db.collection("raceMatchCandidates").get()).empty).toBe(true);
});

it("restores discovery from the creator archive and replaying does not change it", async () => {
  await db.doc("raceChallenges/public").set(challenge("public"));
  await expect(migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW)).resolves.toMatchObject({changed: 1});
  await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "backfilled-match"}, {db, nowMs: NOW})).resolves.toMatchObject({status: "matched", challenge: {challengeId: "public"}});
  expect((await db.doc("raceChallenges/public").get()).data()).toMatchObject({riddles: RIDDLES, scope: "public", snapshotVersion: 1, contentVersion: raceDeckContentVersion(RIDDLES)});
  await db.doc("raceRuns/recording").delete();
  await expect(migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW)).resolves.toMatchObject({changed: 0, skipped: 1});
});

it("binds an offer to one owned accepted run and records readiness/terminal facts idempotently", async () => {
  await db.doc(`users/${PLAYER}`).set({displayName: "Player", coins: 0});
  await db.doc(`users/${CREATOR}`).set({displayName: "Creator", coins: 0});
  await db.doc("raceChallenges/public").set({...challenge("public"), riddles: RIDDLES, scope: "public",
    snapshotVersion: 1, contentVersion: raceDeckContentVersion(RIDDLES)});
  await db.doc("raceChallenges/other").set({...challenge("other"), riddles: RIDDLES, scope: "public",
    snapshotVersion: 1, contentVersion: raceDeckContentVersion(RIDDLES)});
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  /** Provides offer behavior. */
  const offer = await findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "attributed-lookup"}, {db, nowMs: NOW});
  if (offer.status !== "matched" || !offer.offerId) throw new Error("expected-issued-match-offer");
  /** Provides input behavior. */
  const input = {locale: "en" as const, challengeId: offer.challenge.challengeId, offerId: offer.offerId, requestId: "attributed-start", prepare: true};
  await expect(startRaceRunForUser(`reddit_${"c".repeat(40)}`, input, {db, nowMs: NOW + 1}))
    .rejects.toMatchObject({code: "permission-denied"});
  await expect(startRaceRunForUser(PLAYER, {...input, challengeId: input.challengeId === "public" ? "other" : "public"}, {db, nowMs: NOW + 1}))
    .rejects.toMatchObject({code: "permission-denied"});
  // Preview cache expiry does not revoke an otherwise eligible direct challenge.
  /** Provides accepted at ms behavior. */
  const acceptedAtMs = NOW + 60001;
  /** Provides starts behavior. */
  const starts = await Promise.all(Array.from({length: 6}, () => startRaceRunForUser(PLAYER, input, {db, nowMs: acceptedAtMs})));
  /** Provides run id behavior. */
  const runId = starts[0].run.runId;
  expect(starts.every(response => response.run.runId === runId)).toBe(true);
  expect((await db.doc(`raceRuns/${runId}`).get()).data()?.matchOfferId).toBe(offer.offerId);
  expect((await db.doc(`raceMatchOffers/${offer.offerId}`).get()).data()).toMatchObject({acceptedRunId: runId,
    acceptedAtMs, preparationRequested: true, offerExpiredAtAcceptance: true, matchPolicyVersion: 3});
  /** Provides ready behavior. */
  const ready = await readyRaceRunForUser(PLAYER, {runId, requestId: "attributed-ready"}, {db, nowMs: acceptedAtMs + 1});
  expect((await db.doc(`raceMatchOffers/${offer.offerId}`).get()).data()?.startsAtMs).toBe(ready.run.startsAtMs);
  await Promise.all(Array.from({length: 4}, () => getRaceOutcomeForUser(PLAYER, runId, {db, nowMs: 199000})));
  expect((await db.doc(`raceMatchOffers/${offer.offerId}`).get()).data()).toMatchObject({terminalStatus: "completed",
    result: "ghost_win", correctCount: 0, adjustedFinishMs: 20000});
  await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "attributed-lookup"}, {db, nowMs: 199001}))
    .rejects.toMatchObject({code: "already-exists"});
});

it("rejects a corrupt issued offer before creating an attempt or accepting its attribution", async () => {
  await db.doc(`users/${PLAYER}`).set({displayName: "Player", coins: 0});
  await db.doc("raceChallenges/public").set({...challenge("public"), riddles: RIDDLES, scope: "public",
    snapshotVersion: 1, contentVersion: raceDeckContentVersion(RIDDLES)});
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  /** Issue a genuine receipt before injecting corruption. */
  const offer = await findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "corrupt-start-lookup"}, {db, nowMs: NOW});
  if (offer.status !== "matched" || !offer.offerId) throw new Error("expected-issued-match-offer");
  /** Keep the corrupted physical record for unchanged-state assertions. */
  const ref = db.doc(`raceMatchOffers/${offer.offerId}`);
  await ref.update({matchPolicyHash: "b".repeat(64)});
  /** Rejection must leave the original corrupt receipt untouched. */
  const before = (await ref.get()).data();
  await expect(startRaceRunForUser(PLAYER, {locale: "en", challengeId: "public", offerId: offer.offerId,
    requestId: "corrupt-start", prepare: true}, {db, nowMs: NOW + 1})).rejects.toMatchObject({code: "data-loss"});
  expect((await ref.get()).data()).toEqual(before);
  expect((await db.collection("raceAttempts").get()).empty).toBe(true);
  expect((await db.collection("raceRuns").where("userId", "==", PLAYER).get()).empty).toBe(true);
});

it.each(["abandon", "ready-expiry", "worker-expiry"])("records %s without rewards or a fabricated scheduled start", async reason => {
  await db.doc(`users/${PLAYER}`).set({displayName: "Player", coins: 0});
  await db.doc(`users/${CREATOR}`).set({displayName: "Creator", coins: 0});
  await db.doc("raceChallenges/public").set({...challenge("public"), riddles: RIDDLES, scope: "public",
    snapshotVersion: 1, contentVersion: raceDeckContentVersion(RIDDLES)});
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  /** Provides offer behavior. */
  const offer = await findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "abandoned-lookup"}, {db, nowMs: NOW});
  if (offer.status !== "matched" || !offer.offerId) throw new Error("expected-issued-match-offer");
  /** Provides prepared behavior. */
  const prepared = await startRaceRunForUser(PLAYER, {locale: "en", challengeId: "public", offerId: offer.offerId,
    requestId: "abandoned-start", prepare: true}, {db, nowMs: NOW + 1});
  if (reason === "abandon") await abandonRaceRunForUser(PLAYER, {runId: prepared.run.runId, requestId: "abandon-request"}, {db, nowMs: NOW + 2});
  else if (reason === "ready-expiry") await readyRaceRunForUser(PLAYER, {runId: prepared.run.runId, requestId: "expired-ready"}, {db, nowMs: NOW + 30002});
  else await processRaceSettlementJobs(db, NOW + 30002);
  /** Provides receipt behavior. */
  const receipt = (await db.doc(`raceMatchOffers/${offer.offerId}`).get()).data()!;
  expect(receipt).toMatchObject({acceptedRunId: prepared.run.runId, terminalStatus: "abandoned", result: null});
  expect(receipt.startsAtMs).toBeUndefined();
  expect((await db.doc(`users/${PLAYER}`).get()).data()?.coins).toBe(0);
});

it("keeps private invitations out of public discovery even when their lobby has disappeared", async () => {
  await db.doc("raceChallenges/race-invite-legacy").set(challenge("race-invite-legacy"));
  await db.doc("raceChallenges/private").set({...challenge("private"), scope: "invitation"});
  await db.doc("raceChallenges/opaque-private").set(challenge("opaque-private"));
  await db.doc("raceInviteLobbies/opaque-private").set({creatorId: CREATOR});
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  expect((await db.collection("raceMatchCandidates").get()).empty).toBe(true);
  for (const id of ["race-invite-legacy", "private", "opaque-private"]) {
    expect((await db.doc(`raceChallenges/${id}`).get()).data()?.scope).toBe("invitation");
  }
});

it("reports unavailable original decks and never reconstructs their content", async () => {
  await db.doc("raceChallenges/missing").set({...challenge("missing"), creatorRunId: "missing-run"});
  await expect(migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW)).resolves.toMatchObject({unavailable: 1, changed: 0});
  expect((await db.collection("raceMatchCandidates").get()).empty).toBe(true);
});

it("paginates by stable document ID and safely removes stale projections", async () => {
  await db.doc("raceChallenges/a").set(challenge("a"));
  await db.doc("raceChallenges/b").set({...challenge("b"), status: "revoked"});
  await db.doc("raceMatchCandidates/b").set({status: "active"});
  /** Provides first behavior. */
  const first = await migrateRaceArchitecturePage(db, {collection: "challenges", limit: 1, dryRun: false}, NOW);
  expect(first).toMatchObject({nextAfterId: "a", complete: false, changed: 1});
  /** Provides second behavior. */
  const second = await migrateRaceArchitecturePage(db, {collection: "challenges", afterId: first.nextAfterId, dryRun: false}, NOW);
  expect(second).toMatchObject({nextAfterId: "b", complete: true, changed: 1});
  expect((await db.doc("raceMatchCandidates/b").get()).exists).toBe(false);
});

it("populates legacy active deadlines and rules snapshots idempotently", async () => {
  await db.doc("raceRuns/active").set({runId: "active", userId: PLAYER, role: "challenger", status: "active", locale: "en",
    categoryId: "history", rulesVersion: RACE_RULES.version, deckId: "deck", riddles: RIDDLES, events: [], startedAtMs: 1_000,
    currentPosition: 0, correctCount: 0, guessesUsed: 0, hintUsed: false, revealedLetters: [], hintPenaltyMs: 0, skipPenaltyMs: 0});
  await expect(migrateRaceArchitecturePage(db, {collection: "runs", dryRun: false}, NOW)).resolves.toMatchObject({changed: 1});
  expect((await db.doc("raceRuns/active").get()).data()).toMatchObject({deadlineAtMs: 301_000, rulesSnapshot: RACE_RULES});
  await expect(migrateRaceArchitecturePage(db, {collection: "runs", dryRun: false}, NOW)).resolves.toMatchObject({changed: 0});
});

it("does not bypass quarantined sources or transient deadline backoff during a backfill", async () => {
  await db.doc("raceRuns/quarantined").set({status: "active", deadlineQuarantinedAtMs: NOW});
  await db.doc("raceRuns/retrying").set({status: "active", deadlineAtMs: NOW + 30000,
    deadlineRecovery: {originalDeadlineAtMs: NOW - 1, attempts: 1, nextAttemptAtMs: NOW + 30000}});
  await expect(migrateRaceArchitecturePage(db, {collection: "runs", dryRun: false}, NOW))
    .resolves.toMatchObject({changed: 0, unavailable: 1});
  expect((await db.doc("raceRuns/quarantined").get()).data()?.deadlineAtMs).toBeUndefined();
  expect((await db.doc("raceRuns/retrying").get()).data()?.deadlineAtMs).toBe(NOW + 30000);
});

it.each(["missing", "cancelled", "wrong-creator", "expired", "wrong-recipient"])("rejects private acceptance with a %s lobby", async (reason) => {
  /** Provides record behavior. */
  const record = parseChallengeRecord({...challenge("private"), scope: "invitation", riddles: RIDDLES});
  if (reason !== "missing") await db.doc("raceInviteLobbies/private").set({challengeId: "private", creatorId: reason === "wrong-creator" ? PLAYER : CREATOR,
    recipientId: reason === "wrong-recipient" ? CREATOR : PLAYER, locale: "en", expiresAtMs: reason === "expired" ? NOW : 100_000,
    createdAtMs: 0, status: "published", ...(reason === "cancelled" ? {cancelledAtMs: NOW - 1} : {})});
  await expect(db.runTransaction((transaction) => raceChallengeEligibility(transaction, db, PLAYER, record, "en", NOW))).resolves.toBe("invitation");
});

it("accepts a valid private seat but rejects a tampered versioned archive", async () => {
  await db.doc("raceInviteLobbies/private").set({challengeId: "private", creatorId: CREATOR, recipientId: PLAYER,
    locale: "en", createdAtMs: 0, expiresAtMs: 100_000, status: "published"});
  /** Provides record behavior. */
  const record = parseChallengeRecord({...challenge("private"), scope: "invitation", riddles: RIDDLES,
    snapshotVersion: 1, contentVersion: raceDeckContentVersion(RIDDLES)});
  await expect(db.runTransaction((transaction) => raceChallengeEligibility(transaction, db, PLAYER, record, "en", NOW))).resolves.toBeNull();
  await expect(db.runTransaction((transaction) => raceChallengeEligibility(transaction, db, PLAYER,
    {...record, riddles: RIDDLES.map((riddle) => ({...riddle, answer: "changed"}))}, "en", NOW))).resolves.toBe("content");
});

it.each([{runId: "different-recording"}, {role: "challenger"}, {categoryId: "music"}, {deckId: "different-deck"},
  {correctCount: 9}, {wallFinishMs: 19000, finishedAtMs: 20000},
  {rulesSnapshot: {...RACE_RULES, maxHintsPerRiddle: RACE_RULES.maxHintsPerRiddle === 1 ? 2 : 1}},
  {events: [{sequence: 0, type: "correct", riddlePosition: 0, wallElapsedMs: 1000, penaltyAddedMs: 0,
    totalPenaltyMs: 0, adjustedElapsedMs: 1000, correctCount: 1}]}])("rejects a mismatched legacy creator source in acceptance, resolution and reconciliation: %j", async corruption => {
  await db.doc("raceChallenges/legacy").set(challenge("legacy"));
  await db.doc("raceRuns/recording").update(corruption);
  /** The three archive consumers share the same source-link contract. */
  const record = parseChallengeRecord(challenge("legacy"), "legacy");
  await expect(db.runTransaction(tx => raceChallengeEligibility(tx, db, PLAYER, record, "en", NOW))).resolves.toBe("content");
  await expect(resolveChallengeRiddles(db, "en", record)).rejects.toThrow();
  expect(await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW)).toMatchObject({unavailable: 1});
  expect((await db.collection("raceMatchCandidates").get()).empty).toBe(true);
  expect((await db.collection("raceAttempts").get()).empty).toBe(true);
});

it("rejects mismatched canonical challenge identity without accepting or projecting another recording", async () => {
  await db.doc(`users/${PLAYER}`).set({displayName: "Player", coins: 0});
  await db.doc("raceChallenges/public").set({...challenge("different-recording"), riddles: RIDDLES});
  await expect(startRaceRunForUser(PLAYER, {locale: "en", challengeId: "public", requestId: "mismatched-source"}, {db, nowMs: NOW}))
    .rejects.toMatchObject({code: "data-loss"});
  expect((await db.collection("raceAttempts").get()).empty).toBe(true);
  expect((await db.collection("raceStartRequests").get()).empty).toBe(true);
  expect((await db.doc("raceChallenges/different-recording").get()).exists).toBe(false);
  /** Migration reports corrupt canonical identity instead of producing a different-key projection. */
  const result = await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  expect(result.unavailable).toBe(1);
  expect((await db.collection("raceMatchCandidates").get()).empty).toBe(true);
});

/** Valid changes retain the same legacy token while altering immutable source meaning. */
const recordingDrifts = [
  {label: "category", patch: {categoryId: "science"}},
  {label: "rules", patch: {rules: {...RACE_RULES, maxHintsPerRiddle: 1}}},
  {label: "creator", patch: {creatorId: `reddit_${"c".repeat(40)}`}},
  {label: "creator run", patch: {creatorRunId: "different-recording"}},
  {label: "source deck", patch: {deckId: "different-source-deck"}},
  {label: "evaluation", patch: {evaluationPolicy: "server-only"}},
  {label: "duration", patch: {creatorWallFinishMs: 21000, creatorAdjustedFinishMs: 21000}},
  {label: "timeline", patch: {ghostEvents: [{sequence: 0, type: "correct", riddlePosition: 0,
    wallElapsedMs: 1000, penaltyAddedMs: 0, totalPenaltyMs: 0, adjustedElapsedMs: 1000, correctCount: 1}]}},
  {label: "content", patch: {riddles: RIDDLES.map(riddle => ({...riddle, text: "Changed archived clue"}))}},
];

it.each(recordingDrifts)("rejects $label drift before acceptance without consuming an attempt", async ({patch}) => {
  /** Provides ref behavior. */
  const ref = db.doc("raceChallenges/drift");
  await ref.set({...challenge("drift"), riddles: RIDDLES});
  /** Change authority after outside preparation, before the real acceptance transaction. */
  const original = db.runTransaction.bind(db);
  /** Provides changed behavior. */
  let changed = false;
  /** Provides interleave behavior. */
  const interleave = jest.spyOn(db, "runTransaction").mockImplementation(async (operation, options) => {
    if (!changed) {changed = true; await ref.update(patch);}
    return original(operation, options);
  });
  try {
    await expect(startRaceRunForUser(PLAYER, {locale: "en", challengeId: "drift", requestId: "drift-acceptance", prepare: true},
      {db, nowMs: NOW})).rejects.toMatchObject({code: "failed-precondition"});
  } finally {interleave.mockRestore();}
  for (const name of ["raceAttempts", "raceStartRequests", "raceDecks"]) expect((await db.collection(name).get()).empty).toBe(true);
  expect((await db.collection("raceRuns").get()).docs.map(document => document.id)).toEqual(["recording"]);
  expect((await db.doc(`users/${PLAYER}/raceMatchProfiles/en`).get()).exists).toBe(false);
});

it.each(recordingDrifts)("rejects $label drift at readiness without assigning a scored start", async ({patch}) => {
  /** Provides ref behavior. */
  const ref = db.doc("raceChallenges/drift");
  await ref.set({...challenge("drift"), riddles: RIDDLES});
  /** Provides prepared behavior. */
  const prepared = await startRaceRunForUser(PLAYER, {locale: "en", challengeId: "drift", requestId: "drift-preparation", prepare: true},
    {db, nowMs: NOW});
  /** Provides run ref behavior. */
  const runRef = db.doc(`raceRuns/${prepared.run.runId}`);
  expect((await runRef.get()).data()?.recordingFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(prepared.run).not.toHaveProperty("recordingFingerprint");
  await ref.update(patch);
  await expect(readyRaceRunForUser(PLAYER, {runId: prepared.run.runId, requestId: "drift-readiness"},
    {db, nowMs: NOW + 1000})).rejects.toMatchObject({code: "failed-precondition"});
  expect((await runRef.get()).data()).toMatchObject({status: "prepared", startedAtMs: 0});
});

it("allows equivalent legacy backfill and presentation changes, then resumes independently of the source", async () => {
  /** Provides ref behavior. */
  const ref = db.doc("raceChallenges/backfill-ready");
  await ref.set(challenge(ref.id));
  /** Provides prepared behavior. */
  const prepared = await startRaceRunForUser(PLAYER, {locale: "en", challengeId: ref.id, requestId: "backfill-preparation", prepare: true},
    {db, nowMs: NOW});
  await ref.update({riddles: RIDDLES, snapshotVersion: 1, contentVersion: raceDeckContentVersion(RIDDLES),
    creatorSnapshot: {displayName: "New presentation"}, rules: Object.fromEntries(Object.entries(RACE_RULES).reverse())});
  /** Provides scheduled behavior. */
  const scheduled = await readyRaceRunForUser(PLAYER, {runId: prepared.run.runId, requestId: "backfill-readiness"},
    {db, nowMs: NOW + 1000});
  expect(scheduled.run.status).toBe("scheduled");
  await ref.delete();
  await db.doc("raceRuns/recording").delete();
  await expect(resumeRaceRunForUser(PLAYER, prepared.run.runId, {db, nowMs: NOW + 5000}))
    .resolves.toMatchObject({run: {status: "active"}});
  await expect(readyRaceRunForUser(PLAYER, {runId: prepared.run.runId, requestId: "backfill-ready-retry"},
    {db, nowMs: NOW + 5000})).resolves.toMatchObject({run: {startsAtMs: scheduled.run.startsAtMs}});
});

it.each(["acceptance", "readiness"])("rejects legacy source content drift at %s with an unchanged catalog token", async phase => {
  /** Provides ref behavior. */
  const ref = db.doc("raceChallenges/legacy-drift");
  await ref.set(challenge(ref.id));
  /** Provides source behavior. */
  const source = db.doc("raceRuns/recording");
  /** Provides input behavior. */
  const input = {locale: "en" as const, challengeId: ref.id, requestId: "legacy-drift-prepare", prepare: true};
  if (phase === "readiness") {
    /** Provides prepared behavior. */
    const prepared = await startRaceRunForUser(PLAYER, input, {db, nowMs: NOW});
    await source.update({riddles: RIDDLES.map(riddle => ({...riddle, answer: "changed"}))});
    await expect(readyRaceRunForUser(PLAYER, {runId: prepared.run.runId, requestId: "legacy-drift-ready"},
      {db, nowMs: NOW + 1000})).rejects.toMatchObject({code: "failed-precondition"});
    expect((await db.doc(`raceRuns/${prepared.run.runId}`).get()).data()).toMatchObject({status: "prepared", startedAtMs: 0});
  } else {
    /** Provides original behavior. */
    const original = db.runTransaction.bind(db);
    /** Provides interleave behavior. */
    const interleave = jest.spyOn(db, "runTransaction").mockImplementation(async (operation, options) => {
      await source.update({riddles: RIDDLES.map(riddle => ({...riddle, answer: "changed"}))});
      return original(operation, options);
    });
    try {await expect(startRaceRunForUser(PLAYER, input, {db, nowMs: NOW})).rejects.toMatchObject({code: "failed-precondition"});}
    finally {interleave.mockRestore();}
    expect((await db.collection("raceAttempts").get()).empty).toBe(true);
  }
});

it.each(["acceptance", "readiness"])("leaves offer conversion clocks unchanged after recording drift at %s", async phase => {
  /** Provides ref behavior. */
  const ref = db.doc("raceChallenges/offered-drift");
  await ref.set({...challenge(ref.id), riddles: RIDDLES, snapshotVersion: 1, contentVersion: raceDeckContentVersion(RIDDLES)});
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  /** Provides offer behavior. */
  const offer = await findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "offered-drift-search"}, {db, nowMs: NOW});
  if (offer.status !== "matched" || !offer.offerId) throw new Error("expected-recorded-offer");
  /** Provides offer ref behavior. */
  const offerRef = db.doc(`raceMatchOffers/${offer.offerId}`);
  /** Provides input behavior. */
  const input = {locale: "en" as const, challengeId: ref.id, offerId: offer.offerId, requestId: "offered-drift-prepare", prepare: true};
  if (phase === "readiness") {
    /** Provides prepared behavior. */
    const prepared = await startRaceRunForUser(PLAYER, input, {db, nowMs: NOW});
    /** Provides before behavior. */
    const before = (await offerRef.get()).data();
    await ref.update({creatorWallFinishMs: 21000, creatorAdjustedFinishMs: 21000});
    await expect(readyRaceRunForUser(PLAYER, {runId: prepared.run.runId, requestId: "offered-drift-ready"},
      {db, nowMs: NOW + 1000})).rejects.toMatchObject({code: "failed-precondition"});
    expect((await offerRef.get()).data()).toEqual(before);
  } else {
    /** Provides before behavior. */
    const before = (await offerRef.get()).data();
    /** Provides original behavior. */
    const original = db.runTransaction.bind(db);
    /** Provides interleave behavior. */
    const interleave = jest.spyOn(db, "runTransaction").mockImplementation(async (operation, options) => {
      await ref.update({creatorWallFinishMs: 21000, creatorAdjustedFinishMs: 21000});
      return original(operation, options);
    });
    try {await expect(startRaceRunForUser(PLAYER, input, {db, nowMs: NOW})).rejects.toMatchObject({code: "failed-precondition"});}
    finally {interleave.mockRestore();}
    expect((await offerRef.get()).data()).toEqual(before);
  }
});

it.each(["acceptance", "replay"])("rejects a changed recording after discovery at %s without rewriting the offer", async phase => {
  /** Genuine discovery binds its original scoring facts before any preparation request. */
  const ref = db.doc("raceChallenges/discovery-drift");
  await ref.set({...challenge(ref.id), riddles: RIDDLES, snapshotVersion: 1, contentVersion: raceDeckContentVersion(RIDDLES)});
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  /** Search identity remains stable through rejected replay. */
  const search = {locale: "en" as const, requestId: "discovery-drift-search"};
  /** Owned offer contains no client-visible provenance or source content. */
  const offer = await findRecordedRaceMatch(PLAYER, search, {db, nowMs: NOW});
  if (offer.status !== "matched" || !offer.offerId) throw new Error("expected-recorded-offer");
  /** Persisted receipt must remain unchanged after immutable source drift. */
  const receipt = db.doc(`raceMatchOffers/${offer.offerId}`);
  /** Exact original fingerprint and policy attribution survive the failed command. */
  const before = (await receipt.get()).data();
  expect(before?.recordingFingerprint).toMatch(/^[a-f0-9]{64}$/);
  await ref.update({creatorWallFinishMs: 21000, creatorAdjustedFinishMs: 21000});
  if (phase === "acceptance") await expect(startRaceRunForUser(PLAYER, {locale: "en", challengeId: ref.id,
    offerId: offer.offerId, requestId: "discovery-drift-accept", prepare: true}, {db, nowMs: NOW + 1}))
    .rejects.toMatchObject({code: "failed-precondition"});
  else await expect(findRecordedRaceMatch(PLAYER, search, {db, nowMs: NOW + 1}))
    .rejects.toMatchObject({code: "aborted"});
  expect((await receipt.get()).data()).toEqual(before);
  expect((await db.collection("raceAttempts").get()).empty).toBe(true);
  expect((await db.collection("raceStartRequests").get()).empty).toBe(true);
});

it("rejects drift between candidate inspection and offer commitment, then permits a fresh indexed search", async () => {
  /** A single healthy indexed recording isolates the inspection-to-commit race. */
  const ref = db.doc("raceChallenges/commit-drift");
  await ref.set({...challenge(ref.id), riddles: RIDDLES, snapshotVersion: 1, contentVersion: raceDeckContentVersion(RIDDLES)});
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  /** First transaction inspects content; second would issue its receipt. */
  const original = db.runTransaction.bind(db);
  /** Alter scoring authority immediately before the committing transaction. */
  let calls = 0;
  /** Real Firestore transactions retain every authorization and read-before-write check. */
  const interleave = jest.spyOn(db, "runTransaction").mockImplementation(async (operation, options) => {
    if (++calls === 2) await ref.update({creatorWallFinishMs: 21000, creatorAdjustedFinishMs: 21000});
    return original(operation, options);
  });
  try {await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "commit-drift-search"}, {db, nowMs: NOW}))
    .rejects.toMatchObject({code: "aborted"});}
  finally {interleave.mockRestore();}
  expect((await db.collection("raceMatchOffers").get()).empty).toBe(true);
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW + 1);
  await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "commit-drift-new-intent"}, {db, nowMs: NOW + 1}))
    .resolves.toMatchObject({status: "matched", challenge: {challengeId: ref.id, adjustedTimeToBeatMs: 21000}});
});

it("uses a read-only discovery snapshot and a writable final offer transaction", async () => {
  await db.doc("raceChallenges/read-only-discovery").set(challenge("read-only-discovery"));
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  /** Original SDK transaction preserves real read-only and writable semantics. */
  const original = db.runTransaction.bind(db);
  /** Discovery and acceptance must use their respective transaction modes. */
  const modes: Array<boolean | undefined> = [];
  /** Observe transaction options without replacing emulator authority. */
  const transactions = jest.spyOn(db, "runTransaction").mockImplementation((operation, options) => {
    modes.push(options?.readOnly);
    return original(operation, options);
  });
  try {
    await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "read-only-discovery"}, {db, nowMs: NOW}))
      .resolves.toMatchObject({status: "matched"});
    expect(modes).toEqual([true, undefined]);
  } finally {transactions.mockRestore();}
});

it("reads the committing receipt and selected challenge in one SDK batch", async () => {
  await db.doc("raceChallenges/batched-offer").set(challenge("batched-offer"));
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  /** Real emulator transaction implementation retained beneath instrumentation. */
  const original = db.runTransaction.bind(db);
  /** Transaction count identifies the final offer-acceptance attempt. */
  let calls = 0;
  /** Ordered document paths observed during offer acceptance. */
  const commitBatches: string[][] = [];
  /** Instrumentation retains real transaction retry and commit behavior. */
  const transactions = jest.spyOn(db, "runTransaction").mockImplementation(async (operation, options) => {
    /** Only the final acceptance transaction contributes recorded batches. */
    const committing = ++calls === 2;
    return original(async transaction => {
      /** Original ordered SDK batch implementation. */
      const getAll = transaction.getAll.bind(transaction);
      /** Read instrumentation observes paths without replacing storage authority. */
      const batches = jest.spyOn(transaction, "getAll").mockImplementation((...references) => {
        if (committing) commitBatches.push(references.map(reference => reference.path));
        return getAll(...references);
      });
      try {return await operation(transaction);}
      finally {batches.mockRestore();}
    }, options);
  });
  try {
    /** Public matchmaking response identifies the accepted offer. */
    const result = await findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "batched-offer"}, {db, nowMs: NOW});
    expect(result.status).toBe("matched");
    expect(commitBatches).toContainEqual([`raceMatchOffers/${result.status === "matched" ? result.offerId : ""}`, "raceChallenges/batched-offer",
      `raceBotOffers/${result.status === "matched" ? result.offerId : ""}`]);
  } finally {transactions.mockRestore();}
});

it("starts the bounded scope query while independent history is pending", async () => {
  await db.doc("raceChallenges/parallel-ingress").set(challenge("parallel-ingress"));
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  /** Releases the deliberately held independent history read. */
  let releaseHistory!: () => void;
  /** Deterministic barrier keeps history pending during the scope query. */
  const heldHistory = new Promise<void>(resolve => {releaseHistory = resolve;});
  /** Signals that the held history read has begun. */
  let historyStarted!: () => void;
  /** Observation barrier prevents timing-dependent assertions. */
  const startedHistory = new Promise<void>(resolve => {historyStarted = resolve;});
  /** Original reference factory retains canonical emulator paths. */
  const originalDoc = db.doc.bind(db);
  /** Reference instrumentation delays only the owned history document. */
  const documents = jest.spyOn(db, "doc").mockImplementation(path => {
    /** Real document reference beneath the history barrier. */
    const reference = originalDoc(path);
    if (path === `users/${PLAYER}/raceMatchProfiles/en`) {
      /** Original document read resumes after the barrier is released. */
      const originalGet = reference.get.bind(reference);
      jest.spyOn(reference, "get").mockImplementation(async () => {
        historyStarted();
        await heldHistory;
        return originalGet();
      });
    }
    return reference;
  });
  /** Actual query implementation used by the scope index. */
  const queryPrototype = Object.getPrototypeOf(db.collection("raceMatchCandidates").where("locale", "==", "en"));
  /** Original SDK query read retained beneath observation. */
  const originalQueryGet = queryPrototype.get;
  /** Records whether the independent scope query has begun. */
  let scopeStarted = false;
  /** Query instrumentation retains actual emulator results. */
  const queries = jest.spyOn(queryPrototype, "get").mockImplementation(function(this: FirebaseFirestore.Query) {
    scopeStarted = true;
    return originalQueryGet.call(this);
  });
  /** Public matchmaking operation owns every issued read until completion. */
  const pending = findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "parallel-ingress"}, {db, nowMs: NOW});
  try {
    await startedHistory;
    await Promise.resolve();
    expect(scopeStarted).toBe(true);
  } finally {
    releaseHistory();
    await pending;
    documents.mockRestore();
    queries.mockRestore();
  }
});

it("retrieves a complete sparse scope once instead of querying every empty bucket", async () => {
  for (let index = 0; index < 9; index++) await db.doc(`raceChallenges/sparse-${index}`).set(challenge(`sparse-${index}`));
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  /** Actual public-service telemetry counts every candidate query, including empty buckets. */
  const logged = jest.spyOn(logger, "info");
  try {
    await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "sparse-scope-lookup"}, {db, nowMs: NOW}))
      .resolves.toMatchObject({status: "matched"});
    expect(logged).toHaveBeenCalledWith("Race matchmaking lookup", expect.objectContaining({candidateQueries: 1, candidateDocumentsRead: 9}));
  } finally {logged.mockRestore();}
});

it.each([12, 13])("retains indexed sampling when a scope probe is full (%i records)", async size => {
  for (let index = 0; index < size; index++) await db.doc(`raceChallenges/dense-${index}`).set(challenge(`dense-${index}`));
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  /** A full probe cannot prove that the provider/category scope is exhausted. */
  const logged = jest.spyOn(logger, "info");
  try {
    await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "dense-scope-lookup"}, {db, nowMs: NOW}))
      .resolves.toMatchObject({status: "matched"});
    /** Physical reads include the probe and any overlapping indexed pages. */
    const payload = logged.mock.calls.find(([message]) => message === "Race matchmaking lookup")?.[1];
    expect(payload.candidateQueries).toBeGreaterThan(1);
    expect(payload.candidateDocumentsRead).toBeLessThanOrEqual(200);
  } finally {logged.mockRestore();}
});
