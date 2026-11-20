import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {
  androidPushTokenHash,
  sendAndroidPush,
  sendAndroidLiveChallengePush,
  setAndroidPushSubscription,
  sendAndroidDailyReminders,
} from "../android/androidNotifications";
import {androidDailyReminderCopy} from "../android/androidNotificationCopy";

/** Only the external FCM network boundary is replaced; authority and concurrency use real Firestore. */
const mockSend = jest.fn(async (_input: unknown) => "provider-message-id");
jest.mock("firebase-admin/messaging", () => ({getMessaging: () => ({send: mockSend})}));
/** Synthetic authenticated accounts and opaque token owned by this emulator scenario. */
const A = "AndroidPushA12345678901234567",
  B = "AndroidPushB12345678901234567",
  TOKEN = "opaque-native-fcm-registration-token";
/** Real Firestore database in the dedicated local demo project. */
let db: FirebaseFirestore.Firestore;
/** Invokes the authenticated callable with synthetic verified claims. */
const call = (uid: string, data: unknown, provider = "anonymous") =>
  setAndroidPushSubscription.run({auth: {uid, token: {firebase: {sign_in_provider: provider}}}, data} as never);
/** Explicit invitation and Daily consent for the current game account. */
const preferences = (patch = {}) => ({token: TOKEN, invitations: true, daily: false, locale: "fr", ...patch});
/** This distinct demo project belongs exclusively to these fixtures. */
async function clear() {
  for (const name of ["users", "androidPushTokens", "jestAccountDeletionTombstones"])
    await db.recursiveDelete(db.collection(name));
}
beforeAll(() => {
  if (
    process.env.GCLOUD_PROJECT !== "demo-android-notifications" ||
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:18199"
  )
    throw new Error("Dedicated Android notifications demo emulator required.");
  if (!getApps().length) initializeApp({projectId: process.env.GCLOUD_PROJECT});
  db = getFirestore();
});
beforeEach(async () => {
  await clear();
  mockSend.mockReset();
  mockSend.mockResolvedValue("provider-message-id");
  for (const uid of [A, B]) await db.doc(`users/${uid}`).set({androidProvider: "anonymous", preferredLanguage: "fr"});
});
afterAll(clear);

