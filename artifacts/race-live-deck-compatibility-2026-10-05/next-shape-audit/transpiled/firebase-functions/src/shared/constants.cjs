"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_RIDDLE_ANSWER_CHARACTERS = exports.RIDDLE_GENERATION_BATCH_SIZE = exports.RIDDLE_GENERATION_THRESHOLD = exports.XP_LEVEL_THRESHOLDS = exports.BASE_SCORE_CHALLENGE = exports.BASE_SCORE_CLASSIC = exports.ACHIEVEMENT_UNLOCK_COIN_REWARD = exports.LEVEL_UP_COIN_BONUS = exports.MAX_STREAK_REWARD_BONUS = exports.STREAK_REWARD_BONUS_STEP = exports.INITIAL_STREAK_REWARD_BONUS = exports.COINS_REWARD_CHALLENGE = exports.COINS_REWARD_CLASSIC = exports.MAX_ATTEMPTS_CHALLENGE = exports.MAX_ATTEMPTS_CLASSIC = exports.CONTINUE_COST_COINS = exports.HINT_COST_COINS = exports.SKIP_COST_CLASSIC = void 0;
exports.isStreakRewardMilestone = isStreakRewardMilestone;
exports.getStreakRewardBonus = getStreakRewardBonus;
exports.getXpThresholdForLevel = getXpThresholdForLevel;
exports.getLevelFromXp = getLevelFromXp;
const game_1 = require("@qwordly/core/game");
/** Server game constants share the provider-independent solo economy with the client. */
/** Coin cost to skip a level in Classic mode. */
exports.SKIP_COST_CLASSIC = game_1.SOLO_COIN_COSTS.skip;
/** Coin cost to skip a level in Daily Challenge mode. */
/** Coin cost to reveal one hint letter. */
exports.HINT_COST_COINS = game_1.SOLO_COIN_COSTS.hint;
/** Coin cost to continue after exhausting attempts. */
exports.CONTINUE_COST_COINS = game_1.SOLO_COIN_COSTS.continue;
/** Maximum guesses allowed in Classic mode. */
exports.MAX_ATTEMPTS_CLASSIC = 5;
/** Maximum guesses allowed in Challenge mode. */
exports.MAX_ATTEMPTS_CHALLENGE = 5;
/** Coins earned for solving a Classic riddle. */
exports.COINS_REWARD_CLASSIC = game_1.SOLO_WIN_COINS.classic.easy;
/** Coins earned for solving a Daily Challenge riddle. */
exports.COINS_REWARD_CHALLENGE = game_1.SOLO_WIN_COINS.challenge.easy;
/** Number of consecutive daily wins required for each streak reward. */
const STREAK_REWARD_INTERVAL_DAYS = 7;
/** Daily streak bonus paid while a streak is active. */
exports.INITIAL_STREAK_REWARD_BONUS = 20;
/** Coin increase applied at each weekly daily-streak reward milestone. */
exports.STREAK_REWARD_BONUS_STEP = 20;
/** Maximum daily-streak reward bonus paid for a daily win. */
exports.MAX_STREAK_REWARD_BONUS = 300;
/** Bonus coins awarded for the first active daily streak day. */
/** Returns true when a daily streak has reached a weekly reward milestone. */
function isStreakRewardMilestone(streakValue) {
    /** Normalizes d streak. */
    const normalizedStreak = Math.max(0, Math.floor(streakValue));
    return normalizedStreak > 0 && normalizedStreak % STREAK_REWARD_INTERVAL_DAYS === 0;
}
/** Returns the daily-streak bonus for the active streak day. */
function getStreakRewardBonus(streakValue) {
    /** Normalizes d streak. */
    const normalizedStreak = Math.max(0, Math.floor(streakValue));
    if (normalizedStreak === 0)
        return 0;
    /** Completes d milestones. */
    const completedMilestones = Math.floor(normalizedStreak / STREAK_REWARD_INTERVAL_DAYS);
    /** Provides bonus behavior. */
    const bonus = exports.INITIAL_STREAK_REWARD_BONUS + completedMilestones * exports.STREAK_REWARD_BONUS_STEP;
    return Math.min(bonus, exports.MAX_STREAK_REWARD_BONUS);
}
/** Bonus coins awarded per level-up. */
exports.LEVEL_UP_COIN_BONUS = 50;
/** Bonus coins awarded per newly unlocked achievement. */
exports.ACHIEVEMENT_UNLOCK_COIN_REWARD = 25;
/** Base score for a Classic win. */
exports.BASE_SCORE_CLASSIC = 50;
/** Base score for a Challenge win. */
exports.BASE_SCORE_CHALLENGE = 100;
/**
 * XP curve configuration.
 * Each new level needs a slightly larger XP amount than the previous level.
 */
exports.XP_LEVEL_THRESHOLDS = {
    basePerLevel: 100,
    growthPerLevel: 10,
};
/**
 * Returns total cumulative XP required to be at a given level (1-based).
 */
function getXpThresholdForLevel(level) {
    if (level <= 1)
        return 0;
    /** Completes d level ups. */
    const completedLevelUps = level - 1;
    /** Provides {base per level, growth per level} behavior. */
    const { basePerLevel, growthPerLevel } = exports.XP_LEVEL_THRESHOLDS;
    return completedLevelUps * basePerLevel + ((completedLevelUps - 1) * completedLevelUps * growthPerLevel) / 2;
}
/**
 * Converts cumulative XP into a 1-based level.
 */
function getLevelFromXp(totalXp) {
    /** Provides xp behavior. */
    const xp = Math.max(totalXp, 0);
    /** Provides {base per level, growth per level} behavior. */
    const { basePerLevel, growthPerLevel } = exports.XP_LEVEL_THRESHOLDS;
    /** Provides a behavior. */
    const a = growthPerLevel / 2;
    /** Provides b behavior. */
    const b = basePerLevel - growthPerLevel / 2;
    /** Provides discriminant behavior. */
    const discriminant = b * b + 4 * a * xp;
    /** Completes d level ups. */
    const completedLevelUps = Math.floor((-b + Math.sqrt(discriminant)) / (2 * a));
    return completedLevelUps + 1;
}
/**
 * Threshold of remaining classic riddles (based on `totalClassicRiddles - currentClassicIndex`)
 * below which new riddles are auto-generated.
 *
 * With the current semantics (currentClassicIndex is the *next* riddle to play),
 * a value of 1 means "user is on the penultimate riddle or later".
 */
exports.RIDDLE_GENERATION_THRESHOLD = 1;
/** Number of new classic riddles to generate when threshold is reached. */
exports.RIDDLE_GENERATION_BATCH_SIZE = 5;
/** Maximum characters allowed in generated riddle answers. */
var game_2 = require("@qwordly/core/game");
Object.defineProperty(exports, "MAX_RIDDLE_ANSWER_CHARACTERS", { enumerable: true, get: function () { return game_2.MAX_RIDDLE_ANSWER_CHARACTERS; } });
