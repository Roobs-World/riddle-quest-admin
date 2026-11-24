import {useCallback, useEffect, useLayoutEffect, useMemo, useSyncExternalStore, type RefObject} from "react";
import {tr} from "../../../../../src/localization/browser/i18n";
import {isPlayerNotificationsEnabled, subscribeToPlayerNotifications} from "../../../../../src/settings/browser/playerPreferences";
import type {NotificationSettingsCapability} from "../../../../../src/notifications/contracts/notificationSettings";
import {captureBrowserException} from "../../../../../src/observability/browserErrorReporter";
import type {JestSession} from "../types";
import {useJestNotifications} from "./useJestNotifications";
import type {NotificationCopy} from "./copy";
import type {NotificationOperationGate} from "./operationGate";
import {retireJestLiveChallengePush, setJestLiveChallengePush} from "./liveChallengePush";

type JestNotificationsProps = Pick<Parameters<typeof useJestNotifications>[0], "locale" | "mockRuntime" | "session" | "engagementProgress" | "platform" | "trackFunnel"> & {
  authHarness: boolean;
  gate: NotificationOperationGate;
  sessionRef: RefObject<JestSession | null>;
  install(capability: NotificationSettingsCapability): () => void;
};

/** Loads notification delivery only after the playable session has mounted. */
export function JestNotifications({locale, mockRuntime, authHarness, session, engagementProgress, platform, trackFunnel, gate, sessionRef, install}: JestNotificationsProps) {
  /** Bundled locale copy keeps the Jest notification lifecycle independent of remote configuration availability. */
  const notificationFallbackCopy = useMemo<NotificationCopy>(
    () => ({
      dailyBody: tr("WebPortal.NOTIFICATION_DAILY_BODY"),
      dailyCta: tr("WebPortal.NOTIFICATION_DAILY_CTA"),
      streakBody: tr("WebPortal.NOTIFICATION_STREAK_BODY"),
      streakCta: tr("WebPortal.NOTIFICATION_STREAK_CTA"),
      weeklyBody: tr("WebPortal.NOTIFICATION_WEEKLY_BODY"),
      weeklyCta: tr("WebPortal.NOTIFICATION_WEEKLY_CTA"),
      raceTitle: tr("RaceTo10.TITLE"),
      raceBody: tr("RaceTo10.RESULTS_NOTIFICATION_BODY"),
      raceCta: tr("RaceTo10.CHECK_RESULTS"),
    }),
    [locale],
  );
  const notificationsPreference = useSyncExternalStore(subscribeToPlayerNotifications, isPlayerNotificationsEnabled, () => true);
  const notificationsEnabled = useCallback(() => notificationsPreference && isPlayerNotificationsEnabled() && gate.isOpen(),
    [gate, notificationsPreference]);
  const {cancelAllNotifications} = useJestNotifications({
    locale,
    mockRuntime,
    session,
    engagementProgress,
    gameTitle: tr("WebPortal.JEST_APP_TITLE"),
    playerFallback: tr("WebPortal.NOTIFICATION_PLAYER_FALLBACK"),
    fallbackCopy: notificationFallbackCopy,
    assetReference: import.meta.env.VITE_JEST_NOTIFICATION_ASSET_REFERENCE || undefined,
    platform,
    notificationsEnabled,
    withPlatformActivity: gate.run,
    trackFunnel,
  });
  const notificationSettings = useMemo<NotificationSettingsCapability>(() => ({
    async setEnabled(enabled) {
      const playerId = session?.player.playerId, uid = session?.firebaseUid;
      const isCurrent = () => Boolean(playerId && sessionRef.current?.player.playerId === playerId &&
        sessionRef.current?.firebaseUid === uid && gate.isOpen() && isPlayerNotificationsEnabled() === enabled);
      if (!isCurrent()) return false;
      const cleanup = enabled ? Promise.resolve(true) : cancelAllNotifications();
      if (!session?.player.registered || authHarness || mockRuntime) return cleanup;
      const preference = gate.run(async () => {
        const {setNotificationPreference} = await import("../../../../../src/platform/firebase/browserClient");
        if (!isCurrent()) return false;
        await setNotificationPreference({enabled});
        return true;
      });
      const pushOperation = setJestLiveChallengePush(enabled, {isCurrent, beforeRegister: () => preference})
        .catch(error => {
          captureBrowserException(error, {component: "jest_notifications", operation: "update_push_subscription"});
          return false;
        });
      const push = gate.run(() => pushOperation);
      const results = await Promise.allSettled([preference, cleanup, push]);
      results.forEach(result => {
        if (result.status === "rejected") captureBrowserException(result.reason, {component: "jest_notifications", operation: "save_preference"});
      });
      const saved = results[0].status === "fulfilled" && results[0].value === true;
      const removed = results[1].status === "fulfilled" && results[1].value === true;
      return isCurrent() && saved && removed;
    },
  }), [authHarness, cancelAllNotifications, mockRuntime, gate, session?.firebaseUid, session?.player.playerId, session?.player.registered]);
  useEffect(() => {
    if (!session?.player.registered || authHarness || mockRuntime) return;
    const playerId = session.player.playerId, uid = session.firebaseUid;
    const enabled = isPlayerNotificationsEnabled();
    let active = true;
    const isCurrent = () => active && sessionRef.current?.player.playerId === playerId && sessionRef.current?.firebaseUid === uid &&
      gate.isOpen() && isPlayerNotificationsEnabled() === enabled;
    void gate.run(async () => {
      if (!isCurrent()) return;
      await setJestLiveChallengePush(enabled, {requestPermission: false, isCurrent});
    }).catch(error => captureBrowserException(error, {component: "jest_notifications", operation: "restore_preference"}));
    return () => {active = false; void retireJestLiveChallengePush(uid);};
  }, [authHarness, mockRuntime, gate, session?.firebaseUid, session?.player.playerId, session?.player.registered]);
  useLayoutEffect(() => install(notificationSettings), [install, notificationSettings]);
  return null;
}
