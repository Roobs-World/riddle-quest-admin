import type {
  ManagerNotificationProvider,
  ManagerNotificationSnapshot,
  NotificationPreferenceStore,
} from "../contracts/notificationProvider";

/** Edits the Firebase account preference independently of native device enrollment. */
export function createManagerNotificationProvider({preferences, saveConsent, available}: {
  preferences: NotificationPreferenceStore;
  saveConsent(enabled: boolean): Promise<boolean>;
  available: boolean;
}): ManagerNotificationProvider {
  let active = true;
  let generation = 0;
  let stopPreferences: (() => void) | undefined;
  let pending = Promise.resolve();
  const listeners = new Set<() => void>();
  let snapshot: ManagerNotificationSnapshot = {
    kind: "manager", enabled: preferences.getEnabled(), available, busy: false, saveFailed: false,
  };
  const publish = (enabled: boolean, busy = false, saveFailed = false) => {
    snapshot = {kind: "manager", enabled, available: active && available, busy, saveFailed};
    listeners.forEach(listener => listener());
  };
  return {
    kind: "manager",
    getSnapshot: () => snapshot,
    subscribe(listener) {listeners.add(listener); return () => {listeners.delete(listener);};},
    async restore() {
      active = true;
      generation++;
      stopPreferences?.();
      stopPreferences = preferences.subscribe(() => {
        const enabled = preferences.getEnabled();
        if (snapshot.enabled !== enabled) {
          generation++;
          publish(enabled);
        }
      });
      publish(preferences.getEnabled());
    },
    async setEnabled(enabled) {
      if (!active || !available) return false;
      const previous = preferences.getEnabled();
      const operation = ++generation;
      const current = () => active && generation === operation;
      publish(enabled, true);
      try {
        preferences.setEnabled(enabled);
        const write = pending.then(() => current() ? saveConsent(enabled) : false);
        pending = write.then(() => undefined, () => undefined);
        if (await write && current()) {
          publish(enabled);
          return true;
        }
      } catch {
        // Settings offers the same switch again after restoring the prior value.
      }
      if (current()) {
        publish(previous, false, true);
        if (preferences.getEnabled() !== previous) preferences.setEnabled(previous);
      }
      return false;
    },
    retire() {
      active = false;
      generation++;
      stopPreferences?.();
      stopPreferences = undefined;
      publish(preferences.getEnabled());
    },
  };
}
