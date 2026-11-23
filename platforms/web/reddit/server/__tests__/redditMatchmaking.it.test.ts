import {logger} from "firebase-functions";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {projectRaceMatchCandidate} from "../../../../../firebase-functions/src/race/matchmaking/raceMatchCandidates";
import {parseChallengeRecord, requestDocumentId} from "../../../../../firebase-functions/src/race/raceSetupService";
import {findRedditRaceMatch} from "../redditMatchmaking";
import {emptyRaceMatchProfile, recordRaceExposure, recordRacePerformance, racePerformanceExpectation} from "../../../../../firebase-functions/src/race/matchmaking/raceMatchPerformance";
import {searchRaceCandidates, racePerformanceBucket, RACE_MATCH_READ_BUDGET} from "../../../../../firebase-functions/src/race/matchmaking/raceCandidateSearch";
import {DEFAULT_RACE_MATCH_POLICY, raceMatchPolicySnapshot, selectRaceMatchConfiguration} from "../../../../../firebase-functions/src/race/matchmaking/raceMatchPolicy";
import {RACE_MATCH_LOOKUP_MS} from "../../../../../firebase-functions/src/race/matchmaking/raceMatchReadMeter";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
/** Renders the now interface. */
const NOW = Date.UTC(2026, 7, 20, 12);
/** Provides uid behavior. */
const uid = (character: string) => `reddit_${character.repeat(40)}`;
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;

/** Provides challenge behavior. */
const challenge = (challengeId: string, creatorId: string, locale: "en" | "ar") => ({
  challengeId,
  creatorId,
  creatorRunId: `run-${challengeId}`,
  creatorSnapshot: {displayName: `Rival ${challengeId}`},
  categoryId: "history",
  locale,
  deckId: `deck-${challengeId}`,
  canonicalRiddleIds: Array.from({length: 15}, (_, index) => `${challengeId}-riddle-${index}`),
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `${challengeId}-riddle-${position}`, text: "Archived clue", answer: "test", position})),
  targetCorrect: 10,
  creatorWallFinishMs: 40_000,
  creatorHintPenaltyMs: 0,
  creatorSkipPenaltyMs: 0,
  creatorTotalPenaltyMs: 0,
  creatorAdjustedFinishMs: 40_000,
  ghostEvents: [],
  rules: {
    version: "race10_v1",
    targetCorrect: 10,
    deckSize: 15,
    maxGuessesPerRiddle: 5,
    hintPenaltyMs: 15_000,
    skipPenaltyMs: 45_000,
    maxAdjustedTimeMs: 300_000,
  },
  contentVersion: "automated_translation_v1",
  status: "active",
  createdAtMs: NOW - 1_000,
  expiresAtMs: NOW + 60_000,
  expiresAt: Timestamp.fromMillis(NOW + 60_000),
});

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
});

beforeEach(async () => {
  await Promise.all([
    db.doc("raceConfig/matchPolicy").delete(),
    db.recursiveDelete(db.collection("raceMatchCandidates")),
    db.recursiveDelete(db.collection("raceMatchOffers")),
    db.recursiveDelete(db.collection("raceAttempts")),
    db.recursiveDelete(db.collection("users")),
    db.recursiveDelete(db.collection("raceChallenges")),
    db.recursiveDelete(db.collection("jestAccountDeletionTombstones")),
  ]);
});

afterAll(async () => {
  await Promise.all([
    db.doc("raceConfig/matchPolicy").delete(),
    db.recursiveDelete(db.collection("raceMatchCandidates")),
    db.recursiveDelete(db.collection("raceMatchOffers")),
    db.recursiveDelete(db.collection("raceAttempts")),
    db.recursiveDelete(db.collection("users")),
    db.recursiveDelete(db.collection("raceChallenges")),
    db.recursiveDelete(db.collection("jestAccountDeletionTombstones")),
  ]);
});

it("uses one immutable language/category policy across retrieval, ranking and concurrent configuration changes", async () => {
  /** Cold-start history should retrieve forty-second recordings under the configured language prior. */
  const configured = {...DEFAULT_RACE_MATCH_POLICY.policy, revision: 42,
    localePriors: {en: {overallMs: 180000, categories: {history: 40000}}}};
  /** Operator updates occur independently of candidate-validation transactions. */
  const policyRef = db.doc("raceConfig/matchPolicy");
  await policyRef.set(configured);
  /** More mismatches than the document budget prove the prior affects indexed retrieval before ranking. */
  const batch = db.batch();
  for (let index = 0; index < 220; index++) batch.set(db.doc(`raceChallenges/other-${index}`), {
    ...challenge(`other-${index}`, uid("b"), "en"), creatorAdjustedFinishMs: 180000, creatorWallFinishMs: 180000,
  });
  batch.set(db.doc("raceChallenges/comparable"), challenge("comparable", uid("c"), "en"));
  await batch.commit();
  await projectCandidates();
  /** Change configuration only after lookup has captured its context. */
  const originalTransaction = db.runTransaction.bind(db);
  /** Mid-lookup configuration must not alter ranking or attribution. */
  let changed = false;
  /** Fixed-document reads expose accidental policy reloads. */
  const reads = jest.spyOn(db, "doc");
  /** Canonical eligibility validation begins after the policy/history read pair. */
  const transactions = jest.spyOn(db, "runTransaction").mockImplementation(async (operation, options) => {
    if (!changed) {changed = true; await policyRef.set({...configured, revision: 43, localePriors: {en: {overallMs: 180000, categories: {history: 180000}}}});}
    return originalTransaction(operation, options);
  });
  /** Matched response retains the first selected configuration despite the operator update. */
  let result;
  try {
    result = await findRedditRaceMatch(uid("a"), {locale: "en", categoryId: "history", requestId: "configured-intent"}, {db, nowMs: NOW});
    expect(reads.mock.calls.filter(([path]) => path === "raceConfig/matchPolicy")).toHaveLength(1);
  } finally {transactions.mockRestore(); reads.mockRestore();}
  expect(result).toMatchObject({status: "matched", challenge: {challengeId: "comparable"}});
  /** Offer stores a complete reproducible parameter snapshot and independent recording normalization. */
  const receipt = db.doc(`raceMatchOffers/${requestDocumentId(uid("a"), "configured-intent")}`);
  /** Replays must preserve original lookup attribution rather than rewrite it using current configuration. */
  const stored = (await receipt.get()).data();
  expect(stored).toMatchObject({matchPolicyVersion: 3, matchPolicyRevision: 42,
    matchPolicyHash: raceMatchPolicySnapshot(configured).hash, matchPolicySnapshot: configured,
    expectedPerformanceMs: expect.closeTo(40000, 2), questionOverlap: 0, recentRivalRepeats: 0});
  expect((await db.doc("raceMatchCandidates/comparable").get()).data()?.matchPolicyVersion).toBe(1);
  await expect(findRedditRaceMatch(uid("a"), {locale: "en", categoryId: "history", requestId: "configured-intent"}, {db, nowMs: NOW + 1}))
    .resolves.toMatchObject({status: "matched", challenge: {challengeId: "comparable"}});
  expect((await receipt.get()).data()).toEqual(stored);
});

