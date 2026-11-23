import {createHash} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {joinLiveRaceForUser} from "../../race/raceLiveService";
import {getLiveRaceChallengeForUser} from "../../race/raceLiveInvitation";
import {sendLiveRaceChallengeForUser, listLiveRaceChallengesForUser} from "../../race/raceLiveChallengeNotifications";
import {deliverLiveRacePush, sendFacebookLiveChallengePush} from "../../race/raceLivePushDelivery";
import {facebookFirebaseUid} from "../../../../platforms/web/facebook/server/facebookSecurity";
import * as facebookTransport from "../../../../platforms/web/facebook/server/facebookNotificationTransport";
import {createUsernameReservationFields, createUsernameReservationId} from "../../profile/usernameReservations";
import {liveChallengePushCopy} from "../../race/raceLivePushCopy";
import {setLiveRacePushSubscription} from "../../race/raceLivePushJobs";

/** Synthetic same-provider account identities for emulator tests. */
const A = `jest_${"a".repeat(40)}`, B = `jest_${"b".repeat(40)}`, C = `jest_${"c".repeat(40)}`;
/** Stable server clock and synthetic browser token. */
const NOW = 1_800_000_000_000, TOKEN = "a-real-shaped-test-browser-token";
/** Isolated or configured server database. */
let db: FirebaseFirestore.Firestore;
/** Removes only this demo project’s synthetic fixtures. */
async function clear() {
  for (const collection of ["liveRaceTickets", "liveRacePlayers", "liveRaceMatches", "users", "localizedRiddles", "usernameReservations",
    "liveRacePushOutbox", "liveRacePushTokens", "jestAccountDeletionTombstones", "providerIdentities", "facebookNotificationPromptLeases"]) await db.recursiveDelete(db.collection(collection));
}
beforeAll(() => {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "") ||
    !process.env.GCLOUD_PROJECT?.startsWith("demo-")) throw new Error("Isolated loopback demo emulator required");
  if (!getApps().length) initializeApp({projectId: process.env.GCLOUD_PROJECT});
  db = getFirestore();
});
beforeEach(async () => {
  await clear();
  /** Atomic fixture initialization. */
  const batch = db.batch();
  for (const [index, uid] of [A, B, C].entries()) {
    /** Known server-reserved fixture username. */
    const username = ["Alice", "Bob", "Charlie"][index];
    batch.set(db.doc(`users/${uid}`), {username, coins: 100, preferredLanguage: index === 1 ? "fr" : "en", ...createUsernameReservationFields(username)});
    batch.set(db.doc(`usernameReservations/${createUsernameReservationId(username)}`), {username, userId: uid});
  }
  for (let i = 0; i < 30; i++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${i}`), {
    riddleId: `history-${i}`, canonicalRiddleId: `history:${i}`, categoryId: "history",
    text: `Unique historical question ${i} follows its own trail`, answer: `a${String(i).padStart(6, "0")}`,
    difficultyBand: ["easy", "medium", "hard"][i % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  batch.set(db.doc(`users/${B}/livePushSubscriptions/current`), {enabled: true, token: TOKEN, updatedAtMs: NOW});
  batch.set(db.doc(`liveRacePushTokens/${createHash("sha256").update(TOKEN).digest("hex")}`), {uid: B});
  await batch.commit();
});
afterAll(clear);
/** Reserves one private lobby through the real authority. */
const reserve = () => joinLiveRaceForUser(A, {locale: "en", categoryId: "history", requestId: "private-push-lobby", createChallenge: true}, {db, nowMs: NOW});
/** Addresses a known player through the real server service. */
const notify = (challengeId: string, recipientUsername = "Bob") => sendLiveRaceChallengeForUser(db, A, {challengeId, recipientUsername}, NOW + 1000);

it("atomically addresses the existing lobby, inbox and one durable event; retries and concurrent sends do not duplicate", async () => {
  /** Original private lobby receipt. */
  const seat = await reserve();
  await Promise.all([notify(seat.challengeId!), notify(seat.challengeId!, "BOB")]);
  expect((await db.collection("liveRacePushOutbox").get()).size).toBe(1);
  expect((await db.doc(`users/${A}/liveChallengeRate/current`).get()).data()?.count).toBe(1);
  expect(await listLiveRaceChallengesForUser(db, B, NOW + 1000)).toMatchObject([{challengeId: seat.challengeId, creator: {displayName: "Alice"}, status: "available"}]);
  expect((await db.collection("liveRacePlayers").get()).size).toBe(1);
  await expect(notify(seat.challengeId!, "Charlie")).rejects.toMatchObject({code: "failed-precondition"});
  await expect(getLiveRaceChallengeForUser(C, seat.challengeId!, {db, nowMs: NOW})).rejects.toMatchObject({code: "not-found"});
  /** Recipient seat retains the original lobby and countdown. */
  const accepted = await joinLiveRaceForUser(B, {locale: "en", categoryId: "history", challengeId: seat.challengeId!, requestId: "accept-notified-seat"}, {db, nowMs: NOW + 2000});
  expect(accepted).toMatchObject({phase: "countdown", startsAtMs: NOW + 7000});
  expect((await db.collection("liveRaceMatches").get()).docs[0].id).toBe(seat.ticketId);
});

it("claims an offline push once across concurrent event redelivery, using recipient-language copy", async () => {
  /** Original private lobby receipt. */
  const seat = await reserve(); await notify(seat.challengeId!);
  /** Injected provider boundary never sends to a person. */
  const send = jest.fn(async () => "submitted" as const);
  await Promise.all([deliverLiveRacePush(db, seat.ticketId, send, NOW + 2000), deliverLiveRacePush(db, seat.ticketId, send, NOW + 2000)]);
  await deliverLiveRacePush(db, seat.ticketId, send, NOW + 3000);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0]).toEqual([{event: expect.objectContaining({recipientId: B, challengeId: seat.challengeId}), token: TOKEN,
    title: "Alice vous défie", body: "Accepter le défi"}]);
  expect((await db.doc(`liveRacePushOutbox/${seat.ticketId}`).get()).data()?.status).toBe("submitted");
});

it("keeps ambiguous sends terminal so a retry cannot deliver a duplicate", async () => {
  /** Original private lobby receipt. */
  const seat = await reserve(); await notify(seat.challengeId!);
  /** Injected provider boundary never sends to a person. */
  const send = jest.fn(async () => {throw new Error("provider-timeout");});
  await deliverLiveRacePush(db, seat.ticketId, send, NOW + 2000);
  await deliverLiveRacePush(db, seat.ticketId, send, NOW + 3000);
  expect(send).toHaveBeenCalledTimes(1);
  expect((await db.doc(`liveRacePushOutbox/${seat.ticketId}`).get()).data()?.status).toBe("unconfirmed");
});

it.each(["opted-out", "expired-subscription", "shared-device", "blocked", "recipient-deleted", "creator-deleted", "expired-lobby", "cancelled", "accepted"])("suppresses %s pushes while retaining truthful inbox state", async mode => {
  /** Original private lobby receipt. */
  const seat = await reserve(); await notify(seat.challengeId!);
  if (mode === "opted-out") await db.doc(`users/${B}/livePushSubscriptions/current`).delete();
  if (mode === "expired-subscription") await db.doc(`users/${B}/livePushSubscriptions/current`).update({updatedAtMs: NOW - 31 * 86_400_000});
  if (mode === "shared-device") await db.doc(`liveRacePushTokens/${createHash("sha256").update(TOKEN).digest("hex")}`).set({uid: C});
  if (mode === "blocked") await db.doc(`users/${B}/blockedRivals/${A}`).set({blocked: true});
  if (mode.endsWith("-deleted")) await db.doc(`jestAccountDeletionTombstones/${mode === "creator-deleted" ? A : B}`).set({deletedAt: NOW});
  if (mode === "cancelled") await db.doc(`liveRaceTickets/${seat.ticketId}`).update({cancelled: true});
  if (mode === "accepted") await joinLiveRaceForUser(B, {locale: "en", categoryId: "history", challengeId: seat.challengeId!, requestId: "accepted-before-push"}, {db, nowMs: NOW + 1500});
  /** Injected provider boundary never sends to a person. */
  const send = jest.fn(async () => "submitted" as const);
  await deliverLiveRacePush(db, seat.ticketId, send, mode === "expired-lobby" ? NOW + 900_000 : NOW + 2000);
  expect(send).not.toHaveBeenCalled();
  expect((await db.doc(`liveRacePushOutbox/${seat.ticketId}`).get()).data()?.status).toBe("skipped");
  if (["opted-out", "expired-subscription", "shared-device"].includes(mode)) expect(await listLiveRaceChallengesForUser(db, B, NOW + 2000)).toHaveLength(1);
});

it("rejects foreign creators, cross-provider recipients, self-invites, stale reservations and forged deadlines", async () => {
  /** Original private lobby receipt. */
  const seat = await reserve();
  await expect(sendLiveRaceChallengeForUser(db, C, {challengeId: seat.challengeId!, recipientUsername: "Bob"}, NOW)).rejects.toMatchObject({code: "not-found"});
  await expect(notify(seat.challengeId!, "Alice")).rejects.toMatchObject({code: "not-found"});
  await db.doc(`usernameReservations/${createUsernameReservationId("Bob")}`).update({userId: `facebook_${"b".repeat(40)}`});
  await expect(notify(seat.challengeId!)).rejects.toMatchObject({code: "not-found"});
  await db.doc(`usernameReservations/${createUsernameReservationId("Bob")}`).update({userId: B});
  await db.doc(`users/${B}`).update({username: "NewBob"});
  await expect(notify(seat.challengeId!)).rejects.toMatchObject({code: "not-found"});
  await db.doc(`users/${B}`).update({username: "Bob"});
  await db.doc(`users/${A}/liveChallengeRate/current`).set({count: 5, resetAtMs: NOW + 3_600_000});
  await expect(notify(seat.challengeId!)).rejects.toMatchObject({code: "resource-exhausted"});
  await db.doc(`users/${A}/liveChallengeRate/current`).delete();
  await db.doc(`users/${B}/liveChallengeInboxRate/current`).set({lastAtMs: NOW});
  await expect(notify(seat.challengeId!)).rejects.toMatchObject({code: "resource-exhausted"});
  await db.doc(`users/${B}/liveChallengeInboxRate/current`).delete();
  await notify(seat.challengeId!);
  await db.doc(`liveRacePushOutbox/${seat.ticketId}`).update({expiresAtMs: NOW + 99_000_000});
  /** Injected provider boundary never sends to a person. */
  const send = jest.fn(async () => "submitted" as const);
  await deliverLiveRacePush(db, seat.ticketId, send, NOW + 2000);
  expect(send).not.toHaveBeenCalled();
});

it("renders localized server copy without leaving substitution placeholders", () => {
  for (const locale of ["ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "vi"])
    expect(liveChallengePushCopy(locale, "Alice").title).toContain("Alice");
  expect(liveChallengePushCopy("unknown", "Alice")).toEqual(liveChallengePushCopy("en", "Alice"));
});

it("composes the canonical Facebook identity, consent ledger and one fixed-host native push without guessing acknowledgement", async () => {
  /** Synthetic credentials and canonical identity never leave the injected HTTP boundary. */
  const appId = "1748953042991569", uidSecret = Buffer.alloc(32, 7).toString("base64"), playerId = "push_fixture_player";
  /** Real UID derivation validates the current provider generation. */
  const uid = facebookFirebaseUid(playerId, uidSecret), challengeId = `live_${"d".repeat(64)}`, issuedAtMs = Date.now();
  await db.doc(`users/${uid}`).set({username: "Bob"});
  await db.doc(`providerIdentities/${createHash("sha256").update(`${appId}\0${playerId}`).digest("hex")}`).set({provider: "facebook",
    appId, providerPlayerId: playerId, uid, accountGeneration: 1, status: "active"});
  await db.doc(`facebookNotificationPromptLeases/${uid}`).set({schemaVersion: 1, uid, accepted: true,
    acceptedAt: Timestamp.fromMillis(issuedAtMs), lastPromptAt: Timestamp.fromMillis(issuedAtMs - 1)});
  /** No request ever reaches Meta. */
  const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response('{"synthetic":true}'));
  /** Original event timestamp is immutable across dispatch redelivery. */
  const delivery = {event: {challengeId, creatorId: facebookFirebaseUid("creator", uidSecret), recipientId: uid,
    createdAtMs: issuedAtMs, expiresAtMs: issuedAtMs + 900000, status: "queued" as const}, title: "Alice challenged you", body: "Accept challenge"};
  /** Feature switches are isolated from developer environment configuration. */
  const off = process.env.FACEBOOK_DISABLED_FEATURES;
  delete process.env.FACEBOOK_DISABLED_FEATURES;
  try {
    /** All provider requests remain injected, even when the real consent ledger admits them. */
    const config = {appId, uidSecret, appAccessToken: "synthetic-token", enabled: true, fetch: fetchMock};
    expect(await sendFacebookLiveChallengePush(db, delivery, config)).toBe("unconfirmed");
    expect(await sendFacebookLiveChallengePush(db, delivery, config)).toBe("skipped");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchMock.mock.calls[0][0])).origin).toBe("https://graph.fb.gg");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({player_id: playerId, payload: JSON.stringify({challengeId})});
    expect((await db.doc(`users/${uid}/facebookNotificationState/current`).get()).data()?.slots[0].phase).toBe("uncertain");
  } finally {if (off === undefined) delete process.env.FACEBOOK_DISABLED_FEATURES; else process.env.FACEBOOK_DISABLED_FEATURES = off;}
});

it.each(["copy", "payload", "recipient", "label", "schedule"])("refuses changed %s bytes before admitting a Facebook provider attempt", async field => {
  /** No real recipient or provider credential is used by the real composition boundary. */
  const appId = "1748953042991569", uidSecret = Buffer.alloc(32, 7).toString("base64"), playerId = "push_binding_fixture";
  /** The canonical linked account and original outbox issuance are fixed before transport composition. */
  const uid = facebookFirebaseUid(playerId, uidSecret), challengeId = `live_${"e".repeat(64)}`, issuedAtMs = Date.now();
  await db.doc(`users/${uid}`).set({username: "Bob"});
  await db.doc(`providerIdentities/${createHash("sha256").update(`${appId}\0${playerId}`).digest("hex")}`).set({provider: "facebook",
    appId, providerPlayerId: playerId, uid, accountGeneration: 1, status: "active"});
  await db.doc(`facebookNotificationPromptLeases/${uid}`).set({schemaVersion: 1, uid, accepted: true,
    acceptedAt: Timestamp.fromMillis(issuedAtMs), lastPromptAt: Timestamp.fromMillis(issuedAtMs - 1)});
  /** Provider fetch remains fully injected even when the real private ledger admits a request. */
  const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response('{"synthetic":true}'));
  /** Original server work supplies only authoritative targeting and localized copy. */
  const delivery = {event: {challengeId, creatorId: facebookFirebaseUid("creator", uidSecret), recipientId: uid,
    createdAtMs: issuedAtMs, expiresAtMs: issuedAtMs + 900000, status: "queued" as const}, title: "Alice challenged you", body: "Accept challenge"};
  /** Retain the actual transport implementation to change only the composition boundary input. */
  const originalTransport = facebookTransport.createFacebookNotificationTransport;
  /** Alter bytes after the existing caller minted its ledger commitment; all authority remains real. */
  const spy = jest.spyOn(facebookTransport, "createFacebookNotificationTransport").mockImplementation(options => {
    /** Real transport still owns serialization, authorization, destination and result decoding. */
    const transport = originalTransport(options);
    return {...transport, send: request => transport.send({...request,
      ...(field === "copy" ? {message: {...request.message, body: "Different copy"}} : {}),
      ...(field === "payload" ? {payload: JSON.stringify({challengeId: "different"})} : {}),
      ...(field === "recipient" ? {playerId: "different_player"} : {}),
      ...(field === "label" ? {label: "riddlequest_different"} : {}),
      ...(field === "schedule" ? {scheduleInterval: 300} : {}),
    })};
  });
  /** Preserve developer feature settings without activating any external service. */
  const off = process.env.FACEBOOK_DISABLED_FEATURES;
  delete process.env.FACEBOOK_DISABLED_FEATURES;
  try {
    /** Synthetic credential is never sent over the network. */
    const config = {appId, uidSecret, appAccessToken: "synthetic-token", enabled: true, fetch: fetchMock};
    expect(await sendFacebookLiveChallengePush(db, delivery, config)).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await db.collection(`users/${uid}/facebookNotificationAttempts`).get()).empty).toBe(true);
    expect((await db.doc(`users/${uid}/facebookNotificationState/current`).get()).exists).toBe(false);
    spy.mockRestore();
    expect(await sendFacebookLiveChallengePush(db, delivery, config)).toBe("unconfirmed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await db.doc(`users/${uid}/facebookNotificationState/current`).get()).data()?.slots[0].phase).toBe("uncertain");
  } finally {
    spy.mockRestore();
    if (off === undefined) delete process.env.FACEBOOK_DISABLED_FEATURES; else process.env.FACEBOOK_DISABLED_FEATURES = off;
  }
});

it("accepts subscription consent only from registered Jest accounts, rebinds shared browsers and supports revocation", async () => {
  /** Executes the real callable wrapper against the local emulator and synthetic verified claims. */
  const call = (uid: string, registered: boolean, data: unknown) => setLiveRacePushSubscription.run({auth: {uid,
    token: {jestRegistered: registered}}, data} as never);
  await expect(call(B, false, {enabled: true, token: TOKEN})).rejects.toMatchObject({code: "permission-denied"});
  await expect(call(`facebook_${"b".repeat(40)}`, true, {enabled: true, token: TOKEN})).rejects.toMatchObject({code: "permission-denied"});
  await expect(call(B, true, {enabled: true, token: TOKEN, recipientId: C})).rejects.toMatchObject({code: "invalid-argument"});
  expect(await call(B, true, {enabled: true, token: TOKEN})).toEqual({enabled: true});
  expect(await call(C, true, {enabled: true, token: TOKEN})).toEqual({enabled: true});
  expect((await db.doc(`liveRacePushTokens/${createHash("sha256").update(TOKEN).digest("hex")}`).get()).data()?.uid).toBe(C);
  expect(await call(C, true, {enabled: false})).toEqual({enabled: false});
  expect((await db.doc(`users/${C}/livePushSubscriptions/current`).get()).exists).toBe(false);
  expect((await db.doc(`liveRacePushTokens/${createHash("sha256").update(TOKEN).digest("hex")}`).get()).exists).toBe(false);
});
