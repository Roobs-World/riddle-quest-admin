import {useCallback, useEffect, useMemo} from "react";
import {JEST_REFERRAL_REFERENCES, JEST_REFERRAL_REWARD_COINS} from "@qwordly/core/referrals";
import {tr} from "../../play/i18n";
import type {
  ReferralRaceShareInput,
  ReferralResultShareInput,
  ReferralSharingCapability,
} from "../../play/sharing/ReferralSharingCapability";
import type {JestBackendPort} from "../backend";
import type {JestPlatformPort, JestSession} from "../types";
import {createUniqueJestReferralReference} from "./referralReferences";
import {captureGameScreenshot, captureVictoryShareImage, sizeCheckedScreenshotProvider} from "./screenshots";

/** Describes with platform activity. */
type WithPlatformActivity = <Result>(operation: () => Promise<Result>) => Promise<Result>;
/** Describes track funnel. */
type TrackFunnel = (eventName: string, params?: Record<string, string | number | boolean>) => void;

/** Provides Jest-owned referral sharing to the shared game through one typed capability. */
export function useJestSharing({
  locale,
  session,
  platform,
  backend,
  withPlatformActivity,
  withBackgroundPlatformActivity,
  trackFunnel,
  authHarness = false,
}: {
  locale: string;
  session: JestSession | null;
  platform: JestPlatformPort;
  backend: JestBackendPort;
  withPlatformActivity: WithPlatformActivity;
  withBackgroundPlatformActivity: WithPlatformActivity;
  trackFunnel: TrackFunnel;
  /** Retains the legacy browser event driver only inside the trusted Jest test harness. */
  authHarness?: boolean;
}): ReferralSharingCapability | null {
  useEffect(() => {
    if (!session) return;
    platform.setScreenshotProvider(sizeCheckedScreenshotProvider(captureGameScreenshot));
    return () => platform.setScreenshotProvider(null);
  }, [platform, session?.player.playerId]);

  useEffect(() => {
    if (!session?.player.registered) return;
    void withBackgroundPlatformActivity(async () => {
      const result = await platform.listReferralsSigned();
      if (result.status === "success") {
        const verification = await backend.verifyReferrals(result.value, session.player.playerId);
        trackFunnel("viral_referrals_reconciled", {
          conversions: verification.conversionCount ?? 0,
          rewardsGranted: verification.rewardsGranted ?? 0,
        });
        if (
          (verification.rewardsGranted ?? 0) > 0 &&
          typeof verification.newCoins === "number" &&
          typeof verification.coinsPerPlayer === "number"
        ) {
          const detail = {
            coinsAwarded: verification.rewardsGranted! * verification.coinsPerPlayer,
            newCoins: verification.newCoins,
            conversions: verification.rewardsGranted,
          };
          (window as Window & {__RIDDLE_QUEST_PENDING_REFERRAL_REWARD__?: typeof detail})
            .__RIDDLE_QUEST_PENDING_REFERRAL_REWARD__ = detail;
          window.dispatchEvent(new CustomEvent("riddle-quest:referral-reward", {detail}));
        }
      }
    }).catch((error) => {
      console.warn("[riddle-quest] Jest referral reconciliation failed", error);
      trackFunnel("viral_referrals_reconcile_failed");
    });
  }, [
    backend,
    platform,
    session?.player.playerId,
    session?.player.registered,
    trackFunnel,
    withBackgroundPlatformActivity,
  ]);

  const shareResult = useCallback((detail: ReferralResultShareInput) => {
    if (!session) return;
    const inviterName = session.profile?.username ?? tr("WebPortal.NOTIFICATION_PLAYER_FALLBACK");
    const gameMode = detail.gameMode === "challenge" ? "challenge" : "classic";
    const attempts = typeof detail.attempts === "number" && Number.isFinite(detail.attempts)
      ? Math.min(99, Math.max(1, Math.round(detail.attempts)))
      : 1;
    const gameType = tr(
      gameMode === "challenge" ? "VictoryModal.SHARE_DAILY_CHALLENGE_LABEL" : "VictoryModal.SHARE_CLASSIC_MODE_LABEL",
    );
    const attemptLabel = tr(
      attempts === 1 ? "VictoryModal.SHARE_ATTEMPT_SINGULAR" : "VictoryModal.SHARE_ATTEMPT_PLURAL",
    );
    const emojiGrid = detail.emojiGrid?.slice(0, 500) || "🟩";
    const rewardMessage = tr("VictoryModal.REFERRAL_REWARD_MESSAGE", {coins: JEST_REFERRAL_REWARD_COINS});
    const shareText = `${tr("VictoryModal.SHARE_MESSAGE_TEMPLATE", {gameType, attempts, attemptLabel, emojiGrid})}\n\n${rewardMessage}`;
    const referralReference = createUniqueJestReferralReference("result");
    trackFunnel("viral_share_intent", {surface: "victory", campaign: "friend_challenge_v2", gameMode});
    void withPlatformActivity(async () => {
      const shareImage = await sizeCheckedScreenshotProvider(() =>
        captureVictoryShareImage({
          title: tr("VictoryModal.SHARE_RESULT_TITLE"),
          summary: `${gameType} · ${attempts} ${attemptLabel}`,
          emojiGrid,
        }),
      )();
      return platform.shareReferral({
        reference: referralReference,
        shareTitle: tr("VictoryModal.SHARE_RESULT_TITLE"),
        shareText,
        ...(shareImage ? {shareImage} : {}),
        onboardingSlug: "friend-challenge",
        entryPayload: {
          campaign: "friend_challenge_v2",
          reference: "victory_friend_challenge_v2",
          inviteKind: "result",
          gameMode,
          challengeDestination: gameMode,
          ...(typeof detail.riddleId === "string" && detail.riddleId.length <= 160
            ? {riddleId: detail.riddleId}
            : {}),
          inviterName,
        },
      });
    }).then((result) => {
      trackFunnel("friend_challenge_share_dialog", {status: result.status, gameMode, attempts});
      trackFunnel("viral_share_dialog_result", {
        status: result.status,
        surface: "victory",
        campaign: "friend_challenge_v2",
      });
    }).catch((error) => {
      console.warn("[riddle-quest] Jest victory share failed", error);
      trackFunnel("viral_share_dialog_result", {
        status: "retryable-failure",
        surface: "victory",
        campaign: "friend_challenge_v2",
      });
    });
  }, [locale, platform, session, trackFunnel, withPlatformActivity]);

  const shareRace = useCallback((detail: ReferralRaceShareInput) => {
    if (
      !session || !detail.challengeId || detail.challengeId.length > 160 ||
      typeof detail.preview.adjustedTimeToBeatMs !== "number" ||
      !Number.isFinite(detail.preview.adjustedTimeToBeatMs) ||
      detail.preview.adjustedTimeToBeatMs <= 0
    ) return;
    const challengeId = detail.challengeId;
    const inviterName = session.profile?.username ?? tr("WebPortal.NOTIFICATION_PLAYER_FALLBACK");
    const seconds = (detail.preview.adjustedTimeToBeatMs / 1_000).toFixed(1);
    const summary = `${inviterName} · ${seconds}s · ${tr("RaceTo10.FIRST_TO_TEN")}`;
    const referralReference = createUniqueJestReferralReference("race");
    trackFunnel("viral_share_intent", {surface: "race", campaign: "race_to_10_v1"});
    void withPlatformActivity(async () => {
      const shareImage = await sizeCheckedScreenshotProvider(() =>
        captureVictoryShareImage({title: tr("RaceTo10.TITLE"), summary, emojiGrid: "🏁 10/10"}),
      )();
      return platform.shareReferral({
        reference: referralReference,
        shareTitle: tr("RaceTo10.TITLE"),
        shareText: `${tr("RaceTo10.CHALLENGED_BY", {name: inviterName})} · ${tr("RaceTo10.TIME_TO_BEAT", {time: `${seconds}s`})}\n\n${tr("VictoryModal.REFERRAL_REWARD_MESSAGE", {coins: JEST_REFERRAL_REWARD_COINS})}`,
        ...(shareImage ? {shareImage} : {}),
        onboardingSlug: "race-to-10",
        entryPayload: {
          campaign: "race_to_10_v1",
          reference: "race_to_10_share_v1",
          inviteKind: "race",
          challengeDestination: challengeId,
          challengeId,
          inviterName,
        },
      });
    }).then((result) => {
      trackFunnel("race_challenge_share_dialog", {
        status: result.status,
        categoryId: detail.preview.categoryId ?? "unknown",
      });
      trackFunnel("viral_share_dialog_result", {
        status: result.status,
        surface: "race",
        campaign: "race_to_10_v1",
      });
    }).catch((error) => {
      console.warn("[riddle-quest] Jest race share failed", error);
      trackFunnel("viral_share_dialog_result", {
        status: "retryable-failure",
        surface: "race",
        campaign: "race_to_10_v1",
      });
    });
  }, [locale, platform, session, trackFunnel, withPlatformActivity]);

  const shareInvite = useCallback(() => {
    if (!session) return;
    const inviterName = session.profile?.username ?? tr("WebPortal.NOTIFICATION_PLAYER_FALLBACK");
    const rewardMessage = tr("VictoryModal.REFERRAL_REWARD_MESSAGE", {coins: JEST_REFERRAL_REWARD_COINS});
    trackFunnel("viral_share_intent", {surface: "profile", campaign: "open_invite_v1"});
    void withPlatformActivity(async () => {
      const shareImage = await sizeCheckedScreenshotProvider(() => captureVictoryShareImage({
        title: tr("WebPortal.APP_TITLE"),
        summary: rewardMessage,
        emojiGrid: "🧩  🤝  🪙",
      }))();
      return platform.shareReferral({
        reference: JEST_REFERRAL_REFERENCES.friendChallenge,
        shareTitle: tr("WebPortal.APP_TITLE"),
        shareText: tr("VictoryModal.OPEN_INVITE_MESSAGE", {
          name: inviterName,
          coins: JEST_REFERRAL_REWARD_COINS,
        }),
        ...(shareImage ? {shareImage} : {}),
        onboardingSlug: "friend-challenge",
        entryPayload: {
          campaign: "open_invite_v1",
          reference: "profile_invite_v1",
          inviteKind: "open",
          inviterName,
        },
      });
    }).then((result) => trackFunnel("viral_share_dialog_result", {
      status: result.status,
      surface: "profile",
      campaign: "open_invite_v1",
    })).catch((error) => {
      console.warn("[riddle-quest] Jest profile invite failed", error);
      trackFunnel("viral_share_dialog_result", {
        status: "retryable-failure",
        surface: "profile",
        campaign: "open_invite_v1",
      });
    });
  }, [locale, platform, session, trackFunnel, withPlatformActivity]);

  useEffect(() => {
    if (!authHarness || !session) return;
    const onResult = (event: Event) => {
      shareResult((event as CustomEvent<ReferralResultShareInput>).detail ?? {});
    };
    const onRace = (event: Event) => {
      const detail = (event as CustomEvent<ReferralRaceShareInput>).detail;
      if (detail) shareRace(detail);
    };
    window.addEventListener("riddle-quest:share-referral", onResult);
    window.addEventListener("riddle-quest:share-race", onRace);
    window.addEventListener("riddle-quest:share-invite", shareInvite);
    return () => {
      window.removeEventListener("riddle-quest:share-referral", onResult);
      window.removeEventListener("riddle-quest:share-race", onRace);
      window.removeEventListener("riddle-quest:share-invite", shareInvite);
    };
  }, [authHarness, session, shareInvite, shareRace, shareResult]);

  return useMemo(() => session ? {
    rewardCoins: JEST_REFERRAL_REWARD_COINS,
    shareResult,
    shareInvite,
    shareRace,
  } : null, [session, shareInvite, shareRace, shareResult]);
}
