import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {
  androidPushTokenHash,
  sendAndroidPush,
  sendAndroidLiveChallengePush,
  setAndroidPushSubscription,
} from "../androidNotifications";

/** Only FCM is replaced; authentication, consent and ownership use isolated Firestore. */
const mockSend = jest.fn(async (_input: unknown) => "provider-message-id");
jest.mock("firebase-admin/messaging", () => ({getMessaging: () => ({send: mockSend})}));
const A = "AndroidPushA12345678901234567", B = "AndroidPushB12345678901234567";
const TOKEN = "opaque-native-fcm-registration-token";
const deviceId = (index = 1) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const originalManagerUrl = process.env.NOTIFICATION_MANAGER_URL;
let db: FirebaseFirestore.Firestore, deviceEpoch = 0;
const call = (uid: string, data: unknown, provider = "anonymous") =>
  setAndroidPushSubscription.run({auth: {uid, token: {firebase: {sign_in_provider: provider}}}, data} as never);
const enabled = (uid: string, patch: Record<string, unknown> = {}) => ({
  enabled: true, expectedOwnerId: uid, deviceEpoch: ++deviceEpoch, deviceId: deviceId(),
  preferenceFromSettings: true, token: TOKEN, locale: "fr", ...patch,
});
const disabled = (uid: string, patch: Record<string, unknown> = {}) => ({
  enabled: false, expectedOwnerId: uid, deviceEpoch: ++deviceEpoch, deviceId: deviceId(),
  preferenceFromSettings: true, token: TOKEN, ...patch,
});
const campaignData = (revision = 1) => ({kind: "campaign", notificationId: "c".repeat(64), registrationRevision: String(revision),
  title: "Manager headline", body: "Manager message",
  expiresAtMs: String(Date.now() + 30_000)});
async function clear() {
  for (const name of ["users", "androidPushTokens", "androidNotificationDevices", "androidPushDeliveries", "jestAccountDeletionTombstones"])
    await db.recursiveDelete(db.collection(name));
}
beforeAll(() => {
  if (!/^demo-/.test(process.env.GCLOUD_PROJECT ?? "") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ""))
    throw new Error("Dedicated Android notifications demo emulator required.");
  const app = getApps().find(candidate => candidate.name === "[DEFAULT]") ?? initializeApp({projectId: "demo-android-notifications"});
  if (app.options.projectId !== "demo-android-notifications") throw new Error("Dedicated Android notifications demo emulator required.");
  db = getFirestore(app);
  process.env.NOTIFICATION_MANAGER_URL = "";
});
beforeEach(async () => {
  await clear();
  deviceEpoch = 0;
  mockSend.mockReset();
  mockSend.mockResolvedValue("provider-message-id");
  for (const uid of [A, B]) await db.doc(`users/${uid}`).set({androidProvider: "anonymous", preferredLanguage: "fr"});
});
afterAll(async () => {
  await clear();
  if (originalManagerUrl === undefined) delete process.env.NOTIFICATION_MANAGER_URL;
  else process.env.NOTIFICATION_MANAGER_URL = originalManagerUrl;
});

it("rejects wrong providers, missing accounts, malformed tokens and foreign expected owners", async () => {
  await expect(call(A, enabled(A), "custom")).rejects.toMatchObject({code: "permission-denied"});
  await expect(call("missing-account", enabled("missing-account"))).rejects.toMatchObject({code: "not-found"});
  await expect(call(A, enabled(A, {token: "bad token"}))).rejects.toMatchObject({code: "invalid-argument"});
  await expect(call(A, enabled(B))).rejects.toMatchObject({code: "permission-denied"});
  await expect(call(A, enabled(A, {uid: B}))).rejects.toMatchObject({code: "invalid-argument"});
  expect((await db.collection("androidPushTokens").get()).empty).toBe(true);
});

it("replays one command without changing its revision and rejects a retired account's operation", async () => {
  const firstCommand = enabled(A);
  await expect(call(A, firstCommand)).resolves.toMatchObject({enabled: true, delivery: "not-configured"});
  const ref = db.doc(`androidPushTokens/${androidPushTokenHash(TOKEN)}`), first = (await ref.get()).data();
  await Promise.all([call(A, firstCommand), call(A, firstCommand)]);
  expect((await db.collection("androidPushTokens").get()).size).toBe(1);
  expect((await ref.get()).data()?.revision).toBe(first?.revision);
  expect(first).toMatchObject({uid: A, enabled: true, managerCampaigns: true});
  await call(B, enabled(B));
  await expect(call(A, firstCommand)).rejects.toMatchObject({code: "failed-precondition"});
  await expect(call(B, firstCommand)).rejects.toMatchObject({code: "permission-denied"});
  expect((await ref.get()).data()?.uid).toBe(B);
  await call(B, disabled(B));
  expect((await ref.get()).data()).toMatchObject({uid: B, enabled: false});
  expect((await db.doc(`users/${B}`).get()).data()?.notificationsEnabled).toBe(false);
  expect(mockSend).not.toHaveBeenCalled();
});

