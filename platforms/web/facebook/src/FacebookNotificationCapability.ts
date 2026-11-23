import type {NotificationCapability, PlatformResult} from "../../../../packages/web-game/src/platform/types";
import type {FacebookInstantSdk} from "./fbinstant";
import {runFacebookSdkDialog} from "./FacebookSdkDialogGate";

/** Creates the Meta-owned subscription prompt only when all required v8 APIs are supported. */
export function createFacebookNotificationCapability(sdk: FacebookInstantSdk): NotificationCapability | undefined {
  /** APIs advertised by the current Meta host, rather than assumed from SDK presence. */
  const supported = new Set(sdk.getSupportedAPIs());
  /** Player-scoped bot APIs remain behind the Facebook adapter. */
  const player = sdk.player;
  if (
    !supported.has("player.canSubscribeBotAsync") ||
    !supported.has("player.isSubscribedBotAsync") ||
    !supported.has("player.subscribeBotAsync") ||
    typeof player.canSubscribeBotAsync !== "function" ||
    typeof player.isSubscribedBotAsync !== "function" ||
    typeof player.subscribeBotAsync !== "function"
  ) return undefined;

  /** One platform dialog shared by simultaneous callers. */
  let inFlight: Promise<PlatformResult<void>> | undefined;
  /** Checks existing consent and eligibility before opening Meta UI. */
  const requestPermission = async (): Promise<PlatformResult<void>> => {
    try {
      if (await player.isSubscribedBotAsync!() === true) return {status: "success", value: undefined};
      if (await player.canSubscribeBotAsync!() !== true) {
        return {status: "unavailable", message: "facebook-notification-prompt-unavailable"};
      }
      await player.subscribeBotAsync!();
      if (await player.isSubscribedBotAsync!() !== true) return {status: "cancelled"};
      return {status: "success", value: undefined};
    } catch (error) {
      /** Meta distinguishes player dismissal from transport or host errors. */
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      if (code === "USER_INPUT" || code === "USER_CANCELLED") return {status: "cancelled"};
      return {status: "retryable-failure", message: "facebook-notification-prompt-failed"};
    }
  };
  return {
    /** Coalesces permission requests into one Meta subscription dialog. */
    requestPermission() {
      inFlight ??= runFacebookSdkDialog(sdk, requestPermission).finally(() => {inFlight = undefined;});
      return inFlight;
    },
    // Bot subscription is consent, not a browser scheduling API. Delivery requires
    // a separately approved server integration; never forward this to Jest.
    /** Reports scheduling as unavailable until a separate Meta delivery contract is implemented. */
    async schedule() {
      return {status: "unavailable", message: "facebook-notification-scheduling-unavailable"};
    },
    /** Does not claim that an unsupported provider cancellation succeeded. */
    async cancel() {
      return {status: "unavailable", message: "facebook-notification-cancellation-unavailable"};
    },
  };
}
