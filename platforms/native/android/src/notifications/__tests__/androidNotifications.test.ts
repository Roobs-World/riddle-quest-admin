import {describe, expect, it} from "@jest/globals";
import {
  createAndroidNotificationController,
  parseAndroidNotificationPreferences,
  type AndroidNotificationPreferences,
} from "../androidNotificationController";

/** Real async ports retain device consent and account bindings without invoking a provider SDK. */
function fixture() {
  /** In-memory app-private preference records for this consent scenario. */
  const records = new Map<string, string>(),
    sent: Array<
      AndroidNotificationPreferences & {
        /** Opaque provider token, never a local grant or account selector. */
        token: string;
        /** Supported recipient language used for notification or referral copy. */
        locale: string;
      }
    > = [];
  /** Native account and consent changes observed by the fixture. */
  const owners: Array<{
    /** Authenticated game account that owns this operation. */
    uid: string;
    /** Explicit invitation and Daily consent for the current game account. */
    preferences: AndroidNotificationPreferences;
  }> = [];
  /** Scripted Android permission decision and provider failure state. */
  let permission = true,
    token = "opaque-fcm-registration-token",
    requests = 0,
    fail = false;
  /** Deferred provider response used to control concurrent completion order. */
  let pending: Promise<unknown> = Promise.resolve();
  /** Account-owned controller coordinating the device and authoritative backend. */
  const controller = createAndroidNotificationController({
    uid: "first-account",
    locale: "es",
    device: {
      requestPermission: async () => {
        requests += 1;
        return permission;
      },
      hasPermission: async () => permission,
      configure: async () => undefined,
      getToken: async () => token,
      setAccount: async (uid, preferences) => {
        owners.push({uid, preferences});
      },
    },
    backend: {
      /** Records explicit native consent at the authenticated backend boundary. */
      async setSubscription(input) {
        if (fail) throw new Error("network-unavailable");
        sent.push(input);
        await pending;
        return {invitations: input.invitations, daily: input.daily};
      },
    },
    storage: {
      getItem: async (key) => records.get(key) ?? null,
      setItem: async (key, value) => {
        records.set(key, value);
      },
    },
  });
  return {
    controller,
    records,
    sent,
    owners,
    /** Changes the next Android permission decision in this scenario. */
    setPermission(value: boolean) {
      permission = value;
    },
    /** Replaces the provider registration token to simulate SDK rotation. */
    setToken(value: string) {
      token = value;
    },
    /** Makes the provider boundary unavailable without changing local consent. */
    setFailure(value: boolean) {
      fail = value;
    },
    /** Defers the next provider reply so the scenario can retire or replace its owner. */
    setPending(value: Promise<unknown>) {
      pending = value;
    },
    requests: () => requests,
  };
}

describe("Android notification consent", () => {
  it("never infers consent from missing, malformed or wrongly typed storage", () => {
    for (const value of [null, "broken", "null", "{}", '{"invitations":"yes","daily":true}'])
      expect(parseAndroidNotificationPreferences(value)).toEqual({invitations: false, daily: false});
  });
  it("opens quietly with no permission prompt, token registration or default consent", async () => {
    /** Device, storage and backend ports owned by this consent scenario. */
    const f = fixture();
    await f.controller.refresh();
    expect(f.requests()).toBe(0);
    expect(f.sent).toEqual([]);
    expect(f.owners.at(-1)?.preferences).toEqual({invitations: false, daily: false});
  });
  it("registers only after permission and persists the exact selected consent", async () => {
    /** Device, storage and backend ports owned by this consent scenario. */
    const f = fixture();
    await f.controller.update({invitations: true, daily: false});
    expect(f.requests()).toBe(1);
    expect(f.sent).toEqual([{token: "opaque-fcm-registration-token", locale: "es", invitations: true, daily: false}]);
    expect(await f.controller.read()).toEqual({invitations: true, daily: false});
  });
  it("refuses denied permission without persisting opt-in or contacting the backend", async () => {
    /** Device, storage and backend ports owned by this consent scenario. */
    const f = fixture();
    f.setPermission(false);
    await expect(f.controller.update({invitations: true, daily: true})).rejects.toThrow(
      "notification-permission-denied",
    );
    expect(f.sent).toEqual([]);
    expect(await f.controller.read()).toEqual({invitations: false, daily: false});
  });
  it("renews a rotated token without another permission prompt", async () => {
    /** Device, storage and backend ports owned by this consent scenario. */
    const f = fixture();
    await f.controller.update({invitations: true, daily: true});
    f.setToken("rotated-fcm-registration-token");
    await f.controller.refresh();
    expect(f.requests()).toBe(1);
    expect(f.sent.at(-1)?.token).toBe("rotated-fcm-registration-token");
  });
  it("blocks local notification delivery and persists revocation even during a network failure", async () => {
    /** Device, storage and backend ports owned by this consent scenario. */
    const f = fixture();
    await f.controller.update({invitations: true, daily: true});
    f.setFailure(true);
    await expect(f.controller.update({invitations: false, daily: false})).rejects.toThrow("network-unavailable");
    expect(await f.controller.read()).toEqual({invitations: false, daily: false});
    expect(f.owners.at(-1)?.preferences).toEqual({invitations: false, daily: false});
  });
  it("does not let a stale foreground refresh restore revoked consent", async () => {
    /** Device, storage and backend ports owned by this consent scenario. */
    const f = fixture();
    await f.controller.update({invitations: true, daily: true});
    /** Completes the deliberately delayed provider request. */
    let release: (() => void) | undefined;
    f.setPending(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    /** Foreground renewal started before the player changed consent. */
    const refreshing = f.controller.refresh();
    while (f.sent.length < 2) await Promise.resolve();
    /** Explicit revocation that must supersede older token renewal. */
    const disabling = f.controller.update({invitations: false, daily: false});
    while (f.sent.length < 3) await Promise.resolve();
    release?.();
    await expect(refreshing).rejects.toThrow("notification-account-changed");
    await disabling;
    expect(f.owners.at(-1)?.preferences).toEqual({invitations: false, daily: false});
  });
  it("does not restore an old native owner after its account session ends", async () => {
    /** Device, storage and backend ports owned by this consent scenario. */
    const f = fixture();
    /** Completes the deliberately delayed provider request. */
    let release: (() => void) | undefined;
    f.setPending(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    /** In-flight enable request whose owner can be retired. */
    const updating = f.controller.update({invitations: true, daily: true});
    while (!f.sent.length) await Promise.resolve();
    f.controller.invalidate();
    release?.();
    await expect(updating).rejects.toThrow("notification-account-changed");
    expect(f.owners).toEqual([]);
    expect(f.records.size).toBe(0);
  });
});