it("fails a corrupt stored policy rather than silently using defaults or returning an empty pool", async () => {
  await db.doc("raceChallenges/healthy").set(challenge("healthy", uid("b"), "en"));
  await projectCandidates();
  await db.doc("raceConfig/matchPolicy").set({...DEFAULT_RACE_MATCH_POLICY.policy, performance: {
    ...DEFAULT_RACE_MATCH_POLICY.policy.performance, wideRatio: 0,
  }});
  await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId: "corrupt-policy"}, {db, nowMs: NOW}))
    .rejects.toMatchObject({code: "data-loss"});
  expect((await db.collection("raceMatchOffers").get()).empty).toBe(true);
});

it("preserves the transaction winner's policy when concurrent lookups capture different revisions", async () => {
  /** Both recordings are independently eligible but belong to different performance bands. */
  await db.doc("raceChallenges/quick").set(challenge("quick", uid("b"), "en"));
  await db.doc("raceChallenges/slow").set({...challenge("slow", uid("c"), "en"), creatorAdjustedFinishMs: 180000, creatorWallFinishMs: 180000});
  await projectCandidates();
  /** Each configuration favors exactly one recording before the offer transaction races. */
  const policies = [40000, 180000].map((overallMs, index) => ({...DEFAULT_RACE_MATCH_POLICY.policy, revision: index + 10,
    defaultPriors: {overallMs, categories: {}}}));
  /** Simulates configuration reads on opposite sides of an operator update. */
  const getPolicy = jest.fn().mockResolvedValueOnce({exists: true, data: () => policies[0]})
    .mockResolvedValueOnce({exists: true, data: () => policies[1]});
  /** Canonical records and transactions continue to use the actual emulator. */
  const originalDoc = db.doc.bind(db);
  /** Only the independent configuration read is supplied by a controlled adapter. */
  const reads = jest.spyOn(db, "doc").mockImplementation(path => {
    /** Production document references remain intact for every other operation. */
    const ref = originalDoc(path);
    return path === "raceConfig/matchPolicy" ? new Proxy(ref, {get: (target, key) => key === "get" ? getPolicy : Reflect.get(target, key, target)}) : ref;
  });
  /** Both callers share the same requester-bound intent. */
  let results;
  try {results = await Promise.all([0, 1].map(() => findRedditRaceMatch(uid("a"), {locale: "en", requestId: "policy-race"}, {db, nowMs: NOW})));}
  finally {reads.mockRestore();}
  expect(getPolicy).toHaveBeenCalledTimes(2);
  expect(results[0]).toEqual(results[1]);
  /** A losing context cannot rewrite the winner's prediction for another recording. */
  const stored = (await db.doc(`raceMatchOffers/${requestDocumentId(uid("a"), "policy-race")}`).get()).data()!;
  expect(stored.expectedPerformanceMs).toBeCloseTo(stored.recordingPerformanceMs);
  expect(stored.matchPolicyHash).toBe(raceMatchPolicySnapshot(stored.matchPolicySnapshot).hash);
  expect(stored.matchPolicyRevision).toBe(stored.matchPolicySnapshot.revision);
  expect([10, 11]).toContain(stored.matchPolicyRevision);
  expect((await db.collection("raceMatchOffers").get()).size).toBe(1);
});

it("does not issue configuration or history reads after the initial receipt read exhausts the lookup deadline", async () => {
  /** A healthy pool must not hide a storage timeout as an empty result. */
  await db.doc("raceChallenges/healthy").set(challenge("healthy", uid("b"), "en"));
  await projectCandidates();
  /** The real receipt read completes after the bounded issuing deadline. */
  const started = Date.now();
  /** Clock adapter is advanced only after the initial asynchronous read. */
  let clock: jest.SpyInstance | undefined;
  /** The initial two-receipt batch completes before the elapsed work deadline is checked. */
  const originalGetAll = db.getAll.bind(db);
  /** Fixed-path observer proves the lookup issues no further storage work. */
  const reads = jest.spyOn(db, "doc");
  /** Advance real time only after the actual emulator batch resolves. */
  const ingress = jest.spyOn(db, "getAll").mockImplementation(async (...references) => {
    /** Preserve canonical emulator reads before advancing the lookup deadline. */
    const snapshots = await originalGetAll(...references);
    clock = jest.spyOn(Date, "now").mockReturnValue(started + RACE_MATCH_LOOKUP_MS + 1000);
    return snapshots;
  });
  try {
    await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId: "slow-receipt"}, {db, nowMs: NOW}))
      .rejects.toMatchObject({code: "deadline-exceeded"});
    expect(reads.mock.calls.map(([path]) => path)).toHaveLength(2);
    expect(ingress).toHaveBeenCalledTimes(1);
  } finally {clock?.mockRestore(); reads.mockRestore(); ingress.mockRestore();}
});

/** Projects the canonical fixtures using the same publication projection as production. */
async function projectCandidates(): Promise<void> {
  /** Provides challenges behavior. */
  const challenges = await db.collection("raceChallenges").get();
  /** Provides batch behavior. */
  const batch = db.batch();
  for (const document of challenges.docs) {
    /** Provides candidate behavior. */
    const candidate = projectRaceMatchCandidate(parseChallengeRecord(document.data()));
    if (candidate) batch.set(db.doc(`raceMatchCandidates/${document.id}`), candidate);
  }
  await batch.commit();
}

