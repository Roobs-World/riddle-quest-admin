import {useCallback, useEffect, useLayoutEffect, useMemo, type RefObject} from "react";
import {isPlayerNotificationsEnabled, subscribeToPlayerNotifications} from "../../../../../src/settings/browser/playerPreferences";
import type {NotificationRegistrationCommands} from "../../../../../src/notifications/contracts/notificationProvider";
import {captureBrowserException} from "../../../../../src/observability/browserErrorReporter";
import type {JestSession} from "../types";
import {useJestNotifications} from "./useJestNotifications";
import type {NotificationOperationGate} from "./operationGate";
import {getJestNotificationPlan} from "./managerClient";

type JestNotificationsProps = Pick<Parameters<typeof useJestNotifications>[0], "session" | "platform"> & {
  mockRuntime: boolean;
  authHarness: boolean;
  gate: NotificationOperationGate;
  sessionRef: RefObject<JestSession | null>;
  install(capability: NotificationRegistrationCommands): () => void;
};

/** Applies manager-owned reminders as soon as a verified registered session is ready. */
export function JestNotifications({mockRuntime, authHarness, session, platform, gate, sessionRef, install}: JestNotificationsProps) {
  const lifetime = useMemo(() => ({active: false, generation: 0, revision: -1, request: () => {}}),
    [authHarness, mockRuntime, platform, gate, session?.firebaseUid, session?.player.playerId, session?.player.registered]);
  useLayoutEffect(() => {
    lifetime.active = true;
    return () => {lifetime.active = false; lifetime.generation++;};
  }, [lifetime]);
  const isSessionCurrent = useCallback(() => {
    if (!lifetime.active || authHarness || mockRuntime || !session?.firebaseAuthenticated || !session.player.registered ||
        sessionRef.current?.player.playerId !== session.player.playerId || sessionRef.current?.firebaseUid !== session.firebaseUid ||
        !sessionRef.current.player.registered || !gate.isOpen()) return false;
    const player = platform.getPlayer();
    return player.registered && player.playerId === session.player.playerId;
  }, [authHarness, mockRuntime, lifetime, platform, gate, session?.firebaseAuthenticated, session?.firebaseUid,
    session?.player.playerId, session?.player.registered, sessionRef]);
  const {cancelAllNotifications, retireLegacyNotifications, applyNotifications} = useJestNotifications({
    session,
    platform,
    isActive: isSessionCurrent,
    withPlatformActivity: gate.run,
  });

  useEffect(() => {
    let stopped = false, running = false, requested = true, needsRefresh = true, attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const retryDelays = [1000, 5000, 15000];
    const run = async () => {
      if (stopped || running || !requested || !isSessionCurrent() || document.visibilityState === "hidden") return;
      requested = false;
      running = true;
      const generation = lifetime.generation;
      const enabled = isPlayerNotificationsEnabled();
      const isCurrent = () => !stopped && generation === lifetime.generation && isSessionCurrent() &&
        isPlayerNotificationsEnabled() === enabled;
      let complete = false;
      try {
        // Revoke locally even when the manager is temporarily unreachable.
        const revoked = enabled || await cancelAllNotifications(isCurrent);
        if (!isCurrent()) return;
        const plan = await gate.run(getJestNotificationPlan);
        if (!isCurrent()) return;
        if (plan.revision < lifetime.revision || plan.enabled && plan.expiresAtMs <= Date.now()) {
          throw new Error("jest-notification-plan-stale");
        }
        lifetime.revision = plan.revision;
        if (!enabled) complete = revoked;
        else if (!plan.enabled) complete = await cancelAllNotifications(isCurrent);
        else {
          const maySchedule = () => isCurrent() && plan.revision === lifetime.revision && plan.expiresAtMs > Date.now();
          complete = await applyNotifications(plan.notifications, maySchedule);
          if (complete) complete = await retireLegacyNotifications(isCurrent);
        }
        if (!complete && isCurrent()) throw new Error("jest-notification-sdk-incomplete");
      } catch (error) {
        if (isCurrent()) captureBrowserException(error, {component: "jest_notifications", operation: "apply_manager_plan"});
      } finally {
        running = false;
        if (generation === lifetime.generation) needsRefresh = !complete;
        if (!stopped && isSessionCurrent()) {
          if (requested) void run();
          else if (!complete && generation === lifetime.generation && attempts < retryDelays.length) {
            retryTimer = setTimeout(() => {requested = true; void run();}, retryDelays[attempts++]);
          }
        }
      }
    };
    const request = () => {
      if (stopped) return;
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      attempts = 0;
      needsRefresh = true;
      requested = true;
      void run();
    };
    lifetime.request = request;
    const stopPreferences = subscribeToPlayerNotifications(() => {lifetime.generation++; request();});
    const resume = () => {
      if (document.visibilityState === "hidden" || running) return;
      if (needsRefresh) request();
      else void run();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("online", request);
    document.addEventListener("visibilitychange", resume);
    void run();
    return () => {
      stopped = true;
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      if (lifetime.request === request) lifetime.request = () => {};
      stopPreferences();
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", request);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [applyNotifications, cancelAllNotifications, gate, isSessionCurrent, lifetime, retireLegacyNotifications]);

  const commands = useMemo(() => {
    const setEnabled = async (enabled: boolean) => {
      const generation = ++lifetime.generation;
      const isCurrent = () => generation === lifetime.generation && isSessionCurrent() && isPlayerNotificationsEnabled() === enabled;
      if (!isCurrent()) return false;
      const cleanup = enabled ? Promise.resolve(true) : cancelAllNotifications(isCurrent);
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
      if (isCurrent()) lifetime.request();
      // Retain the saved consent if a provider call needs a background retry.
      return isCurrent() && saved;
    };
    return {
      setEnabled,
    } satisfies NotificationRegistrationCommands;
  }, [cancelAllNotifications, gate, isSessionCurrent, lifetime]);
  useLayoutEffect(() => {
    return install(commands);
  }, [commands, install]);
  return null;
}
