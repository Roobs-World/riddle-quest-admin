import {useCallback, useEffect, useLayoutEffect, useMemo, useRef} from "react";
import type {JestPlatformPort, JestSession, PlatformResult} from "../types";
import {LEGACY_REMINDER_IDS, PLAYER_NOTIFICATION_IDS, RACE_REMINDER_IDS} from "./engagement";
import {createJestFundNotifications} from "./fundCampaign";
import {captureBrowserException} from "../../../../../src/observability/browserErrorReporter";
import {isPlayerNotificationsEnabled, subscribeToPlayerNotifications} from "../../../../../src/settings/browser/playerPreferences";

type WithPlatformActivity = <Result>(operation: () => Promise<Result>) => Promise<Result>;
const RETRY_DELAYS_MS = [1_000, 4_000, 15_000];

/** Schedules registered-player reminders through Jest, preserving consent and deletion ordering. */
export function useJestNotifications({session, platform, isActive, withPlatformActivity}: {
  session: JestSession | null;
  platform: JestPlatformPort;
  isActive: () => boolean;
  withPlatformActivity: WithPlatformActivity;
}) {
  const owner = useMemo(() => ({
    active: false,
    registered: session?.player.registered === true,
    scheduleKey: "",
    completed: new Set<string>(),
  }), [platform, session?.player.playerId, session?.firebaseUid, session?.player.registered]);
  useLayoutEffect(() => {
    owner.active = true;
    return () => {owner.active = false;};
  }, [owner]);
  /** One queue also drains admitted work before a replacement account starts scheduling. */
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<Result,>(operation: () => Promise<Result>): Promise<Result> => {
    const result = pending.current.then(operation);
    pending.current = result.catch(() => undefined);
    return result;
  }, []);
  const synchronizeNotifications = useCallback(() => enqueue(async () => {
    const current = () => owner.active && owner.registered && isActive();
    if (!current()) return true;
    return withPlatformActivity(async () => {
      if (!current()) return true;
      const enabled = isPlayerNotificationsEnabled();
      const key = enabled ? `enabled:${new Date().toISOString().slice(0, 10)}` : "disabled";
      const unchanged = () => current() && isPlayerNotificationsEnabled() === enabled;
      if (owner.scheduleKey !== key) {
        owner.scheduleKey = key;
        owner.completed.clear();
      }
      const operations: Array<{key: string; run: () => Promise<PlatformResult<void>>}> = enabled
        ? [
            ...createJestFundNotifications().map(input => ({
              key: `schedule:${input.identifier}`, run: () => platform.scheduleNotification(input),
            })),
            ...[...LEGACY_REMINDER_IDS, ...RACE_REMINDER_IDS].map(identifier => ({
              key: `remove:${identifier}`, run: () => platform.removeNotification(identifier),
            })),
          ]
        : PLAYER_NOTIFICATION_IDS.map(identifier => ({
            key: `remove:${identifier}`, run: () => platform.removeNotification(identifier),
          }));
      const results = await Promise.all(operations.map(async operation => {
        if (!unchanged()) return false;
        if (owner.completed.has(operation.key)) return true;
        try {
          const result = await operation.run();
          if (result.status !== "success") return false;
          if (unchanged()) owner.completed.add(operation.key);
          return true;
        } catch (error) {
          captureBrowserException(error, {component: "jest_notifications", operation: operation.key});
          return false;
        }
      }));
      return unchanged() && results.every(Boolean);
    });
  }), [enqueue, isActive, owner, platform, withPlatformActivity]);

  useEffect(() => {
    let retired = false;
    let attempts = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const synchronize = () => {
      if (retired || !owner.active || !owner.registered || !isActive()) return;
      if (retry !== undefined) clearTimeout(retry);
      const scheduleRetry = () => {
        if (retired || !owner.active || !isActive()) return;
        const delay = RETRY_DELAYS_MS[attempts++];
        if (delay !== undefined) retry = setTimeout(synchronize, delay);
      };
      void synchronizeNotifications().then(success => {
        if (success) attempts = 0;
        else scheduleRetry();
      }).catch(error => {
        if (retired || !owner.active || !isActive()) return;
        captureBrowserException(error, {component: "jest_notifications", operation: "synchronize_schedule"});
        scheduleRetry();
      });
    };
    const refresh = () => {attempts = 0; synchronize();};
    const onVisible = () => {if (document.visibilityState === "visible") refresh();};
    const unsubscribe = subscribeToPlayerNotifications(refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onVisible);
    synchronize();
    return () => {
      retired = true;
      if (retry !== undefined) clearTimeout(retry);
      unsubscribe();
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isActive, owner, synchronizeNotifications]);

  return {synchronizeNotifications};
}