it.each([{userId: uid("c")}, {expiresAtMs: "tomorrow"}, {challengeId: "wrong/path"}, {matchPolicyHash: "b".repeat(64)}, {acceptedRunId: "unconfirmed"}])(
  "rejects corrupt replay receipts without replacing selection: %j", async patch => {
    await db.doc("raceChallenges/healthy").set(challenge("healthy", uid("b"), "en"));
    await projectCandidates();
    /** Stable intent must not silently replace its damaged selection. */
    const input = {locale: "en" as const, requestId: "corrupt-replay"};
    await findRedditRaceMatch(uid("a"), input, {db, nowMs: NOW});
    /** Physical receipt is scoped to this caller and intent. */
    const ref = db.doc(`raceMatchOffers/${requestDocumentId(uid("a"), input.requestId)}`);
    await ref.update(patch);
    /** Saved corruption must survive failure without accidental repair writes. */
    const before = (await ref.get()).data();
    await expect(findRedditRaceMatch(uid("a"), input, {db, nowMs: NOW + 1})).rejects.toMatchObject({code: "data-loss"});
    expect((await ref.get()).data()).toEqual(before);
    expect((await db.collection("raceAttempts").get()).empty).toBe(true);
  });

it("matches concurrent global Reddit callers only to other players in the exact locale", async () => {
  /** Provides english creator behavior. */
  const englishCreator = uid("a");
  /** Provides arabic creator behavior. */
  const arabicCreator = uid("b");
  /** Provides english player behavior. */
  const englishPlayer = uid("c");
  /** Provides arabic player behavior. */
  const arabicPlayer = uid("d");
  await Promise.all([
    db
      .collection("raceChallenges")
      .doc("english-match")
      .set(challenge("english-match", englishCreator, "en")),
    db
      .collection("raceChallenges")
      .doc("arabic-match")
      .set(challenge("arabic-match", arabicCreator, "ar")),
    db
      .collection("raceChallenges")
      .doc("self-match")
      .set(challenge("self-match", englishPlayer, "en")),
    db
      .collection("raceChallenges")
      .doc("foreign-provider")
      .set(challenge("foreign-provider", `facebook_${"e".repeat(40)}`, "en")),
  ]);

  await projectCandidates();
  /** Provides [english, arabic] behavior. */
  const [english, arabic] = await Promise.all([
    Promise.all(Array.from({length: 8}, () => findRedditRaceMatch(englishPlayer, "en", {db, nowMs: NOW}))),
    Promise.all(Array.from({length: 8}, () => findRedditRaceMatch(arabicPlayer, "ar", {db, nowMs: NOW}))),
  ]);
  expect(
    english.every(
      (result) =>
        result.status === "matched" &&
        result.challenge.challengeId === "english-match" &&
        result.challenge.locale === "en",
    ),
  ).toBe(true);
  expect(
    arabic.every(
      (result) =>
        result.status === "matched" &&
        result.challenge.challengeId === "arabic-match" &&
        result.challenge.locale === "ar",
    ),
  ).toBe(true);
  expect(JSON.stringify(english)).not.toContain("self-match");
  expect(JSON.stringify(english)).not.toContain("foreign-provider");
});

it("never offers an ineligible human when only self, cross-locale, expired, or revoked candidates exist", async () => {
  /** Provides player behavior. */
  const player = uid("a");
  await Promise.all([
    db
      .collection("raceChallenges")
      .doc("self")
      .set(challenge("self", player, "en")),
    db
      .collection("raceChallenges")
      .doc("arabic")
      .set(challenge("arabic", uid("b"), "ar")),
    db
      .collection("raceChallenges")
      .doc("expired")
      .set({...challenge("expired", uid("c"), "en"), expiresAtMs: NOW - 1, expiresAt: Timestamp.fromMillis(NOW - 1)}),
    db
      .collection("raceChallenges")
      .doc("revoked")
      .set({...challenge("revoked", uid("d"), "en"), status: "revoked"}),
  ]);
  await projectCandidates();
  /** A bot receipt may accompany an empty human pool when other suites seed playable content. */
  const result = await findRedditRaceMatch(player, "en", {db, nowMs: NOW});
  expect(result).toMatchObject({status: "empty", locale: "en"});
  expect(result).not.toHaveProperty("challenge");
});


it("skips attempted and bidirectionally blocked recordings before offering a match", async () => {
  /** Provides player behavior. */
  const player = uid("a");
  for (const [id, creator] of [["attempted", uid("b")], ["blocked", uid("c")], ["ready", uid("d")]]) {
    await db.doc(`raceChallenges/${id}`).set(challenge(id, creator, "en"));
  }
  await projectCandidates();
  await db.doc(`raceAttempts/${requestDocumentId("attempted", player)}`).set({playerId: player});
  await db.doc(`users/${uid("c")}/blockedRivals/${player}`).set({blocked: true});
  /** Provides result behavior. */
  const result = await findRedditRaceMatch(player, {locale: "en", requestId: "eligibility-request"}, {db, nowMs: NOW});
  expect(result).toMatchObject({status: "matched", challenge: {challengeId: "ready"}});
});

it("finds a playable recording beyond a full first page of attempted candidates", async () => {
  /** Provides player behavior. */
  const player = uid("a");
  /** Provides batch behavior. */
  const batch = db.batch();
  for (let index = 0; index < 55; index += 1) {
    /** Provides id behavior. */
    const id = `attempted-${index}`;
    batch.set(db.doc(`raceChallenges/${id}`), {...challenge(id, uid("b"), "en"), expiresAtMs: NOW + 30_000});
    batch.set(db.doc(`raceAttempts/${requestDocumentId(id, player)}`), {playerId: player});
  }
  batch.set(db.doc("raceChallenges/ready"), challenge("ready", uid("c"), "en"));
  await batch.commit();
  await projectCandidates();
  await expect(findRedditRaceMatch(player, {locale: "en", requestId: "second-page-request"}, {db, nowMs: NOW})).resolves.toMatchObject({
    status: "matched", challenge: {challengeId: "ready"},
  });
});

it("returns a stable offer for concurrent retries and rejects reusing its request for another language", async () => {
  await db.doc("raceChallenges/first").set(challenge("first", uid("b"), "en"));
  await db.doc("raceChallenges/second").set(challenge("second", uid("c"), "en"));
  await projectCandidates();
  /** Provides input behavior. */
  const input = {locale: "en" as const, requestId: "stable-match-request"};
  /** Provides results behavior. */
  const results = await Promise.all(Array.from({length: 8}, () => findRedditRaceMatch(uid("a"), input, {db, nowMs: NOW})));
  expect(new Set(results.map((result) => result.status === "matched" ? result.challenge.challengeId : "empty")).size).toBe(1);
  await expect(findRedditRaceMatch(uid("a"), {...input, locale: "ar"}, {db, nowMs: NOW})).rejects.toMatchObject({code: "invalid-argument"});
});

