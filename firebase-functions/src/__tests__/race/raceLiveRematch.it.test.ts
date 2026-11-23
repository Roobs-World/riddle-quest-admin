import {initializeApp, deleteApp, getApps, type App} from "firebase-admin/app";
import {createHmac} from "node:crypto";
import {getFirestore, Timestamp, FieldValue} from "firebase-admin/firestore";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {getLiveRaceChallengeForUser} from "../../race/raceLiveInvitation";
import {listLiveRaceChallengesForUser} from "../../race/raceLiveChallengeNotifications";
import {getJestAccountDeletionRef, JEST_ACCOUNT_DELETION_COLLECTION} from "../../shared/accountDeletion";
import {LIVE_RACE_HISTORY_MS, LIVE_RACE_INVITE_MS, LiveRaceViewSchema, LiveRaceChallengeSchema} from "@riddle-quest/core/race";
import {redditGameplay} from "../../../../platforms/web/reddit/server/redditGameplayEndpoint";
import {redditProviderIdentityId} from "../../../../platforms/web/reddit/server/redditEndpoints";
import {redditFirebaseUid, hashRedditGatewayPayload, canonicalRedditGatewayAssertion} from "../../../../platforms/web/reddit/server/redditSecurity";
import type {RaceProviderScope} from "../../race/raceEligibility";
import {setEmulatorSystemTime} from "../helpers/emulatorClock";

/** Owned demo project prevents cleanup from touching another database. */
const PROJECT = "demo-live-rematch-review";
/** Synthetic source and invitation clocks make every boundary deterministic. */
const NOW = 1_800_000_000_000;
/** Named isolated test application. */
let app: App;
/** Only the signed HTTP test owns the default application used by production callables. */
let gatewayApp: App | undefined;
/** Guarded emulator authority. */
let db: FirebaseFirestore.Firestore;

/** Clears only synthetic data after validating both the project and loopback emulator. */
async function clear() {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ""))
    throw new Error("Owned loopback demo emulator required");
  for (const name of ["users", "localizedRiddles", "liveRaceTickets", "liveRaceMatches", "liveRacePlayers", "liveRaceQueues",
    "liveRacePushOutbox", "liveRaceSignals", "racePerformanceOutbox", "providerIdentities", "redditGatewayNonces", "redditRequestRates", JEST_ACCOUNT_DELETION_COLLECTION])
    await db.recursiveDelete(db.collection(name));
  await db.doc("raceConfig/rollout").delete();
}
beforeAll(() => {app = initializeApp({projectId: PROJECT}, PROJECT); db = getFirestore(app);});
beforeEach(clear);
afterEach(() => jest.useRealTimers());
afterAll(async () => {await clear(); if (gatewayApp) await deleteApp(gatewayApp); await deleteApp(app);});

