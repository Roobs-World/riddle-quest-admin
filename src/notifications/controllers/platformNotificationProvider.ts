import type {NotificationActivity, NotificationDelivery, NotificationPreferenceStore, NotificationProvider, NotificationSnapshot} from "../contracts/notificationProvider";

/** Adapts a required platform API to the same observable lifecycle as hosted delivery. */
export function createPlatformNotificationProvider({preferences, applyEnabled, applyPermission, restoreDelivery, recordActivity}: {
  preferences: NotificationPreferenceStore;
  applyEnabled(enabled: boolean): Promise<boolean>;
  applyPermission?: () => Promise<boolean>;
  restoreDelivery?: () => Promise<NotificationDelivery>;
  recordActivity?: (activity: NotificationActivity) => Promise<void>;
}): NotificationProvider {
  let active = true;
  let generation = 0;
  let changing = false;
  let stopPreferences: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const uncheckedDelivery = restoreDelivery ? "permission-required" : "ready";
  let snapshot: NotificationSnapshot = {
    enabled: preferences.getEnabled(), busy: false, delivery: preferences.getEnabled() ? uncheckedDelivery : "inactive",
  };
  const publish = (next: NotificationSnapshot) => {
    if (next.enabled === snapshot.enabled && next.busy === snapshot.busy && next.delivery === snapshot.delivery) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const preferenceChanged = () => {
    const enabled = preferences.getEnabled();
    publish({...snapshot, enabled, delivery: enabled ? snapshot.delivery === "inactive" ? uncheckedDelivery : snapshot.delivery : "inactive"});
  };
  const setEnabled = async (enabled: boolean, permission = false): Promise<boolean> => {
    if (!active || changing) return false;
    changing = true;
    const operation = ++generation;
    try {
      publish({...snapshot, busy: true});
      preferences.setEnabled(enabled);
      publish({enabled: preferences.getEnabled(), busy: true, delivery: enabled ? snapshot.delivery : "inactive"});
      const saved = await (permission && applyPermission ? applyPermission() : applyEnabled(enabled));
      if (!active || operation !== generation) return false;
      const delivery = saved && enabled && restoreDelivery ? await restoreDelivery() : uncheckedDelivery;
      if (!active || operation !== generation) return false;
      const currentEnabled = preferences.getEnabled();
      const ownsPreference = currentEnabled === enabled;
      publish({enabled: currentEnabled, busy: false,
        delivery: !ownsPreference ? currentEnabled ? uncheckedDelivery : "inactive" : saved ? enabled ? delivery : "inactive" : "save-failed"});
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
      publish({enabled, busy: false, delivery: enabled ? uncheckedDelivery : "inactive"});
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
          publish({...snapshot, enabled: currentEnabled, delivery: currentEnabled ? "not-configured" : "inactive"});
        }
      }
    },
    setEnabled,
    requestPermission: () => setEnabled(true, true),
    async recordActivity(activity) {
      if (!active) return;
      if (recordActivity) await recordActivity(activity);
      if (!active || changing || !restoreDelivery || !preferences.getEnabled()) return;
      const operation = generation;
      try {
        const delivery = await restoreDelivery();
        if (active && !changing && operation === generation && preferences.getEnabled()) publish({...snapshot, delivery});
      } catch {
        if (active && !changing && operation === generation && preferences.getEnabled()) publish({...snapshot, delivery: "not-configured"});
      }
    },
    retire() {
      active = false;
      generation += 1;
      stopPreferences?.();
      stopPreferences = undefined;
    },
  };
}