it("selects comparable category performance instead of expiry order or request shuffling", async () => {
  await db.doc("raceChallenges/far").set({...challenge("far", uid("b"), "en"), creatorAdjustedFinishMs: 150_000, creatorWallFinishMs: 150_000,
    expiresAtMs: NOW + 30_000});
  await db.doc("raceChallenges/near").set({...challenge("near", uid("c"), "en"), creatorAdjustedFinishMs: 50_000, creatorWallFinishMs: 50_000});
  /** Provides profile behavior. */
  let profile = emptyRaceMatchProfile();
  for (let index = 0; index < 10; index += 1) profile = recordRacePerformance(profile, "history", {observation: "finish", timeMs: 40_000, evidence: 1});
  await db.doc(`users/${uid("a")}/raceMatchProfiles/en`).set(profile);
  await projectCandidates();
  await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId: "performance-request"}, {db, nowMs: NOW}))
    .resolves.toMatchObject({status: "matched", challenge: {challengeId: "near"}});
});

it.each([undefined, "history" as const])("retrieves the best category-specific recording with preference %s despite a dense overall-performance pool", async categoryId => {
  /** Overall pace deliberately differs from the player's established history pace. */
  const profile = {...emptyRaceMatchProfile(), overall: {logMs: Math.log(120000), evidence: 20, updatedAtMs: NOW},
    categories: {history: {logMs: Math.log(20000), evidence: 20, updatedAtMs: NOW}}};
  /** Exact category expectation gives the history recording zero performance distance. */
  const historyPerformance = Math.round(Math.exp(racePerformanceExpectation(profile, "history", NOW).expectedLog));
  /** Dense unrelated category can consume the entire former global retrieval budget. */
  const batch = db.batch();
  for (let index = 0; index < 220; index++) {
    /** Distinct canonical recordings in the overall-performance interval. */
    const id = `music-${index}`;
    batch.set(db.doc(`raceChallenges/${id}`), {...challenge(id, uid("b"), "en"), categoryId: "music",
      creatorAdjustedFinishMs: 145000, creatorWallFinishMs: 145000, recordingPerformanceMs: 145000});
  }
  batch.set(db.doc("raceChallenges/category-best"), {...challenge("category-best", uid("c"), "en"),
    creatorAdjustedFinishMs: historyPerformance, creatorWallFinishMs: historyPerformance, recordingPerformanceMs: historyPerformance});
  await batch.commit();
  await db.doc(`users/${uid("a")}/raceMatchProfiles/en`).set(profile);
  await projectCandidates();
  /** Search includes the category's own interval even without an explicit category preference. */
  const result = await findRedditRaceMatch(uid("a"), {locale: "en", categoryId, requestId: "category-retrieval"}, {db, nowMs: NOW});
  expect(result).toMatchObject({status: "matched", challenge: {challengeId: "category-best"}});
  if (result.status !== "matched" || !result.offerId) throw new Error("expected-issued-offer");
  expect((await db.doc(`raceMatchOffers/${result.offerId}`).get()).data()?.lookupCandidateDocumentsRead)
    .toBeLessThanOrEqual(RACE_MATCH_READ_BUDGET);
  /** Direct retrieval also guarantees disjoint category cursors and a stable retry window. */
  const pool = await searchRaceCandidates(db, uid("a"), "reddit", {locale: "en", categoryId}, profile, "category-retrieval", NOW);
  expect(new Set(pool.documents.map(document => document.id)).size).toBe(pool.documents.length);
  expect(pool.documents.some(document => document.id === "category-best")).toBe(true);
  if (categoryId) expect(pool.documents.every(document => document.data().categoryId === categoryId)).toBe(true);
});

it("retrieves a comparable recording beyond 200 earlier-expiring mismatched performances", async () => {
  /** Provides batch behavior. */
  const batch = db.batch();
  for (let index = 0; index < 220; index++) {
    /** Provides id behavior. */
    const id = `far-${index}`;
    batch.set(db.doc(`raceChallenges/${id}`), {...challenge(id, uid("b"), "en"), creatorAdjustedFinishMs: 260000, creatorWallFinishMs: 260000, expiresAtMs: NOW + 30000});
  }
  batch.set(db.doc("raceChallenges/comparable"), {...challenge("comparable", uid("c"), "en"), creatorAdjustedFinishMs: 120000, creatorWallFinishMs: 120000});
  await batch.commit();
  await projectCandidates();
  /** Provides result behavior. */
  const result = await findRedditRaceMatch(uid("a"), {locale: "en", requestId: "indexed-performance"}, {db, nowMs: NOW});
  expect(result).toMatchObject({status: "matched", challenge: {challengeId: "comparable"}});
  if (result.status !== "matched" || !result.offerId) throw new Error("expected-issued-offer");
  /** Provides receipt behavior. */
  const receipt = (await db.doc(`raceMatchOffers/${result.offerId}`).get()).data()!;
  // The sparse-scope optimization probes twelve records before indexed retrieval;
  // the one comparable bucket document brings the total physical reads to thirteen.
  expect(receipt.lookupCandidateDocumentsRead).toBe(13);
  expect(receipt.lookupCandidateQueries).toBeLessThanOrEqual(7);
  expect(receipt.lookupDocumentReadAttempts).toBeGreaterThanOrEqual(17);
  expect(receipt.lookupTransactionAttempts).toBeGreaterThanOrEqual(2);
});

