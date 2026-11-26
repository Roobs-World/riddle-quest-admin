import {deleteApp, getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {disableBrowserDevice, inactiveBrowserStatus} from "../notificationDevices";
import {pushDigest} from "../notificationBridge";

const deviceToken = "b".repeat(64);
const deviceHash = pushDigest(deviceToken);
let db: ReturnType<typeof getFirestore>;
let fetchMock: jest.SpyInstance;

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith("demo-"))
    throw new Error("Browser retirement fixtures require an isolated demo Firestore emulator.");
  if (!getApps().length) initializeApp({projectId: process.env.GCLOUD_PROJECT});
  db = getFirestore();
  process.env.NOTIFICATION_MANAGER_URL = "https://notification-manager.example";
  process.env.NOTIFICATION_MANAGER_BRIDGE_SECRET = "retirement-test-bridge-secret-with-no-production-access";
});

beforeEach(() => {
  fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", {status: 200}));
});

afterEach(async () => {
  fetchMock.mockRestore();
  await db.recursiveDelete(db.collection("accountPushDevices"));
});

afterAll(async () => {for (const app of getApps()) await deleteApp(app);});

it.each([{fcmToken: "previous-fcm-token"}, {subscription: {endpoint: "https://example.com/push"}}])(
  "disables an existing browser route and removes retained sender credentials", async credential => {
    const ref = db.doc(`accountPushDevices/${deviceHash}`);
    await ref.set({target: "jest", locale: "en", enabled: true, revision: 42, expiresAtMs: Date.now() + 86_400_000, ...credential});
    const result = await disableBrowserDevice(deviceToken);
    expect(result).toMatchObject({registered: false, enabled: false});
    expect(result.revision).toBeGreaterThan(42);
    const stored = (await ref.get()).data();
    expect(stored).toMatchObject({enabled: false, managerRevision: result.revision, managerExpiresAtMs: result.expiresAtMs});
    expect(stored).not.toHaveProperty("subscription");
    expect(stored).not.toHaveProperty("fcmToken");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({version: 1, deviceHash, target: "jest",
      revision: result.revision, enabled: false, locale: "en", expiresAtMs: result.expiresAtMs});
    expect(await disableBrowserDevice(deviceToken)).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);

it("retries an unacknowledged removal without changing its revision", async () => {
  const ref = db.doc(`accountPushDevices/${deviceHash}`);
  await ref.set({target: "jest", locale: "en", enabled: true, revision: 42, expiresAtMs: Date.now() + 86_400_000});
  fetchMock.mockRejectedValueOnce(new Error("offline"));
  await expect(disableBrowserDevice(deviceToken)).rejects.toThrow("offline");
  const disabled = (await ref.get()).data();
  expect(disabled?.enabled).toBe(false);
  expect((await disableBrowserDevice(deviceToken)).revision).toBe(disabled?.revision);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("returns inactive without creating a registration for an unknown browser", async () => {
  expect(await disableBrowserDevice(deviceToken)).toEqual(inactiveBrowserStatus);
  expect((await db.doc(`accountPushDevices/${deviceHash}`).get()).exists).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
