import {describe, expect, it} from "@jest/globals";
import {
  createAndroidNotificationController,
  parseAndroidNotificationPreferences,
  type AndroidNotificationBackend,
  type AndroidNotificationPreferences,
  type AndroidSubscriptionInput,
} from "../androidNotificationController";

const DEVICE_ID = "f6a1b3c2-04d5-4678-9abc-112233445566";
const KEY = "riddle-quest:android:notifications:first-account";
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

function fixture(saved?: string) {
  const records = new Map<string, string>();
  if (saved !== undefined) records.set(KEY, saved);
  const sent: AndroidSubscriptionInput[] = [];
  const owners: Array<{uid: string; preferences: AndroidNotificationPreferences}> = [];
  const cleared: string[] = [];
  const reads: string[] = [];
  let permission = true, requests = 0, tokenReads = 0, fail = false, nativeEpoch = 0;
  let token = "opaque-fcm-registration-token";
  let known: string | null = null;
  let registrationRevision = 0;
  let remote: boolean | null = null;
  let pending: Promise<void> = Promise.resolve();
  const backend: AndroidNotificationBackend = {
    async readPreference(expectedOwnerId) {reads.push(expectedOwnerId); return remote;},
    async setSubscription(input) {
      if (fail) throw new Error("network-unavailable");
      sent.push(input);
      await pending;
      if (input.enabled && !input.preferenceFromSettings && remote === false)
        return {enabled: false, delivery: "inactive", registrationRevision: 0};
      if (input.preferenceFromSettings) remote = input.enabled;
      const ready = input.enabled && "token" in input;
      return {enabled: input.enabled, delivery: input.enabled ? ready ? "ready" : "permission-required" : "inactive",
        registrationRevision: ready ? ++registrationRevision : 0};
    },
  };
  const controller = createAndroidNotificationController({
    uid: "first-account", locale: "es", backend,
    device: {
      requestPermission: async () => {requests += 1; return permission;},
      hasPermission: async () => permission,
      configure: async () => undefined,
      getToken: async () => {tokenReads += 1; known = token; return token;},
      knownToken: async () => known,
      deviceId: async () => DEVICE_ID,
      beginAccountOperation: async () => ++nativeEpoch,
      invalidateAccountOperation: async () => {nativeEpoch += 1;},
      setAccount: async (uid, preferences, operationId) => {
        if (operationId !== nativeEpoch) throw new Error("notification-account-changed");
        owners.push({uid, preferences});
      },
      clearPendingToken: async value => {cleared.push(value);},
    },
    storage: {
      getItem: async key => records.get(key) ?? null,
      setItem: async (key, value) => {records.set(key, value);},
    },
  });
  return {
    controller, records, sent, owners, cleared, reads,
    setPermission(value: boolean) {permission = value;},
    setToken(value: string) {token = value; known = value;},
    setFailure(value: boolean) {fail = value;},
    setRemote(value: boolean | null) {remote = value;},
    setPending(value: Promise<void>) {pending = value;},
    requests: () => requests,
    tokenReads: () => tokenReads,
  };
}

