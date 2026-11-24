import type {NotificationActivity, NotificationDelivery, NotificationPreferenceStore, NotificationProvider, NotificationSnapshot} from "../contracts/notificationProvider";

/** Adapts a required platform API to the same observable lifecycle as hosted delivery. */
export function createPlatformNotificationProvider({preferences, applyEnabled, restoreDelivery, recordActivity}: {
  preferences: NotificationPreferenceStore;
  applyEnabled(enabled: boolean): Promise<boolean>;
  restoreDelivery?: () => Promise<NotificationDelivery>;
  recordActivity?: (activity: NotificationActivity) => Promise<void>;
}): NotificationProvider {
  let active = true;
  let generation = 0;
  let changing = false;
  let stopPreferences: (() => void) | undefined;
  const listeners = new Set<() => void>();
  let snapshot: NotificationSnapshot = {
    enabled: preferences.getEnabled(), busy: false, delivery: preferences.getEnabled() ? "ready" : "inactive",
  };
  const publish = (next: NotificationSnapshot) => {
    if (next.enabled === snapshot.enabled && next.busy === snapshot.busy && next.delivery === snapshot.delivery) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const preferenceChanged = () => {
    const enabled = preferences.getEnabled();
    publish({...snapshot, enabled, delivery: enabled ? snapshot.delivery === "inactive" ? "ready" : snapshot.delivery : "inactive"});
  };
  const setEnabled = async (enabled: boolean): Promise<boolean> => {
    if (!active || changing) return false;
    changing = true;
    const operation = ++generation;
    try {
      publish({...snapshot, busy: true});
      preferences.setEnabled(enabled);
      publish({enabled: preferences.getEnabled(), busy: true, delivery: enabled ? snapshot.delivery : "inactive"});
      const saved = await applyEnabled(enabled);
      if (!active || operation !== generation) return false;
      const currentEnabled = preferences.getEnabled();
      const ownsPreference = currentEnabled === enabled;
      publish({enabled: currentEnabled, busy: false,
        delivery: !ownsPreference ? currentEnabled ? "ready" : "inactive" : saved ? enabled ? "ready" : "inactive" : "save-failed"});
      return saved && ownsPreference;
    } catch {
      if (active && operation === generation) publish({enabled: preferences.getEnabled(), busy: false, delivery: "save-failed"});
      return false;
    } finally {
      if (operation === generation) changing = false;
    }
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {listeners.add(listener); return () => {listeners.delete(listener);};},
    async restore() {
      active = true;
      changing = false;
      const operation = ++generation;
      stopPreferences?.();
      stopPreferences = preferences.subscribe(preferenceChanged);
      const enabled = preferences.getEnabled();
      publish({enabled, busy: false, delivery: enabled ? "ready" : "inactive"});
      if (!enabled || !restoreDelivery) return;
      try {
        const delivery = await restoreDelivery();
        if (active && operation === generation) {
          const currentEnabled = preferences.getEnabled();
          publish({...snapshot, enabled: currentEnabled, delivery: currentEnabled ? delivery : "inactive"});
        }
      } catch {
        if (active && operation === generation) {
          const currentEnabled = preferences.getEnabled();
          publish({...snapshot, enabled: currentEnabled, delivery: currentEnabled ? "unsupported" : "inactive"});
        }
      }
    },
    setEnabled,
    requestPermission: () => setEnabled(true),
    async recordActivity(activity) {if (active && recordActivity) await recordActivity(activity);},
    retire() {
      active = false;
      generation += 1;
      stopPreferences?.();
      stopPreferences = undefined;
    },
  };
}
