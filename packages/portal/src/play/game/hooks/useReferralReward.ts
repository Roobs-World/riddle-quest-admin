import {useEffect} from "react";
import type {Dispatch, MutableRefObject} from "react";
import type {GameSessionAction, GameSessionState} from "../../gameSessionTypes";

/** Describes referral reward detail. */
type ReferralRewardDetail = {
  /** Stores coins awarded. */
  coinsAwarded?: unknown;
  /** Stores new coins. */
  newCoins?: unknown;
  /** Stores conversions. */
  conversions?: unknown;
};

/** Describes referral reward window. */
type ReferralRewardWindow = Window & {
  /** Stores riddle quest pending referral reward. */
  __RIDDLE_QUEST_PENDING_REFERRAL_REWARD__?: ReferralRewardDetail;
};

/** Applies a verified referral reward after authoritative game initialization. */
export function useReferralReward(
  stateRef: MutableRefObject<GameSessionState>,
  dispatch: Dispatch<GameSessionAction>,
  initialized: boolean,
  riddleId: string | undefined,
) {
  useEffect(() => {
    /** Provides reward window behavior. */
    const rewardWindow = window as ReferralRewardWindow;
    /** Provides show referral reward behavior. */
    const showReferralReward = (event: Event) => {
      /** Provides detail behavior. */
      const detail = (event as CustomEvent<ReferralRewardDetail>).detail;
      // Host initialization replaces the bootstrap snapshot, so rewards remain
      // queued until the authoritative profile and riddle have both arrived.
      if (!stateRef.current.initialized || !stateRef.current.riddle) return;

      delete rewardWindow.__RIDDLE_QUEST_PENDING_REFERRAL_REWARD__;
      /** Provides coins awarded behavior. */
      const coinsAwarded = detail?.coinsAwarded;
      /** Provides new coins behavior. */
      const newCoins = detail?.newCoins;
      if (
        typeof coinsAwarded !== "number" ||
        !Number.isFinite(coinsAwarded) ||
        coinsAwarded <= 0 ||
        typeof newCoins !== "number" ||
        !Number.isFinite(newCoins) ||
        newCoins < 0
      )
        return;

      dispatch({type: "coinsUpdated", newCoins});
      dispatch({
        type: "showAuxiliaryFanfare",
        fanfare: {
          id: `referral-${Date.now()}`,
          kind: "referral",
          coinsAwarded,
          totalCoins: newCoins,
          achievementIds: [],
        },
      });
    };

    window.addEventListener("riddle-quest:referral-reward", showReferralReward);
    /** Provides pending reward behavior. */
    const pendingReward = rewardWindow.__RIDDLE_QUEST_PENDING_REFERRAL_REWARD__;
    if (pendingReward) {
      showReferralReward(new CustomEvent("riddle-quest:referral-reward", {detail: pendingReward}));
    }
    return () => window.removeEventListener("riddle-quest:referral-reward", showReferralReward);
  }, [dispatch, initialized, riddleId, stateRef]);
}
