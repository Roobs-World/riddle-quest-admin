import {createHmac} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {redditGameplay} from "../redditGameplayEndpoint";
import {redditProviderIdentityId} from "../redditEndpoints";
import {canonicalRedditGatewayAssertion, hashRedditGatewayPayload, redditFirebaseUid} from "../redditSecurity";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../../../../firebase-functions/src/race/live/raceLiveService";
import {setEmulatorSystemTime} from "../../../../../firebase-functions/src/__tests__/helpers/emulatorClock";

/** Gateway tests use real signature, nonce, quota, identity, callable and read-only receipt authority. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "", NOW = Date.UTC(2026, 9, 6);
/** These secrets identify only the owned loopback fixture. */
const GATEWAY = "live-receipt-fixture-secret-at-least-32-characters", UID_SECRET = Buffer.alloc(32, 39).toString("base64");
/** Provider account has no shared production identity. */
const PERSON = "t2_receipt_gateway", OWNER = redditFirebaseUid(PERSON, UID_SECRET, 1);
/** Only the owned demo database is changed. */
let db: FirebaseFirestore.Firestore;
/** Environment restoration keeps signed fixtures independent of deployment configuration. */
const original = {REDDIT_GATEWAY_SECRET: process.env.REDDIT_GATEWAY_SECRET, REDDIT_UID_SECRET: process.env.REDDIT_UID_SECRET,
  REDDIT_DISABLED_FEATURES: process.env.REDDIT_DISABLED_FEATURES};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Owned loopback demo required");
  if (getApps().length === 0) initializeApp({projectId: PROJECT}); db = getFirestore();
  process.env.REDDIT_GATEWAY_SECRET = GATEWAY; process.env.REDDIT_UID_SECRET = UID_SECRET;
  process.env.REDDIT_DISABLED_FEATURES = "commerce,notifications";
});
/** All cleanup stays within the fresh demo and this fixture's player. */
const clear = async () => {
  for (const collection of ["liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "localizedRiddles/en/riddles"]) await db.recursiveDelete(db.collection(collection));
  await db.recursiveDelete(db.doc(`users/${OWNER}`));
  await db.doc(`providerIdentities/${redditProviderIdentityId("riddle-quest", PERSON)}`).delete();
  await db.doc("raceConfig/rollout").delete();
  await db.recursiveDelete(db.collection("redditGatewayNonces")); await db.recursiveDelete(db.collection("redditGatewayRateLimits"));
};
beforeEach(async () => {
  await clear(); setEmulatorSystemTime(NOW);
  await db.doc(`users/${OWNER}`).set({username: "Gateway player", coins: 500});
  await db.doc(`providerIdentities/${redditProviderIdentityId("riddle-quest", PERSON)}`).set({provider: "reddit", appName: "riddle-quest",
    providerUserId: PERSON, accountGeneration: 1, status: "active", uid: OWNER});
  await db.doc("raceConfig/rollout").set({enabled: true, percentage: 100, allowlistHashes: []});
  /** Real authoritative scoring requires a complete eligible content deck. */
  const batch = db.batch();
  for (let index = 0; index < 30; index++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${index}`), {
    riddleId: `history-${index}`, canonicalRiddleId: `history:${index}`, categoryId: "history", text: `Unique historical question ${index} follows its own trail`,
    answer: `a${String(index).padStart(6, "0")}`, difficultyBand: (["easy", "medium", "hard"] as const)[index % 3], raceEligible: true, qualityVersion: "human_review_v1"});
  await batch.commit();
});
afterEach(() => {jest.useRealTimers(); jest.restoreAllMocks();});
afterAll(async () => {await clear(); for (const [key, value] of Object.entries(original)) {
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
}});
/** HTTP seam observes output while the signed production dispatch stays intact. */
const request = async (payload: unknown, nonce = "receipt_gateway_nonce_" + "n".repeat(32)) => {
  /** Each operation receives a one-use, payload-bound Devvit assertion. */
  const assertion = {version: 1 as const, appName: "riddle-quest", installationId: "riddle-quest:t5_test", subredditId: "t5_test",
    postId: "t3_test", userId: PERSON, operation: "gameplay.race.live.receipt", issuedAtMs: Date.now(),
    nonce, payloadHash: hashRedditGatewayPayload(payload)};
  /** Real gateway verifies this canonical signature before authority. */
  const signature = createHmac("sha256", GATEWAY).update("riddle-quest-reddit-gateway-v1\0")
    .update(canonicalRedditGatewayAssertion(assertion)).digest("base64url");
  /** Safe endpoint result remains independent of Express. */
  let status = 200, body: unknown;
  /** Fluent response records the actual signed dispatcher output. */
  const response = {set: () => response, status: (value: number) => {status = value; return response;}, json: (value: unknown) => {body = value; return response;}};
  await redditGameplay({method: "POST", body: {assertion, payload}, get: () => signature} as never, response as never);
  return {status, body};
};
/** Creates an active owned bot seat without a fabricated command receipt. */
async function activeSeat() {
  /** Authoritative search timeout admits the configured bot fallback. */
  const joined = await joinLiveRaceForUser(OWNER, {locale: "en", categoryId: "history", requestId: "receipt-gateway-join"}, {db, nowMs: NOW});
  await updateLiveRaceForUser(OWNER, {ticketId: joined.ticketId, action: "poll", requestId: "receipt-start-bot"}, {db, nowMs: NOW + 61000});
  /** Bot seat shares the ordinary countdown before input can be accepted. */
  const active = await updateLiveRaceForUser(OWNER, {ticketId: joined.ticketId, action: "poll", requestId: "receipt-active-bot"}, {db, nowMs: NOW + 67000});
  jest.setSystemTime(NOW + 68000);
  return active;
}
it("observes later receipt acceptance through fresh signed requests without canonical writes or negative caching", async () => {
  /** Both observations address the same stable original command identity. */
  const active = await activeSeat(), input = {ticketId: active.ticketId, requestId: "gateway-wrong-guess", riddleId: active.run!.currentRiddle!.riddleId, position: 0, guessesUsedBefore: 0};
  expect(await request(input)).toEqual({status: 200, body: {ok: true, result: {status: "unconfirmed"}}});
  await updateLiveRaceForUser(OWNER, {ticketId: input.ticketId, requestId: input.requestId, riddleId: input.riddleId, action: "guess", guess: "zzzzzzz"}, {db, nowMs: NOW + 68000});
  /** Capture all canonical gameplay/economy records; security nonces and quotas may still advance. */
  const paths = [`users/${OWNER}`, `liveRaceTickets/${input.ticketId}`, `liveRaceMatches/${input.ticketId}`];
  /** Exact nanosecond update times detect even unchanged-value rewrites. */
  const before = await Promise.all(paths.map(path => db.doc(path).get()));
  expect(await request(input, "receipt_gateway_nonce_" + "m".repeat(32))).toEqual({status: 200, body: {ok: true, result: {status: "accepted"}}});
  expect(await request(input, "receipt_gateway_nonce_" + "p".repeat(32))).toEqual({status: 200, body: {ok: true, result: {status: "accepted"}}});
  for (let index = 0; index < paths.length; index++) {
    /** Gateway response hydration must not touch the owned seat, match or balance. */
    const after = await db.doc(paths[index]).get();
    expect(after.data()).toEqual(before[index].data());
    expect(after.updateTime!.isEqual(before[index].updateTime!)).toBe(true);
  }
  expect((await db.collection(`jestAccountDeletionTombstones/${OWNER}/activeOperations`).get()).empty).toBe(true);
});
it.each([{userId: OWNER}, {guess: "zzzzzzz"}, {action: "guess"}])("rejects command and account selectors through signed dispatch: %p", async extra => {
  /** Only a bounded historical locator is valid on the observer route. */
  const input = {ticketId: "a".repeat(64), requestId: "gateway-wrong-guess", riddleId: "riddle-1", position: 0, guessesUsedBefore: 0};
  expect(await request({...input, ...extra})).toEqual({status: 400, body: {error: "live-race-request-failed", code: "invalid-argument"}});
});
