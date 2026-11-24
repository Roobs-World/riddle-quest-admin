import {createECDH} from "node:crypto";
import {deleteApp, getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {renewPairedBrowserDevice} from "../notificationDevices";
import {PUSH_DEVICE_TTL_MS, pushDigest} from "../notificationBridge";
import {runWithJestAccountOperationLease} from "../../shared/accountDeletion";

const UID = `jest_${"a".repeat(40)}`, OTHER_UID = `jest_${"f".repeat(40)}`;
const PAIRING_CODE = "c".repeat(64), PAIRING_HASH = pushDigest(PAIRING_CODE), DEVICE_HASH = pushDigest("b".repeat(64));
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/notification-renewal-fixture", ENDPOINT_HASH = pushDigest(ENDPOINT);
const COLLECTIONS = ["users", "accountPushDevices", "accountPushEndpoints", "notificationPairings", "jestAccountDeletionTombstones"];
let db: ReturnType<typeof getFirestore>;
let fetchMock: jest.SpyInstance;

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith("demo-"))
    throw new Error("Notification renewal fixtures require an isolated demo Firestore emulator.");
  if (!getApps().length) initializeApp({projectId: process.env.GCLOUD_PROJECT});
  db = getFirestore();
  process.env.NOTIFICATION_MANAGER_URL = "https://notification-manager.example";
  process.env.NOTIFICATION_MANAGER_BRIDGE_SECRET = "renewal-test-bridge-secret-with-no-production-access";
});

beforeEach(async () => {
  fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", {status: 200}));
  const now = Date.now(), expiresAtMs = now + 2 * 86_400_000;
  const key = createECDH("prime256v1");
  key.setPrivateKey(Buffer.alloc(32, 1));
  await db.doc(`users/${UID}`).set({notificationsEnabled: true});
  await db.doc(`accountPushDevices/${DEVICE_HASH}`).set({uid: UID, target: "jest", locale: "en", enabled: true,
    revision: 42, managerRevision: 42, managerExpiresAtMs: expiresAtMs, expiresAtMs, expiresAt: Timestamp.fromMillis(expiresAtMs),
    enrolledAtMs: now - 28 * 86_400_000, endpointHash: ENDPOINT_HASH, pairingHash: PAIRING_HASH,
    subscription: {endpoint: ENDPOINT, keys: {p256dh: key.getPublicKey().toString("base64url"), auth: Buffer.alloc(16, 2).toString("base64url")}}});
  await db.doc(`notificationPairings/${PAIRING_HASH}`).set({uid: UID, target: "jest", locale: "en", deviceHash: DEVICE_HASH,
    expiresAtMs: now - 27 * 86_400_000, expiresAt: Timestamp.fromMillis(expiresAtMs)});
  await db.doc(`accountPushEndpoints/${ENDPOINT_HASH}`).set({uid: UID, deviceHash: DEVICE_HASH, expiresAt: Timestamp.fromMillis(expiresAtMs)});
});

afterEach(async () => {
  fetchMock.mockRestore();
  for (const collection of COLLECTIONS) await db.recursiveDelete(db.collection(collection));
});

afterAll(async () => {for (const app of getApps()) await deleteApp(app);});

const renewFromGameplay = () => runWithJestAccountOperationLease(UID, 60, () => renewPairedBrowserDevice(UID, PAIRING_CODE));

it("keeps a returning player's paired device enrolled without changing revision or asking for a new subscription", async () => {
  const before = (await db.doc(`accountPushDevices/${DEVICE_HASH}`).get()).data();
  const started = Date.now();
  await renewFromGameplay();
  const device = (await db.doc(`accountPushDevices/${DEVICE_HASH}`).get()).data();
  expect(device?.expiresAtMs).toBeGreaterThanOrEqual(started + PUSH_DEVICE_TTL_MS);
  expect(device).toMatchObject({revision: 42, managerRevision: 42, enrolledAtMs: before?.enrolledAtMs, subscription: before?.subscription});
  expect(device?.managerExpiresAtMs).toBe(device?.expiresAtMs);
  expect((await db.doc(`notificationPairings/${PAIRING_HASH}`).get()).data()?.expiresAt.toMillis()).toBe(device?.expiresAtMs);
  expect((await db.doc(`accountPushEndpoints/${ENDPOINT_HASH}`).get()).data()?.expiresAt.toMillis()).toBe(device?.expiresAtMs);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({version: 1, deviceHash: DEVICE_HASH, target: "jest", revision: 42,
    enabled: true, locale: "en", expiresAtMs: device?.expiresAtMs});
  await renewFromGameplay();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("retries an unacknowledged lease extension after a manager outage, without changing device identity or revision", async () => {
  fetchMock.mockRejectedValueOnce(new Error("offline"));
  await expect(renewFromGameplay()).rejects.toThrow("offline");
  const pending = (await db.doc(`accountPushDevices/${DEVICE_HASH}`).get()).data();
  expect(pending?.managerExpiresAtMs).toBeLessThan(pending?.expiresAtMs);
  await renewFromGameplay();
  const acknowledged = (await db.doc(`accountPushDevices/${DEVICE_HASH}`).get()).data();
  expect(acknowledged).toMatchObject({revision: 42, managerRevision: 42, expiresAtMs: pending?.expiresAtMs});
  expect(acknowledged?.managerExpiresAtMs).toBe(acknowledged?.expiresAtMs);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it.each(["master-off", "device-off", "expired", "foreign-pairing", "foreign-device", "superseded-pairing", "foreign-endpoint", "missing-user", "missing-device"])("does not renew or re-enroll a %s device", async condition => {
  const deviceRef = db.doc(`accountPushDevices/${DEVICE_HASH}`);
  switch (condition) {
    case "master-off": await db.doc(`users/${UID}`).update({notificationsEnabled: false}); break;
    case "device-off": await deviceRef.update({enabled: false}); break;
    case "expired": await deviceRef.update({expiresAtMs: Date.now() - 1}); break;
    case "foreign-pairing": await db.doc(`notificationPairings/${PAIRING_HASH}`).update({uid: OTHER_UID}); break;
    case "foreign-device": await deviceRef.update({uid: OTHER_UID}); break;
    case "superseded-pairing": await deviceRef.update({pairingHash: "d".repeat(64)}); break;
    case "foreign-endpoint": await db.doc(`accountPushEndpoints/${ENDPOINT_HASH}`).update({uid: OTHER_UID}); break;
    case "missing-user": await db.doc(`users/${UID}`).delete(); break;
    case "missing-device": await deviceRef.delete(); break;
  }
  const before = (await deviceRef.get()).data();
  await renewFromGameplay();
  expect((await deviceRef.get()).data()).toEqual(before);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("does not renew a deleted account even when its old device and pairing remain", async () => {
  await db.doc(`jestAccountDeletionTombstones/${UID}`).set({recreationBlocked: true});
  const before = (await db.doc(`accountPushDevices/${DEVICE_HASH}`).get()).data();
  await renewPairedBrowserDevice(UID, PAIRING_CODE);
  expect((await db.doc(`accountPushDevices/${DEVICE_HASH}`).get()).data()).toEqual(before);
  expect(fetchMock).not.toHaveBeenCalled();
});
