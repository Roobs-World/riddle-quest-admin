import {completeAuthoritativeGame} from "../gameplay/completeGameLogic";
import {createAndroidUser} from "../android/androidUser";
import {ensureAuthoritativeSession, submitAuthoritativeGuess} from "../gameplay/singlePlayerSession";
import {getSinglePlayerContentKey} from "../gameplay/singlePlayerAnswerPolicy";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {createHash} from "node:crypto";
import {
  androidGoogleIdentity,
  registerAndroidReferralIdentity,
  type AndroidGoogleIdentity,
} from "../android/androidReferralIdentity";
import {
  issueAndroidReferral,
  bindAndroidReferral,
  androidReferralStatus,
  androidReferralTokenId,
  settleAndroidReferralAfterPlay,
  ANDROID_REFERRAL_TTL_MS,
} from "../android/androidReferrals";
import {deleteAndroidReferralData} from "../android/androidReferralDeletion";
import {
  createAndroidReferral,
  getAndroidReferralStatus,
  bindAndroidReferralEntry,
} from "../android/androidReferralCallables";
import {androidReferralLiveEventId, deliverAndroidReferralPlay} from "../android/androidReferralDelivery";

/** External content generation is independent of committed solo/referral authority. */
jest.mock("../riddles/riddleSupply", () => ({triggerClassicRiddleGenerationIfNeeded: async () => undefined}));

/** Deterministic server clock and synthetic provider-scoped account identities. */
const NOW = Date.parse("2026-11-20T12:00:00Z"),
  A = "a".repeat(28),
  B = "b".repeat(28),
  C = "c".repeat(28);
