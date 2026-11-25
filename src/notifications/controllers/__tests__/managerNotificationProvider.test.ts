import {describe, expect, jest, test} from "@jest/globals";
import type {NotificationPreferenceStore, NotificationSetupLink} from "../../contracts/notificationProvider";
import {createManagerNotificationProvider} from "../managerNotificationProvider";

const link = {url: `https://notifications.example/push/#pair=${"a".repeat(64)}`, expiresAtMs: 1_900_000_000_000};

function deferred<Value>() {
  let complete: (value: Value) => void = () => {throw new Error("Deferred response not initialized");};
  const promise = new Promise<Value>(resolve => {complete = resolve;});
  return {promise, resolve: (value: Value) => complete(value)};
}

function preferenceStore(initialEnabled: boolean): NotificationPreferenceStore {
  let enabled = initialEnabled;
  const listeners = new Set<() => void>();
  return {
    getEnabled: () => enabled,
    setEnabled(next) {enabled = next; listeners.forEach(listener => listener());},
    subscribe(listener) {listeners.add(listener); return () => {listeners.delete(listener);};},
  };
}

function fixture(initialEnabled = true, available = true) {
  const preferences = preferenceStore(initialEnabled);
  const saveConsent = jest.fn<(enabled: boolean) => Promise<boolean>>().mockResolvedValue(true);
  const registerAccount = jest.fn<() => Promise<NotificationSetupLink>>().mockResolvedValue(link);
  const provider = createManagerNotificationProvider({preferences, saveConsent, registerAccount, available});
  return {preferences, saveConsent, registerAccount, provider};
}