it("rotates dense-bucket windows across new intents while preserving replay windows and bounded reads", async () => {
  /** Provides batch behavior. */
  const batch = db.batch();
  for (let index = 0; index < 251; index++) {
    /** Provides id behavior. */
    const id = `dense-${index}`;
    batch.set(db.doc(`raceChallenges/${id}`), {...challenge(id, uid("b"), "en"), creatorAdjustedFinishMs: 120000, creatorWallFinishMs: 120000});
  }
  await batch.commit();
  await projectCandidates();
  /** Provides lookup behavior. */
  const lookup = (requestId: string) => searchRaceCandidates(db, uid("a"), "reddit", {locale: "en"}, emptyRaceMatchProfile(), requestId, NOW);
  /** Provides first behavior. */
  const first = await lookup("rotation-a");
  /** Provides replay behavior. */
  const replay = await lookup("rotation-a");
  /** Provides next behavior. */
  const next = await lookup("rotation-b");
  expect(first.documents).toHaveLength(RACE_MATCH_READ_BUDGET);
  expect(first.exhausted).toBe(false);
  expect(replay.documents.map(document => document.id)).toEqual(first.documents.map(document => document.id));
  expect(next.documents.map(document => document.id)).not.toEqual(first.documents.map(document => document.id));
  expect(new Set(first.documents.map(document => document.id)).size).toBe(first.documents.length);
  expect(new Set(next.documents.map(document => document.id)).size).toBe(next.documents.length);
});

it("returns a capped-search failure when canonical rejections exhaust the total read budget", async () => {
  /** Distinct attempted recordings still consume bounded canonical work without producing an offer. */
  const batch = db.batch();
  for (let index = 0; index < 190; index++) {
    /** Distinct prior-attempt accounts prevent shared creator reads from masking the budget guard. */
    const creator = `reddit_${index.toString(16).padStart(40, "0")}`;
    /** Recording remains in the public projection until canonical eligibility is checked. */
    const id = `blocked-${index}`;
    batch.set(db.doc(`raceChallenges/${id}`), {...challenge(id, creator, "en"), creatorAdjustedFinishMs: 120000, creatorWallFinishMs: 120000});
    batch.set(db.doc(`raceAttempts/${requestDocumentId(id, uid("a"))}`), {runId: `attempt-${index}`});
  }
  await batch.commit();
  await projectCandidates();
  await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId: "storage-budget"}, {db, nowMs: NOW}))
    .rejects.toMatchObject({code: "resource-exhausted", details: {matchmaking: {
      reason: "search-budget-exceeded", recovery: "new-intent", retryAfterMs: 0,
    }}});
  expect((await db.collection("raceMatchOffers").get()).empty).toBe(true);
});

it("requires a fresh intent after expiry without silently renewing the old offer", async () => {
  /** The recording outlives the short offer, isolating intent expiry from pool expiry. */
  const recording = {...challenge("long-lived", uid("b"), "en"), expiresAtMs: NOW + 600_000,
    expiresAt: Timestamp.fromMillis(NOW + 600_000)};
  await db.doc("raceChallenges/long-lived").set(recording);
  await projectCandidates();
  /** First receipt remains immutable after the client's response is lost. */
  const first = await findRedditRaceMatch(uid("a"), {locale: "en", requestId: "expired-intent"}, {db, nowMs: NOW});
  expect(first.status).toBe("matched");
  await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId: "expired-intent"}, {db, nowMs: NOW + 60_001}))
    .rejects.toMatchObject({code: "failed-precondition", details: {matchmaking: {
      reason: "intent-expired", recovery: "new-intent", retryAfterMs: 0,
    }}});
  /** Explicit player retry can still select the eligible reusable recording. */
  const fresh = await findRedditRaceMatch(uid("a"), {locale: "en", requestId: "fresh-intent"}, {db, nowMs: NOW + 60_001});
  expect(fresh.status).toBe("matched");
  expect((await db.collection("raceMatchOffers").get()).size).toBe(2);
});

it("rejects structurally valid stale ranking metadata and continues to a healthy canonical recording", async () => {
  await db.doc("raceChallenges/stale").set({...challenge("stale", uid("b"), "en"), creatorAdjustedFinishMs: 260000, creatorWallFinishMs: 260000});
  await db.doc("raceChallenges/healthy").set({...challenge("healthy", uid("c"), "en"), creatorAdjustedFinishMs: 135000, creatorWallFinishMs: 135000});
  await projectCandidates();
  await db.doc("raceMatchCandidates/stale").update({performanceMs: 120000, performanceBucket: racePerformanceBucket(120000)});
  await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId: "canonical-ranking"}, {db, nowMs: NOW}))
    .resolves.toMatchObject({status: "matched", challenge: {challengeId: "healthy"}});
});

it("reports projection corruption as a recoverable failure rather than an empty opponent pool", async () => {
  await db.doc("raceChallenges/corrupt").set({...challenge("corrupt", uid("b"), "en"), creatorAdjustedFinishMs: 120000, creatorWallFinishMs: 120000});
  await projectCandidates();
  await db.doc("raceMatchCandidates/corrupt").update({categoryId: "invalid"});
  await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId: "corrupt-projection"}, {db, nowMs: NOW}))
    .rejects.toMatchObject({code: "unavailable", details: {matchmaking: {reason: "projection-unavailable", recovery: "same-intent", retryAfterMs: 15000}}});
});

it("prefers unfamiliar questions and rivals within comparable performance bands", async () => {
  /** Provides repeated behavior. */
  const repeated = {...challenge("repeated", uid("b"), "en"), creatorAdjustedFinishMs: 120_000, creatorWallFinishMs: 120_000};
  await db.doc("raceChallenges/repeated").set(repeated);
  await db.doc("raceChallenges/fresh").set({...challenge("fresh", uid("c"), "en"), creatorAdjustedFinishMs: 110_000, creatorWallFinishMs: 110_000});
  await db.doc(`users/${uid("a")}/raceMatchProfiles/en`).set(recordRaceExposure(emptyRaceMatchProfile(), uid("a"), repeated.riddles, uid("b")));
  await projectCandidates();
  await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId: "freshness-request"}, {db, nowMs: NOW}))
    .resolves.toMatchObject({status: "matched", challenge: {challengeId: "fresh"}});
});

it("widens performance bands when the nearest candidate is blocked", async () => {
  await db.doc("raceChallenges/near-blocked").set({...challenge("near-blocked", uid("b"), "en"), creatorAdjustedFinishMs: 120_000, creatorWallFinishMs: 120_000});
  await db.doc("raceChallenges/distant-eligible").set({...challenge("distant-eligible", uid("c"), "en"), creatorAdjustedFinishMs: 10_000, creatorWallFinishMs: 10_000});
  await db.doc(`users/${uid("a")}/blockedRivals/${uid("b")}`).set({blocked: true});
  await projectCandidates();
  await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId: "widening-request"}, {db, nowMs: NOW}))
    .resolves.toMatchObject({status: "matched", challenge: {challengeId: "distant-eligible"}});
});


