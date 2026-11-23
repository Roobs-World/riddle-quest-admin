import {setEmulatorSystemTime} from "../helpers/emulatorClock";
import {initializeApp, deleteApp, getApps, type App} from "firebase-admin/app";
import {createHmac} from "node:crypto";
import {getFirestore} from "firebase-admin/firestore";
import {getDatabase, type Database} from "firebase-admin/database";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/live/raceLiveService";
import {blockKnownRival, reportKnownRival} from "../../social/socialSafety";
import {getJestAccountDeletionRef, JEST_ACCOUNT_DELETION_COLLECTION} from "../../shared/accountDeletion";
import {redditGameplay} from "../../../../platforms/web/reddit/server/redditGameplayEndpoint";
import {redditProviderIdentityId} from "../../../../platforms/web/reddit/server/redditEndpoints";
import {canonicalRedditGatewayAssertion, hashRedditGatewayPayload, redditFirebaseUid} from "../../../../platforms/web/reddit/server/redditSecurity";

/** Isolated demo project supplied by the local emulator runner. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
/** Fixed server time makes retained-ticket and report-window checks deterministic. */
const NOW = 1_800_000_000_000;
/** Dedicated fixture app avoids the default application's database namespace. */
let app: App;
/** Only the real signed gateway requires the fixture's default application. */
let gatewayApp: App | undefined;
/** Private Firestore authority in the demo instance. */
let db: FirebaseFirestore.Firestore;
/** Presence revocation is verified against the real local RTDB instance. */
let database: Database;
/** Cleanup is permitted only after both loopback demo guards pass. */
async function clear() {
  for (const name of ["users", "liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "socialModerationQueue", "socialReportRateLimits", JEST_ACCOUNT_DELETION_COLLECTION, "localizedRiddles", "providerIdentities", "redditGatewayNonces", "redditGatewayRateLimits"])
    await db.recursiveDelete(db.collection(name));
  await database.ref().set(null);
}
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "") ||
    !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? "")) throw new Error("Isolated loopback demo emulators required");
  app = initializeApp({projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com`}, "live-safety-fixture");
  db = getFirestore(app); database = getDatabase(app);
});
beforeEach(clear);
afterEach(() => jest.useRealTimers());
afterAll(async () => {if (db && database) await clear(); if (app) await deleteApp(app); if (gatewayApp) await deleteApp(gatewayApp);});

it("routes signed Reddit safety through strict shared callables and deletion leases", async () => {
  if (getApps().some(value => value.name === "[DEFAULT]")) throw new Error("Owned default fixture app required");
  gatewayApp = initializeApp({projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com`});
  /** Local fixture values are restored before another integration can run. */
  const original = {REDDIT_GATEWAY_SECRET: process.env.REDDIT_GATEWAY_SECRET, REDDIT_UID_SECRET: process.env.REDDIT_UID_SECRET,
    REDDIT_DISABLED_FEATURES: process.env.REDDIT_DISABLED_FEATURES};
  /** Only synthesized credentials can sign these loopback demo assertions. */
  const secret = "reddit-live-safety-loopback-secret-at-least-32-characters", uidSecret = Buffer.alloc(32, 37).toString("base64");
  /** Provider accounts must derive from the same real UID contract used by the gateway. */
  const userId = "t2_live_safety", ids = [userId, "t2_live_safety_peer", "t2_live_safety_stranger"].map(id => redditFirebaseUid(id, uidSecret, 1));
  /** Response envelope preserves the production handler while recording only synthetic output. */
  let status = 200, body: unknown, sequence = 0;
  /** Minimal fluent HTTP seam delegates actual verification, quotas, dispatch and mutations. */
  const response = {set: () => response, status: (value: number) => {status = value; return response;},
    json: (value: unknown) => {body = value; return response;}};
  /** Each transport retry has a fresh signed nonce while retaining its original domain request. */
  const send = async (operation: "gameplay.safety.report" | "gameplay.safety.block", payload: unknown) => {
    status = 200; body = undefined;
    /** Complete assertion binds the approved app, provider account and exact payload bytes. */
    const assertion = {version: 1 as const, appName: "riddle-quest", installationId: "riddle-quest:t5_test", subredditId: "t5_test",
      postId: "t3_test", userId, operation, issuedAtMs: NOW + 2000, nonce: `live_safety_${++sequence}_${"n".repeat(32)}`,
      payloadHash: hashRedditGatewayPayload(payload)};
    /** Production canonicalization and signature are verified by the real endpoint. */
    const signature = createHmac("sha256", secret).update("riddle-quest-reddit-gateway-v1\0")
      .update(canonicalRedditGatewayAssertion(assertion)).digest("base64url");
    await redditGameplay({method: "POST", body: {assertion, payload}, get: () => signature} as never, response as never);
  };
  try {
    process.env.REDDIT_GATEWAY_SECRET = secret; process.env.REDDIT_UID_SECRET = uidSecret;
    process.env.REDDIT_DISABLED_FEATURES = "matchmaking,commerce,notifications";
    /** A retained human seat remains a safety target even after new matchmaking is disabled. */
    const {seats} = await pair("reddit", "gateway", NOW, ids);
    await db.doc(`providerIdentities/${redditProviderIdentityId("riddle-quest", userId)}`).set({provider: "reddit", appName: "riddle-quest",
      providerUserId: userId, accountGeneration: 1, status: "active", uid: ids[0]});
    setEmulatorSystemTime(NOW + 2000);
    /** Original categorized intent survives a new signed transport assertion. */
    const payload = {liveTicketId: seats[0].ticketId, category: "spam", requestId: "signed-safety-report-0001"};
    await send("gameplay.safety.report", payload);
    expect(status).toBe(200);
    expect(body).toEqual({ok: true, result: {queued: true, reportId: expect.stringMatching(/^[a-f0-9]{64}$/)}});
    /** Report acknowledgement contains no account, avatar, ticket or answer fields. */
    const first = body;
    await send("gameplay.safety.report", payload);
    expect(body).toEqual(first);
    expect((await db.collection("socialModerationQueue").get()).size).toBe(1);
    await database.ref("presenceVisibility").set({[ids[0]]: {[ids[1]]: true}, [ids[1]]: {[ids[0]]: true}});
    await send("gameplay.safety.block", {liveTicketId: seats[0].ticketId});
    expect(status).toBe(200); expect(body).toEqual({ok: true, result: {blocked: true}});
    expect((await database.ref(`presenceVisibility/${ids[0]}/${ids[1]}`).get()).child("allowed").val()).toBe(false);
    expect((await database.ref(`presenceVisibility/${ids[1]}/${ids[0]}`).get()).child("allowed").val()).toBe(false);
    await send("gameplay.safety.report", {...payload, targetUserId: ids[1]});
    expect(status).toBe(401); expect(body).toEqual({error: "invalid-request"});
    /** Permanent owner deletion is rejected by the shared lease before another moderation record. */
    await getJestAccountDeletionRef(db, ids[0]).set({deletedAtMs: NOW + 2000});
    await send("gameplay.safety.report", {...payload, requestId: "signed-deleted-report-0002"});
    expect(status).toBe(401); expect(body).toEqual({error: "invalid-request"});
    expect((await db.collection("socialModerationQueue").get()).size).toBe(1);
    expect((await getJestAccountDeletionRef(db, ids[0]).collection("activeOperations").get()).empty).toBe(true);
  } finally {
    jest.restoreAllMocks(); jest.useRealTimers();
    for (const [key, value] of Object.entries(original)) {if (value === undefined) delete process.env[key]; else process.env[key] = value;}
  }
});

