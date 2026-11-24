import {useCallback, useEffect, useLayoutEffect, useMemo, useRef} from "react";
import type {JestPlatformPort, JestSession} from "../types";
import {PLAYER_NOTIFICATION_IDS} from "./engagement";
import {captureBrowserException} from "../../../../../src/observability/browserErrorReporter";

type WithPlatformActivity = <Result>(operation: () => Promise<Result>) => Promise<Result>;

/** Retires schedules created before notification content moved to the manager. */
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
  const cancelAllNotifications = useCallback(() => enqueue(async () => {
    if (!owner.active || !owner.registered || !isActive()) return true;
    const removed = await withPlatformActivity(() => owner.active && owner.registered && isActive() ? Promise.all(
      PLAYER_NOTIFICATION_IDS.map(identifier => platform.removeNotification(identifier)),
    ) : Promise.resolve([]));
    return removed.every(result => result.status === "success");
  }), [enqueue, isActive, owner, platform, withPlatformActivity]);

  useEffect(() => {
    void cancelAllNotifications().catch(error => {
      captureBrowserException(error, {component: "jest_notifications", operation: "retire_legacy_reminders"});
    });
  }, [cancelAllNotifications]);

  return {cancelAllNotifications};
}
