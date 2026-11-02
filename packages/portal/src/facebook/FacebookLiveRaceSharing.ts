import type {LiveRaceCapability} from "@riddle-quest/core/race";
import {tr} from "../play/i18n";
import {captureVictoryShareImage} from "../play/sharing/shareImages";
import type {FacebookInstantSdk} from "./fbinstant";
import type {FacebookAgeCategory} from "./FacebookCapabilityPolicy";
import {runFacebookSdkDialog} from "./FacebookSdkDialogGate";

/** Friend challenges use the multiplayer gate independently of referral rewards. */
export function createFacebookLiveRaceSharing({sdk, enabled, ageCategory, isActive,
  renderImage = captureVictoryShareImage, reportFailure = () => undefined}: {
  /** Started and authenticated target SDK. */
  sdk: FacebookInstantSdk;
  /** Authenticated multiplayer feature gate. */
  enabled: boolean;
  /** Verified release audience. */
  ageCategory: FacebookAgeCategory;
  /** Rejects late dialogs after unmount or account deletion. */
  isActive: () => boolean;
  /** Local invitation card renderer. */
  renderImage?: typeof captureVictoryShareImage;
  /** Reports bounded errors without provider diagnostics. */
  reportFailure?: (error: Error) => void;
}): LiveRaceCapability["shareChallenge"] {
  if (!enabled || ageCategory !== "13_plus") return undefined;
  /** Advertised APIs for this exact host. */
  const supported = sdk.getSupportedAPIs();
  /** Prefer the native friend picker when actually callable. */
  const canInvite = supported.includes("inviteAsync") && typeof sdk.inviteAsync === "function";
  /** Older hosts can use their native share dialog. */
  const canShare = supported.includes("shareAsync") && typeof sdk.shareAsync === "function";
  if (!canInvite && !canShare) return undefined;
  return async ({challengeId}) => {
    if (!isActive() || !/^live_[a-f0-9]{64}$/.test(challengeId)) return "error";
    /** One provider prompt may own input at a time. */
    const result = await runFacebookSdkDialog(sdk, async () => {
      try {
        if (!isActive()) return {status: "unavailable", message: "facebook-challenge-inactive"};
        /** Resolve translated copy when the player opens the dialog. */
        const title = tr("RaceTo10.CHALLENGE_FRIEND"), summary = tr("RaceTo10.FIRST_TO_TEN");
        /** The invitation includes no player identity or answer. */
        const image = renderImage({title, summary, emojiGrid: ""});
        if (!image || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image) || image.length > 2_800_000)
          throw new Error("facebook-challenge-image-unavailable");
        if (!isActive()) return {status: "unavailable", message: "facebook-challenge-inactive"};
        /** Only the existing server handle enters provider entry data. */
        const text = `${tr("RaceTo10.TITLE")} · ${summary}`, data = {challengeId};
        if (canInvite) await sdk.inviteAsync!({image, text: {default: text}, data,
          cta: tr("RaceTo10.LIVE_START"), dialogTitle: title});
        else await sdk.shareAsync!({intent: "CHALLENGE", image, text, data, switchContext: false});
        // Closing the provider dialog never counts as accepting or starting the race.
        return {status: "success", value: undefined};
      } catch (error) {
        /** Treat native dismissal as cancellation, without displaying diagnostics. */
        const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
        if (code === "USER_INPUT" || code === "USER_CANCELLED") return {status: "cancelled"};
        reportFailure(new Error("facebook-native-challenge-failed"));
        return {status: "retryable-failure", message: "facebook-native-challenge-failed"};
      }
    });
    return result.status === "success" ? "success" : result.status === "cancelled" ? "cancelled" : "error";
  };
}
