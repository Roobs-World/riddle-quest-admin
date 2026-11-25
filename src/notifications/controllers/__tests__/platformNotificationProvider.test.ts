import {describe, expect, jest, test} from "@jest/globals";
import type {NotificationDelivery, NotificationPreferenceStore} from "../../contracts/notificationProvider";
import {createPlatformNotificationProvider} from "../platformNotificationProvider";

/** Uses the same observable preference contract as the platform adapters. */
function preferenceStore(initialEnabled: boolean): NotificationPreferenceStore {
  let enabled = initialEnabled;
  const listeners = new Set<() => void>();
  return {
    getEnabled: () => enabled,
    setEnabled(next) {
      enabled = next;
      listeners.forEach(listener => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {listeners.delete(listener);};
    },
  };
}

describe("platform notification preference and delivery", () => {
  test("keeps a saved preference successful when delivery status is unavailable", async () => {
    const preferences = preferenceStore(false);
    const applyEnabled = jest.fn<(enabled: boolean) => Promise<boolean>>().mockResolvedValue(true);
    const provider = createPlatformNotificationProvider({
      preferences,
      applyEnabled,
      restoreDelivery: async () => {throw new Error("Status unavailable");},
    });
    try {
      await expect(provider.setEnabled(true)).resolves.toBe(true);
      expect(applyEnabled).toHaveBeenCalledWith(true);
      expect(preferences.getEnabled()).toBe(true);
      expect(provider.getSnapshot()).toMatchObject({enabled: true, busy: false, delivery: "not-configured"});
    } finally {provider.retire();}
  });

  test("reports a rejected setup action separately from a preference save failure", async () => {
    const applyEnabled = jest.fn<(enabled: boolean) => Promise<boolean>>().mockResolvedValue(true);
    const applyPermission = jest.fn<() => Promise<boolean>>().mockResolvedValue(false);
    const provider = createPlatformNotificationProvider({preferences: preferenceStore(true), applyEnabled, applyPermission});
    try {
      await expect(provider.requestPermission()).resolves.toBe(false);
      expect(applyPermission).toHaveBeenCalledTimes(1);
      expect(applyEnabled).not.toHaveBeenCalled();
      expect(provider.getSnapshot()).toMatchObject({enabled: true, busy: false, delivery: "setup-failed"});
    } finally {provider.retire();}
  });

  test("retains the save failure state when the preference write itself fails", async () => {
    const provider = createPlatformNotificationProvider({
      preferences: preferenceStore(false),
      applyEnabled: async () => false,
    });
    try {
      await expect(provider.setEnabled(true)).resolves.toBe(false);
      expect(provider.getSnapshot()).toMatchObject({busy: false, delivery: "save-failed"});
    } finally {provider.retire();}
  });

  test("keeps startup busy until the initial delivery status settles", async () => {
    let completeStatus: ((delivery: NotificationDelivery) => void) | undefined;
    const status = new Promise<NotificationDelivery>(resolve => {completeStatus = resolve;});
    const provider = createPlatformNotificationProvider({
      preferences: preferenceStore(true),
      applyEnabled: async () => true,
      restoreDelivery: () => status,
    });
    try {
      expect(provider.getSnapshot().busy).toBe(true);
      const restoring = provider.restore();
      expect(provider.getSnapshot().busy).toBe(true);
      completeStatus?.("permission-required");
      await restoring;
      expect(provider.getSnapshot()).toMatchObject({enabled: true, busy: false, delivery: "permission-required"});
    } finally {provider.retire();}
  });

  test("clears startup busy state when delivery status fails", async () => {
    let rejectStatus: ((reason: Error) => void) | undefined;
    const status = new Promise<NotificationDelivery>((_resolve, reject) => {rejectStatus = reject;});
    const provider = createPlatformNotificationProvider({
      preferences: preferenceStore(true),
      applyEnabled: async () => true,
      restoreDelivery: () => status,
    });
    try {
      const restoring = provider.restore();
      expect(provider.getSnapshot().busy).toBe(true);
      rejectStatus?.(new Error("Status unavailable"));
      await restoring;
      expect(provider.getSnapshot()).toMatchObject({enabled: true, busy: false, delivery: "not-configured"});
    } finally {provider.retire();}
  });

  test("exposes the manual setup link until a later status refresh confirms delivery", async () => {
    const setupLink = {url: `https://notifications.example/push/#pair=${"a".repeat(64)}`, expiresAtMs: Date.now() + 60_000};
    let delivery: NotificationDelivery = "permission-required";
    const provider = createPlatformNotificationProvider({
      preferences: preferenceStore(true),
      applyEnabled: async () => true,
      applyPermission: async () => true,
      restoreDelivery: async () => delivery,
      getSetupLink: () => setupLink,
    });
    try {
      await expect(provider.requestPermission()).resolves.toBe(true);
      expect(provider.getSnapshot()).toMatchObject({delivery: "permission-required", setupLink});
      delivery = "ready";
      await provider.recordActivity({locale: "en"});
      expect(provider.getSnapshot().delivery).toBe("ready");
      expect(provider.getSnapshot().setupLink).toBeUndefined();
    } finally {provider.retire();}
  });

  test("retirement clears the cached setup link and busy state before pending setup settles", async () => {
    const setupLink = {url: `https://notifications.example/push/#pair=${"a".repeat(64)}`, expiresAtMs: Date.now() + 60_000};
    let completePermission: ((saved: boolean) => void) | undefined;
    const pendingPermission = new Promise<boolean>(resolve => {completePermission = resolve;});
    const getSetupLink = jest.fn(() => setupLink);
    const applyPermission = jest.fn<() => Promise<boolean>>().mockResolvedValueOnce(true).mockReturnValueOnce(pendingPermission);
    const provider = createPlatformNotificationProvider({
      preferences: preferenceStore(true),
      applyEnabled: async () => true,
      applyPermission,
      restoreDelivery: async () => "permission-required",
      getSetupLink,
    });
    try {
      await provider.requestPermission();
      expect(provider.getSnapshot().setupLink).toEqual(setupLink);
      const permission = provider.requestPermission();
      expect(provider.getSnapshot()).toMatchObject({busy: true, setupLink});

      provider.retire();

      expect(getSetupLink()).toEqual(setupLink);
      expect(provider.getSnapshot().busy).toBe(false);
      expect(provider.getSnapshot().setupLink).toBeUndefined();
      completePermission?.(true);
      await expect(permission).resolves.toBe(false);
      expect(provider.getSnapshot().busy).toBe(false);
      expect(provider.getSnapshot().setupLink).toBeUndefined();
    } finally {provider.retire();}
  });
});
