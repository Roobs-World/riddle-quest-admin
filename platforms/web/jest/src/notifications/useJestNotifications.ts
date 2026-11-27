import {useCallback, useLayoutEffect, useMemo, useRef} from "react";
import type {JestPlatformPort, JestSession} from "../types";
import {PLAYER_NOTIFICATION_IDS, RETIRED_NOTIFICATION_IDS} from "./engagement";
import type {JestManagedNotification} from "./managerProtocol";

type WithPlatformActivity = <Result>(operation: () => Promise<Result>) => Promise<Result>;

/** Serializes the manager's schedules and consent cleanup at the SDK boundary. */
export function useJestNotifications({session, platform, isActive, withPlatformActivity}: {
  session: JestSession | null;
  platform: JestPlatformPort;
  isActive: () => boolean;
  withPlatformActivity: WithPlatformActivity;
}) {
  const owner = useMemo(() => ({active: false, registered: session?.player.registered === true}),
    [platform, session?.player.playerId, session?.firebaseUid, session?.player.registered]);
  useLayoutEffect(() => {
    owner.active = true;
    return () => {owner.active = false;};
  }, [owner]);
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<Result,>(operation: () => Promise<Result>): Promise<Result> => {
    const result = pending.current.then(operation);
    pending.current = result.catch(() => undefined);
    return result;
  }, []);
  const mayUseSdk = useCallback(() => {
    if (!owner.active || !owner.registered || !isActive()) return false;
    const player = platform.getPlayer();
    return player.registered && player.playerId === session?.player.playerId;
  }, [isActive, owner, platform, session?.player.playerId]);
  const removeNotifications = useCallback((identifiers: readonly string[], isCurrent: () => boolean) => enqueue(async () => {
    if (!mayUseSdk() || !isCurrent()) return false;
    return withPlatformActivity(async () => {
      let succeeded = true;
      for (const identifier of identifiers) {
        if (!mayUseSdk() || !isCurrent()) return false;
        const result = await platform.removeNotification(identifier);
        succeeded = result.status === "success" && succeeded;
      }
      return succeeded;
    });
  }), [enqueue, mayUseSdk, platform, withPlatformActivity]);
  const cancelAllNotifications = useCallback((isCurrent: () => boolean = () => true) =>
    removeNotifications(PLAYER_NOTIFICATION_IDS, isCurrent), [removeNotifications]);
  const retireLegacyNotifications = useCallback((isCurrent: () => boolean) =>
    removeNotifications(RETIRED_NOTIFICATION_IDS, isCurrent), [removeNotifications]);
  const applyNotifications = useCallback((notifications: readonly JestManagedNotification[], isCurrent: () => boolean) => enqueue(async () => {
    if (!mayUseSdk() || !isCurrent()) return false;
    return withPlatformActivity(async () => {
      let succeeded = true;
      for (const notification of notifications) {
        if (!mayUseSdk() || !isCurrent()) return false;
        const result = await platform.scheduleNotification(notification);
        succeeded = result.status === "success" && succeeded;
      }
      return succeeded;
    });
  }), [enqueue, mayUseSdk, platform, withPlatformActivity]);

  return {cancelAllNotifications, retireLegacyNotifications, applyNotifications};
}