it.each(["repeat", "overlap"])("relaxes into a fresh comparable band for %s while replaying the original offer", async signal => {
  /** Nearest match is exact, but familiarity can make it a poor repeat experience. */
  /** Nearest eligible recording remains a deterministic fallback. */
  const repeated = {...challenge("nearest", uid("b"), "en"), creatorAdjustedFinishMs: 120000, creatorWallFinishMs: 120000};
  await db.doc("raceChallenges/nearest").set(repeated);
  /** Two hundred seconds is outside the cold-start near band, inside the wider band. */
  await db.doc("raceChallenges/fresh-wide").set({...challenge("fresh-wide", uid("c"), "en"), creatorAdjustedFinishMs: 200000, creatorWallFinishMs: 200000});
  await db.doc(`users/${uid("a")}/raceMatchProfiles/en`).set(recordRaceExposure(emptyRaceMatchProfile(), uid("a"),
    signal === "overlap" ? repeated.riddles : [], signal === "repeat" ? uid("b") : undefined));
  await projectCandidates();
  /** One intent remains stable through a later operator update. */
  const input = {locale: "en" as const, categoryId: "history" as const, requestId: "freshness-wide"};
  /** Selected recording must be outside the exact nearest band. */
  const first = await findRedditRaceMatch(uid("a"), input, {db, nowMs: NOW});
  expect(first).toMatchObject({status: "matched", challenge: {challengeId: "fresh-wide"}});
  /** Stored attribution follows the actual wider recording. */
  const receipt = (await db.doc(`raceMatchOffers/${requestDocumentId(uid("a"), input.requestId)}`).get()).data();
  expect(receipt).toMatchObject({offerBand: 1, freshnessRelaxed: true, recentRivalRepeats: 0, questionOverlap: 0});
  await db.doc("raceConfig/matchPolicy").set({...DEFAULT_RACE_MATCH_POLICY.policy, revision: 99,
    freshness: {nearCandidateBudget: 100, maxAdditionalChecks: 20, repeatThreshold: 20, overlapThreshold: 1}});
  expect(await findRedditRaceMatch(uid("a"), input, {db, nowMs: NOW + 1})).toEqual(first);
  expect((await db.doc(`raceMatchOffers/${requestDocumentId(uid("a"), input.requestId)}`).get()).data()).toEqual(receipt);
});

it.each(["blocked", "foreign", "too-far", "missing"])("keeps nearest fallback when the freshness alternative is %s", async reason => {
  /** Nearest eligible recording remains a deterministic fallback. */
  const repeated = {...challenge("nearest", uid("b"), "en"), creatorAdjustedFinishMs: 120000, creatorWallFinishMs: 120000};
  await db.doc("raceChallenges/nearest").set(repeated);
  if (reason !== "missing") await db.doc("raceChallenges/alternative").set({...challenge("alternative", uid("c"), reason === "foreign" ? "ar" : "en"),
    creatorAdjustedFinishMs: reason === "too-far" ? 10000 : 200000, creatorWallFinishMs: reason === "too-far" ? 10000 : 200000});
  if (reason === "blocked") await db.doc(`users/${uid("a")}/blockedRivals/${uid("c")}`).set({blocked: true});
  await db.doc(`users/${uid("a")}/raceMatchProfiles/en`).set(recordRaceExposure(emptyRaceMatchProfile(), uid("a"), repeated.riddles, uid("b")));
  await projectCandidates();
  await expect(findRedditRaceMatch(uid("a"), {locale: "en", categoryId: "history", requestId: "fallback-freshness"}, {db, nowMs: NOW}))
    .resolves.toMatchObject({status: "matched", challenge: {challengeId: "nearest"}});
  expect((await db.doc(`raceMatchOffers/${requestDocumentId(uid("a"), "fallback-freshness")}`).get()).data()?.freshnessRelaxed).toBe(false);
});

it("keeps version-2 band-first selection when the configured policy is legacy", async () => {
  /** Nearest eligible recording remains a deterministic fallback. */
  const repeated = {...challenge("nearest", uid("b"), "en"), creatorAdjustedFinishMs: 120000, creatorWallFinishMs: 120000};
  await db.doc("raceChallenges/nearest").set(repeated);
  await db.doc("raceChallenges/fresh-wide").set({...challenge("fresh-wide", uid("c"), "en"), creatorAdjustedFinishMs: 200000, creatorWallFinishMs: 200000});
  await db.doc(`users/${uid("a")}/raceMatchProfiles/en`).set(recordRaceExposure(emptyRaceMatchProfile(), uid("a"), repeated.riddles, uid("b")));
  /** Legacy configuration excludes every new algorithm field. */
  const {freshness: _freshness, ...base} = DEFAULT_RACE_MATCH_POLICY.policy.algorithmVersion === 3 ? DEFAULT_RACE_MATCH_POLICY.policy : (() => {throw Error("expected-v3");})();
  /** Original algorithm retains band-first selection. */
  const legacy = {...base, algorithmVersion: 2};
  await db.doc("raceConfig/matchPolicy").set(legacy);
  await projectCandidates();
  await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId: "legacy-freshness"}, {db, nowMs: NOW}))
    .resolves.toMatchObject({status: "matched", challenge: {challengeId: "nearest"}});
  expect((await db.doc(`raceMatchOffers/${requestDocumentId(uid("a"), "legacy-freshness")}`).get()).data()?.matchPolicySnapshot).toEqual(legacy);
});

