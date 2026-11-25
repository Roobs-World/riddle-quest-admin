import {useLayoutEffect, useMemo, type RefObject} from "react";
import {isPlayerNotificationsEnabled} from "../../../../../src/settings/browser/playerPreferences";
import type {NotificationRegistrationCommands} from "../../../../../src/notifications/contracts/notificationProvider";
import {captureBrowserException} from "../../../../../src/observability/browserErrorReporter";
import type {JestSession} from "../types";
import {useJestNotifications} from "./useJestNotifications";
import type {NotificationOperationGate} from "./operationGate";
import {createFirebaseNotificationRegistration} from "../../../../../src/notifications/browser/firebaseRegistration";
import {getCurrentLocale} from "../../../../../src/localization/browser/i18n";

type JestNotificationsProps = Pick<Parameters<typeof useJestNotifications>[0], "session" | "platform"> & {
  mockRuntime: boolean;
  authHarness: boolean;
  gate: NotificationOperationGate;
  sessionRef: RefObject<JestSession | null>;
  install(capability: NotificationRegistrationCommands): () => void;
};

/** Registers account consent and retires legacy platform schedules. */
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
    const registerAccount = eligible && uid ? createFirebaseNotificationRegistration({
      expectedUid: uid,
      managerOrigin: import.meta.env.VITE_NOTIFICATION_SERVICE_URL || "https://riddle-quest-admin.vercel.app",
      locale: getCurrentLocale,
      isCurrent: () => isSessionCurrent() && isPlayerNotificationsEnabled(),
      run: gate.run,
    }) : async () => {throw new Error("notification-registration-unavailable");};
    return {
      setEnabled,
      registerAccount,
    } satisfies NotificationRegistrationCommands;
  }, [authHarness, cancelAllNotifications, mockRuntime, gate, session?.firebaseUid, session?.player.playerId, session?.player.registered]);
  useLayoutEffect(() => {
    return install(commands);
  }, [commands, install]);
  return null;
}