/** Real engine matching establishes a private human opponent without a recorded known-rival row. */
async function pair(provider: "facebook" | "reddit" = "facebook", suffix = "first", nowMs = NOW, accountIds?: string[]) {
  /** Canonical same-provider accounts are independent of public game profile names. */
  const ids = accountIds ?? [`${provider}_${"a".repeat(40)}`, `${provider}_${"b".repeat(40)}`, `${provider}_${"c".repeat(40)}`];
  /** Real eligible catalog and balances are the only prerequisites for matching. */
  const batch = db.batch();
  for (let i = 0; i < 30; i++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${i}`), {
    riddleId: `history-${i}`, canonicalRiddleId: `history:${i}`, categoryId: "history",
    text: `Unique historical question ${i} follows its own trail`, answer: `a${String(i).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[i % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  for (const userId of ids) batch.set(db.doc(`users/${userId}`), {username: "Safety player", coins: 100});
  await batch.commit();
  /** Distinct request identities create two independent owned seats. */
  const first = await joinLiveRaceForUser(ids[0], {locale: "en", categoryId: "history", requestId: `safety-a-${suffix}`}, {db, nowMs});
  /** Second real join chooses the first waiting human. */
  const second = await joinLiveRaceForUser(ids[1], {locale: "en", categoryId: "history", requestId: `safety-b-${suffix}`}, {db, nowMs: nowMs + 1000});
  return {ids, seats: [first, second]};
}

it.each(["facebook", "reddit"] as const)("authorizes both %s human seats, preserves report replay/cap and revokes presence on block", async provider => {
  /** Match binding replaces any need for a client-visible rival identity. */
  const {ids, seats} = await pair(provider);
  for (const seat of [0, 1]) {
    /** Immutable owned-seat report is replayed concurrently without another quota charge. */
    const input = {liveTicketId: seats[seat].ticketId, category: "spam" as const, requestId: `report-owned-seat-${seat}`};
    /** No recorded relationship exists for either live opponent. */
    expect((await db.doc(`users/${ids[seat]}/knownRivals/${ids[1 - seat]}`).get()).exists).toBe(false);
    /** Duplicate actual report transactions converge on one private queue receipt. */
    const results = await Promise.all(Array.from({length: 4}, () => reportKnownRival(ids[seat], input, {db, nowMs: NOW + 2000})));
    expect(new Set(results.map(result => result.reportId)).size).toBe(1);
    expect(JSON.stringify(results)).not.toMatch(/facebook_|reddit_|targetUserId|answer/);
    /** The queue alone retains the server-resolved private account pair. */
    const record = (await db.doc(`socialModerationQueue/${results[0].reportId}`).get()).data()!;
    expect(record).toMatchObject({targetUserId: ids[1 - seat], reporterId: ids[seat], category: "spam"});
    expect(record).not.toHaveProperty("liveTicketId");
    await expect(reportKnownRival(ids[seat], {...input, category: "cheating"}, {db, nowMs: NOW + 2001}))
      .rejects.toMatchObject({code: "failed-precondition"});
    /** The same existing five-report UTC budget applies to live-target reports. */
    const extra = await Promise.allSettled(Array.from({length: 5}, (_, index) => reportKnownRival(ids[seat],
      {...input, requestId: `report-extra-${seat}-${index}`}, {db, nowMs: NOW + 2002})));
    expect(extra.filter(value => value.status === "fulfilled")).toHaveLength(4);
    expect(extra.filter(value => value.status === "rejected")).toHaveLength(1);
  }
  await database.ref("presenceVisibility").set({[ids[0]]: {[ids[1]]: true}, [ids[1]]: {[ids[0]]: true}});
  /** Concurrent live blocks stay server-bound and return only after both presence edges are revoked. */
  expect(await Promise.all(Array.from({length: 2}, () => blockKnownRival(ids[0], {liveTicketId: seats[0].ticketId}, {db, database, nowMs: NOW + 3000}))))
    .toEqual([{blocked: true}, {blocked: true}]);
  expect((await database.ref(`presenceVisibility/${ids[0]}/${ids[1]}`).get()).child("allowed").val()).toBe(false);
    expect((await database.ref(`presenceVisibility/${ids[1]}/${ids[0]}`).get()).child("allowed").val()).toBe(false);
  expect((await db.doc(`users/${ids[0]}/blockedRivals/${ids[1]}`).get()).exists).toBe(true);
  /** The real live engine immediately terminates the blocked pair without a forfeit reward. */
  for (const seat of [0, 1]) expect(await updateLiveRaceForUser(ids[seat], {ticketId: seats[seat].ticketId,
    action: "poll", requestId: `after-block-${seat}`}, {db, nowMs: NOW + 4000})).toMatchObject({phase: "result", result: "tie", rewardCoins: 0});
  for (const id of ids) expect((await db.doc(`users/${id}`).get()).data()!.coins).toBe(100);
  /** A later public search cannot pair the blocked humans again. */
  const again = await pair(provider, "blocked-requeue", NOW + 5000);
  expect(again.seats.every(value => value.phase === "searching")).toBe(true);
});

it.each(["stranger", "deleted", "expired", "corrupt-seat", "cross-provider"] as const)("rejects %s live-target reports without queue writes", async kind => {
  /** Every rejected fixture starts with a real bound pair. */
  const {ids, seats} = await pair();
  if (kind === "deleted") await getJestAccountDeletionRef(db, ids[1]).set({deletedAtMs: NOW + 2000});
  if (kind === "corrupt-seat") await db.doc(`liveRaceMatches/${seats[0].ticketId}`).update({tickets: [seats[1].ticketId, seats[0].ticketId]});
  if (kind === "cross-provider") await db.doc(`liveRaceTickets/${seats[1].ticketId}`).update({userId: `reddit_${"b".repeat(40)}`});
  await expect(reportKnownRival(kind === "stranger" ? ids[2] : ids[0], {liveTicketId: seats[0].ticketId, category: "spam", requestId: "rejected-live-report"},
    {db, nowMs: kind === "expired" ? NOW + 7 * 86400000 : NOW + 2000})).rejects.toBeDefined();
  expect((await db.collection("socialModerationQueue").get()).empty).toBe(true);
  expect((await db.collection("socialReportRateLimits").get()).empty).toBe(true);
});

it("rejects bot targeting and replaying a report id against a different retained match", async () => {
  /** Initial real pair supplies an original report binding. */
  const {ids, seats} = await pair();
  await reportKnownRival(ids[0], {liveTicketId: seats[0].ticketId, category: "spam", requestId: "original-match-report"}, {db, nowMs: NOW + 1500});
  await updateLiveRaceForUser(ids[0], {ticketId: seats[0].ticketId, action: "leave", requestId: "retire-first-match"}, {db, nowMs: NOW + 2000});
  /** A fresh real match with the same rival cannot reuse the earlier seat's report identity. */
  const again = await pair("facebook", "next-match", NOW + 3000);
  await expect(reportKnownRival(ids[0], {liveTicketId: again.seats[0].ticketId, category: "spam", requestId: "original-match-report"}, {db, nowMs: NOW + 5000}))
    .rejects.toMatchObject({code: "failed-precondition"});
  /** A third real player waits alone until the server supplies its actual fallback bot. */
  const bot = await joinLiveRaceForUser(ids[2], {locale: "en", categoryId: "history", requestId: "safety-bot-player"}, {db, nowMs: NOW + 5000});
  await updateLiveRaceForUser(ids[2], {ticketId: bot.ticketId, action: "poll", requestId: "safety-bot-poll"}, {db, nowMs: NOW + 65000});
  await expect(blockKnownRival(ids[2], {liveTicketId: bot.ticketId}, {db, database, nowMs: NOW + 65001}))
    .rejects.toMatchObject({code: "failed-precondition"});
  expect((await db.collection("socialModerationQueue").get()).size).toBe(1);
});