describe("Android notification preference", () => {
  it("defaults missing preferences On and preserves explicit or legacy Off", () => {
    expect(parseAndroidNotificationPreferences(null)).toEqual({enabled: true});
    for (const value of ['{"enabled":false}', '{"invitations":false,"daily":false}', "broken", "null", "{}"])
      expect(parseAndroidNotificationPreferences(value)).toEqual({enabled: false});
    expect(parseAndroidNotificationPreferences('{"invitations":true,"daily":false}')).toEqual({enabled: true});
    expect(parseAndroidNotificationPreferences('{"enabled":true}')).toEqual({enabled: true});
  });

  it("restores default On with granted permission without opening a permission prompt", async () => {
    const f = fixture();
    await f.controller.restore();
    expect(f.requests()).toBe(0);
    expect(f.reads).toEqual(["first-account"]);
    expect(f.sent).toEqual([{enabled: true, expectedOwnerId: "first-account", deviceId: DEVICE_ID, deviceEpoch: 1, preferenceFromSettings: false, token: "opaque-fcm-registration-token", locale: "es"}]);
    expect(f.controller.getSnapshot()).toMatchObject({enabled: true, busy: false, delivery: "ready"});
    expect(f.owners.at(-1)).toEqual({uid: "first-account", preferences: {enabled: true}});
  });

  it("retains default On while awaiting OS permission without registering a token", async () => {
    const f = fixture();
    f.setPermission(false);
    await f.controller.restore();
    expect(f.requests()).toBe(0);
    expect(f.tokenReads()).toBe(0);
    expect(f.sent).toEqual([]);
    expect(f.controller.getSnapshot()).toMatchObject({enabled: true, delivery: "permission-required"});
    expect(f.owners.at(-1)?.preferences).toEqual({enabled: false});
  });

  it("preserves saved Off and sends revocation without requiring an FCM token", async () => {
    const f = fixture('{"invitations":false,"daily":false}');
    await f.controller.restore();
    expect(f.requests()).toBe(0);
    expect(f.tokenReads()).toBe(0);
    expect(f.sent).toEqual([{enabled: false, expectedOwnerId: "first-account", deviceId: DEVICE_ID, deviceEpoch: 1, preferenceFromSettings: false}]);
    expect(f.controller.getSnapshot()).toMatchObject({enabled: false, delivery: "inactive"});
  });

  it("honors the authenticated account's saved Off over an absent local preference", async () => {
    const f = fixture();
    f.setRemote(false);
    await f.controller.restore();
    expect(f.controller.getSnapshot()).toMatchObject({enabled: false, delivery: "inactive"});
    expect(f.tokenReads()).toBe(0);
  });

  it("preserves On after an explicit permission denial and permits a later Settings retry", async () => {
    const f = fixture();
    f.setPermission(false);
    expect(await f.controller.requestPermission()).toBe(false);
    expect(f.requests()).toBe(1);
    expect(f.sent).toEqual([{enabled: true, expectedOwnerId: "first-account", deviceId: DEVICE_ID, deviceEpoch: 1, preferenceFromSettings: true}]);
    expect(f.controller.getSnapshot()).toMatchObject({enabled: true, busy: false, delivery: "blocked"});
    expect(f.owners.at(-1)?.preferences).toEqual({enabled: false});
    f.setPermission(true);
    expect(await f.controller.requestPermission()).toBe(true);
    expect(f.controller.getSnapshot().delivery).toBe("ready");
  });

  it("renews a rotated token and acknowledges it without another permission prompt", async () => {
    const f = fixture();
    await f.controller.restore();
    f.setToken("rotated-fcm-registration-token");
    await f.controller.restore();
    expect(f.requests()).toBe(0);
    expect(f.sent.at(-1)).toMatchObject({token: "rotated-fcm-registration-token", expectedOwnerId: "first-account"});
    expect(f.cleared).toEqual(["opaque-fcm-registration-token", "rotated-fcm-registration-token"]);
  });

  it("blocks local delivery and persists Off even when server revocation fails", async () => {
    const f = fixture();
    await f.controller.restore();
    f.setFailure(true);
    expect(await f.controller.setEnabled(false)).toBe(false);
    expect(JSON.parse(f.records.get(KEY) ?? "null")).toEqual({enabled: false});
    expect(f.controller.getSnapshot()).toMatchObject({enabled: false, delivery: "save-failed"});
    expect(f.owners.at(-1)?.preferences).toEqual({enabled: false});
  });

  it("accepts authoritative Off when it changes after a restoration read", async () => {
    const f = fixture();
    let release: () => void = () => undefined;
    f.setPending(new Promise<void>(resolve => {release = resolve;}));
    const restoring = f.controller.restore();
    await flush();
    expect(f.sent).toHaveLength(1);
    f.setRemote(false);
    release();
    await restoring;
    expect(f.controller.getSnapshot()).toMatchObject({enabled: false, busy: false, delivery: "inactive"});
    expect(f.owners.at(-1)?.preferences).toEqual({enabled: false});
    expect(f.cleared).toEqual([]);
  });

  it("does not let a stale foreground restoration restore revoked consent", async () => {
    const f = fixture();
    let release: () => void = () => undefined;
    f.setPending(new Promise<void>(resolve => {release = resolve;}));
    const restoring = f.controller.restore();
    await flush();
    expect(f.sent).toHaveLength(1);
    const disabling = f.controller.setEnabled(false);
    await flush();
    expect(f.sent).toHaveLength(2);
    release();
    await restoring;
    expect(await disabling).toBe(true);
    await flush();
    expect(f.controller.getSnapshot()).toMatchObject({enabled: false, busy: false, delivery: "inactive"});
    expect(f.owners.at(-1)?.preferences).toEqual({enabled: false});
  });

  it("refreshes a rotated token queued during a Settings registration", async () => {
    const f = fixture();
    let release: () => void = () => undefined;
    f.setPending(new Promise<void>(resolve => {release = resolve;}));
    const enabling = f.controller.setEnabled(true);
    await flush();
    expect(f.sent).toHaveLength(1);
    f.setToken("rotated-during-settings-token");
    await f.controller.restore();
    expect(f.sent).toHaveLength(1);
    release();
    expect(await enabling).toBe(true);
    await flush();
    expect(f.sent.at(-1)).toMatchObject({enabled: true, token: "rotated-during-settings-token", preferenceFromSettings: false});
    expect(f.cleared.at(-1)).toBe("rotated-during-settings-token");
    expect(f.controller.getSnapshot()).toMatchObject({enabled: true, busy: false, delivery: "ready"});
  });

  it("does not restore native ownership after its account session retires", async () => {
    const f = fixture();
    let release: () => void = () => undefined;
    f.setPending(new Promise<void>(resolve => {release = resolve;}));
    const enabling = f.controller.setEnabled(true);
    await flush();
    expect(f.sent).toHaveLength(1);
    f.controller.retire();
    release();
    expect(await enabling).toBe(false);
    expect(f.owners).toEqual([]);
    expect(f.cleared).toEqual([]);
  });
});
