"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raceRewardAwardsAgree = raceRewardAwardsAgree;
exports.evaluateRaceAchievementEvent = evaluateRaceAchievementEvent;
const race_1 = require("@qwordly/core/race");
const constants_1 = require("../shared/constants");
/** Provides nonnegative integer behavior. */
const nonnegativeInteger = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
/** Validates a retained one-time award against supported unique unlocks and their fixed grant amount. */
function raceRewardAwardsAgree(ids, coins) {
    return ids.length <= race_1.RACE_ACHIEVEMENT_IDS.length && new Set(ids).size === ids.length &&
        ids.every(id => race_1.RACE_ACHIEVEMENT_IDS.some(supported => supported === id)) &&
        coins === ids.length * constants_1.ACHIEVEMENT_UNLOCK_COIN_REWARD;
}
/** Records or empty. */
const recordOrEmpty = (value) => typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
/** Provides unlocked ids behavior. */
const unlockedIds = (value) => new Set(Array.isArray(value)
    ? value.flatMap((entry) => {
        if (typeof entry === "string")
            return [entry];
        /** Provides record behavior. */
        const record = recordOrEmpty(entry);
        return typeof record.achievementId === "string" ? [record.achievementId] : [];
    })
    : []);
/** Evaluates one race event and returns idempotent achievement state changes. */
function evaluateRaceAchievementEvent(userData, event, nowMs) {
    /** Provides current stats behavior. */
    const currentStats = recordOrEmpty(userData.stats);
    /** Provides stats behavior. */
    const stats = {
        multiplayerGamesPlayed: nonnegativeInteger(currentStats.multiplayerGamesPlayed),
        multiplayerWins: nonnegativeInteger(currentStats.multiplayerWins),
        multiplayerChallengesCreated: nonnegativeInteger(currentStats.multiplayerChallengesCreated),
    };
    if (event.kind === "completed") {
        stats.multiplayerGamesPlayed += 1;
        if (event.won)
            stats.multiplayerWins += 1;
    }
    else if (event.kind === "opponent_resolved") {
        stats.multiplayerGamesPlayed += 1;
        if (event.won)
            stats.multiplayerWins += 1;
    }
    else {
        stats.multiplayerChallengesCreated += 1;
    }
    /** Provides eligible behavior. */
    const eligible = new Set();
    if (stats.multiplayerGamesPlayed >= 1)
        eligible.add("race_debut");
    if (stats.multiplayerWins >= 1)
        eligible.add("race_first_win");
    if (stats.multiplayerWins >= 5)
        eligible.add("race_wins_5");
    if (stats.multiplayerWins >= 25)
        eligible.add("race_wins_25");
    if (stats.multiplayerChallengesCreated >= 1)
        eligible.add("race_host");
    if (stats.multiplayerChallengesCreated >= 5)
        eligible.add("race_hosts_5");
    if (event.kind === "completed" && event.cleanRun)
        eligible.add("race_clean_run");
    /** Provides existing behavior. */
    const existing = unlockedIds(userData.unlockedAchievements);
    /** Provides newly unlocked achievement ids behavior. */
    const newlyUnlockedAchievementIds = race_1.RACE_ACHIEVEMENT_IDS.filter((achievementId) => eligible.has(achievementId) && !existing.has(achievementId));
    /** Provides achievement coins awarded behavior. */
    const achievementCoinsAwarded = newlyUnlockedAchievementIds.length * constants_1.ACHIEVEMENT_UNLOCK_COIN_REWARD;
    /** Provides new coins behavior. */
    const newCoins = nonnegativeInteger(userData.coins) + achievementCoinsAwarded;
    return {
        stats,
        newlyUnlockedAchievementIds,
        unlockedAchievementEntries: newlyUnlockedAchievementIds.map((achievementId) => ({
            achievementId,
            unlockedAt: nowMs,
        })),
        achievementCoinsAwarded,
        newCoins,
    };
}
//# sourceMappingURL=raceAchievements.js.map