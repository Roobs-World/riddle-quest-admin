import {describe, expect, jest, test} from "@jest/globals";
import type {NotificationPreferenceStore} from "../../contracts/notificationProvider";
import {createManagerNotificationProvider} from "../managerNotificationProvider";

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
  const provider = createManagerNotificationProvider({preferences, saveConsent, available});
  return {preferences, saveConsent, provider};
}

describe("native notification account preference", () => {
  test("restores the saved opt-out without performing any server write", async () => {
    const {provider, saveConsent} = fixture(false);
    await provider.restore();
    expect(provider.getSnapshot()).toMatchObject({enabled: false, available: true});
    expect(saveConsent).not.toHaveBeenCalled();
    expect("register" in provider).toBe(false);
    expect("requestPermission" in provider).toBe(false);
    provider.retire();
  });

  test("guests cannot change account consent", async () => {
    const {provider, saveConsent} = fixture(true, false);
    await expect(provider.setEnabled(false)).resolves.toBe(false);
    expect(saveConsent).not.toHaveBeenCalled();
  });

  test("restores the previous setting on failure so the same change can be retried", async () => {
    const {provider, preferences, saveConsent} = fixture();
    await provider.restore();
    saveConsent.mockResolvedValueOnce(false);
    await expect(provider.setEnabled(false)).resolves.toBe(false);
    expect(provider.getSnapshot()).toMatchObject({enabled: true, busy: false, saveFailed: true});
    expect(preferences.getEnabled()).toBe(true);
    await expect(provider.setEnabled(false)).resolves.toBe(true);
    expect(provider.getSnapshot()).toMatchObject({enabled: false, saveFailed: false});
    provider.retire();
  });

  test("serializes an opt-out after an in-flight opt-in", async () => {
    const {provider, saveConsent} = fixture(false);
    const saving = deferred<boolean>(), started = deferred<void>();
    saveConsent.mockImplementationOnce(() => {started.resolve(); return saving.promise;});
    const on = provider.setEnabled(true);
    await started.promise;
    const off = provider.setEnabled(false);
    saving.resolve(true);
    await expect(on).resolves.toBe(false);
    await expect(off).resolves.toBe(true);
    expect(saveConsent.mock.calls).toEqual([[true], [false]]);
    expect(provider.getSnapshot().enabled).toBe(false);
  });
});
