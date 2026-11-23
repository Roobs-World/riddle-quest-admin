import {createHmac} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {redditGameplay} from "../redditGameplayEndpoint";
import {redditProviderIdentityId} from "../redditEndpoints";
import {canonicalRedditGatewayAssertion, hashRedditGatewayPayload, redditFirebaseUid} from "../redditSecurity";
import {liveJoinIntentRef} from "../../../../../firebase-functions/src/race/invitations/raceLiveJoinIntent";
import {setEmulatorSystemTime} from "../../../../../firebase-functions/src/__tests__/helpers/emulatorClock";

/** Gateway tests use real signature, nonce, quota, identity, callable and retirement authority. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "", NOW = Date.UTC(2026, 9, 6);
/** These secrets identify only the owned loopback fixture. */
const GATEWAY = "live-retirement-fixture-secret-at-least-32-characters", UID_SECRET = Buffer.alloc(32, 39).toString("base64");
/** Provider account has no shared production identity. */
const PERSON = "t2_retirement_gateway", OWNER = redditFirebaseUid(PERSON, UID_SECRET, 1);
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
});
afterEach(() => {jest.useRealTimers(); jest.restoreAllMocks();});
afterAll(async () => {await clear(); for (const [key, value] of Object.entries(original)) {
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
}});
/** HTTP seam observes output while the signed production dispatch stays intact. */
const request = async (payload: unknown) => {
  /** Each operation receives a one-use, payload-bound Devvit assertion. */
  const assertion = {version: 1 as const, appName: "riddle-quest", installationId: "riddle-quest:t5_test", subredditId: "t5_test",
    postId: "t3_test", userId: PERSON, operation: "gameplay.race.live.retire", issuedAtMs: NOW,
    nonce: "retire_gateway_nonce_" + "n".repeat(32), payloadHash: hashRedditGatewayPayload(payload)};
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
it("returns only a retirement acknowledgement through the signed gateway", async () => {
  expect(await request({requestId: "original-gateway-join", expectedOwnerId: OWNER})).toEqual({status: 200, body: {ok: true, result: {status: "retired"}}});
  expect((await liveJoinIntentRef(db, OWNER, "original-gateway-join").get()).data()?.retired).toBe(true);
  expect((await db.doc(`users/${OWNER}`).get()).data()?.coins).toBe(500);
});
it.each([
  [{requestId: "original-gateway-join", expectedOwnerId: "different-authenticated-account"}, 403, "permission-denied"],
  [{requestId: "original-gateway-join", ticketId: "a".repeat(64)}, 400, "invalid-argument"],
] as const)("preserves a safe definitive rejection through the signed gateway: %p", async (payload, status, code) => {
  expect(await request(payload)).toEqual({status, body: {error: "live-race-request-failed", code}});
  expect((await db.collection(`users/${OWNER}/liveRaceJoinIntents`).get()).empty).toBe(true);
});
it("does not publish a retirement marker for an absent verified account", async () => {
  await db.doc(`users/${OWNER}`).delete();
  expect(await request({requestId: "original-gateway-join", expectedOwnerId: OWNER})).toEqual({status: 404, body: {error: "live-race-request-failed", code: "not-found"}});
  expect((await db.collection(`users/${OWNER}/liveRaceJoinIntents`).get()).empty).toBe(true);
});
