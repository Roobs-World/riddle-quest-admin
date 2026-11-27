import {tr} from "../../../../src/localization/browser/i18n";
import {captureVictoryShareImage} from "../../../../src/sharing/browser/shareImages";
import type {ReferralSharingCapability, ReferralShareOutcome} from "../../../../src/sharing/components/ReferralSharingCapability";
import type {FacebookInstantSdk, FacebookSharePayload} from "./fbinstant";
import type {FacebookAgeCategory} from "./FacebookCapabilityPolicy";
import {createFacebookReferralToken, parseFacebookReferralTokenResponse} from "./referrals";
import {runFacebookSdkDialog} from "./FacebookSdkDialogGate";
import {createFacebookLiveRaceSharing} from "./FacebookLiveRaceSharing";

/** Supplies native Meta invitations only after authenticated feature and age gates succeed. */
export function createFacebookReferralSharing({sdk, enabled, referralsEnabled, ageCategory, isActive, issueToken = createFacebookReferralToken,
  renderImage = captureVictoryShareImage, reportFailure = () => undefined}: {
  /** Started Meta host. */
  sdk: FacebookInstantSdk;
  /** Authenticated host permits native social dialogs. */
  enabled: boolean;
  /** Authenticated server switch for optional referral attribution. */
  referralsEnabled: boolean;
  /** Verified release audience. */
  ageCategory: FacebookAgeCategory;
  /** Prevents late shares after unmount or account deletion. */
  isActive: () => boolean;
  /** Server-issued invitation authority. */
  issueToken?: () => Promise<unknown>;
  /** Local identity-free share card renderer. */
  renderImage?: typeof captureVictoryShareImage;
  /** Reports bounded errors without leaking entry data. */
  reportFailure?: (error: Error) => void;
}): ReferralSharingCapability | undefined {
  if (!enabled || ageCategory !== "13_plus") return undefined;
  const supported = sdk.getSupportedAPIs();
  const inviteAsync = supported.includes("inviteAsync") && typeof sdk.inviteAsync === "function"
    ? sdk.inviteAsync.bind(sdk) : undefined;
  const shareAsync = supported.includes("shareAsync") && typeof sdk.shareAsync === "function"
    ? sdk.shareAsync.bind(sdk) : undefined;
  if (!inviteAsync && !shareAsync) return undefined;
  /** Diagnostics cannot change a native dialog's outcome or block neutral invitations. */
  const reportSafely = (error: Error) => {
    try {reportFailure(error);} catch { /* Reporting is best effort. */ }
  };

  /** Occupies the shared provider dialog gate before issuing a token, so double taps cannot open two dialogs. */
  const share = async (intent: FacebookSharePayload["intent"], text: string, data: Record<string, string>,
    card: Parameters<typeof captureVictoryShareImage>[0]): Promise<ReferralShareOutcome> => {
    if (!isActive()) return "error";
    /** Provider completion is an invitation result, never a currency grant. */
    const result = await runFacebookSdkDialog(sdk, async () => {
      try {
        if (!isActive()) return {status: "unavailable", message: "facebook-share-inactive"};
        /** Cards contain game results only, with no DOM/profile or provider identity capture. */
        const image = renderImage(card);
        if (!image || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image) || image.length > 2_800_000)
          throw new Error("facebook-share-image-unavailable");
        /** Attribution is optional for a neutral invitation, never a condition of inviting a friend. */
        let entry = data;
        if (referralsEnabled) {
          try {
            const {token} = parseFacebookReferralTokenResponse(await issueToken());
            entry = {...data, referralToken: token};
          } catch (error) {
            if (intent !== "INVITE") throw error;
            reportSafely(new Error("facebook-invite-attribution-unavailable"));
          }
        }
        if (!isActive()) return {status: "unavailable", message: "facebook-share-inactive"};
        /** This fixed, ASCII-only envelope fits Meta's 1KB entry-data contract. */
        if (JSON.stringify(entry).length > 1000) throw new Error("facebook-share-data-too-large");
        if (intent === "INVITE" && inviteAsync) {
          await inviteAsync({image, text: {default: text}, data: entry,
            cta: tr("VictoryModal.INVITE_FRIEND"), dialogTitle: tr("VictoryModal.INVITE_FRIEND")});
        } else if (shareAsync) {
          await shareAsync({intent, text, image, data: entry, switchContext: false});
        } else return {status: "unavailable", message: "facebook-share-unsupported"};
        return {status: "success", value: undefined};
      } catch (error) {
        /** Meta treats an explicitly dismissed native dialog as ordinary user input. */
        const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
        if (code === "USER_INPUT" || code === "USER_CANCELLED") return {status: "cancelled"};
        reportSafely(new Error("facebook-native-share-failed"));
        return {status: "retryable-failure", message: "facebook-native-share-failed"};
      }
    });
    return result.status === "success" ? "success" : result.status === "cancelled" ? "cancelled" : "error";
  };
  return {
    rewardCoins: referralsEnabled ? 100 : 0,
    /** Reads copy after restored preferences or an in-game language change. */
    get inviteLabel() {return tr("VictoryModal.INVITE_FRIEND");},
    /** Uses the active locale when the shared race view renders. */
    get raceShareLabel() {return tr("RaceTo10.CHALLENGE_FRIEND");},
    /** Keeps native share instructions in the player's selected language. */
    get raceReadyText() {return tr("RaceTo10.FIRST_TO_TEN");},
    /** Opens an explicitly requested native invitation. */
    shareInvite() {
      /** The translated game summary avoids promising rewards merely for registering or sharing. */
      const summary = tr("RaceTo10.FIRST_TO_TEN");
      return share("INVITE", `Riddle Quest · ${summary}`, {}, {title: tr("VictoryModal.INVITE_FRIEND"), summary, emojiGrid: ""});
    },
    /** Shares the same native invitation behavior as the independently gated multiplayer capability. */
    shareLiveRace: createFacebookLiveRaceSharing({sdk, enabled: referralsEnabled, ageCategory, isActive, renderImage, reportFailure: reportSafely}),
    ...(shareAsync ? {
      /** Shares a completed result through Meta. */
      shareResult(input: Parameters<NonNullable<ReferralSharingCapability["shareResult"]>>[0]) {
        /** Copy and visual payload remain bounded even for a malformed shared UI input. */
        const attempts = typeof input.attempts === "number" && Number.isSafeInteger(input.attempts) && input.attempts > 0
          ? Math.min(input.attempts, 99) : 1;
        /** Selects the bounded single-player destination. */
        const gameMode = input.gameMode === "challenge" ? "challenge" : "classic";
        /** Localized mode label used in the share card. */
        const gameType = tr(gameMode === "challenge" ? "VictoryModal.SHARE_DAILY_CHALLENGE_LABEL" : "VictoryModal.SHARE_CLASSIC_MODE_LABEL");
        /** Localized singular or plural attempt label. */
        const attemptLabel = tr(attempts === 1 ? "VictoryModal.SHARE_ATTEMPT_SINGULAR" : "VictoryModal.SHARE_ATTEMPT_PLURAL");
        /** Bounded board representation, without answer or identity. */
        const emojiGrid = typeof input.emojiGrid === "string" ? input.emojiGrid.slice(0, 500) : "🟩";
        return share("SHARE", tr("VictoryModal.SHARE_MESSAGE_TEMPLATE", {gameType, attempts, attemptLabel, emojiGrid}), {gameMode},
          {title: tr("VictoryModal.SHARE_RESULT_TITLE"), summary: `${gameType} · ${attempts} ${attemptLabel}`, emojiGrid});
      },
      /** Shares a server-published challenge through Meta. */
      async shareRace(input: Parameters<NonNullable<ReferralSharingCapability["shareRace"]>>[0]): Promise<ReferralShareOutcome> {
        if (!/^[A-Za-z0-9_-]{1,160}$/.test(input.challengeId) || !Number.isSafeInteger(input.preview.adjustedTimeToBeatMs) ||
          input.preview.adjustedTimeToBeatMs < 0) return "error";
        /** Scores are presentation only; the incoming server challenge supplies all competitive authority. */
        const summary = tr("RaceTo10.TIME_TO_BEAT", {time: `${(input.preview.adjustedTimeToBeatMs / 1000).toFixed(2)}s`});
        return share("CHALLENGE", `${tr("RaceTo10.TITLE")} · ${summary}`, {challengeId: input.challengeId},
          {title: tr("RaceTo10.TITLE"), summary, emojiGrid: ""});
      },
    } : {}),
  };
}
