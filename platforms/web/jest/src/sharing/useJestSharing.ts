import {useCallback, useEffect, useMemo} from "react";
import {JEST_REFERRAL_REFERENCES, JEST_REFERRAL_REWARD_COINS} from "../referrals/referralCampaigns";
import {tr} from "../../../../../src/localization/browser/i18n";
import type {
  ReferralRaceShareInput,
  ReferralResultShareInput,
  ReferralShareOutcome,
  ReferralSharingCapability,
} from "../../../../../src/sharing/components/ReferralSharingCapability";
import type {JestBackendPort} from "../backend";
import type {JestPlatformPort, JestSession} from "../types";
import {createUniqueJestReferralReference} from "./referralReferences";
import {
  captureGameScreenshot,
  captureVictoryShareImage,
  sizeCheckedScreenshotProvider,
  sizeCheckedShareImage,
} from "./screenshots";

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
  sharingEnabled,
  withPlatformActivity,
  withBackgroundPlatformActivity,
  trackFunnel,
  authHarness = false,
}: {
  /** Stores locale. */
  locale: string;
  /** Stores session. */
  session: JestSession | null;
  /** Stores platform. */
  platform: JestPlatformPort;
  /** Stores backend. */
  backend: JestBackendPort;
  /** Synchronous account-deletion check for dialogs opened directly by a click. */
  sharingEnabled: () => boolean;
  /** Stores with platform activity. */
  withPlatformActivity: WithPlatformActivity;
  /** Stores with background platform activity. */
  withBackgroundPlatformActivity: WithPlatformActivity;
  /** Stores track funnel. */
  trackFunnel: TrackFunnel;
  /** Retains the legacy browser event driver only inside the trusted Jest test harness. */
  authHarness?: boolean;
}): ReferralSharingCapability | null {
  /** Game-owned display name included in the invitation text. */
  const inviterName = session?.profile?.username ?? tr("WebPortal.NOTIFICATION_PLAYER_FALLBACK");
  useEffect(() => {
    if (!session?.player.registered || !("serviceWorker" in navigator)) return;
    /** Worker clicks refresh pending notices without accepting or interrupting an existing match. */
    const receive = (event: MessageEvent<unknown>) => {
      /** Validated data carries only a destination hint; the server owns acceptance authority. */
      const data = event.data as {
        /** Fixed worker event. */
        kind?: unknown;
        /** Opaque invitation. */
        challengeId?: unknown;
      };
      if (data?.kind === "liveChallenge" && typeof data.challengeId === "string" && /^live_[a-f0-9]{64}$/.test(data.challengeId))
        window.dispatchEvent(new Event("riddle-quest:live-race-inbox-changed"));
    };
    navigator.serviceWorker.addEventListener("message", receive);
    return () => navigator.serviceWorker.removeEventListener("message", receive);
  }, [session?.player.registered]);
  useEffect(() => {
    if (!session) return;
    platform.setScreenshotProvider(sizeCheckedScreenshotProvider(captureGameScreenshot));
    return () => platform.setScreenshotProvider(null);
  }, [platform, session?.player.playerId]);

  useEffect(() => {
    if (!session?.player.registered) return;
    void withBackgroundPlatformActivity(async () => {
      /** Provides result behavior. */
      const result = await platform.listReferralsSigned();
      if (result.status === "success") {
        /** Provides verification behavior. */
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
          /** Provides detail behavior. */
          const detail = {
            coinsAwarded: verification.rewardsGranted! * verification.coinsPerPlayer,
            newCoins: verification.newCoins,
            conversions: verification.rewardsGranted,
          };
          (
            window as Window & {
              /** Stores riddle quest pending referral reward. */
              __RIDDLE_QUEST_PENDING_REFERRAL_REWARD__?: typeof detail;
            }
          ).__RIDDLE_QUEST_PENDING_REFERRAL_REWARD__ = detail;
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

  /** Provides share result behavior. */
  const shareResult = useCallback(
    (detail: ReferralResultShareInput) => {
      if (!session) return;
      /** Provides game mode behavior. */
      const gameMode = detail.gameMode === "challenge" ? "challenge" : "classic";
      /** Provides attempts behavior. */
      const attempts =
        typeof detail.attempts === "number" && Number.isFinite(detail.attempts)
          ? Math.min(99, Math.max(1, Math.round(detail.attempts)))
          : 1;
      /** Provides game type behavior. */
      const gameType = tr(
        gameMode === "challenge" ? "VictoryModal.SHARE_DAILY_CHALLENGE_LABEL" : "VictoryModal.SHARE_CLASSIC_MODE_LABEL",
      );
      /** Provides attempt label behavior. */
      const attemptLabel = tr(
        attempts === 1 ? "VictoryModal.SHARE_ATTEMPT_SINGULAR" : "VictoryModal.SHARE_ATTEMPT_PLURAL",
      );
      /** Provides emoji grid behavior. */
      const emojiGrid = detail.emojiGrid?.slice(0, 500) || "🟩";
      /** Provides reward message behavior. */
      const rewardMessage = tr("VictoryModal.REFERRAL_REWARD_MESSAGE", {coins: JEST_REFERRAL_REWARD_COINS});
      /** Provides share text behavior. */
      const shareText = `${tr("VictoryModal.SHARE_MESSAGE_TEMPLATE", {gameType, attempts, attemptLabel, emojiGrid})}\n\n${rewardMessage}`;
      /** Provides referral reference behavior. */
      const referralReference = createUniqueJestReferralReference("result");
      trackFunnel("viral_share_intent", {surface: "victory", campaign: "friend_challenge_v2", gameMode});
      void withPlatformActivity(() => {
        /** Provides share image behavior. */
        const shareImage = sizeCheckedShareImage(
          captureVictoryShareImage({
            title: tr("VictoryModal.SHARE_RESULT_TITLE"),
            summary: `${gameType} · ${attempts} ${attemptLabel}`,
            emojiGrid,
          }),
        );
        return platform.shareReferral({
          reference: referralReference,
          shareTitle: tr("VictoryModal.SHARE_RESULT_TITLE"),
          shareText,
          ...(shareImage ? {shareImage} : {}),
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
      })
        .then((result) => {
          trackFunnel("friend_challenge_share_dialog", {status: result.status, gameMode, attempts});
          trackFunnel("viral_share_dialog_result", {
            status: result.status,
            surface: "victory",
            campaign: "friend_challenge_v2",
          });
        })
        .catch((error) => {
          console.warn("[riddle-quest] Jest victory share failed", error);
          trackFunnel("viral_share_dialog_result", {
            status: "retryable-failure",
            surface: "victory",
            campaign: "friend_challenge_v2",
          });
        });
    },
    [locale, platform, session, inviterName, trackFunnel, withPlatformActivity],
  );

  /** Provides share race behavior. */
  const shareRace = useCallback(
    async (detail: ReferralRaceShareInput): Promise<ReferralShareOutcome> => {
      if (
        !session ||
        !detail.challengeId ||
        detail.challengeId.length > 160 ||
        typeof detail.preview.adjustedTimeToBeatMs !== "number" ||
        !Number.isFinite(detail.preview.adjustedTimeToBeatMs) ||
        detail.preview.adjustedTimeToBeatMs <= 0
      )
        return "error";
      /** Provides challenge id behavior. */
      const challengeId = detail.challengeId;
      /** Provides seconds behavior. */
      const seconds = (detail.preview.adjustedTimeToBeatMs / 1_000).toFixed(1);
      /** Provides summary behavior. */
      const summary = `${inviterName} · ${seconds}s · ${tr("RaceTo10.FIRST_TO_TEN")}`;
      /** Provides referral reference behavior. */
      const referralReference = createUniqueJestReferralReference("race");
      trackFunnel("viral_share_intent", {surface: "race", campaign: "race_to_10_v1"});
      try {
        /** Provider result for the referral dialog request. */
        const result = await withPlatformActivity(() => {
          /** Provides share image behavior. */
          const shareImage = sizeCheckedShareImage(
            captureVictoryShareImage({title: tr("RaceTo10.TITLE"), summary, emojiGrid: "🏁 10/10"}),
          );
          return platform.shareReferral({
            reference: referralReference,
            shareTitle: tr("RaceTo10.TITLE"),
            shareText: `${tr("RaceTo10.CHALLENGED_BY", {name: inviterName})} · ${tr("RaceTo10.TIME_TO_BEAT", {time: `${seconds}s`})}\n\n${tr("VictoryModal.REFERRAL_REWARD_MESSAGE", {coins: JEST_REFERRAL_REWARD_COINS})}`,
            ...(shareImage ? {shareImage} : {}),
            entryPayload: {
              campaign: "race_to_10_v1",
              reference: "race_to_10_share_v1",
              inviteKind: "race",
              challengeDestination: challengeId,
              challengeId,
              inviterName,
            },
          });
        });
        trackFunnel("race_challenge_share_dialog", {
          status: result.status,
          categoryId: detail.preview.categoryId ?? "unknown",
        });
        trackFunnel("viral_share_dialog_result", {
          status: result.status,
          surface: "race",
          campaign: "race_to_10_v1",
        });
        return result.status === "success" ? "success" : result.status === "cancelled" ? "cancelled" : "error";
      } catch (error) {
        console.warn("[riddle-quest] Jest race share failed", error);
        trackFunnel("viral_share_dialog_result", {
          status: "retryable-failure",
          surface: "race",
          campaign: "race_to_10_v1",
        });
        return "error";
      }
    },
    [locale, platform, session, inviterName, trackFunnel, withPlatformActivity],
  );

  /** Shares a private PvP lobby through Jest's native dialog, including the host's SMS share option. */
  const shareLiveRace = useCallback(async ({challengeId}: {
    /** Server-issued private lobby handle. */
    challengeId: string;
  }): Promise<ReferralShareOutcome> => {
    if (!session || !sharingEnabled() || !/^live_[a-f0-9]{64}$/.test(challengeId)) return "error";
    try {
      // Jest opens its platform-owned dialog through the SDK bridge after lobby reservation.
      /** Provider outcome for sharing this private lobby, independent of recipient acceptance. */
      const result = await platform.shareReferral({
        reference: createUniqueJestReferralReference("race"),
        shareTitle: tr("RaceTo10.CHALLENGE_FRIEND"),
        shareText: tr("RaceTo10.LIVE_INVITE_MESSAGE", {name: inviterName}),
        entryPayload: {inviteKind: "race", campaign: "live_pvp_v1", challengeDestination: "multiplayer", challengeId, inviterName},
      });
      return result.status === "success" ? "success" : result.status === "cancelled" ? "cancelled" : "error";
    } catch {return "error";}
  }, [locale, platform, session, inviterName, sharingEnabled]);

  /** Opens Jest's provider-owned profile invite dialog with custom referral details. */
  const shareInvite = useCallback(() => {
    if (!session) return;
    /** Provides reward message behavior. */
    const rewardMessage = tr("VictoryModal.REFERRAL_REWARD_MESSAGE", {coins: JEST_REFERRAL_REWARD_COINS});
    /** Custom preview prepared synchronously so the SDK call remains in the button's click dispatch. */
    const shareImage = sizeCheckedShareImage(
      captureVictoryShareImage({
        title: tr("WebPortal.APP_TITLE"),
        summary: rewardMessage,
        emojiGrid: "🧩  🤝  🪙",
      }),
    );
    trackFunnel("viral_share_intent", {surface: "profile", campaign: "open_invite_v1"});
    void platform
      .shareReferral({
        reference: JEST_REFERRAL_REFERENCES.friendChallenge,
        shareTitle: tr("WebPortal.APP_TITLE"),
        shareText: tr("VictoryModal.OPEN_INVITE_MESSAGE", {
          name: inviterName,
          coins: JEST_REFERRAL_REWARD_COINS,
        }),
        ...(shareImage ? {shareImage} : {}),
        entryPayload: {
          campaign: "open_invite_v1",
          reference: "profile_invite_v1",
          inviteKind: "open",
          inviterName,
        },
      })
      .then((result) =>
        trackFunnel("viral_share_dialog_result", {
          status: result.status,
          surface: "profile",
          campaign: "open_invite_v1",
        }),
      )
      .catch((error) => {
        console.warn("[riddle-quest] Jest profile invite failed", error);
        trackFunnel("viral_share_dialog_result", {
          status: "retryable-failure",
          surface: "profile",
          campaign: "open_invite_v1",
        });
      });
  }, [locale, platform, session, inviterName, trackFunnel]);
  useEffect(() => {
    if (!authHarness || !session) return;
    /** Provides on result behavior. */
    const onResult = (event: Event) => {
      shareResult((event as CustomEvent<ReferralResultShareInput>).detail ?? {});
    };
    /** Provides on race behavior. */
    const onRace = (event: Event) => {
      /** Provides detail behavior. */
      const detail = (event as CustomEvent<ReferralRaceShareInput>).detail;
      if (detail) void shareRace(detail);
    };
    /** Harness listeners registered together so cleanup removes the exact same callbacks. */
    const handlers: [string, EventListener][] = [
      ["riddle-quest:share-referral", onResult],
      ["riddle-quest:share-race", onRace],
      ["riddle-quest:share-invite", shareInvite],
    ];
    for (const [event, handler] of handlers) window.addEventListener(event, handler);
    return () => {
      for (const [event, handler] of handlers) window.removeEventListener(event, handler);
    };
  }, [authHarness, session, shareInvite, shareRace, shareResult]);

  return useMemo(
    () =>
      session
        ? {
            rewardCoins: JEST_REFERRAL_REWARD_COINS,
            shareResult,
            shareInvite,
            shareRace,
            shareLiveRace,
            autoOpenLiveRaceInvite: true,
          }
        : null,
    [session, shareInvite, shareRace, shareResult, shareLiveRace],
  );
}
