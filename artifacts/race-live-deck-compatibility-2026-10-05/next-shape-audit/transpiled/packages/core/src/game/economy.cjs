"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOLO_WIN_COINS = exports.SOLO_COIN_COSTS = void 0;
exports.normalizeEconomyDifficulty = normalizeEconomyDifficulty;
exports.getSoloWinCoins = getSoloWinCoins;
exports.getCoinPackBuyingPower = getCoinPackBuyingPower;
/** Stable action prices: harder content increases earnings without increasing help costs. */
exports.SOLO_COIN_COSTS = Object.freeze({ hint: 25, continue: 50, skip: 100 });
/** Base rewards exclude the separately settled streak, level and achievement bonuses. */
exports.SOLO_WIN_COINS = Object.freeze({
    classic: Object.freeze({ easy: 25, medium: 40, hard: 60 }),
    challenge: Object.freeze({ easy: 75, medium: 100, hard: 125 }),
});
/** Gives legacy or malformed content the conservative easy reward. */
function normalizeEconomyDifficulty(value) {
    return value === "medium" || value === "hard" ? value : "easy";
}
/** Calculates a base win grant from trusted content, never from player level or payment history. */
function getSoloWinCoins(mode, difficulty) {
    return exports.SOLO_WIN_COINS[mode][normalizeEconomyDifficulty(difficulty)];
}
/** Compares a pack to gameplay spending using whole actions and mutually exclusive examples. */
function getCoinPackBuyingPower(coins) {
    /** Invalid pack grants must never produce an inflated value claim. */
    const balance = Number.isSafeInteger(coins) && coins > 0 ? coins : 0;
    return { hints: Math.floor(balance / exports.SOLO_COIN_COSTS.hint), continues: Math.floor(balance / exports.SOLO_COIN_COSTS.continue) };
}
