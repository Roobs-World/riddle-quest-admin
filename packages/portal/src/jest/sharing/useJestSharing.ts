import {useEffect} from "react";
import {tr} from "../../play/i18n";
import type {JestBackendPort} from "../backend";
import type {JestPlatformPort, JestSession} from "../types";
import {captureGameScreenshot, captureVictoryShareImage, sizeCheckedScreenshotProvider} from "./screenshots";

type WithPlatformActivity = <Result>(operation: () => Promise<Result>) => Promise<Result>;
type TrackFunnel = (eventName: string, params?: Record<string, string | number | boolean>) => void;

export function useJestSharing({
  locale,
  session,
  platform,
  backend,
  withPlatformActivity,
  trackFunnel,
}: {
  locale: string;
  session: JestSession | null;
  platform: JestPlatformPort;
  backend: JestBackendPort;
  withPlatformActivity: WithPlatformActivity;
  trackFunnel: TrackFunnel;
}) {
  useEffect(() => {
    if (!session) return;
    platform.setScreenshotProvider(sizeCheckedScreenshotProvider(captureGameScreenshot));
    return () => platform.setScreenshotProvider(null);
  }, [platform, session?.player.playerId]);

  useEffect(() => {
    if (!session?.player.registered) return;
    void withPlatformActivity(async () => {
      const result = await platform.listReferralsSigned();
      if (result.status === "success") {
        await backend.verifyReferrals(result.value, session.player.playerId);
      }
    });
  }, [backend, platform, session?.player.playerId, session?.player.registered, withPlatformActivity]);

  useEffect(() => {
    if (!session) return;
    const share = (event: Event) => {
      const detail =
        (
          event as CustomEvent<{
            gameMode?: "classic" | "challenge";
            challengeId?: string;
            attempts?: number;
            emojiGrid?: string;
          }>
        ).detail ?? {};
      const inviterName = session.profile?.username ?? "Riddle Quest player";
      const gameMode = detail.gameMode === "challenge" ? "challenge" : "classic";
      const attempts = Math.max(1, detail.attempts ?? 1);
      const gameType = tr(
        gameMode === "challenge" ? "VictoryModal.SHARE_DAILY_CHALLENGE_LABEL" : "VictoryModal.SHARE_CLASSIC_MODE_LABEL",
      );
      const attemptLabel = tr(
        attempts === 1 ? "VictoryModal.SHARE_ATTEMPT_SINGULAR" : "VictoryModal.SHARE_ATTEMPT_PLURAL",
      );
      const emojiGrid = detail.emojiGrid?.slice(0, 500) || "🟩";
      const shareText = tr("VictoryModal.SHARE_MESSAGE_TEMPLATE", {gameType, attempts, attemptLabel, emojiGrid});
      void withPlatformActivity(async () => {
        const shareImage = await sizeCheckedScreenshotProvider(() =>
          captureVictoryShareImage({
            title: tr("VictoryModal.SHARE_RESULT_TITLE"),
            summary: `${gameType} · ${attempts} ${attemptLabel}`,
            emojiGrid,
          }),
        )();
        return platform.shareReferral({
          reference: "riddle_quest_friend_challenge_v2",
          shareTitle: tr("VictoryModal.SHARE_RESULT_TITLE"),
          shareText,
          ...(shareImage ? {shareImage} : {}),
          onboardingSlug: "friend-challenge",
          entryPayload: {
            campaign: "friend_challenge_v2",
            reference: "victory_friend_challenge_v2",
            gameMode,
            challengeDestination: detail.challengeId ?? gameMode,
            challengeId: detail.challengeId ?? gameMode,
            inviterName,
            customName: tr("WebPortal.APP_TITLE"),
          },
        });
      }).then((result) =>
        trackFunnel("friend_challenge_share_dialog", {status: result.status, gameMode, attempts}),
      );
    };
    window.addEventListener("riddle-quest:share-referral", share);
    return () => window.removeEventListener("riddle-quest:share-referral", share);
  }, [locale, platform, session, trackFunnel, withPlatformActivity]);

  useEffect(() => {
    if (!session) return;
    const shareRace = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          challengeId?: string;
          preview?: {adjustedTimeToBeatMs?: number; categoryId?: string};
        }>
      ).detail;
      if (!detail?.challengeId || typeof detail.preview?.adjustedTimeToBeatMs !== "number") return;
      const challengeId = detail.challengeId;
      const inviterName = session.profile?.username ?? tr("WebPortal.NOTIFICATION_PLAYER_FALLBACK");
      const seconds = (detail.preview.adjustedTimeToBeatMs / 1_000).toFixed(1);
      const summary = `${inviterName} · ${seconds}s · ${tr("RaceTo10.FIRST_TO_TEN")}`;
      void withPlatformActivity(async () => {
        const shareImage = await sizeCheckedScreenshotProvider(() =>
          captureVictoryShareImage({title: tr("RaceTo10.TITLE"), summary, emojiGrid: "🏁 10/10"}),
        )();
        return platform.shareReferral({
          reference: "riddle_quest_race_to_10_v1",
          shareTitle: tr("RaceTo10.TITLE"),
          shareText: `${tr("RaceTo10.CHALLENGED_BY", {name: inviterName})} · ${tr("RaceTo10.TIME_TO_BEAT", {time: `${seconds}s`})}`,
          ...(shareImage ? {shareImage} : {}),
          onboardingSlug: "race-to-10",
          entryPayload: {
            campaign: "race_to_10_v1",
            reference: "race_to_10_share_v1",
            challengeDestination: challengeId,
            challengeId,
            inviterName,
            customName: tr("WebPortal.APP_TITLE"),
          },
        });
      }).then((result) =>
        trackFunnel("race_challenge_share_dialog", {
          status: result.status,
          categoryId: detail.preview?.categoryId ?? "unknown",
        }),
      );
    };
    window.addEventListener("riddle-quest:share-race", shareRace);
    return () => window.removeEventListener("riddle-quest:share-race", shareRace);
  }, [locale, platform, session, trackFunnel, withPlatformActivity]);
}