it("rejects wrong providers, missing Android profiles, invalid token data and client-supplied identities", async () => {
  await expect(call(A, preferences(), "custom")).rejects.toMatchObject({code: "permission-denied"});
  await expect(call("missing-account", preferences())).rejects.toMatchObject({code: "not-found"});
  await expect(call(A, preferences({token: "bad token"}))).rejects.toMatchObject({code: "invalid-argument"});
  await expect(call(A, preferences({uid: B}))).rejects.toMatchObject({code: "invalid-argument"});
  expect((await db.collection("androidPushTokens").get()).empty).toBe(true);
});
it("replays consent idempotently and rebinds one installation to its latest authenticated account", async () => {
  await call(A, preferences({daily: true}));
  /** Private Firestore reference used by this authority or replay scenario. */
  const ref = db.doc(`androidPushTokens/${androidPushTokenHash(TOKEN)}`),
    first = (await ref.get()).data();
  await Promise.all([call(A, preferences({daily: true})), call(A, preferences({daily: true}))]);
  expect((await db.collection("androidPushTokens").get()).size).toBe(1);
  expect((await ref.get()).data()?.nextDailyAtMs).toBe(first?.nextDailyAtMs);
  await call(B, preferences());
  await call(A, preferences({invitations: false}));
  expect((await ref.get()).data()?.uid).toBe(B);
  await call(B, preferences({invitations: false}));
  expect((await ref.get()).exists).toBe(false);
});
it("bounds an account's notification registrations and removes daily work when consent ends", async () => {
  for (let i = 0; i < 5; i++) await call(A, preferences({token: `${TOKEN}-${i}`, daily: true}));
  await expect(call(A, preferences({token: `${TOKEN}-overflow`}))).rejects.toMatchObject({code: "resource-exhausted"});
  await call(A, preferences({token: `${TOKEN}-0`, daily: false}));
  expect(
    (await db.doc(`androidPushTokens/${androidPushTokenHash(`${TOKEN}-0`)}`).get()).data()?.nextDailyAtMs,
  ).toBeUndefined();
});
it("sends only consented fresh tokens and the current account, with canonical native data", async () => {
  await call(A, preferences());
  /** Opaque digest selecting a provider registration without exposing its raw token. */
  const id = androidPushTokenHash(TOKEN),
    data = {kind: "liveChallenge", challengeId: `live_${"a".repeat(64)}`, title: "Invitation", body: "Play"};
  expect(await sendAndroidPush(db, id, B, data, "invitations", 1000)).toBe(false);
  expect(await sendAndroidPush(db, id, A, data, "daily", 1000)).toBe(false);
  expect(await sendAndroidPush(db, id, A, data, "invitations", -1)).toBe(false);
  expect(mockSend).not.toHaveBeenCalled();
  expect(await sendAndroidPush(db, id, A, data, "invitations", 1000)).toBe(true);
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({
      token: TOKEN,
      data: {...data, accountId: A},
      android: {priority: "high", ttl: 1000, collapseKey: "liveChallenge"},
    }),
  );
  await db.doc(`androidPushTokens/${id}`).update({updatedAtMs: Date.now() - 31 * 86_400_000});
  expect(await sendAndroidPush(db, id, A, data, "invitations", 1000)).toBe(false);
});
it("refuses deleted accounts and removes provider-invalid tokens without replaying sends", async () => {
  await call(A, preferences());
  await db.doc(`jestAccountDeletionTombstones/${A}`).set({deletedAt: Date.now()});
  await expect(call(A, preferences())).rejects.toMatchObject({code: "failed-precondition"});
  expect(await sendAndroidPush(db, androidPushTokenHash(TOKEN), A, {kind: "daily"}, "invitations", 1000)).toBe(false);
  await db.doc(`jestAccountDeletionTombstones/${A}`).delete();
  mockSend.mockRejectedValueOnce(
    Object.assign(new Error("invalid registration"), {code: "messaging/registration-token-not-registered"}),
  );
  await expect(
    sendAndroidPush(db, androidPushTokenHash(TOKEN), A, {kind: "daily"}, "invitations", 1000),
  ).rejects.toThrow("invalid registration");
  expect((await db.doc(`androidPushTokens/${androidPushTokenHash(TOKEN)}`).get()).exists).toBe(false);
});
it("treats a transport outage as uncertain and preserves consent for the next new notification", async () => {
  await call(A, preferences());
  mockSend.mockRejectedValueOnce(new Error("provider timeout"));
  expect(
    await sendAndroidLiveChallengePush(db, {
      uid: A,
      challengeId: `live_${"a".repeat(64)}`,
      title: "Invitation",
      body: "Play",
      expiresAtMs: Date.now() + 30_000,
    }),
  ).toBe("unconfirmed");
  expect((await db.collection("androidPushTokens").get()).size).toBe(1);
});
it("claims a Daily reminder before concurrent scheduler redelivery and localizes the body", async () => {
  await call(A, preferences({daily: true}));
  /** Private Firestore reference used by this authority or replay scenario. */
  const ref = db.doc(`androidPushTokens/${androidPushTokenHash(TOKEN)}`);
  await ref.update({nextDailyAtMs: Date.now() - 1000});
  await Promise.all([sendAndroidDailyReminders.run({} as never), sendAndroidDailyReminders.run({} as never)]);
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({kind: "daily", accountId: A, body: androidDailyReminderCopy("fr")}),
    }),
  );
  expect((await ref.get()).data()?.nextDailyAtMs).toBeGreaterThan(Date.now());
});
