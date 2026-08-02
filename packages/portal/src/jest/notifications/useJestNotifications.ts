import {useEffect, useState} from "react";
import {loadNotificationCopy} from "../../firebase";
import type {JestPlatformPort, JestSession} from "../types";
import {
  MOCK_NOTIFICATION_COPY,
  notificationPlayerName,
  renderNotificationBody,
  type NotificationCopy,
} from "./copy";
import {notificationRotationSeed, replaceEngagementReminders} from "./engagement";

type WithPlatformActivity = <Result>(operation: () => Promise<Result>) => Promise<Result>;
type TrackFunnel = (eventName: string, params?: Record<string, string | number | boolean>) => void;

export function useJestNotifications({
  locale,
  mockRuntime,
  session,
  engagementProgress,
  playerFallback,
  assetReference,
  platform,
  withPlatformActivity,
  trackFunnel,
}: {
  locale: string;
  mockRuntime: boolean;
  session: JestSession | null;
  engagementProgress: {level: number; winStreak: number; wins: number};
  playerFallback: string;
  assetReference?: string;
  platform: JestPlatformPort;
  withPlatformActivity: WithPlatformActivity;
  trackFunnel: TrackFunnel;
}) {
  const [copy, setCopy] = useState<NotificationCopy | null>(null);

  useEffect(() => {
    if (!session?.player.registered) {
      setCopy(null);
      return;
    }
    let active = true;
    void withPlatformActivity(() =>
      mockRuntime ? Promise.resolve(MOCK_NOTIFICATION_COPY) : loadNotificationCopy(locale),
    ).then((loadedCopy) => {
      if (active) setCopy(loadedCopy);
    }).catch(() => {
      if (active) {
        setCopy(null);
        trackFunnel("notification_copy_load_failed", {locale});
      }
    });
    return () => {
      active = false;
    };
  }, [locale, mockRuntime, session?.player.registered, trackFunnel, withPlatformActivity]);

  useEffect(() => {
    if (!session?.player.registered || !copy) return;
    const playerName = notificationPlayerName(
      session.profile?.username ?? session.entryIntent.customName,
      playerFallback,
    );
    void withPlatformActivity(() => replaceEngagementReminders(platform, {
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
    }, notificationRotationSeed(session.player.playerId))).then(({removed, scheduled}) => {
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
    }).catch(() => trackFunnel("notification_schedule_failed", {index: -1, status: "invalid-copy"}));
  }, [
    assetReference,
    copy,
    engagementProgress.level,
    engagementProgress.winStreak,
    engagementProgress.wins,
    platform,
    playerFallback,
    session?.entryIntent.customName,
    session?.player.playerId,
    session?.player.registered,
    session?.profile?.username,
    trackFunnel,
    withPlatformActivity,
  ]);

  useEffect(() => {
    if (!session?.player.registered || !copy) return;
    const scheduleRaceReturn = (event: Event) => {
      const detail = (event as CustomEvent<{challengeId?: string}>).detail;
      if (!detail?.challengeId) return;
      const challengeId = detail.challengeId;
      void withPlatformActivity(async () => {
        await platform.removeNotification("race_to_10_return_v1");
        return platform.scheduleNotification({
          identifier: "race_to_10_results_v1",
          scheduledInDays: 1,
          title: copy.raceTitle,
          body: copy.raceBody,
          ctaText: copy.raceCta,
          priority: "high",
          entryPayload: {
            campaign: "race_to_10_results_v1",
            reference: "race_to_10_results_d1_v1",
            challengeDestination: "inbox",
            challengeId,
            notification_template: "race_to_10_results_v1",
            notification_offset: "D1",
          },
        });
      }).then((result) => trackFunnel("race_results_reminder_scheduled", {status: result.status}));
    };
    window.addEventListener("riddle-quest:race-challenge-published", scheduleRaceReturn);
    return () => window.removeEventListener("riddle-quest:race-challenge-published", scheduleRaceReturn);
  }, [copy, platform, session?.player.registered, trackFunnel, withPlatformActivity]);

  useEffect(() => {
    if (!session?.player.registered || session.entryIntent.challengeDestination !== "inbox") return;
    void withPlatformActivity(() => platform.removeNotification("race_to_10_results_v1"))
      .then((result) => trackFunnel("race_results_reminder_opened", {status: result.status}));
  }, [platform, session?.entryIntent.challengeDestination, session?.player.registered, trackFunnel, withPlatformActivity]);
}
