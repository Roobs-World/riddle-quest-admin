import {useLayoutEffect, useMemo, type RefObject} from "react";
import {isPlayerNotificationsEnabled} from "../../../../../src/settings/browser/playerPreferences";
import type {NotificationRegistrationCommands} from "../../../../../src/notifications/contracts/notificationProvider";
import {captureBrowserException} from "../../../../../src/observability/browserErrorReporter";
import type {JestSession} from "../types";
import {useJestNotifications} from "./useJestNotifications";
import type {NotificationOperationGate} from "./operationGate";

type JestNotificationsProps = Pick<Parameters<typeof useJestNotifications>[0], "session" | "platform"> & {
  mockRuntime: boolean;
  authHarness: boolean;
  gate: NotificationOperationGate;
  sessionRef: RefObject<JestSession | null>;
  install(capability: NotificationRegistrationCommands): () => void;
};

/** Keeps account consent synchronized with the Jest-owned reminder sequence. */
export function JestNotifications({mockRuntime, authHarness, session, platform, gate, sessionRef, install}: JestNotificationsProps) {
  const {synchronizeNotifications} = useJestNotifications({
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
      const schedule = synchronizeNotifications();
      if (!session?.player.registered || authHarness || mockRuntime) {
        await schedule;
        return isCurrent();
      }
      const preference = gate.run(async () => {
        const {setNotificationPreference} = await import("../../../../../src/platform/firebase/browserClient");
        if (!isCurrent()) return false;
        await setNotificationPreference({enabled});
        return true;
      });
      const results = await Promise.allSettled([preference, schedule]);
      results.forEach(result => {
        if (result.status === "rejected") captureBrowserException(result.reason, {component: "jest_notifications", operation: "save_preference"});
      });
      const saved = results[0].status === "fulfilled" && results[0].value === true;
      return isCurrent() && saved;
    };
    return {
      setEnabled,
    } satisfies NotificationRegistrationCommands;
  }, [authHarness, synchronizeNotifications, mockRuntime, gate, session?.firebaseUid, session?.player.playerId, session?.player.registered]);
  useLayoutEffect(() => {
    return install(commands);
  }, [commands, install]);
  return null;
}
