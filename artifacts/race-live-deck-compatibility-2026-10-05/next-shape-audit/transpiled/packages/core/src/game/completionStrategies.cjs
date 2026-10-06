"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeGuestCompletionRewards = computeGuestCompletionRewards;
/**
 * Calculates deterministic guest/local completion rewards without mutating economy state.
 *
 * @param gameMode - Selects the challenge or classic coin and base-score values.
 * @param attempts - Cumulative attempts used to complete the game.
 * @param options - Mode-specific coin grants and optional score-model overrides.
 * @returns The selected coin grant and calculated score.
 *
 * @remarks
 * The attempt bonus is `max(0, (scoreMaxAttempts - attempts + 1) * 10)`.
 * `scoreMaxAttempts` defaults to `5`; challenge and classic base scores default
 * to `100` and `50` respectively. Inputs are trusted, so this helper does not
 * reject fractional, negative, or otherwise invalid numeric configuration.
 */
function computeGuestCompletionRewards(gameMode, attempts, options) {
    /** Provides score max attempts behavior. */
    const scoreMaxAttempts = options.scoreMaxAttempts ?? 5;
    /** Provides base score behavior. */
    const baseScore = gameMode === "challenge" ? (options.challengeBaseScore ?? 100) : (options.classicBaseScore ?? 50);
    /** Provides attempts bonus behavior. */
    const attemptsBonus = Math.max(0, (scoreMaxAttempts - attempts + 1) * 10);
    /** Provides coins behavior. */
    const coins = gameMode === "challenge" ? options.challengeCoinReward : options.classicCoinReward;
    return { coins, score: baseScore + attemptsBonus };
}
