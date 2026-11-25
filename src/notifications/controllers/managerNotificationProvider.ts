import type {
  ManagerNotificationProvider,
  ManagerNotificationRegistration,
  ManagerNotificationSnapshot,
  NotificationPreferenceStore,
  NotificationSetupLink,
} from "../contracts/notificationProvider";

/** Registers account consent and a manager handoff without observing device delivery. */
export function createManagerNotificationProvider({preferences, saveConsent, registerAccount, available}: {
  preferences: NotificationPreferenceStore;
  saveConsent(enabled: boolean): Promise<boolean>;
  registerAccount(): Promise<NotificationSetupLink>;
  available: boolean;
}): ManagerNotificationProvider {
  const idleRegistration: ManagerNotificationRegistration = available ? {kind: "available"} : {kind: "unavailable"};
  let active = true;
  let generation = 0;
  let changing = false;
  let stopPreferences: (() => void) | undefined;
  let pendingConsent: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();
  let snapshot: ManagerNotificationSnapshot = {
    kind: "manager", enabled: preferences.getEnabled(), busy: false, registration: idleRegistration,
  };
  const publish = (next: ManagerNotificationSnapshot) => {
    if (next.enabled === snapshot.enabled && next.busy === snapshot.busy && next.registration === snapshot.registration) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const observes = (operation: number) => active && operation === generation;
  const owns = (operation: number, enabled: boolean) => observes(operation) && preferences.getEnabled() === enabled;
  const persistConsent = (enabled: boolean, operation: number): Promise<boolean> => {
    const saved = pendingConsent.then(() => owns(operation, enabled) ? saveConsent(enabled) : false);
    pendingConsent = saved.then(() => undefined, () => undefined);
    return saved;
  };
  const preferenceChanged = () => {
    const enabled = preferences.getEnabled();
    if (enabled === snapshot.enabled) return;
    generation += 1;
    changing = false;
    publish({kind: "manager", enabled, busy: false, registration: idleRegistration});
  };
  const begin = (enabled: boolean) => {
    changing = true;
    const operation = ++generation;
    publish({kind: "manager", enabled, busy: true, registration: idleRegistration});
    return operation;
  };
  const fail = (operation: number, failedOperation: "consent" | "registration") => {
    if (observes(operation)) publish({kind: "manager", enabled: preferences.getEnabled(), busy: false,
      registration: {kind: "failed", operation: failedOperation}});
  };
  return {
    kind: "manager",
    getSnapshot: () => snapshot,
    subscribe(listener) {listeners.add(listener); return () => {listeners.delete(listener);};},
    async restore() {
      active = true;
      generation += 1;
      changing = false;
      stopPreferences?.();
      stopPreferences = preferences.subscribe(preferenceChanged);
      publish({kind: "manager", enabled: preferences.getEnabled(), busy: false, registration: idleRegistration});
    },
    async setEnabled(enabled) {
      if (!active || !available || changing && enabled) return false;
      let operation = generation;
      try {
        operation = begin(enabled);
        preferences.setEnabled(enabled);
        const saved = await persistConsent(enabled, operation);
        if (!owns(operation, enabled)) {
          fail(operation, "consent");
          return false;
        }
        publish({kind: "manager", enabled, busy: false,
          registration: saved ? idleRegistration : {kind: "failed", operation: "consent"}});
        return saved;
      } catch {
        fail(operation, "consent");
        return false;
      } finally {if (observes(operation)) changing = false;}
    },
    async register() {
      if (!active || !available || changing) return false;
      let operation = generation;
      let failedOperation: "consent" | "registration" = "consent";
      try {
        operation = begin(true);
        preferences.setEnabled(true);
        const saved = await persistConsent(true, operation);
        if (!owns(operation, true)) {
          fail(operation, "consent");
          return false;
        }
        if (!saved) {fail(operation, "consent"); return false;}
        failedOperation = "registration";
        const link = await registerAccount();
        if (!owns(operation, true)) {fail(operation, "consent"); return false;}
        publish({kind: "manager", enabled: true, busy: false, registration: {kind: "handoff", link}});
        return true;
      } catch {
        fail(operation, failedOperation);
        return false;
      } finally {if (observes(operation)) changing = false;}
    },
    retire() {
      active = false;
      generation += 1;
      changing = false;
      stopPreferences?.();
      stopPreferences = undefined;
      publish({kind: "manager", enabled: preferences.getEnabled(), busy: false, registration: {kind: "unavailable"}});
    },
  };
}