it.each([true, false])("reserves wider retrieval and fallback commit capacity in dense repetitive pools (fresh=%s)", async withFresh => {
  /** More nearest recordings than the reserved nearest budget must not starve the wider tier. */
  const batch = db.batch();
  for (let index = 0; index < 220; index++) batch.set(db.doc(`raceChallenges/repeated-${index}`), {
    ...challenge(`repeated-${index}`, uid("b"), "en"), creatorAdjustedFinishMs: 120000, creatorWallFinishMs: 120000,
  });
  if (withFresh) batch.set(db.doc("raceChallenges/fresh-wide"), {...challenge("fresh-wide", uid("c"), "en"), creatorAdjustedFinishMs: 200000, creatorWallFinishMs: 200000});
  await batch.commit();
  await db.doc(`users/${uid("a")}/raceMatchProfiles/en`).set(recordRaceExposure(emptyRaceMatchProfile(), uid("a"), [], uid("b")));
  await projectCandidates();
  /** Selection must succeed even when all reserved nearest candidates repeat the same opponent. */
  const result = await findRedditRaceMatch(uid("a"), {locale: "en", categoryId: "history", requestId: "dense-freshness"}, {db, nowMs: NOW});
  expect(result.status).toBe("matched");
  if (result.status !== "matched") throw new Error("expected-match");
  expect(result.challenge.challengeId).toMatch(withFresh ? /^fresh-wide$/ : /^repeated-/);
  /** Read attribution proves optional variety checks retain fallback capacity. */
  const receipt = (await db.doc(`raceMatchOffers/${requestDocumentId(uid("a"), "dense-freshness")}`).get()).data()!;
  expect(receipt.lookupCandidateDocumentsRead).toBeLessThanOrEqual(200);
  expect(receipt.lookupDocumentReadAttempts).toBeLessThan(500);
  expect(receipt.freshnessRelaxed).toBe(withFresh);
  expect(receipt).toMatchObject({freshnessBaselineBand: 0, freshnessBaselineRepeats: 1, freshnessBaselineOverlap: 0});
});

it("reports corrupt canonical identity as recoverable pool corruption rather than an empty pool", async () => {
  await db.doc("raceChallenges/corrupt-identity").set({...challenge("corrupt-identity", uid("b"), "en"), creatorAdjustedFinishMs: 120000, creatorWallFinishMs: 120000});
  await projectCandidates();
  await db.doc("raceChallenges/corrupt-identity").update({challengeId: "different-recording"});
  await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId: "corrupt-canonical"}, {db, nowMs: NOW}))
    .rejects.toMatchObject({code: "unavailable", details: {matchmaking: {reason: "projection-unavailable", recovery: "same-intent", retryAfterMs: 15000}}});
  expect((await db.collection("raceMatchOffers").get()).empty).toBe(true);
});


it("scans a fully blocked pool with fewer reads and grouped transaction callbacks", async () => {
  /** Distinct creators retain real block/deletion checks rather than relying only on a shared rival. */
  const batch = db.batch();
  for (let index = 0; index < 160; index++) {
    /** Canonical provider identity for this excluded recording. */
    const creator = `reddit_${index.toString(16).padStart(40, "0")}`;
    /** Every recording is indexed and must be rejected canonically. */
    const id = `blocked-${index}`;
    batch.set(db.doc(`raceChallenges/${id}`), {...challenge(id, creator, "en"), creatorAdjustedFinishMs: 120000, creatorWallFinishMs: 120000});
    batch.set(db.doc(`users/${uid("a")}/blockedRivals/${creator}`), {createdAtMs: NOW});
  }
  await batch.commit();
  await projectCandidates();
  /** Terminal telemetry captures actual physical read attempts after cache reuse. */
  const logs = jest.spyOn(logger, "info");
  try {
    await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId: "blocked-cost"}, {db, nowMs: NOW})).resolves.toMatchObject({status: "empty"});
    /** One fully scanned pool now fits the budget, while preserving every canonical exclusion. */
    const event = logs.mock.calls.find(([message, data]) => message === "Race matchmaking lookup" && data?.disposition === "empty")?.[1];
    expect(event).toMatchObject({examined: 160, rejected: {blocked: 160}});
    expect(event.documentReadAttempts).toBeLessThanOrEqual(700);
    expect(event.transactionAttempts).toBeLessThanOrEqual(40);
    expect(event.documentReadCacheHits).toBeGreaterThan(0);
    expect((await db.collection("raceMatchOffers").get()).empty).toBe(true);
  } finally {logs.mockRestore();}
});

it("revalidates a newly added block at offer commit rather than reusing discovery's transaction cache", async () => {
  await db.doc("raceChallenges/healthy").set({...challenge("healthy", uid("b"), "en"), creatorAdjustedFinishMs: 120000, creatorWallFinishMs: 120000});
  await projectCandidates();
  /** Original emulator transactions provide genuine snapshots and lock boundaries. */
  const original = db.runTransaction.bind(db);
  /** A block arrives only after a discovery inspection committed its read-only transaction. */
  let changed = false;
  /** Injection occurs outside the inspection transaction before the offer transaction starts. */
  const transactions = jest.spyOn(db, "runTransaction").mockImplementation(async operation => {
    /** A completed inspection is an eligibility hint, not a reusable authorization decision. */
    const result = await original(operation);
    if (!changed && result instanceof Map && result.get("healthy")?.challenge) {
      changed = true;
      await db.doc(`users/${uid("a")}/blockedRivals/${uid("b")}`).set({blocked: true});
    }
    return result;
  });
  try {
    await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId: "changed-block"}, {db, nowMs: NOW})).rejects.toMatchObject({code: "aborted", details: {matchmaking: {reason: "eligibility-changed", recovery: "new-intent"}}});
    expect(changed).toBe(true);
    expect((await db.collection("raceMatchOffers").get()).empty).toBe(true);
  } finally {transactions.mockRestore();}
});


