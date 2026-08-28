import type {GameModal, GameSessionState} from "../../gameSession";
import {getRankForLevel} from "../../ranks";

/** A single screen in a victory or auxiliary reward celebration. */
export type FanfareStep =
  | {
      /** Stores kind. */
      kind: "achievement"; /** Stores achievement id. */
      /** Stores achievement id. */
      achievementId: string;
    }
  | {
      /** Stores kind. */
      kind: "victory";
    }
  | {
      /** Stores kind. */
      kind: "level";
    }
  | {
      /** Stores kind. */
      kind: "rank";
    }
  | {
      /** Stores kind. */
      kind: "purchase";
    }
  | {
      /** Stores kind. */
      kind: "referral";
    }
  | {
      /** Stores kind. */
      kind: "coins";
    };

/** Coin award displayed during a fanfare sequence. */
export type FanfareCoinAward = {
  /** Stores id. */
  id: string;
  /** Stores amount. */
  amount: number;
  /** Stores total. */
  total: number;
};

/** State fields required to resolve the active fanfare coin award. */
export type FanfareAwardState = Pick<
  GameSessionState,
  "auxiliaryFanfare" | "lastOutcome" | "lastRewards" | "modal" | "profile"
>;

/** Builds the ordered celebration steps for a server-authoritative victory reward. */
export function createVictoryFanfareSteps(reward: GameSessionState["lastRewards"]): FanfareStep[] {
  if (!reward) return [];

  /** Provides victory level behavior. */
  const victoryLevel = reward.newLevel;
  /** Provides reached new rank behavior. */
  const reachedNewRank =
    reward.leveledUp === true &&
    victoryLevel !== undefined &&
    getRankForLevel(Math.max(1, victoryLevel - 1)).id !== getRankForLevel(victoryLevel).id;

  return [
    ...reward.newlyUnlockedAchievementIds.map((achievementId): FanfareStep => ({kind: "achievement", achievementId})),
    {kind: "victory"},
    ...(reward.leveledUp ? ([{kind: "level"}] as FanfareStep[]) : []),
    ...(reachedNewRank ? ([{kind: "rank"}] as FanfareStep[]) : []),
  ];
}

/** Builds the ordered celebration steps for a purchase or achievement reward. */
export function createRewardFanfareSteps(fanfare: GameSessionState["auxiliaryFanfare"]): FanfareStep[] {
  if (!fanfare) return [];

  return [
    ...(fanfare.kind === "purchase" ? ([{kind: "purchase"}] as FanfareStep[]) : []),
    ...(fanfare.kind === "referral" ? ([{kind: "referral"}] as FanfareStep[]) : []),
    ...fanfare.achievementIds.map((achievementId): FanfareStep => ({kind: "achievement", achievementId})),
    ...(fanfare.kind === "achievement" && fanfare.coinsAwarded > 0 ? ([{kind: "coins"}] as FanfareStep[]) : []),
  ];
}

/** Returns the current step while safely clamping an out-of-range index. */
export function getActiveFanfareStep(steps: readonly FanfareStep[], index: number): FanfareStep | undefined {
  return steps[Math.min(Math.max(0, index), Math.max(0, steps.length - 1))];
}

/** Resolves the coin award associated with the active modal sequence step. */
export function getActiveCoinAward(
  state: FanfareAwardState,
  victoryStep: FanfareStep | undefined,
  rewardStep: FanfareStep | undefined,
): FanfareCoinAward | null {
  if (state.modal === "victory" && victoryStep?.kind === "victory") {
    return {
      id: `victory-${state.lastOutcome?.id ?? "current"}`,
      amount: state.lastRewards?.coinsEarned ?? 0,
      total: state.lastRewards?.totalCoins ?? state.profile?.coins ?? 0,
    };
  }

  if (
    state.modal === "reward" &&
    (rewardStep?.kind === "purchase" || rewardStep?.kind === "referral" || rewardStep?.kind === "coins")
  ) {
    return {
      id: `${state.auxiliaryFanfare?.id ?? "reward"}-${rewardStep.kind}`,
      amount: state.auxiliaryFanfare?.coinsAwarded ?? 0,
      total: state.auxiliaryFanfare?.totalCoins ?? state.profile?.coins ?? 0,
    };
  }

  return null;
}

/** Reports whether a positive coin award still requires player collection. */
export function isCoinCollectionPending(award: FanfareCoinAward | null, collectedAwardId: string | null): boolean {
  return Boolean(award && award.amount > 0 && collectedAwardId !== award.id);
}

/** Identifies modal kinds that can render a fanfare sequence. */
export function isFanfareModal(modal: GameModal): modal is "victory" | "reward" {
  return modal === "victory" || modal === "reward";
}