describe("manager-owned notification registration", () => {
  test("restores consent without checking devices or issuing a handoff", async () => {
    const {provider, saveConsent, registerAccount} = fixture();
    try {
      await provider.restore();
      expect(provider.kind).toBe("manager");
      expect(provider.getSnapshot()).toEqual({kind: "manager", enabled: true, busy: false, registration: {kind: "available"}});
      expect(saveConsent).not.toHaveBeenCalled();
      expect(registerAccount).not.toHaveBeenCalled();
      expect("requestPermission" in provider).toBe(false);
      expect("recordActivity" in provider).toBe(false);
      expect("delivery" in provider.getSnapshot()).toBe(false);
    } finally {provider.retire();}
  });

  test("saves consent before publishing a registration handoff without claiming delivery readiness", async () => {
    const {provider, preferences, saveConsent, registerAccount} = fixture(false);
    try {
      await expect(provider.register()).resolves.toBe(true);
      expect(preferences.getEnabled()).toBe(true);
      expect(saveConsent).toHaveBeenCalledWith(true);
      expect(registerAccount.mock.invocationCallOrder[0]).toBeGreaterThan(saveConsent.mock.invocationCallOrder[0]);
      expect(provider.getSnapshot()).toEqual({kind: "manager", enabled: true, busy: false, registration: {kind: "handoff", link}});
      expect("delivery" in provider.getSnapshot()).toBe(false);
    } finally {provider.retire();}
  });

  test("separates failed account consent from failed manager registration", async () => {
    const {provider, saveConsent, registerAccount} = fixture();
    try {
      saveConsent.mockResolvedValueOnce(false);
      await expect(provider.register()).resolves.toBe(false);
      expect(registerAccount).not.toHaveBeenCalled();
      expect(provider.getSnapshot().registration).toEqual({kind: "failed", operation: "consent"});
      registerAccount.mockRejectedValueOnce(new Error("Manager unavailable"));
      await expect(provider.register()).resolves.toBe(false);
      expect(provider.getSnapshot().registration).toEqual({kind: "failed", operation: "registration"});
      await expect(provider.register()).resolves.toBe(true);
    } finally {provider.retire();}
  });

  test("does not register or change account consent when the capability is unavailable", async () => {
    const {provider, saveConsent, registerAccount} = fixture(true, false);
    try {
      await expect(provider.register()).resolves.toBe(false);
      await expect(provider.setEnabled(false)).resolves.toBe(false);
      expect(provider.getSnapshot().registration).toEqual({kind: "unavailable"});
      expect(saveConsent).not.toHaveBeenCalled();
      expect(registerAccount).not.toHaveBeenCalled();
    } finally {provider.retire();}
  });

  test("turning Off clears a handoff and invalidates a pending replacement", async () => {
    const {provider, registerAccount} = fixture();
    try {
      await provider.register();
      const replacement = deferred<NotificationSetupLink>();
      const started = deferred<void>();
      registerAccount.mockImplementationOnce(() => {started.resolve(); return replacement.promise;});
      const pending = provider.register();
      await started.promise;
      await expect(provider.setEnabled(false)).resolves.toBe(true);
      expect(provider.getSnapshot()).toMatchObject({enabled: false, busy: false, registration: {kind: "available"}});
      replacement.resolve({...link, url: `https://notifications.example/push/#pair=${"b".repeat(64)}`});
      await expect(pending).resolves.toBe(false);
      expect(provider.getSnapshot()).toMatchObject({enabled: false, busy: false, registration: {kind: "available"}});
    } finally {provider.retire();}
  });

  test("serializes a newer Off write after an already-started On write", async () => {
    const {provider, saveConsent, registerAccount} = fixture(false);
    try {
      const savingOn = deferred<boolean>();
      const started = deferred<void>();
      saveConsent.mockImplementationOnce(() => {started.resolve(); return savingOn.promise;});
      const registering = provider.register();
      await started.promise;
      const disabling = provider.setEnabled(false);
      expect(saveConsent.mock.calls).toEqual([[true]]);
      savingOn.resolve(true);
      await expect(registering).resolves.toBe(false);
      await expect(disabling).resolves.toBe(true);
      expect(saveConsent.mock.calls).toEqual([[true], [false]]);
      expect(registerAccount).not.toHaveBeenCalled();
      expect(provider.getSnapshot()).toMatchObject({enabled: false, busy: false});
    } finally {provider.retire();}
  });

  test("retirement cannot publish an old handoff or unlock a newer registration", async () => {
    const {provider, registerAccount} = fixture();
    try {
      const oldResponse = deferred<NotificationSetupLink>(), nextResponse = deferred<NotificationSetupLink>();
      const oldStarted = deferred<void>(), nextStarted = deferred<void>();
      registerAccount.mockImplementationOnce(() => {oldStarted.resolve(); return oldResponse.promise;})
        .mockImplementationOnce(() => {nextStarted.resolve(); return nextResponse.promise;});
      const oldRegistration = provider.register();
      await oldStarted.promise;
      provider.retire();
      expect(provider.getSnapshot()).toMatchObject({busy: false, registration: {kind: "unavailable"}});
      await provider.restore();
      const nextRegistration = provider.register();
      await nextStarted.promise;
      oldResponse.resolve(link);
      await expect(oldRegistration).resolves.toBe(false);
      expect(provider.getSnapshot()).toMatchObject({busy: true, registration: {kind: "available"}});
      await expect(provider.register()).resolves.toBe(false);
      nextResponse.resolve(link);
      await expect(nextRegistration).resolves.toBe(true);
    } finally {provider.retire();}
  });

  test("a rejected local preference mutation clears busy and cannot issue a handoff", async () => {
    const saveConsent = jest.fn<(enabled: boolean) => Promise<boolean>>().mockResolvedValue(true);
    const registerAccount = jest.fn<() => Promise<NotificationSetupLink>>().mockResolvedValue(link);
    const provider = createManagerNotificationProvider({preferences: {
      getEnabled: () => false,
      setEnabled: () => {throw new Error("Account retired");},
      subscribe: () => () => {},
    }, saveConsent, registerAccount, available: true});
    try {
      await expect(provider.register()).resolves.toBe(false);
      expect(provider.getSnapshot()).toMatchObject({enabled: false, busy: false, registration: {kind: "failed", operation: "consent"}});
      expect(saveConsent).not.toHaveBeenCalled();
      expect(registerAccount).not.toHaveBeenCalled();
    } finally {provider.retire();}
  });
});