it("bounds installations and applies global Off to every account registration", async () => {
  for (let i = 1; i <= 5; i++) await call(A, enabled(A, {token: `${TOKEN}-${i}`, deviceId: deviceId(i)}));
  await expect(call(A, enabled(A, {token: `${TOKEN}-overflow`, deviceId: deviceId(6)})))
    .rejects.toMatchObject({code: "resource-exhausted"});
  await call(A, disabled(A, {token: `${TOKEN}-1`}));
  const registrations = await db.collection("androidPushTokens").where("uid", "==", A).get();
  expect(registrations.size).toBe(5);
  expect(registrations.docs.every(row => row.data().enabled === false)).toBe(true);
  expect((await db.doc(`users/${A}`).get()).data()?.notificationsEnabled).toBe(false);
});

it("sends only to current consented campaign-capable registrations without collapsing distinct campaigns", async () => {
  await call(A, enabled(A));
  const id = androidPushTokenHash(TOKEN);
  const revision = (await db.doc(`androidPushTokens/${id}`).get()).data()?.revision;
  if (typeof revision !== "number") throw new Error("Registration revision absent");
  const data = campaignData(revision);
  expect(await sendAndroidPush(db, id, B, data, "campaign", 1000, revision)).toBe(false);
  expect(await sendAndroidPush(db, id, A, data, "campaign", 1000, revision + 1)).toBe(false);
  expect(await sendAndroidPush(db, id, A, data, "campaign", -1, revision)).toBe(false);
  await db.doc(`users/${A}`).update({notificationsEnabled: false});
  expect(await sendAndroidPush(db, id, A, data, "campaign", 1000, revision)).toBe(false);
  expect(mockSend).not.toHaveBeenCalled();
  await db.doc(`users/${A}`).update({notificationsEnabled: true});
  expect(await sendAndroidPush(db, id, A, data, "campaign", 1000, revision)).toBe(true);
  expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({token: TOKEN, data: {...data, accountId: A},
    android: {priority: "normal", ttl: 1000}}));
  await db.doc(`androidPushTokens/${id}`).update({updatedAtMs: Date.now() - 31 * 86_400_000});
  expect(await sendAndroidPush(db, id, A, data, "campaign", 1000, revision)).toBe(false);
});

it("refuses deleted accounts and removes provider-invalid tokens without replaying sends", async () => {
  await call(A, enabled(A));
  await db.doc(`jestAccountDeletionTombstones/${A}`).set({deletedAt: Date.now()});
  await expect(call(A, enabled(A))).rejects.toMatchObject({code: "failed-precondition"});
  expect(await sendAndroidPush(db, androidPushTokenHash(TOKEN), A, campaignData(), "campaign", 1000)).toBe(false);
  await db.doc(`jestAccountDeletionTombstones/${A}`).delete();
  mockSend.mockRejectedValueOnce(Object.assign(new Error("invalid registration"), {code: "messaging/registration-token-not-registered"}));
  await expect(sendAndroidPush(db, androidPushTokenHash(TOKEN), A, campaignData(), "campaign", 1000)).rejects.toThrow("invalid registration");
  expect((await db.doc(`androidPushTokens/${androidPushTokenHash(TOKEN)}`).get()).exists).toBe(false);
});

it("treats a transport outage as uncertain and preserves the installation", async () => {
  await call(A, enabled(A));
  mockSend.mockRejectedValueOnce(new Error("provider timeout"));
  expect(await sendAndroidLiveChallengePush(db, {uid: A, challengeId: `live_${"a".repeat(64)}`,
    title: "Manager headline", body: "Manager message", expiresAtMs: Date.now() + 30_000})).toBe("unconfirmed");
  expect((await db.collection("androidPushTokens").get()).size).toBe(1);
});

it("records legacy consent without admitting an older client to manager campaigns", async () => {
  await call(A, {token: TOKEN, invitations: true, daily: false, locale: "fr"});
  const registration = (await db.doc(`androidPushTokens/${androidPushTokenHash(TOKEN)}`).get()).data();
  expect(registration).toMatchObject({enabled: true, managerCampaigns: false});
  expect(registration?.nextDailyAtMs).toBeUndefined();
  expect(await sendAndroidPush(db, androidPushTokenHash(TOKEN), A, campaignData(), "campaign", 1000)).toBe(false);
  expect(mockSend).not.toHaveBeenCalled();
});
