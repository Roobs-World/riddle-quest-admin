import {completionPresentationKey, type CompletionIdentity} from "../../gameplay/session/completion/completionPresentation";
import {trackEvent} from "../../observability/analytics/events";
import type {CompletionResult, SinglePlayerGuessResult, WebGameMode} from "../../platform/contracts/hostServices";

/** Exact issued puzzle identity passed to target-owned completion callbacks. */
export type HostCompletionInput = CompletionIdentity & Readonly<{
  /** Classic and Daily results retain independent presentation identities. */
  gameMode: WebGameMode;
}>;

/** Canonical paid actions retain puzzle identity only for local receipt consumption. */
export type HostCoinActionInput = HostCompletionInput & (
  | {kind: "hint"; index: number; cost: number}
  | {kind: "continue"; cost: number}
  | {kind: "skip"; cost: number}
);

/** Correlates an issued game without exposing its private session token to analytics. */
const puzzleKey = (input: HostCompletionInput): string =>
  JSON.stringify([input.gameMode, completionPresentationKey(input)]);

/** Replayed hint positions and one-time continue/skip receipts cannot inflate coin spending. */
export function createHostCoinActionEffects(owned: () => boolean) {
  const consumed = new Set<string>();
  return (input: HostCoinActionInput): void => {
    if (!owned()) return;
    const key = JSON.stringify([puzzleKey(input), input.kind, input.kind === "hint" ? input.index : null]);
    if (consumed.has(key)) return;
    consumed.add(key);
    trackEvent(input.kind === "skip" ? "riddle_skipped" : `${input.kind}_used`, {
      game_mode: input.gameMode, cost: input.cost,
    });
    trackEvent("spend_virtual_currency", {
      virtual_currency_name: "coins", item_name: input.kind, value: input.cost, game_mode: input.gameMode,
    });
  };
}

/** Consumes accepted-attempt telemetry and win prompting under the original account visit. */
export function createHostGuessEffects(owned: () => boolean) {
  /** Semantic retries can use fresh transport request IDs for the same accepted attempt. */
  const attempts = new Set<string>();
  /** A target win prompt belongs to one issued outcome rather than an attempt counter. */
  const wins = new Set<string>();
  return async (
    input: HostCompletionInput,
    result: SinglePlayerGuessResult,
    recordWin?: (input: HostCompletionInput) => void | Promise<void>,
  ): Promise<void> => {
    if (!owned()) return;
    /** Accepted server counters correlate receipts independently of client retry IDs. */
    const identity = puzzleKey(input), attempt = JSON.stringify([identity, result.attempts]);
    if (attempts.has(attempt)) return;
    attempts.add(attempt);
    trackEvent("guess_submitted", {game_mode: input.gameMode, success: result.isCorrect, attempts: result.attempts});
    if (!result.isCorrect || wins.has(identity) || !owned()) return;
    wins.add(identity);
    await recordWin?.(input);
  };
}

/** Consumes optional completion work once within the originating authentication visit. */
export function createHostCompletionEffects(owned: () => boolean) {
  /** Receipts remain consumed across profile updates and target callback replacement. */
  const consumed = new Set<string>();
  return async (
    input: HostCompletionInput,
    result: CompletionResult,
    record?: (input: HostCompletionInput, result: CompletionResult) => void | Promise<void>,
    showResults?: () => void | Promise<void>,
  ): Promise<void> => {
    if (!owned()) return;
    /** A new transport request ID does not identify a new issued puzzle. */
    const key = puzzleKey(input);
    if (consumed.has(key)) return;
    // Consume before invoking external work: retries must not repeat partially
    // successful notification or engagement effects, including after rejection.
    consumed.add(key);
    trackEvent("level_end", {
      game_mode: input.gameMode, success: result.isCorrect, attempts: result.attempts,
      level: result.newLevel, xp: result.newXp, win_streak: result.newWinStreak,
    });
    if (result.coinsEarned > 0) trackEvent("earn_virtual_currency", {virtual_currency_name: "coins", value: result.coinsEarned, source: "puzzle", game_mode: input.gameMode});
    if (result.leveledUp) trackEvent("level_up", {level: result.newLevel});
    for (const achievementId of result.newlyUnlockedAchievementIds)
      trackEvent("unlock_achievement", {achievement_id: achievementId});
    if (!owned()) return;
    await record?.(input, result);
    if (owned()) await showResults?.();
  };
}