/** Real Firestore database in the dedicated local demo project. */
let db: FirebaseFirestore.Firestore;
/** Subject claims are synthetic verified-token fixtures, not caller request fields. */
const token = (subject: string, provider = "google.com") => ({
  firebase: {sign_in_provider: provider, identities: {"google.com": [subject]}},
});
/** Verified Google subject and game account binding, never request-body identity. */
const identity = (uid: string, subject = `google-subject-${uid}`) => androidGoogleIdentity(uid, token(subject));
/** Server-provisioned starting profile matches the Android account's actual relevant counters. */
async function account(uid: string, subject?: string) {
  await db.doc(`users/${uid}`).set({
    androidProvider: "anonymous",
    coins: 300,
    hasPurchasedApp: false,
    hasActiveSubscription: false,
    progress: {classicIndex: 1, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
    stats: {
      level: 1,
      gamesPlayed: 0,
      wins: 0,
      multiplayerGamesPlayed: 0,
      multiplayerWins: 0,
      multiplayerChallengesCreated: 0,
    },
  });
  /** Validated account and durable Google-subject authority for this transaction. */
  const owner = identity(uid, subject);
  await registerAndroidReferralIdentity(db, owner, NOW);
  return owner;
}
/** A canonical completion is fixture-written by Admin, then independently validated by the grant service. */
async function win(owner: AndroidGoogleIdentity, label = "first-win", atMs = NOW + 2000) {
  /** Opaque canonical completion identifier used as authoritative win evidence. */
  const receiptId = createHash("sha256").update(`${owner.uid}:${label}`).digest("hex");
  await db.doc(`users/${owner.uid}`).update({"stats.gamesPlayed": 1, "stats.wins": 1});
  await db.doc(`gameCompletionReceipts/${receiptId}`).set({
    userId: owner.uid,
    status: "completed",
    result: {isCorrect: true, coinsEarned: 15},
    completedAt: Timestamp.fromMillis(atMs),
  });
  return {kind: "solo" as const, receiptId};
}
/** This emulator project contains only this suite's synthetic data. */
async function clear() {
  for (const name of [
    "users",
    "gameCompletionReceipts",
    "liveRaceMatches",
    "androidReferralIdentities",
    "androidReferralTokens",
    "androidReferralBindings",
    "androidReferralSettlements",
    "androidReferralDailyCaps",
    "androidReferralIssueLimits",
    "androidReferralPlayOutbox",
    "jestAccountDeletionTombstones",
  ])
    await db.recursiveDelete(db.collection(name));
}
beforeAll(() => {
  if (
    !/^demo-/.test(process.env.GCLOUD_PROJECT ?? "") ||
    !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")
  )
    throw new Error("Dedicated Android referrals demo emulator required.");
  /** This suite owns a separate demo namespace even under the standard shared coverage runner. */
  const app = getApps().find(candidate => candidate.name === "[DEFAULT]") ?? initializeApp({projectId: "demo-android-referrals"});
  if (app.options.projectId !== "demo-android-referrals") throw new Error("Dedicated Android referrals demo emulator required.");
  db = getFirestore(app);
});
beforeEach(clear);
afterAll(clear);

it("requires a verified Google provider and one signed durable Google subject", () => {
  expect(() => androidGoogleIdentity(A, token("google-subject", "anonymous"))).toThrow("Google sign-in required");
  expect(() => androidGoogleIdentity(A, {firebase: {sign_in_provider: "google.com"}})).toThrow();
  expect(() =>
    androidGoogleIdentity(A, {
      firebase: {sign_in_provider: "google.com", identities: {"google.com": ["subject-one", "subject-two"]}},
    }),
  ).toThrow();
  expect(() => androidGoogleIdentity(`jest_${"a".repeat(40)}`, token("google-subject"))).toThrow();
});
it("keeps anonymous gameplay available but never issues anonymous referral rewards", async () => {
  await account(A);
  /** Synthetic Firebase-verified authentication claims for this boundary test. */
  const auth = {uid: A, token: token("google-subject", "anonymous")};
  expect(await getAndroidReferralStatus.run({auth, data: {}} as never)).toEqual({kind: "google-required"});
  await expect(createAndroidReferral.run({auth, data: {}} as never)).rejects.toMatchObject({code: "permission-denied"});
  await expect(bindAndroidReferralEntry.run({auth, data: {token: "A".repeat(43)}} as never)).rejects.toMatchObject({
    code: "permission-denied",
  });
  expect((await db.collection("androidReferralTokens").get()).empty).toBe(true);
});
it("binds an unplayed Google subject once, supports replay after token TTL cleanup, and grants nothing for sharing", async () => {
  /** Verified inviter and invitee fixtures plus their issued acquisition entry. */
  const a = await account(A),
    b = await account(B),
    referral = await issueAndroidReferral(db, a, NOW);
  expect(await androidReferralStatus(db, b)).toMatchObject({canBind: true, bound: false, settled: false});
  await expect(bindAndroidReferral(db, a, referral.token, NOW + 1000)).rejects.toMatchObject({
    code: "permission-denied",
  });
  expect(await bindAndroidReferral(db, b, referral.token, NOW + 1000)).toMatchObject({alreadyBound: false});
  expect((await db.doc(`users/${A}`).get()).get("coins")).toBe(300);
  expect((await db.doc(`users/${B}`).get()).get("coins")).toBe(300);
  await db.doc(`androidReferralTokens/${androidReferralTokenId(referral.token)}`).delete();
  expect(await bindAndroidReferral(db, b, referral.token, NOW + ANDROID_REFERRAL_TTL_MS + 1)).toMatchObject({
    alreadyBound: true,
  });
  /** Second server-issued token that cannot replace the original lifetime binding. */
  const another = await issueAndroidReferral(db, a, NOW + 2000);
  await expect(bindAndroidReferral(db, b, another.token, NOW + 3000)).rejects.toMatchObject({
    code: "failed-precondition",
  });
});
it("rejects expired, played, purchased and identity-conflicting acquisition attempts", async () => {
  /** Verified inviter and invitee fixtures plus their issued acquisition entry. */
  const a = await account(A),
    b = await account(B),
    referral = await issueAndroidReferral(db, a, NOW);
  await expect(bindAndroidReferral(db, b, referral.token, NOW + ANDROID_REFERRAL_TTL_MS)).rejects.toMatchObject({
    code: "failed-precondition",
  });
  await db.doc(`users/${B}`).update({"stats.gamesPlayed": 1});
  await expect(bindAndroidReferral(db, b, referral.token, NOW + 1000)).rejects.toMatchObject({
    code: "failed-precondition",
  });
  await db.doc(`users/${B}`).update({"stats.gamesPlayed": 0, hasPurchasedApp: true});
  await expect(bindAndroidReferral(db, b, referral.token, NOW + 1000)).rejects.toMatchObject({
    code: "failed-precondition",
  });
  await expect(registerAndroidReferralIdentity(db, identity(B, "different-google-subject"), NOW)).rejects.toMatchObject(
    {code: "failed-precondition"},
  );
  await db.doc(`users/${C}`).set((await db.doc(`users/${B}`).get()).data()!);
  await expect(registerAndroidReferralIdentity(db, identity(C, `google-subject-${A}`), NOW)).rejects.toMatchObject({
    code: "failed-precondition",
  });
});
it("refuses missing/foreign/unwon receipt claims and commits a concurrent first-win reward exactly once", async () => {
  /** Verified inviter and invitee fixtures plus their issued acquisition entry. */
  const a = await account(A),
    b = await account(B),
    referral = await issueAndroidReferral(db, a, NOW);
  await bindAndroidReferral(db, b, referral.token, NOW + 1000);
  await expect(
    settleAndroidReferralAfterPlay(db, B, {kind: "solo", receiptId: "f".repeat(64)}, NOW + 3000),
  ).rejects.toMatchObject({code: "failed-precondition"});
  /** Canonical win belonging to another account, which cannot establish this conversion. */
  const foreign = await win(a);
  await expect(settleAndroidReferralAfterPlay(db, B, foreign, NOW + 3000)).rejects.toMatchObject({
    code: "failed-precondition",
  });
  /** Immutable server completion used to prove the qualifying first win. */
  const source = await win(b);
  /** Concurrent authoritative outcomes checked for one durable grant. */
  const results = await Promise.all([
    settleAndroidReferralAfterPlay(db, B, source, NOW + 3000),
    settleAndroidReferralAfterPlay(db, B, source, NOW + 3000),
  ]);
  expect(results.map((value) => value.alreadySettled).sort()).toEqual([false, true]);
  expect((await db.doc(`users/${A}`).get()).get("coins")).toBe(400);
  expect((await db.doc(`users/${B}`).get()).get("coins")).toBe(400);
  expect((await db.collection("androidReferralSettlements").get()).size).toBe(1);
  expect(await androidReferralStatus(db, b)).toMatchObject({canBind: false, bound: true, settled: true});
});
it("records an authoritative loss as established without paying any referral coins", async () => {
  /** Verified invitee whose authoritative loss must not award referral coins. */
  const b = await account(B),
    source = await win(b);
  await db
    .doc(`gameCompletionReceipts/${source.receiptId}`)
    .update({"result.isCorrect": false, "result.coinsEarned": 0});
  await db.doc(`users/${B}`).update({"stats.wins": 0});
  expect(await settleAndroidReferralAfterPlay(db, B, source, NOW + 3000)).toMatchObject({inviteeCoins: 0});
  expect((await db.doc(`androidReferralIdentities/${b.subjectHash}`).get()).get("established")).toBe(true);
});
it("keeps first-acquisition and paid receipts closed after deletion and a new Firebase uid for the same Google subject", async () => {
  /** Verified inviter and invitee fixtures plus their issued acquisition entry. */
  const a = await account(A),
    b = await account(B),
    referral = await issueAndroidReferral(db, a, NOW);
  await bindAndroidReferral(db, b, referral.token, NOW + 1000);
  await settleAndroidReferralAfterPlay(db, B, await win(b), NOW + 3000);
  await db.doc(`jestAccountDeletionTombstones/${B}`).set({deletedAt: NOW + 4000});
  await deleteAndroidReferralData(B);
  await db.doc(`users/${B}`).delete();
  /** Replacement account generation or next persisted schedule, retaining prior authority. */
  const next = await account(C, `google-subject-${B}`);
  expect(next.subjectHash).toBe(b.subjectHash);
  await expect(bindAndroidReferral(db, next, referral.token, NOW + 5000)).rejects.toMatchObject({
    code: "failed-precondition",
  });
  expect(
    await settleAndroidReferralAfterPlay(db, C, await win(next, "new-generation", NOW + 6000), NOW + 7000),
  ).toMatchObject({alreadySettled: true, inviteeCoins: 0});
  expect((await db.doc(`users/${C}`).get()).get("coins")).toBe(300);
  /** Durable grant or replay tombstone observed after the operation. */
  const receipt = (await db.doc(`androidReferralSettlements/${b.subjectHash}`).get()).data();
  expect(receipt).toMatchObject({provider: "android", state: "closed", replayProtection: true});
  expect(receipt?.inviteeUid).toBeUndefined();
  expect(receipt?.inviterUid).toBeUndefined();
});
it("allows a pending invitee award after inviter deletion while removing the deleted identity from live records", async () => {
  /** Verified inviter and invitee fixtures plus their issued acquisition entry. */
  const a = await account(A),
    b = await account(B),
    referral = await issueAndroidReferral(db, a, NOW);
  await bindAndroidReferral(db, b, referral.token, NOW + 1000);
  await db.doc(`jestAccountDeletionTombstones/${A}`).set({deletedAt: NOW + 2000});
  await deleteAndroidReferralData(A);
  await db.doc(`users/${A}`).delete();
  expect(await settleAndroidReferralAfterPlay(db, B, await win(b), NOW + 3000)).toMatchObject({
    inviteeCoins: 100,
    inviterCoins: 0,
  });
  expect((await db.collection("androidReferralTokens").where("inviterUid", "==", A).get()).empty).toBe(true);
  expect((await db.doc(`androidReferralIdentities/${a.subjectHash}`).get()).get("uid")).toBeNull();
});
it("caps inviter rewards by durable Google subject even after an inviter account generation changes", async () => {
  /** Verified inviter and invitee fixtures plus their issued acquisition entry. */
  const a = await account(A),
    referral = await issueAndroidReferral(db, a, NOW);
  for (let index = 0; index < 5; index++) {
    /** Authenticated game account that owns this operation. */
    const uid = String(index + 1).repeat(28),
      invitee = await account(uid);
    await bindAndroidReferral(db, invitee, referral.token, NOW + 1000);
    await settleAndroidReferralAfterPlay(db, uid, await win(invitee), NOW + 3000);
  }
  expect((await db.doc(`users/${A}`).get()).get("coins")).toBe(800);
  await db.doc(`jestAccountDeletionTombstones/${A}`).set({deletedAt: NOW + 4000});
  await deleteAndroidReferralData(A);
  await db.doc(`users/${A}`).delete();
  /** Replacement account generation or next persisted schedule, retaining prior authority. */
  const next = await account(C, `google-subject-${A}`),
    nextToken = await issueAndroidReferral(db, next, NOW + 5000),
    b = await account(B);
  await bindAndroidReferral(db, b, nextToken.token, NOW + 6000);
  expect(await settleAndroidReferralAfterPlay(db, B, await win(b, "sixth", NOW + 7000), NOW + 8000)).toMatchObject({
    inviteeCoins: 100,
    inviterCoins: 0,
  });
  expect((await db.doc(`users/${C}`).get()).get("coins")).toBe(300);
});
it("bounds issuance and validates native race conversion against the immutable terminal match", async () => {
  /** Verified inviter and invitee fixtures plus their issued acquisition entry. */
  const a = await account(A),
    b = await account(B);
  /** Latest opaque token returned by the bounded issuance fixture. */
  let issued: Awaited<ReturnType<typeof issueAndroidReferral>> | undefined;
  for (let index = 0; index < 10; index++) issued = await issueAndroidReferral(db, a, NOW);
  await expect(issueAndroidReferral(db, a, NOW)).rejects.toMatchObject({code: "resource-exhausted"});
  if (!issued) throw new Error("Missing issued token");
  await bindAndroidReferral(db, b, issued.token, NOW + 1000);
  /** Private server race ticket and immutable match identifiers. */
  const ticketId = "d".repeat(64),
    matchId = "e".repeat(64),
    eventId = androidReferralLiveEventId(B, ticketId);
  await db.doc(`users/${B}`).update({"stats.multiplayerGamesPlayed": 1, "stats.multiplayerWins": 1});
  await db.doc(`liveRaceMatches/${matchId}`).set({
    tickets: [ticketId, null],
    winner: 0,
    rewardCoins: 50,
    observedAtMs: NOW + 2000,
    runs: [
      {userId: B, events: [{type: "correct"}]},
      {userId: "bot", events: []},
    ],
  });
  /** Private Firestore reference used by this authority or replay scenario. */
  const ref = db.doc(`androidReferralPlayOutbox/${eventId}`);
  await ref.set({uid: B, matchId, ticketId, delivered: false});
  /** Canonical Firestore source snapshot, independent of client claims. */
  const snapshot = await ref.get();
  await deliverAndroidReferralPlay.run({data: snapshot, params: {eventId}} as never);
  await deliverAndroidReferralPlay.run({data: snapshot, params: {eventId}} as never);
  expect((await ref.get()).get("delivered")).toBe(true);
  expect((await db.doc(`users/${B}`).get()).get("coins")).toBe(400);
  expect((await db.doc(`users/${A}`).get()).get("coins")).toBe(400);
});

it("closes acquisition at the first accepted wrong guess before completion and preserves that fact across deletion", async () => {
  /** Verified inviter and invitee fixtures plus their issued acquisition entry. */
  const a = await account(A),
    b = await account(B),
    referral = await issueAndroidReferral(db, a, NOW);
  /** Canonical server-owned question used by the real solo authority. */
  const content = {riddleId: "referral-first-guess", answer: "piano"};
  /** Server-issued private solo session binding for the fixture question. */
  const sessionToken = await ensureAuthoritativeSession(
    B,
    "classic",
    content.riddleId,
    "en",
    getSinglePlayerContentKey(content, "classic", "en"),
    "classic:1",
    content.answer,
    {classicIndex: 1},
  );
  expect(
    await submitAuthoritativeGuess(B, {
      riddleId: content.riddleId,
      gameMode: "classic",
      sessionToken,
      guess: "xxxxx",
      requestId: "first-guess-before-referral",
    }),
  ).toMatchObject({isCorrect: false, gameOver: false, attempts: 1});
  expect((await db.doc(`users/${B}`).get()).get("androidReferralPlayed")).toBe(true);
  await expect(bindAndroidReferral(db, b, referral.token, NOW + 1000)).rejects.toMatchObject({
    code: "failed-precondition",
  });
  await db.doc(`jestAccountDeletionTombstones/${B}`).set({deletedAt: NOW + 2000});
  await deleteAndroidReferralData(B);
  await db.recursiveDelete(db.doc(`users/${B}`));
  /** Replacement account generation or next persisted schedule, retaining prior authority. */
  const next = await account(C, `google-subject-${B}`);
  expect(await androidReferralStatus(db, next)).toMatchObject({canBind: false});
});

it("extends a real committed solo win with one referral bonus and replays both ledgers safely", async () => {
  /** Verified inviter and invitee fixtures plus their issued acquisition entry. */
  const a = await account(A),
    b = await account(B),
    at = Date.now() - 1000;
  await db.doc(`users/${B}`).set({...createAndroidUser(B, "anonymous"), androidGoogleSubjectHash: b.subjectHash});
  /** Opaque server token bound before the first online action. */
  const referral = await issueAndroidReferral(db, a, at);
  await bindAndroidReferral(db, b, referral.token, at + 1);
  /** Canonical server-owned question used by the real solo authority. */
  const content = {riddleId: "referral-solo-win", answer: "piano"};
  /** Server-issued private solo session binding for the fixture question. */
  const sessionToken = await ensureAuthoritativeSession(
    B,
    "classic",
    content.riddleId,
    "en",
    getSinglePlayerContentKey(content, "classic", "en"),
    "classic:1",
    content.answer,
    {classicIndex: 1},
  );
  await submitAuthoritativeGuess(B, {
    riddleId: content.riddleId,
    gameMode: "classic",
    sessionToken,
    guess: content.answer,
    requestId: "first-google-win",
  });
  /** Authoritative operation result retained after its transaction commits. */
  const result = await completeAuthoritativeGame(
    {riddleId: content.riddleId, gameMode: "classic", sessionToken},
    {uid: B, isAnonymous: false},
  );
  expect(result.rewardBreakdown?.referralBonus).toBe(100);
  /** Current confirmed coin balance; local receipt lists cannot increase it. */
  const balance = (await db.doc(`users/${B}`).get()).get("coins");
  expect(balance).toBe(result.rewardBreakdown?.newBalance);
  expect((await db.doc(`users/${A}`).get()).get("coins")).toBe(400);
  /** Repeated authoritative completion, which must retain its original bonus without another grant. */
  const replay = await completeAuthoritativeGame(
    {riddleId: content.riddleId, gameMode: "classic", sessionToken},
    {uid: B, isAnonymous: false},
  );
  expect(replay.rewardBreakdown?.referralBonus).toBe(100);
  expect((await db.doc(`users/${B}`).get()).get("coins")).toBe(balance);
});

/** A stale native view must never acquire a referral for a newly signed-in account. */
it("rejects owner-bound referral requests after Firebase identity replacement", async () => {
  /** Verified accounts and their valid opaque referral entry. */
  const a = await account(A),
    b = await account(B),
    referral = await issueAndroidReferral(db, a, Date.now());
  /** Actual authenticated replacement account, distinct from the retired view owner. */
  const auth = {uid: B, token: token(`google-subject-${B}`)};
  await expect(getAndroidReferralStatus.run({auth, data: {expectedOwnerId: A}} as never)).rejects.toMatchObject({
    code: "permission-denied",
  });
  await expect(createAndroidReferral.run({auth, data: {expectedOwnerId: A}} as never)).rejects.toMatchObject({
    code: "permission-denied",
  });
  await expect(
    bindAndroidReferralEntry.run({auth, data: {token: referral.token, expectedOwnerId: A}} as never),
  ).rejects.toMatchObject({code: "permission-denied"});
  expect(await androidReferralStatus(db, b)).toMatchObject({canBind: true, bound: false});
});

/** Removing an inviter cannot erase another player's already-confirmed reward presentation. */
it("preserves a surviving invitee's exact completion bonus replay after inviter deletion", async () => {
  /** Verified participants, canonical win and immutable source attribution. */
  const a = await account(A),
    b = await account(B),
    referral = await issueAndroidReferral(db, a, NOW);
  await bindAndroidReferral(db, b, referral.token, NOW + 1000);
  /** Immutable server completion used to prove the qualifying first win. */
  const source = await win(b);
  await settleAndroidReferralAfterPlay(db, B, source, NOW + 3000);
  await db.doc(`jestAccountDeletionTombstones/${A}`).set({deletedAt: NOW + 4000});
  await deleteAndroidReferralData(A);
  await db.doc(`users/${A}`).delete();
  expect(await settleAndroidReferralAfterPlay(db, B, source, NOW + 5000)).toMatchObject({
    alreadySettled: true,
    inviteeCoins: 100,
    completionReceiptId: source.receiptId,
  });
  expect((await db.doc(`users/${B}`).get()).get("coins")).toBe(400);
  expect((await db.doc(`androidReferralSettlements/${b.subjectHash}`).get()).get("inviterUid")).toBeNull();
});
