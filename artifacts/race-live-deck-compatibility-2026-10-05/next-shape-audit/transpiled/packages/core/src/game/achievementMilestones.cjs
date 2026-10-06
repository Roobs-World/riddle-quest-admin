"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACHIEVEMENT_MILESTONES = void 0;
exports.findNewMilestoneAchievementIds = findNewMilestoneAchievementIds;
/** Additional solo milestones shared by all target authorities and presentation. */
exports.ACHIEVEMENT_MILESTONES = [
    { id: "wins_10", stat: "totalWins", threshold: 10, icon: "🥉" },
    { id: "wins_250", stat: "totalWins", threshold: 250, icon: "🏆" },
    { id: "games_10", stat: "gamesPlayed", threshold: 10, icon: "🎲" },
    { id: "games_250", stat: "gamesPlayed", threshold: 250, icon: "🎟️" },
    { id: "classic_5", stat: "highestLevelClassic", threshold: 5, icon: "🧩" },
    { id: "classic_150", stat: "highestLevelClassic", threshold: 150, icon: "🏯" },
    { id: "daily_3", stat: "dailyPuzzlesCompleted", threshold: 3, icon: "🌤️" },
    { id: "daily_365", stat: "dailyPuzzlesCompleted", threshold: 365, icon: "📆" },
    { id: "challenge_10", stat: "challengeWins", threshold: 10, icon: "🧗" },
    { id: "challenge_100", stat: "challengeWins", threshold: 100, icon: "🏔️" },
    { id: "streak_60", stat: "bestStreak", threshold: 60, icon: "☀️" },
    { id: "xp_10000", stat: "xp", threshold: 10_000, icon: "🌌" },
];
/** Evaluates counters without granting rewards or writing progress. */
function findNewMilestoneAchievementIds(stats, existingIds) {
    /** Previously granted IDs prevent duplicate unlocks. */
    const existing = new Set(existingIds);
    return exports.ACHIEVEMENT_MILESTONES.filter(({ id, stat, threshold }) => !existing.has(id) && (stats?.[stat] ?? 0) >= threshold).map(({ id }) => id);
}
