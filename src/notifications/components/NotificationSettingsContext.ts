import {trackEvent} from "../../observability/analytics/events";
import {createContext, createElement, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode} from "react";
import type {NotificationSettingsCapability} from "../contracts/notificationSettings";
import {isPlayerNotificationsEnabled, setPlayerNotificationsEnabled, subscribeToPlayerNotifications} from "../../settings/browser/playerPreferences";

/** Saved master preference and operation lock for the Settings notification row. */
function useNotificationSettingsState(capability?: NotificationSettingsCapability | null) {
  /** A replaced provider cannot attribute an old permission result to the new visit. */
  const lifetime = useMemo(() => ({active: false}), [capability]);
  useLayoutEffect(() => {
    lifetime.active = true;
    return () => {lifetime.active = false;};
  }, [lifetime]);
  const enabled = useSyncExternalStore(subscribeToPlayerNotifications, isPlayerNotificationsEnabled, () => true);
  /** A pending provider operation survives modal navigation. */
  const [busy, setBusy] = useState(false);
  /** A failed provider update leaves the player's desired preference visible. */
  const [unavailable, setUnavailable] = useState(false);
  /** Immediate operation lock prevents duplicate clicks. */
  const lock = useRef(false);
  /** Settings is the only player-facing entry point for changing notifications. */
  const change = async (next: boolean) => {
    if (lock.current || !capability || (!unavailable && next === enabled)) return;
    lock.current = true; setBusy(true); setUnavailable(false);
    setPlayerNotificationsEnabled(next);
    if (lifetime.active) trackEvent("notification_preference_requested", {enabled: next});
    try {
      const saved = await capability.setEnabled(next);
      if (lifetime.active) trackEvent("notification_preference_result", {enabled: next, success: saved});
      if (lifetime.active && !saved) setUnavailable(true);
    } catch {
      if (lifetime.active) {
        trackEvent("notification_preference_result", {enabled: next, success: false});
        setUnavailable(true);
      }
    }
    finally {lock.current = false; setBusy(false);}
  };
  return {enabled, busy, unavailable, change};
}

/** The active account owns notification updates across modal navigation. */
const NotificationSettingsContext = createContext<ReturnType<typeof useNotificationSettingsState> | null>(null);

/** Keeps notification state independent of referral sharing and multiplayer. */
export function NotificationSettingsProvider({capability, children}: {
  /** Only targets with notification delivery expose the Settings row. */
  capability?: NotificationSettingsCapability | null;
  /** Shared game and Settings content. */
  children: ReactNode;
}) {
  const state = useNotificationSettingsState(capability);
  return createElement(NotificationSettingsContext.Provider, {value: capability ? state : null}, children);
}

/** Reads the global notification preference exposed in Settings. */
export function useNotificationSettings() {return useContext(NotificationSettingsContext);}