/** Uses real queue joins and authoritative forfeit settlement to create a retained human source. */
async function completed(provider: RaceProviderScope, suffix = "source", suppliedIds?: string[]) {
  /** Canonical provider-shaped fixture owners. */
  const ids = suppliedIds ?? ["a", "b", "c"].map(letter => provider === "android" ? letter.repeat(28) : `${provider}_${letter.repeat(40)}`);
  /** Eligible immutable content and canonical profiles are required by the real engine. */
  const batch = db.batch();
  for (let index = 0; index < 30; index++) batch.set(db.doc(`localizedRiddles/en/riddles/rematch-${index}`), {
    riddleId: `rematch-${index}`, canonicalRiddleId: `rematch:${index}`, categoryId: "history",
    text: `Historical rematch question ${index} follows a unique trail`, answer: `a${String(index).padStart(6, "0")}`,
    difficultyBand: ["easy", "medium", "hard"][index % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  for (const [index, id] of ids.entries()) batch.set(db.doc(`users/${id}`), {username: ["Alice", "Bob", "Charlie"][index], coins: 100,
    ...(provider === "android" ? {androidProvider: index === 0 ? "anonymous" : "google.com"} : {})});
  await batch.commit();
  /** Two actual queue seats converge on one private match. */
  const a = await joinLiveRaceForUser(ids[0], {locale: "en", categoryId: "history", requestId: `${suffix}-creator-join`}, {db, nowMs: NOW});
  /** Paired human provides the rematch recipient without a public account selector. */
  const b = await joinLiveRaceForUser(ids[1], {locale: "en", categoryId: "history", requestId: `${suffix}-rival-join`}, {db, nowMs: NOW + 1000});
  /** Original shared match that supplies both participants' canonical first questions. */
  const paired = (await db.doc(`liveRaceMatches/${a.ticketId}`).get()).data()!;
  for (const [seat, view] of [a, b].entries()) {
    /** First owned question answered before a rematch-eligible terminal result. */
    const riddle = paired.runs[seat].riddles[0];
    await updateLiveRaceForUser(ids[seat], {ticketId: view.ticketId, action: "guess", requestId: `rematch-played-${suffix}-${seat}`,
      riddleId: riddle.riddleId, guess: riddle.answer}, {db, nowMs: NOW + 7000});
  }
  await updateLiveRaceForUser(ids[1], {ticketId: b.ticketId, action: "leave", requestId: `${suffix}-rival-forfeit`}, {db, nowMs: NOW + 8000});
  return {ids, a, b};
}

/** Exact own source binds the original content selection and stable join receipt. */
const rematch = (userId: string, source: string, nowMs = NOW + 10_000, requestId = "private-rematch-001") =>
  joinLiveRaceForUser(userId, {locale: "en", categoryId: "history", requestId, rematchOfTicketId: source}, {db, nowMs});

it.each(["facebook", "reddit", "jest", "android"] as const)("reserves %s rematch only for the prior human and recovers concurrent retries once", async provider => {
  /** Either terminal seat may ask its actual rival for a new race. */
  const {ids, a} = await completed(provider);
  /** Concurrent tabs converge on the existing active private lobby even with different request IDs. */
  const outcomes = await Promise.all([rematch(ids[0], a.ticketId), rematch(ids[0], a.ticketId, NOW + 10_000, "second-tab-rematch")]);
  expect(new Set(outcomes.map(row => row.ticketId)).size).toBe(1);
  /** Only the public opaque handle leaves the creator's transport. */
  const lobby = outcomes[0];
  expect(lobby).toMatchObject({phase: "searching", opponent: null, run: null, rewardCoins: 0, challengeId: `live_${lobby.ticketId}`});
  expect(JSON.stringify(lobby)).not.toMatch(/facebook_|reddit_|jest_|inviteRecipientId|rematchOfTicketId|answer/);
  expect((await db.doc(`liveRaceTickets/${lobby.ticketId}`).get()).data()).toMatchObject({
    privateChallenge: true, inviteRecipientId: ids[1], rematchOfTicketId: a.ticketId,
  });
  expect((await listLiveRaceChallengesForUser(db, ids[1], NOW + 11_000)).map(row => row.challengeId)).toEqual([lobby.challengeId]);
  await expect(getLiveRaceChallengeForUser(ids[2], lobby.challengeId!, {db, nowMs: NOW + 11_000})).rejects.toMatchObject({code: "not-found"});
  /** A public stranger cannot take the reserved lobby or cause its bot fallback. */
  const stranger = await joinLiveRaceForUser(ids[2], {locale: "en", categoryId: "history", requestId: "rematch-public-stranger"}, {db, nowMs: NOW + 11_000});
  expect(stranger.phase).toBe("searching");
  expect((await updateLiveRaceForUser(ids[0], {ticketId: lobby.ticketId, action: "poll", requestId: "rematch-no-bot"}, {db, nowMs: NOW + 70_000})).phase).toBe("searching");
  /** Only explicit recipient acceptance creates the new match. */
  const accepted = await joinLiveRaceForUser(ids[1], {locale: "en", categoryId: "history", requestId: "accept-rematch-001", challengeId: lobby.challengeId}, {db, nowMs: NOW + 71_000});
  expect(accepted).toMatchObject({phase: "countdown", opponent: {displayName: "Alice", bot: false}, startsAtMs: NOW + 76_000});
  expect((await db.collection("liveRaceMatches").get()).size).toBe(2);
  expect((await db.doc(`users/${ids[0]}/liveChallengeRate/current`).get()).data()?.count).toBe(1);
  expect((await db.collection("liveRacePushOutbox").get()).size).toBe(provider === "facebook" ? 1 : 0);
  // The settled source granted debut to both seats and first-win to its winner.
  expect((await db.doc(`users/${ids[0]}`).get()).data()?.coins).toBe(200);
  expect((await db.doc(`users/${ids[1]}`).get()).data()?.coins).toBe(125);
});

it.each(["facebook", "reddit", "jest", "android"] as const)("lets the losing %s seat rematch and revalidates safety before acceptance", async provider => {
  /** Authority fixture for this independent rematch gate. */
  const {ids, b} = await completed(provider);
  /** Original loser becomes the new creator; no winner-only privilege is introduced. */
  const lobby = await rematch(ids[1], b.ticketId);
  expect(await getLiveRaceChallengeForUser(ids[0], lobby.challengeId!, {db, nowMs: NOW + 11_000})).toMatchObject({status: "available"});
  await db.doc(`users/${ids[0]}/blockedRivals/${ids[1]}`).set({blocked: true});
  expect(await listLiveRaceChallengesForUser(db, ids[0], NOW + 12_000)).toEqual([]);
  await expect(joinLiveRaceForUser(ids[0], {locale: "en", categoryId: "history", requestId: "blocked-accept-rematch", challengeId: lobby.challengeId}, {db, nowMs: NOW + 12_000}))
    .rejects.toMatchObject({code: "not-found"});
});

it.each([
  {seat: 0, owner: "creator", marker: "revoked"},
  {seat: 0, owner: "creator", marker: "malformed"},
  {seat: 1, owner: "recipient", marker: "revoked"},
  {seat: 1, owner: "recipient", marker: "malformed"},
])("rejects an Android rematch with a $marker $owner profile marker without changing authority", async ({seat, marker}) => {
  /** Both profiles originally held valid native authority when their human match settled. */
  const {ids, a, b} = await completed("android");
  await db.doc(`users/${ids[seat]}`).update({androidProvider: marker === "revoked" ? FieldValue.delete() : true});
  /** Preserve the complete source seats, settlement and canonical balances across rejection. */
  const references = [db.doc(`liveRaceTickets/${a.ticketId}`), db.doc(`liveRaceTickets/${b.ticketId}`),
    db.doc(`liveRaceMatches/${a.ticketId}`), db.doc(`users/${ids[0]}`), db.doc(`users/${ids[1]}`),
    db.doc(`users/${ids[0]}/liveChallengeRate/current`), db.doc(`users/${ids[1]}/liveChallengeInboxRate/current`)];
  /** Reads remain synthetic and local to this test's isolated emulator. */
  const before = await db.getAll(...references);
  await expect(rematch(ids[0], a.ticketId)).rejects.toMatchObject({code: "permission-denied"});
  /** Even rewriting the same data would incorrectly advance its update timestamp. */
  const after = await db.getAll(...references);
  expect(after.map(snapshot => ({data: snapshot.data(), updateTime: snapshot.updateTime})))
    .toEqual(before.map(snapshot => ({data: snapshot.data(), updateTime: snapshot.updateTime})));
  expect((await db.collection("liveRaceTickets").get()).size).toBe(2);
  expect((await db.collection("liveRaceMatches").get()).size).toBe(1);
  expect((await db.collection(`users/${ids[1]}/liveRaceInvitations`).get()).empty).toBe(true);
  expect((await db.collection("liveRacePushOutbox").get()).empty).toBe(true);
});

it.each(["blocked", "reverse-blocked", "owner-deleted", "peer-deleted", "peer-missing", "expired", "future", "unsettled", "corrupt"])(
  "rejects %s rematch authority before creating a new seat, inbox or rate receipt", async mode => {
    /** Authority fixture for this independent rematch gate. */
    const {ids, a} = await completed("reddit");
    /** Mutate one independent authority gate at a time. */
    if (mode === "blocked") await db.doc(`users/${ids[0]}/blockedRivals/${ids[1]}`).set({blocked: true});
    if (mode === "reverse-blocked") await db.doc(`users/${ids[1]}/blockedRivals/${ids[0]}`).set({blocked: true});
    if (mode === "owner-deleted" || mode === "peer-deleted") await getJestAccountDeletionRef(db, ids[mode === "owner-deleted" ? 0 : 1]).set({deletedAt: Timestamp.fromMillis(NOW)});
    if (mode === "peer-missing") await db.doc(`users/${ids[1]}`).delete();
    if (mode === "expired") await db.doc(`liveRaceTickets/${a.ticketId}`).update({createdAtMs: NOW - LIVE_RACE_HISTORY_MS});
    if (mode === "future") await db.doc(`liveRaceTickets/${a.ticketId}`).update({createdAtMs: NOW + 20_000});
    if (mode === "unsettled") await db.doc(`liveRaceMatches/${a.ticketId}`).update({rewardCoins: FieldValue.delete()});
    if (mode === "corrupt") await db.doc(`liveRaceTickets/${a.ticketId}`).update({"run.userId": ids[1]});
    await expect(rematch(ids[0], a.ticketId)).rejects.toBeDefined();
    expect((await db.collection("liveRaceTickets").get()).size).toBe(2);
    expect((await db.collection("liveRacePushOutbox").get()).size).toBe(0);
    expect((await db.doc(`users/${ids[0]}/liveChallengeRate/current`).get()).exists).toBe(false);
    expect((await db.collection(`users/${ids[1]}/liveRaceInvitations`).get()).size).toBe(0);
  });

it("rejects foreign sources, changed content, exhausted shared quota and an unavailable bot", async () => {
  /** Authority fixture for this independent rematch gate. */
  const {ids, a} = await completed("reddit");
  await expect(rematch(ids[2], a.ticketId)).rejects.toMatchObject({code: "permission-denied"});
  await expect(joinLiveRaceForUser(ids[0], {locale: "fr", categoryId: "history", requestId: "wrong-locale-rematch", rematchOfTicketId: a.ticketId}, {db, nowMs: NOW + 10_000}))
    .rejects.toMatchObject({code: "failed-precondition"});
  await db.doc(`users/${ids[0]}/liveChallengeRate/current`).set({count: 5, resetAtMs: NOW + 3_600_000});
  await expect(rematch(ids[0], a.ticketId)).rejects.toMatchObject({code: "resource-exhausted"});
  await db.doc(`users/${ids[0]}/liveChallengeRate/current`).delete();
  /** Actual bot source is terminal but never identifies an eligible human invitation recipient. */
  const bot = await joinLiveRaceForUser(ids[0], {locale: "en", categoryId: "history", requestId: "rematch-bot-source"}, {db, nowMs: NOW + 20_000});
  await updateLiveRaceForUser(ids[0], {ticketId: bot.ticketId, action: "poll", requestId: "rematch-bot-start"}, {db, nowMs: NOW + 80_000});
  await updateLiveRaceForUser(ids[0], {ticketId: bot.ticketId, action: "poll", requestId: "rematch-bot-settle"}, {db, nowMs: NOW + 210_000});
  await expect(rematch(ids[0], bot.ticketId, NOW + 211_000)).rejects.toMatchObject({code: "failed-precondition"});
});

it("binds lost-response receipts to one source and rejects changed replay even after invitation expiry", async () => {
  /** Authority fixture for this independent rematch gate. */
  const {ids, a, b} = await completed("facebook");
  /** Authority fixture for this independent rematch gate. */
  const lobby = await rematch(ids[0], a.ticketId);
  expect((await rematch(ids[0], a.ticketId, NOW + 11_000)).ticketId).toBe(lobby.ticketId);
  await expect(rematch(ids[0], b.ticketId, NOW + 12_000)).rejects.toMatchObject({code: "failed-precondition"});
  await expect(rematch(ids[0], b.ticketId, NOW + LIVE_RACE_INVITE_MS + 20_000)).rejects.toMatchObject({code: "failed-precondition"});
  expect((await rematch(ids[0], a.ticketId, NOW + LIVE_RACE_INVITE_MS + 20_000)).phase).toBe("cancelled");
});

it("refreshes game-owned rematch identity and omits a missing recipient account", async () => {
  /** Retained human source supplies the only permitted recipient. */
  const {ids, a} = await completed("reddit");
  /** New private receipt initially copies Alice's current profile. */
  const lobby = await rematch(ids[0], a.ticketId);
  await db.doc(`users/${ids[0]}`).update({username: "RenamedCreator", level: 7, avatarUrl: "https://example.com/current-avatar.png"});
  expect(await getLiveRaceChallengeForUser(ids[1], lobby.challengeId!, {db, nowMs: NOW + 11_000}))
    .toMatchObject({creator: {displayName: "RenamedCreator", level: 7, avatarUrl: "https://example.com/current-avatar.png"}});
  await db.doc(`users/${ids[1]}`).delete();
  expect(await listLiveRaceChallengesForUser(db, ids[1], NOW + 12_000)).toEqual([]);
});

it("uses the real signed Reddit join/inbox/preview boundaries with strict public receipts and deletion leases", async () => {
  if (getApps().some(value => value.name === "[DEFAULT]")) throw new Error("Owned default application required");
  gatewayApp = initializeApp({projectId: PROJECT});
  /** Only synthetic loopback credentials enter this request verifier. */
  const secret = "reddit-rematch-loopback-secret-at-least-32-characters", uidSecret = Buffer.alloc(32, 51).toString("base64");
  /** Every subject maps to the canonical generation resolved by the production gateway. */
  const subjects = ["t2_rematch_creator", "t2_rematch_peer", "t2_rematch_stranger"];
  /** Canonical account IDs remain exclusively in private setup and expected authority. */
  const ids = subjects.map(subject => redditFirebaseUid(subject, uidSecret, 1));
  /** Exact provider configuration is restored after this isolated test. */
  const original = {REDDIT_GATEWAY_SECRET: process.env.REDDIT_GATEWAY_SECRET, REDDIT_UID_SECRET: process.env.REDDIT_UID_SECRET,
    REDDIT_DISABLED_FEATURES: process.env.REDDIT_DISABLED_FEATURES};
  /** Express response seam exercises real signature, nonce, quota, identity and callable dispatch. */
  let status = 200, body: unknown, sequence = 0;
  /** Fluent response captures public gateway output only. */
  const response = {set: () => response, status: (value: number) => {status = value; return response;}, json: (value: unknown) => {body = value; return response;}};
  /** Parsed target receipts remain untrusted until validated against their actual portable schema. */
  const result = () => {
    if (!body || typeof body !== "object") throw new Error("Missing public gateway result");
    expect(body).toMatchObject({ok: true});
    return Reflect.get(body, "result");
  };
  /** Each request binds exact operation, subject and payload with a fresh nonce. */
  const send = async (operation: string, payload: unknown, subject = subjects[0]) => {
    status = 200; body = undefined;
    /** The fixture uses the production canonical assertion and HMAC domain. */
    const assertion = {version: 1 as const, appName: "riddle-quest", installationId: "riddle-quest:t5_test", subredditId: "t5_test", postId: "t3_test",
      userId: subject, operation, issuedAtMs: NOW + 10_000, nonce: `live_rematch_${++sequence}_${"n".repeat(32)}`, payloadHash: hashRedditGatewayPayload(payload)};
    /** No credential or assertion is printed or returned in browser presentation. */
    const signature = createHmac("sha256", secret).update("riddle-quest-reddit-gateway-v1\0").update(canonicalRedditGatewayAssertion(assertion)).digest("base64url");
    await redditGameplay({method: "POST", body: {assertion, payload}, get: () => signature} as never, response as never);
  };
  try {
    process.env.REDDIT_GATEWAY_SECRET = secret; process.env.REDDIT_UID_SECRET = uidSecret; process.env.REDDIT_DISABLED_FEATURES = "commerce,notifications";
    /** Actual prior terminal authority is required even through the provider transport. */
    const {a} = await completed("reddit", "signed-rematch", ids);
    for (const [index, subject] of subjects.entries()) await db.doc(`providerIdentities/${redditProviderIdentityId("riddle-quest", subject)}`).set({
      provider: "reddit", appName: "riddle-quest", providerUserId: subject, accountGeneration: 1, status: "active", uid: ids[index],
    });
    await db.doc("raceConfig/rollout").set({enabled: true, percentage: 100, allowlistHashes: []});
    setEmulatorSystemTime(NOW + 10_000);
    /** Source selection uses only the creator's own opaque terminal ticket. */
    const input = {locale: "en", categoryId: "history", requestId: "signed-rematch-create", rematchOfTicketId: a.ticketId};
    await send("gameplay.race.live.join", input); expect(status).toBe(200);
    /** Public lobby receipt has no resolved recipient identity or private source marker. */
    const lobby = LiveRaceViewSchema.parse(result());
    expect(lobby).toMatchObject({phase: "searching", rewardCoins: 0, opponent: null});
    expect(JSON.stringify(body)).not.toMatch(/reddit_|userId|participantIds|inviteRecipientId|rematchOfTicketId|answer/);
    await send("gameplay.race.live.join", input); expect(status).toBe(200); expect(result()).toEqual(lobby);
    await send("gameplay.race.live.inbox", {}, subjects[1]); expect(status).toBe(200);
    expect(LiveRaceChallengeSchema.array().max(10).parse(result()).map(row => row.challengeId)).toEqual([lobby.challengeId]);
    await send("gameplay.race.live.challenge", {challengeId: lobby.challengeId}, subjects[1]); expect(status).toBe(200);
    expect(LiveRaceChallengeSchema.parse(result())).toMatchObject({status: "available", locale: "en", categoryId: "history"});
    expect(JSON.stringify(body)).not.toMatch(/reddit_|userId|participantIds|answer/);
    /** A valid signed Reddit subject still cannot attach another provider's optional score destination. */
    await send("gameplay.race.live.join", {...input, requestId: "reddit-forbidden-context", facebookContextId: "foreign-thread"});
    expect(status).toBe(403); expect(body).toEqual({error: "live-race-request-failed", code: "permission-denied"});
    await send("gameplay.race.live.inbox", {userId: ids[0]}, subjects[1]); expect(status).toBe(401); expect(body).toEqual({error: "invalid-request"});
    await getJestAccountDeletionRef(db, ids[1]).set({deletedAtMs: NOW + 10_000});
    await send("gameplay.race.live.inbox", {}, subjects[1]); expect(status).toBe(401); expect(body).toEqual({error: "invalid-request"});
    expect((await db.collection("liveRacePushOutbox").get()).size).toBe(0);
  } finally {
    jest.useRealTimers();
    for (const [key, value] of Object.entries(original)) {if (value === undefined) delete process.env[key]; else process.env[key] = value;}
  }
});
