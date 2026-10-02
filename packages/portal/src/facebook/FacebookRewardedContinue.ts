import type {AdsCapability, AttemptRecoveryCapability} from "../platform/types";
import {createRequestId} from "../play/requestIds";

/** Sequences SDK completion before one bounded server attempt, never a coin grant. */
export function createFacebookRewardedContinue({ads, claim, isActive}: {
  ads?: AdsCapability;
  claim: (input: {gameMode: "classic" | "challenge"; riddleId: string; sessionToken: string; requestId: string}) => Promise<{newCoins: number}>;
  isActive: () => boolean;
}): AttemptRecoveryCapability | undefined {
  if (!ads?.rewardedAvailable) return undefined;
  /** Retains an observed completion across transport retries without replaying the video. */
  let pending: {binding: string; requestId: string} | undefined;
  /** Suppresses duplicate clicks throughout both provider and server work. */
  let busy = false;
  return {
    async request(input) {
      if (busy || !isActive()) return {status: "unavailable", message: "facebook-continuation-unavailable"};
      busy = true;
      try {
        const binding = JSON.stringify([input.gameMode, input.riddleId, input.sessionToken]);
        if (pending?.binding !== binding) {
          pending = undefined;
          const shown = await ads.showRewarded("continue");
          if (shown.status !== "success") return shown;
          if (!isActive()) return {status: "unavailable", message: "facebook-continuation-unavailable"};
          pending = {binding, requestId: createRequestId("rewarded-continue")};
        }
        if (!isActive()) return {status: "unavailable", message: "facebook-continuation-unavailable"};
        const result = await claim({...input, requestId: pending.requestId});
        if (!Number.isSafeInteger(result.newCoins) || result.newCoins < 0) throw new Error("invalid-continuation-response");
        return isActive() ? {status: "success", value: result} : {status: "unavailable", message: "facebook-continuation-unavailable"};
      } catch {
        return {status: "retryable-failure", message: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"};
      } finally {
        busy = false;
      }
    },
  };
}
