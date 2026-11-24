import {trackEvent} from "../../observability/analytics/events";
import {createContext, createElement, useCallback, useContext, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode} from "react";
import type {NotificationProvider, NotificationSnapshot} from "../contracts/notificationProvider";

type NotificationSettingsState = NotificationSnapshot & {
  change(enabled: boolean): Promise<boolean>;
  requestPermission(): Promise<boolean>;
};

/** Settings observes one selected provider, which owns preference and delivery state. */
function useNotificationSettingsState(provider?: NotificationProvider | null): NotificationSettingsState | null {
  /** A replaced provider cannot attribute an old permission result to the new visit. */
  const lifetime = useMemo(() => ({active: false}), [provider]);
  useLayoutEffect(() => {
    lifetime.active = true;
    void provider?.restore().catch(() => {
      if (lifetime.active) trackEvent("notification_preference_restore_failed");
    });
    return () => {lifetime.active = false; provider?.retire();};
  }, [lifetime, provider]);
  const subscribe = useCallback((listener: () => void) => provider?.subscribe(listener) ?? (() => {}), [provider]);
  const getSnapshot = useCallback(() => provider?.getSnapshot() ?? null, [provider]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const change = async (next: boolean): Promise<boolean> => {
    if (!provider) return false;
    if (lifetime.active) trackEvent("notification_preference_requested", {enabled: next});
    try {
      const saved = await provider.setEnabled(next);
      if (lifetime.active) trackEvent("notification_preference_result", {enabled: next, success: saved});
      return saved;
    } catch {
      if (lifetime.active) trackEvent("notification_preference_result", {enabled: next, success: false});
      return false;
    }
  };
  return snapshot && provider ? {...snapshot, change, requestPermission: () => provider.requestPermission()} : null;
}

/** The active account owns notification updates across modal navigation. */
const NotificationSettingsContext = createContext<NotificationSettingsState | null>(null);

/** Keeps notification state independent of referral sharing and multiplayer. */
export function NotificationSettingsProvider({provider, children}: {
  /** Only targets with notification delivery expose the Settings row. */
  provider?: NotificationProvider | null;
  /** Shared game and Settings content. */
  children: ReactNode;
}) {
  const state = useNotificationSettingsState(provider);
  return createElement(NotificationSettingsContext.Provider, {value: state}, children);
}

/** Reads the global notification preference exposed in Settings. */
export function useNotificationSettings() {return useContext(NotificationSettingsContext);}