it("pins stable experiment assignment across new intents, concurrent winners and configuration changes", async () => {
  /** Both complete policies obey the same canonical eligibility boundary. */
  const configuration = {kind: "experiment", schemaVersion: 1, id: "freshness-study", revision: 1, salt: "private-allocation-salt",
    providers: ["reddit"], locales: ["en"], fallbackPolicy: DEFAULT_RACE_MATCH_POLICY.policy,
    arms: [{id: "control", weightBasisPoints: 5000, policy: DEFAULT_RACE_MATCH_POLICY.policy},
      {id: "variant", weightBasisPoints: 5000, policy: {...DEFAULT_RACE_MATCH_POLICY.policy, revision: 3, defaultPriors: {overallMs: 90000, categories: {}}}}]};
  await db.doc("raceConfig/matchPolicy").set(configuration);
  await db.doc("raceChallenges/healthy").set({...challenge("healthy", uid("b"), "en"), creatorAdjustedFinishMs: 120000, creatorWallFinishMs: 120000});
  await projectCandidates();
  /** Assignment depends on authenticated player identity, never request ID. */
  const expected = selectRaceMatchConfiguration(configuration, {userId: uid("a"), provider: "reddit", locale: "en"});
  await Promise.all(Array.from({length: 4}, () => findRedditRaceMatch(uid("a"), {locale: "en", requestId: "experiment-intent"}, {db, nowMs: NOW})));
  await findRedditRaceMatch(uid("a"), {locale: "en", requestId: "another-experiment-intent"}, {db, nowMs: NOW});
  /** Successful receipts retain the exact selected arm policy and allocation identity. */
  const ref = db.doc(`raceMatchOffers/${requestDocumentId(uid("a"), "experiment-intent")}`);
  /** Replaying after reconfiguration must leave the entire original receipt untouched. */
  const before = (await ref.get()).data();
  expect(before).toMatchObject({matchExperiment: expected.experiment, matchPolicyHash: expected.hash, matchPolicySnapshot: expected.policy});
  expect((await db.doc(`raceMatchOffers/${requestDocumentId(uid("a"), "another-experiment-intent")}`).get()).data()?.matchExperiment).toEqual(expected.experiment);
  /** Failure after policy resolution remains part of that arm's search funnel. */
  const warnings = jest.spyOn(logger, "warn");
  try {
    await db.doc(`users/${uid("a")}/raceMatchProfiles/en`).set({corrupt: true});
    await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId: "failed-experiment-intent"}, {db, nowMs: NOW})).rejects.toBeDefined();
    expect(warnings).toHaveBeenCalledWith("Race matchmaking failure", expect.objectContaining({disposition: "failed",
      policyHash: expected.hash, policyRevision: expected.policy.revision, matchExperiment: expected.experiment}));
    expect(JSON.stringify(warnings.mock.calls)).not.toContain(configuration.salt);
    expect((await db.doc(`raceMatchOffers/${requestDocumentId(uid("a"), "failed-experiment-intent")}`).get()).exists).toBe(false);
  } finally {
    warnings.mockRestore();
    await db.doc(`users/${uid("a")}/raceMatchProfiles/en`).delete();
  }
  await db.doc("raceConfig/matchPolicy").set({...configuration, revision: 2, salt: "replacement-allocation-salt"});
  await findRedditRaceMatch(uid("a"), {locale: "en", requestId: "experiment-intent"}, {db, nowMs: NOW + 1});
  expect((await ref.get()).data()).toEqual(before);
  await findRedditRaceMatch(uid("a"), {locale: "en", requestId: "new-allocation-intent"}, {db, nowMs: NOW + 1});
  expect((await db.doc(`raceMatchOffers/${requestDocumentId(uid("a"), "new-allocation-intent")}`).get()).data()?.matchExperiment.revision).toBe(2);
  await db.doc("raceConfig/matchPolicy").delete();
  await findRedditRaceMatch(uid("a"), {locale: "en", requestId: "experiment-intent"}, {db, nowMs: NOW + 2});
  expect((await ref.get()).data()).toEqual(before);
});

it.each([-1, 0])("does not resurrect an expired offer installed after the initial receipt read: %i", async expiryOffset => {
  /** Healthy canonical recording remains available independently of the expired selection. */
  await db.doc("raceChallenges/concurrent-expiry").set(challenge("concurrent-expiry", uid("b"), "en"));
  await projectCandidates();
  /** Exact request identity is shared by the initial read and committing transaction. */
  const requestId = "concurrent-expired-intent";
  /** An expired legacy receipt remains a valid stored record but cannot authorize a new offer. */
  const expired = {userId: uid("a"), challengeId: "concurrent-expiry", fingerprint: JSON.stringify({locale: "en", categoryId: null}),
    createdAtMs: NOW - 60000, expiresAtMs: NOW + expiryOffset};
  /** A concurrent writer wins after lookup observes a missing initial receipt. */
  const receipt = db.doc(`raceMatchOffers/${requestDocumentId(uid("a"), requestId)}`);
  /** Retain real emulator transaction execution after inserting the competing receipt. */
  const original = db.runTransaction.bind(db);
  /** Injection happens before canonical inspection and is visible to the offer commit. */
  let installed = false;
  /** Storage concurrency is exercised without replacing transaction internals. */
  const transactions = jest.spyOn(db, "runTransaction").mockImplementation(async (operation, options) => {
    if (!installed) {installed = true; await receipt.set(expired);}
    return original(operation, options);
  });
  try {
    await expect(findRedditRaceMatch(uid("a"), {locale: "en", requestId}, {db, nowMs: NOW}))
      .rejects.toMatchObject({code: "failed-precondition", details: {matchmaking: {reason: "intent-expired", recovery: "new-intent"}}});
    expect((await receipt.get()).data()).toEqual(expired);
  } finally {transactions.mockRestore();}
});

it.each([600000, 40000, 20000])("keeps the original intent deadline when replacing an ineligible recording: %i", async replacementLifetime => {
  /** The first recording establishes a short selection lifetime. */
  await db.doc("raceChallenges/original-deadline").set({...challenge("original-deadline", uid("b"), "en"), expiresAtMs: NOW + 30000});
  await projectCandidates();
  /** Retries preserve the original search identity independently of selected recording. */
  const input = {locale: "en" as const, requestId: "replacement-deadline-intent"};
  /** The original response fixes the stored offer deadline. */
  const first = await findRedditRaceMatch(uid("a"), input, {db, nowMs: NOW});
  if (first.status !== "matched" || !first.offerId) throw new Error("expected first offer");
  /** Blocking makes the original recording ineligible while a new recording remains healthy. */
  await db.doc(`users/${uid("a")}/blockedRivals/${uid("b")}`).set({blocked: true});
  await db.doc("raceChallenges/replacement-deadline").set({...challenge("replacement-deadline", uid("c"), "en"), expiresAtMs: NOW + replacementLifetime});
  await projectCandidates();
  /** Re-selection under the same request cannot purchase another full selection window. */
  const replacement = await findRedditRaceMatch(uid("a"), input, {db, nowMs: NOW + 10000});
  expect(replacement).toMatchObject({status: "matched", offerId: first.offerId, challenge: {challengeId: "replacement-deadline"}});
  expect((await db.doc(`raceMatchOffers/${first.offerId}`).get()).data()).toMatchObject({createdAtMs: NOW, expiresAtMs: NOW + Math.min(30000, replacementLifetime)});
  await expect(findRedditRaceMatch(uid("a"), input, {db, nowMs: NOW + Math.min(30000, replacementLifetime)}))
    .rejects.toMatchObject({code: "failed-precondition", details: {matchmaking: {reason: "intent-expired"}}});
});
