import {useLayoutEffect, useMemo, type RefObject} from "react";
import {isPlayerNotificationsEnabled} from "../../../../../src/settings/browser/playerPreferences";
import type {NotificationPreferenceCommand} from "../../../../../src/notifications/contracts/notificationProvider";
import {captureBrowserException} from "../../../../../src/observability/browserErrorReporter";
import type {JestSession} from "../types";
import {useJestNotifications} from "./useJestNotifications";
import type {NotificationOperationGate} from "./operationGate";
import {createFirebaseNotificationEnrollment} from "../../../../../src/notifications/browser/firebaseEnrollment";
import {createFirebaseEnrollmentBackend} from "../../../../../src/notifications/browser/firebaseEnrollmentBackend";
import {getCurrentLocale} from "../../../../../src/localization/browser/i18n";

type JestNotificationsProps = Pick<Parameters<typeof useJestNotifications>[0], "session" | "platform"> & {
  mockRuntime: boolean;
  authHarness: boolean;
  gate: NotificationOperationGate;
  sessionRef: RefObject<JestSession | null>;
  install(capability: NotificationPreferenceCommand): () => void;
};

/** Loads notification delivery only after the playable session has mounted. */
export function JestNotifications({mockRuntime, authHarness, session, platform, gate, sessionRef, install}: JestNotificationsProps) {
  const {cancelAllNotifications} = useJestNotifications({
    session,
    platform,
    isActive: gate.isOpen,
    withPlatformActivity: gate.run,
  });
  const commands = useMemo(() => {
    const playerId = session?.player.playerId, uid = session?.firebaseUid;
    const isSessionCurrent = () => Boolean(playerId && sessionRef.current?.player.playerId === playerId &&
      sessionRef.current?.firebaseUid === uid && gate.isOpen());
    const setEnabled = async (enabled: boolean) => {
      const isCurrent = () => isSessionCurrent() && isPlayerNotificationsEnabled() === enabled;
      if (!isCurrent()) return false;
      const cleanup = enabled ? Promise.resolve(true) : cancelAllNotifications();
      if (!session?.player.registered || authHarness || mockRuntime) return cleanup;
      const preference = gate.run(async () => {
        const {setNotificationPreference} = await import("../../../../../src/platform/firebase/browserClient");
        if (!isCurrent()) return false;
        await setNotificationPreference({enabled});
        return true;
      });
      const results = await Promise.allSettled([preference, cleanup]);
      results.forEach(result => {
        if (result.status === "rejected") captureBrowserException(result.reason, {component: "jest_notifications", operation: "save_preference"});
      });
      const saved = results[0].status === "fulfilled" && results[0].value === true;
      const removed = results[1].status === "fulfilled" && results[1].value === true;
      return isCurrent() && saved && removed;
    };
    const eligible = Boolean(uid && session?.player.registered && !authHarness && !mockRuntime);
    let enrollment: ReturnType<typeof createFirebaseNotificationEnrollment> | null = null;
    if (eligible && uid) {
      const backend = createFirebaseEnrollmentBackend({expectedUid: uid, isCurrent: isSessionCurrent, run: gate.run});
      try {
        enrollment = createFirebaseNotificationEnrollment({accountId: uid,
          managerOrigin: import.meta.env.VITE_NOTIFICATION_SERVICE_URL || "https://riddle-quest-admin.vercel.app",
          locale: getCurrentLocale, isCurrent: () => isSessionCurrent() && isPlayerNotificationsEnabled(),
          backend: {...backend, createEnrollment: async input => {
            if (!await setEnabled(true)) throw new Error("notification-enrollment-preference-unavailable");
            return backend.createEnrollment(input);
          }},
        });
      } catch { /* A malformed service configuration must not claim delivery readiness. */ }
    }
    return {enrollment, capability: {
      setEnabled,
      requestPermission: () => enrollment?.requestPermission() ?? Promise.resolve(false),
      restoreDelivery: () => enrollment?.restoreDelivery() ?? Promise.resolve(eligible ? "not-configured" : "unsupported"),
      getSetupLink: () => enrollment?.getSetupLink() ?? null,
    } satisfies NotificationPreferenceCommand};
  }, [authHarness, cancelAllNotifications, mockRuntime, gate, session?.firebaseUid, session?.player.playerId, session?.player.registered]);
  useLayoutEffect(() => {
    commands.enrollment?.activate();
    const uninstall = install(commands.capability);
    return () => {uninstall(); commands.enrollment?.retire();};
  }, [commands, install]);
  return null;
}
