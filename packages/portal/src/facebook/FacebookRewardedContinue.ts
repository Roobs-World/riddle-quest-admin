import type {AdsCapability, AttemptRecoveryCapability} from "../platform/types";
import {createRequestId} from "@qwordly/hosted/play/requestIds";

/** Sequences SDK completion before one bounded server attempt, never a coin grant. */
export function createFacebookRewardedContinue({ads, claim, isActive}: {
  /** Target-owned rewarded-video capability; absent targets cannot request ad-funded continuation. */
  ads?: AdsCapability;
  /** Requests the server-authoritative continuation using a retained idempotency receipt. */
  claim: (input: {
  /** Single-player mode bound to the continuation session. */
  gameMode: "classic" | "challenge";
  /** Authority-owned question identity for the continuation grant. */
  riddleId: string;
  /** Server-issued session token binds continuation to the current question. */
  sessionToken: string;
  /** Stable mutation receipt retained across grant delivery retries. */
  requestId: string}) => Promise<{
  /** Validated authoritative balance returned after the continuation grant. */
  newCoins: number}>;
  /** Checks whether the originating account and platform lifetime still own this action. */
  isActive: () => boolean;
}): AttemptRecoveryCapability | undefined {
  if (!ads?.rewardedAvailable) return undefined;
  /** Retains an observed completion across transport retries without replaying the video. */
  let pending: {
  /** Serialized mode, question and session identity of the observed video completion. */
  binding: string;
  /** Stable mutation receipt retained across grant delivery retries. */
  requestId: string} | undefined;
  /** Suppresses duplicate clicks throughout both provider and server work. */
  let busy = false;
  return {
    /** Requests continuation only while its account and question still own the action. */
    async request(input) {
      if (busy || !isActive()) return {status: "unavailable", message: "facebook-continuation-unavailable"};
      busy = true;
      try {
        /** Serialized mode, question and session identity of the observed video completion. */
        const binding = JSON.stringify([input.gameMode, input.riddleId, input.sessionToken]);
        if (pending?.binding !== binding) {
          pending = undefined;
          /** Observed rewarded-video completion controls whether a grant may be requested. */
          const shown = await ads.showRewarded("continue");
          if (shown.status !== "success") return shown;
          if (!isActive()) return {status: "unavailable", message: "facebook-continuation-unavailable"};
          pending = {binding, requestId: createRequestId("rewarded-continue")};
        }
        if (!isActive()) return {status: "unavailable", message: "facebook-continuation-unavailable"};
        /** Authority response is validated before applying its balance and continuation. */
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
