import type {GameModal, GameSessionState} from "@qwordly/hosted/play/gameSession";

/** A single tab in a victory or auxiliary reward queue. */
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

/** Queues every confirmed milestone without requiring another player action. */
export function createVictoryFanfareSteps(reward: GameSessionState["lastRewards"]): FanfareStep[] {
  /** Ordered, deduplicated milestones for this presentation. */
  const steps: FanfareStep[] = [{kind: "victory"}];
  if (reward?.leveledUp === true) steps.push({kind: "level"});
  for (const achievementId of new Set(reward?.newlyUnlockedAchievementIds)) {
    steps.push({kind: "achievement", achievementId});
  }
  return steps;
}

/** Builds the ordered celebration steps for a purchase or achievement reward. */
export function createRewardFanfareSteps(fanfare: GameSessionState["auxiliaryFanfare"]): FanfareStep[] {
  if (!fanfare) return [];

  /** Ordered, deduplicated milestones for this presentation. */
  const steps: FanfareStep[] = [];
  if (fanfare.kind === "purchase" || fanfare.kind === "referral") steps.push({kind: fanfare.kind});
  for (const achievementId of new Set(fanfare.achievementIds)) steps.push({kind: "achievement", achievementId});
  if (fanfare.kind === "achievement" && fanfare.coinsAwarded > 0) steps.push({kind: "coins"});
  return steps;
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

/** Identifies modal kinds that can render a fanfare sequence. */
export function isFanfareModal(modal: GameModal): modal is "victory" | "reward" {
  return modal === "victory" || modal === "reward";
}
