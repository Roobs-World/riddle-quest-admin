import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue, Timestamp} from "firebase-admin/firestore";
import {prepareFacebookReferralTokenRetention} from "../facebook/facebookReferralRetention";
import {getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {bindFacebookReferralToken, issueFacebookReferralToken, settleFacebookReferralAfterAuthoritativeWin,
  FACEBOOK_REFERRAL_TOKEN_TTL_MS} from "../facebook/facebookReferrals";

/** Emulator-only canonical referral database. */
let db: FirebaseFirestore.Firestore;
/** Opaque inviter/invitee account fixtures, never live provider identity. */
const inviter = `facebook_${"a".repeat(40)}`;
/** Independent invited player. */
const invitee = `facebook_${"b".repeat(40)}`;
/** Synthetic invitation token. */
const token = "t".repeat(43);
/** Stable canonical clocks simplify expiry boundary checks. */
const now = 1_700_000_000_000;
/** Collections owned by these isolated fixtures. */
const collections = ["users", "facebookReferralTokens", "facebookReferralBindings", "facebookReferralSettlements",
  "facebookReferralDailyCaps", "jestAccountDeletionTombstones"];

beforeAll(() => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ""))
    throw new Error("facebook-retention-tests-require-local-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-facebook-retention"});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all(collections.map(name => db.recursiveDelete(db.collection(name))));
  await db.doc(`users/${inviter}`).set({coins: 300, stats: {wins: 1, gamesPlayed: 1}, hasPurchasedApp: false});
  await db.doc(`users/${invitee}`).set({coins: 300, stats: {wins: 0, gamesPlayed: 0}, hasPurchasedApp: false});
});
afterAll(async () => {await Promise.all(collections.map(name => db.recursiveDelete(db.collection(name))));});

/** Downgrades only fixture metadata to the historical contract. */
async function legacyFixture() {
  await issueFacebookReferralToken(inviter, now, () => token, db);
  await bindFacebookReferralToken(invitee, token, now + 1, db);
  /** The database stores only the domain-separated token hash. */
  const row = (await db.collection("facebookReferralTokens").get()).docs[0];
  await row.ref.update({expiresAt: FieldValue.delete()});
  await db.doc(`facebookReferralBindings/${invitee}`).update({tokenIssuedAtMs: FieldValue.delete(), tokenExpiresAtMs: FieldValue.delete()});
  return row.ref;
}

it("dry-runs legacy backfill without mutation, then commits binding metadata before token expiry atomically", async () => {
  /** Historical source row and its existing lifetime receipt. */
  const ref = await legacyFixture();
  await expect(prepareFacebookReferralTokenRetention(db, ref.id)).resolves.toEqual({status: "ready", bindingUpdates: 1});
  expect((await ref.get()).data()?.expiresAt).toBeUndefined();
  expect((await db.doc(`facebookReferralBindings/${invitee}`).get()).data()?.tokenIssuedAtMs).toBeUndefined();
  await expect(prepareFacebookReferralTokenRetention(db, ref.id, true)).resolves.toEqual({status: "ready", bindingUpdates: 1});
  expect((await ref.get()).data()?.expiresAt).toEqual(Timestamp.fromMillis(now + FACEBOOK_REFERRAL_TOKEN_TTL_MS));
  await expect(prepareFacebookReferralTokenRetention(db, ref.id, true)).resolves.toEqual({status: "already-ready", bindingUpdates: 0});
  await ref.delete(); // Simulates TTL deletion; the emulator has no automatic TTL worker.
  await expect(bindFacebookReferralToken(invitee, token, now + FACEBOOK_REFERRAL_TOKEN_TTL_MS + 1, db))
    .resolves.toEqual({alreadyBound: true, expiresAtMs: now + FACEBOOK_REFERRAL_TOKEN_TTL_MS});
  await db.doc(`users/${invitee}`).update({"stats.wins": 1});
  await expect(settleFacebookReferralAfterAuthoritativeWin(invitee, now + FACEBOOK_REFERRAL_TOKEN_TTL_MS + 2, db))
    .resolves.toMatchObject({inviteeCoins: 100, inviterCoins: 100});
  await settleFacebookReferralAfterAuthoritativeWin(invitee, now + FACEBOOK_REFERRAL_TOKEN_TTL_MS + 3, db);
  expect((await db.doc(`users/${invitee}`).get()).data()?.coins).toBe(400);
});

it("rejects unbound, mismatched, deleted or corrupted receipt retries after token deletion", async () => {
  /** New rows already carry both required retention clocks. */
  await issueFacebookReferralToken(inviter, now, () => token, db);
  await bindFacebookReferralToken(invitee, token, now + 1, db);
  await (await db.collection("facebookReferralTokens").get()).docs[0].ref.delete();
  await expect(bindFacebookReferralToken(inviter, token, now + 2, db)).rejects.toThrow("facebook-referral-token-not-found");
  await expect(bindFacebookReferralToken(invitee, "u".repeat(43), now + 2, db)).rejects.toThrow("facebook-referral-binding-conflict");
  await db.doc(`facebookReferralBindings/${invitee}`).update({tokenExpiresAtMs: now + 2});
  await expect(bindFacebookReferralToken(invitee, token, now + 3, db)).rejects.toThrow("facebook-referral-binding-conflict");
  await db.doc(`facebookReferralBindings/${invitee}`).update({tokenExpiresAtMs: now + FACEBOOK_REFERRAL_TOKEN_TTL_MS});
  await getJestAccountDeletionRef(db, invitee).set({});
  await expect(bindFacebookReferralToken(invitee, token, now + 4, db)).rejects.toThrow("account-deleted");
});

it("does not enable TTL if a legacy binding conflicts with the token's canonical window", async () => {
  /** Invalid dependent state cannot be normalized by a retention operation. */
  const ref = await legacyFixture();
  await db.doc(`facebookReferralBindings/${invitee}`).update({boundAtMs: now - 1});
  await expect(prepareFacebookReferralTokenRetention(db, ref.id, true)).rejects.toThrow("facebook-referral-binding-conflict");
  expect((await ref.get()).data()?.expiresAt).toBeUndefined();
});

it("contains high fan-out before changing token expiry or any receipt", async () => {
  /** More dependent receipts than the bounded migration permits. */
  const ref = await legacyFixture();
  /** Unrelated receipt shapes are never examined after the bounded fan-out check fails. */
  const batch = db.batch();
  for (let index = 0; index < 200; index++) batch.set(db.doc(`facebookReferralBindings/extra-${index}`), {tokenId: ref.id});
  await batch.commit();
  await expect(prepareFacebookReferralTokenRetention(db, ref.id, true)).resolves.toEqual({status: "too-many-bindings", bindingUpdates: 0});
  expect((await ref.get()).data()?.expiresAt).toBeUndefined();
});
