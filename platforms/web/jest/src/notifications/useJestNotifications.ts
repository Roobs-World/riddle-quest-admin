import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import type {JestPlatformPort, JestSession} from "../types";
import {MOCK_NOTIFICATION_COPY, notificationPlayerName, renderNotificationBody, type NotificationCopy} from "./copy";
import {
  LEGACY_RACE_REMINDER_ID,
  notificationRotationSeed,
  RACE_RESULTS_REMINDER_ID,
  PLAYER_NOTIFICATION_IDS,
  replaceEngagementReminders,
} from "./engagement";
import {captureBrowserException} from "../../../../../src/observability/browserErrorReporter";
import {notificationAsset} from "./inlineAsset";

/** Describes with platform activity. */
type WithPlatformActivity = <Result>(operation: () => Promise<Result>) => Promise<Result>;
/** Describes track funnel. */
type TrackFunnel = (eventName: string, params?: Record<string, string | number | boolean>) => void;

/** Provides jest notifications. */
export function useJestNotifications({
  locale,
  mockRuntime,
  session,
  engagementProgress,
  gameTitle,
  playerFallback,
  fallbackCopy,
  assetReference,
  platform,
  notificationsEnabled,
  withPlatformActivity,
  trackFunnel,
}: {
  /** Stores locale. */
  locale: string;
  /** Stores mock runtime. */
  mockRuntime: boolean;
  /** Stores session. */
  session: JestSession | null;
  /** Stores engagement progress. */
  engagementProgress: {
    /** Stores level. */
    level: number; /** Stores win streak. */
    /** Stores win streak. */
    winStreak: number; /** Stores wins. */
    /** Stores wins. */
    wins: number;
  };
  /** Localized game title shown on every scheduled notification. */
  gameTitle: string;
  /** Stores player fallback. */
  playerFallback: string;
  /** Bundled localized copy used when the remotely managed copy is unavailable. */
  fallbackCopy: NotificationCopy;
  /** Stores asset reference. */
  assetReference?: string;
  /** Stores platform. */
  platform: JestPlatformPort;
  /** Stores notifications enabled. */
  notificationsEnabled: () => boolean;
  /** Stores with platform activity. */
  withPlatformActivity: WithPlatformActivity;
  /** Stores track funnel. */
  trackFunnel: TrackFunnel;
}) {
  /** Provides [copy, set copy] behavior. */
  const [copy, setCopy] = useState<NotificationCopy | null>(fallbackCopy);
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
  const maySchedule = useCallback(() => owner.active && owner.registered && notificationsEnabled(), [notificationsEnabled, owner]);
  const cancelAllNotifications = useCallback(() => enqueue(async () => {
    if (!owner.active || !owner.registered) return true;
    const removed = await withPlatformActivity(() => owner.active && owner.registered ? Promise.all(
      PLAYER_NOTIFICATION_IDS.map(identifier => platform.removeNotification(identifier)),
    ) : Promise.resolve([]));
    return removed.every(result => result.status === "success");
  }), [enqueue, owner, platform, withPlatformActivity]);

  useEffect(() => {
    if (!owner.registered || notificationsEnabled()) return;
    void cancelAllNotifications().catch(error => {
      captureBrowserException(error, {component: "jest_notifications", operation: "disable_reminders"});
    });
  }, [cancelAllNotifications, notificationsEnabled, owner]);

  useEffect(() => {
    if (!maySchedule()) {
      setCopy(null);
      return;
    }
    setCopy(fallbackCopy);
    /** Provides active behavior. */
    let active = true;
    void withPlatformActivity(() =>
      mockRuntime
        ? Promise.resolve(MOCK_NOTIFICATION_COPY)
        : import("./firebaseCopy").then((module) => module.loadNotificationCopy(locale)),
    )
      .then((loadedCopy) => {
        if (active && maySchedule()) setCopy(loadedCopy);
      })
      .catch((error) => {
        captureBrowserException(error, {component: "jest_notifications", operation: "load_copy"});
        if (active && maySchedule()) {
          setCopy(fallbackCopy);
          trackFunnel("notification_copy_load_failed", {locale});
        }
      });
    return () => {
      active = false;
    };
  }, [fallbackCopy, locale, maySchedule, mockRuntime, trackFunnel, withPlatformActivity]);

  useEffect(() => {
    if (!session?.player.registered || !copy || !maySchedule()) return;
    /** Provides player name behavior. */
    const playerName = notificationPlayerName(session.profile?.username, playerFallback);
    void enqueue(async () => {
      if (!maySchedule()) return {removed: [], scheduled: []};
      return withPlatformActivity(() => maySchedule() ?
        replaceEngagementReminders(
          platform,
          {
            gameTitle,
            dailyBody: renderNotificationBody(copy.dailyBody, {name: playerName, coins: 75}),
            streakBody: renderNotificationBody(copy.streakBody, {
              wins: engagementProgress.wins,
              streak: engagementProgress.winStreak,
              coins: 75,
            }),
            weeklyBody: renderNotificationBody(copy.weeklyBody, {level: engagementProgress.level, coins: 75}),
            dailyCta: copy.dailyCta,
            streakCta: copy.streakCta,
            weeklyCta: copy.weeklyCta,
            ...(assetReference ? {assetReference} : {}),
          },
          notificationRotationSeed(session.player.playerId),
          maySchedule,
        ) : Promise.resolve({removed: [], scheduled: []}),
      );
    })
      .then(({removed, scheduled}) => {
        removed.forEach((result, index) => {
          if (result.status !== "success") {
            trackFunnel("notification_unschedule_failed", {index, status: result.status});
          }
        });
        scheduled.forEach((result, index) => {
          if (result.status !== "success") {
            trackFunnel("notification_schedule_failed", {index, status: result.status});
          }
        });
      })
      .catch((error) => {
        captureBrowserException(error, {component: "jest_notifications", operation: "schedule_reminders"});
        trackFunnel("notification_schedule_failed", {index: -1, status: "invalid-copy"});
      });
  }, [
    assetReference,
    copy,
    engagementProgress.level,
    engagementProgress.winStreak,
    engagementProgress.wins,
    gameTitle,
    platform,
    playerFallback,
    notificationsEnabled,
    maySchedule,
    enqueue,
    session?.player.playerId,
    session?.player.registered,
    session?.profile?.username,
    trackFunnel,
    withPlatformActivity,
  ]);

  useEffect(() => {
    if (!session?.player.registered || !copy || !maySchedule()) return;
    /** Provides schedule race return behavior. */
    const scheduleRaceReturn = (event: Event) => {
      if (!maySchedule()) return;
      /** Provides detail behavior. */
      const detail = (
        event as CustomEvent<{
          /** Stores challenge id. */
          challengeId?: string;
        }>
      ).detail;
      if (!detail?.challengeId) return;
      /** Provides challenge id behavior. */
      const challengeId = detail.challengeId;
      void enqueue(async () => {
        if (!maySchedule()) return;
        return withPlatformActivity(async () => {
          if (!maySchedule()) return;
          await platform.removeNotification(LEGACY_RACE_REMINDER_ID);
          const asset = await notificationAsset({title: `${gameTitle}: ${copy.raceTitle}`, body: copy.raceBody, ctaText: copy.raceCta}, assetReference);
          if (!maySchedule()) return;
          return platform.scheduleNotification({
            identifier: RACE_RESULTS_REMINDER_ID,
            scheduledInDays: 1,
            title: `${gameTitle}: ${copy.raceTitle}`,
            body: copy.raceBody,
            ctaText: copy.raceCta,
            priority: "high",
            ...asset,
            entryPayload: {
              campaign: "race_to_10_results_v1",
              reference: "race_to_10_results_d1_v1",
              challengeDestination: "inbox",
              challengeId,
              notification_template: "race_to_10_results_v1",
              notification_offset: "D1",
            },
          });
        });
      }).then(result => {if (result && owner.active) trackFunnel("race_results_reminder_scheduled", {status: result.status});})
        .catch(error => captureBrowserException(error, {component: "jest_notifications", operation: "schedule_race_reminder"}));
    };
    window.addEventListener("riddle-quest:race-challenge-published", scheduleRaceReturn);
    return () => window.removeEventListener("riddle-quest:race-challenge-published", scheduleRaceReturn);
  }, [assetReference, copy, enqueue, gameTitle, maySchedule, owner, platform, session?.player.registered, trackFunnel, withPlatformActivity]);

  useEffect(() => {
    if (!maySchedule() || session?.entryIntent.challengeDestination !== "inbox")
      return;
    void enqueue(async () => {
      if (!maySchedule()) return;
      return withPlatformActivity(() => maySchedule() ? platform.removeNotification(RACE_RESULTS_REMINDER_ID) : Promise.resolve(undefined));
    }).then(result => {if (result && owner.active) trackFunnel("race_results_reminder_opened", {status: result.status});})
      .catch(error => captureBrowserException(error, {component: "jest_notifications", operation: "remove_opened_reminder"}));
  }, [
    enqueue,
    maySchedule,
    owner,
    platform,
    session?.entryIntent.challengeDestination,
    session?.player.registered,
    trackFunnel,
    withPlatformActivity,
  ]);
  return {cancelAllNotifications};
}
