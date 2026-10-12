"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOSS_COMPLETION_RECEIPT_TTL_MS = exports.DAILY_COMPLETION_ROLLOVER_GRACE_MS = void 0;
exports.isDailyCompletionDateEligible = isDailyCompletionDateEligible;
exports.deriveAuthoritativeCompletion = deriveAuthoritativeCompletion;
exports.completeAuthoritativeGame = completeAuthoritativeGame;
const game_1 = require("@qwordly/core/game");
const dailyCalendar_1 = require("@qwordly/core/validation/dailyCalendar");
const game_2 = require("@qwordly/core/game");
const functions = __importStar(require("firebase-functions"));
const node_crypto_1 = require("node:crypto");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const https_1 = require("firebase-functions/v2/https");
const firestoreService_1 = require("./firestoreService");
const achievements_1 = require("./achievements");
const leaderboard_1 = require("./leaderboard");
const sentry_1 = require("../shared/sentry");
const constants_1 = require("../shared/constants");
const validation_1 = require("@qwordly/core/validation");
const dailyStreak_1 = require("../daily/dailyStreak");
const riddleSupply_1 = require("../riddles/riddleSupply");
const game_3 = require("@qwordly/core/game");
const singlePlayerSession_1 = require("./singlePlayerSession");
const singlePlayerAnswerPolicy_1 = require("./singlePlayerAnswerPolicy");
const errorMetadata_1 = require("../shared/errorMetadata");
const singlePlayerCompletionBinding_1 = require("./singlePlayerCompletionBinding");
const facebookReferrals_1 = require("../facebook/facebookReferrals");
const redditReferrals_1 = require("../reddit/redditReferrals");
/** Narrow recovery window around regional midnight for a committed terminal win. */
exports.DAILY_COMPLETION_ROLLOVER_GRACE_MS = 15 * 60 * 1_000;
/** Retains loss replay receipts beyond the longest valid private session. */
exports.LOSS_COMPLETION_RECEIPT_TTL_MS = 45 * 24 * 60 * 60 * 1_000;
/** Parses a server timestamp without trusting caller-provided time. */
function toTrustedDate(value) {
    if (typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function") {
        /** Parses d. */
        const parsed = value.toDate();
        return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
    }
    return value instanceof Date && !Number.isNaN(value.getTime()) ? value : undefined;
}
/**
 * Accepts today's challenge, or yesterday's server-proven terminal win within
 * a small rollover window. Older/out-of-order challenge sessions fail closed.
 */
function isDailyCompletionDateEligible(challengeDate, isCorrect, terminalAt, now = new Date(), locale = "UTC") {
    if (!challengeDate)
        return false;
    /** Provides today behavior. */
    const today = (0, dailyCalendar_1.getDailyDate)(locale, now);
    if (challengeDate === today)
        return true;
    if (!isCorrect || !terminalAt)
        return false;
    /** Provides rollover behavior. */
    if (!/^\d{4}-\d{2}-\d{2}$/.test(challengeDate))
        return false;
    /** Authoritative next regional midnight used to validate terminal Daily recovery. */
    const rollover = (0, dailyCalendar_1.getDailyMidnight)(locale, (0, dailyCalendar_1.shiftDailyDate)(challengeDate, 1));
    /** Provides rollover ms behavior. */
    const rolloverMs = rollover.getTime();
    return (terminalAt.getTime() >= rolloverMs - exports.DAILY_COMPLETION_ROLLOVER_GRACE_MS &&
        terminalAt.getTime() <= rolloverMs + exports.DAILY_COMPLETION_ROLLOVER_GRACE_MS &&
        now.getTime() >= rolloverMs &&
        now.getTime() <= rolloverMs + exports.DAILY_COMPLETION_ROLLOVER_GRACE_MS);
}
/** Resolves the canonical locale used by authoritative riddle validation. */
const resolveUserLocale = (preferredLanguage) => validation_1.SUPPORTED_LOCALES.includes(preferredLanguage) ? preferredLanguage : "en";
/**
 * Loads the canonical riddle and derives the terminal outcome from server-owned
 * attempt state. No client-provided correctness or attempt count is accepted.
 */
async function deriveAuthoritativeCompletion(data, auth) {
    /** Provides state behavior. */
    const state = await (0, singlePlayerSession_1.finalizeAuthoritativeSession)(auth.uid, data.gameMode, data.riddleId, data.sessionToken);
    if (!state.lastGuess || state.attempts < 1 || state.attempts > 6) {
        throw new https_1.HttpsError("failed-precondition", "The authoritative game state is incomplete.");
    }
    (0, singlePlayerAnswerPolicy_1.assertPlayableSinglePlayerAnswer)(state.answer);
    /** Provides locale behavior. */
    const locale = resolveUserLocale(state.locale);
    /** Normalizes d answer. */
    const normalizedAnswer = (0, game_3.lowerCaseGraphemes)(state.answer.trim(), locale).join("");
    /** Normalizes d guess. */
    const normalizedGuess = (0, game_3.lowerCaseGraphemes)(state.lastGuess.trim(), locale).join("");
    return {
        ...data,
        attempts: state.attempts,
        difficultyBand: (0, game_1.normalizeEconomyDifficulty)(state.difficultyBand),
        isCorrect: normalizedGuess === normalizedAnswer,
        completionKey: normalizedGuess === normalizedAnswer ? state.completionKey : `${state.completionKey}:loss:${data.sessionToken}`,
        entitlementCompletionKey: state.completionKey,
        locale,
        ...(state.classicIndex !== undefined ? { classicIndex: state.classicIndex } : {}),
        ...(state.challengeDate ? { challengeDate: state.challengeDate } : {}),
        ...(toTrustedDate(state.terminalAt) ? { terminalAt: toTrustedDate(state.terminalAt) } : {}),
    };
}
/** Resolves and executes one replay-safe authoritative completion. */
async function completeAuthoritativeGame(data, auth) {
    /** Provides outcome behavior. */
    const outcome = await deriveAuthoritativeCompletion(data, auth);
    return commitAuthoritativeCompletion(outcome, auth);
}
/** Fully populated numeric stats used by the atomic completion transaction. */
const defaultPlayerStats = () => ({
    xp: 0,
    level: 1,
    dailyPuzzlesCompleted: 0,
    bestStreak: 0,
    totalWordsGuessed: 0,
    winRate: 0,
    averageGuesses: 0,
    totalScore: 0,
    highestLevelClassic: 0,
    gamesPlayed: 0,
    wins: 0,
    challengeWins: 0,
    winStreak: 0,
    totalWins: 0,
    totalGuessesInWins: 0,
    totalHintsUsed: 0,
    multiplayerGamesPlayed: 0,
    multiplayerWins: 0,
    multiplayerChallengesCreated: 0,
});
/** Atomically applies progression, rewards, achievements, and the replay receipt. */
async function commitAuthoritativeCompletion(data, auth) {
    /** Provides receipt id behavior. */
    const receiptId = (0, node_crypto_1.createHash)("sha256").update(`${auth.uid}\0${data.gameMode}\0${data.completionKey}`).digest("hex");
    /** Provides db behavior. */
    const db = firebaseAdmin_1.admin.firestore();
    /** Provides r ref. */
    const userRef = db.collection("users").doc(auth.uid);
    /** Provides receipt ref behavior. */
    const receiptRef = db.collection("gameCompletionReceipts").doc(receiptId);
    /** Provides completion binding ref behavior. */
    const completionBindingRef = (0, singlePlayerCompletionBinding_1.getSinglePlayerCompletionBindingRef)(auth.uid, data.gameMode, data.entitlementCompletionKey);
    /** Every retry returns its own context; only the committed attempt supplies post-commit work. */
    const committed = await db.runTransaction(async (transaction) => {
        /** Provides [receipt snapshot, user snapshot, completion binding snapshot] behavior. */
        const [receiptSnapshot, userSnapshot, completionBindingSnapshot] = await Promise.all([
            transaction.get(receiptRef),
            transaction.get(userRef),
            transaction.get(completionBindingRef),
        ]);
        /** Repair uses this attempt's fresh account and commits with completion or its replay. */
        const profileRepair = userSnapshot.exists ? (0, firestoreService_1.prepareUserDocumentCompletion)(userSnapshot.data()) : {};
        /** Prepared authority supplies both replay metadata and new progression within this attempt. */
        const user = userSnapshot.exists ? { ...userSnapshot.data(), ...profileRepair } : undefined;
        /** Replays and superseded completions may repair existing accounts without creating one. */
        const repairExistingProfile = () => {
            if (Object.keys(profileRepair).length)
                transaction.update(userRef, profileRepair);
        };
        /** Clears matching completion binding. */
        const clearMatchingCompletionBinding = () => {
            if (completionBindingSnapshot.exists &&
                (0, singlePlayerCompletionBinding_1.completionBindingMatches)(completionBindingSnapshot.data(), {
                    sessionToken: data.sessionToken,
                    gameMode: data.gameMode,
                    completionKey: data.entitlementCompletionKey,
                    riddleId: data.riddleId,
                }))
                transaction.delete(completionBindingRef);
        };
        /** Creates completion receipt. */
        const createCompletionReceipt = (response) => transaction.create(receiptRef, {
            userId: auth.uid,
            gameMode: data.gameMode,
            completionKey: data.completionKey,
            status: "completed",
            result: response,
            completedAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            ...(!data.isCorrect
                ? {
                    expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(Date.now() + exports.LOSS_COMPLETION_RECEIPT_TTL_MS),
                }
                : {}),
        });
        if (receiptSnapshot.exists) {
            /** Provides cached behavior. */
            const cached = receiptSnapshot.data()?.result;
            if (receiptSnapshot.data()?.status === "completed" && cached) {
                repairExistingProfile();
                clearMatchingCompletionBinding();
                return {
                    response: cached,
                    classicIndex: user?.progress?.classicIndex,
                };
            }
            throw new https_1.HttpsError("data-loss", "The game completion receipt is invalid.");
        }
        if (!user)
            throw new https_1.HttpsError("not-found", "User data not found.");
        /** Provides current stats behavior. */
        const currentStats = { ...defaultPlayerStats(), ...(user.stats ?? {}) };
        /** Provides progress behavior. */
        const progress = {
            classicIndex: user.progress?.classicIndex ?? 1,
            dailyChallengeIndex: user.progress?.dailyChallengeIndex ?? 0,
            dailyChallengeCurrentQuestion: user.progress?.dailyChallengeCurrentQuestion ?? 0,
        };
        /** Provides superseded completion behavior. */
        let supersededCompletion = false;
        if (data.gameMode === "classic") {
            if (typeof data.classicIndex !== "number" || !Number.isInteger(data.classicIndex)) {
                throw new https_1.HttpsError("permission-denied", "Classic progression no longer matches this completion.");
            }
            if (data.classicIndex !== progress.classicIndex) {
                if (data.classicIndex < progress.classicIndex)
                    supersededCompletion = true;
                else
                    throw new https_1.HttpsError("permission-denied", "Classic progression no longer matches this completion.");
            }
        }
        if (data.gameMode === "challenge") {
            /** Provides now behavior. */
            const now = new Date();
            /** Provides last completed key behavior. */
            const lastCompletedKey = typeof user.lastCompletedDailyChallengeKey === "string"
                ? user.lastCompletedDailyChallengeKey
                : (0, dailyStreak_1.getCompletionDay)(user.lastDailyChallengeCompletedAt, data.locale);
            /** Provides last attempted key behavior. */
            const lastAttemptedKey = typeof user.lastDailyChallengeAttemptedKey === "string" ? user.lastDailyChallengeAttemptedKey : undefined;
            if (!data.isCorrect && lastCompletedKey && data.challengeDate && lastCompletedKey >= data.challengeDate) {
                supersededCompletion = true;
            }
            else {
                if (!isDailyCompletionDateEligible(data.challengeDate, data.isCorrect, data.terminalAt, now, data.locale)) {
                    throw new https_1.HttpsError("permission-denied", "This daily challenge is no longer current.");
                }
                if (data.challengeDate !== (0, dailyCalendar_1.getDailyDate)(data.locale, now) &&
                    lastAttemptedKey &&
                    lastAttemptedKey > data.challengeDate) {
                    throw new https_1.HttpsError("permission-denied", "A newer daily challenge was already attempted.");
                }
                if (lastCompletedKey && lastCompletedKey >= data.challengeDate) {
                    throw new https_1.HttpsError("failed-precondition", "This daily challenge is already complete or out of order.");
                }
            }
        }
        if (supersededCompletion) {
            /** Provides response behavior. */
            const response = {
                attempts: data.attempts,
                isCorrect: data.isCorrect,
                coinsEarned: 0,
                newlyUnlockedAchievementIds: [],
                scoreEarned: 0,
                xpEarned: 0,
                newXp: currentStats.xp,
                newLevel: currentStats.level,
                leveledUp: false,
                ...(data.gameMode === "challenge" ? { newWinStreak: currentStats.winStreak } : {}),
            };
            repairExistingProfile();
            createCompletionReceipt(response);
            clearMatchingCompletionBinding();
            return { response, classicIndex: progress.classicIndex };
        }
        /** Provides stats behavior. */
        const stats = { ...currentStats };
        stats.totalWordsGuessed += data.attempts;
        stats.gamesPlayed += 1;
        /** Provides base win coins behavior. */
        let baseWinCoins = 0;
        /** Provides daily streak bonus behavior. */
        let dailyStreakBonus = 0;
        /** Provides level up bonus behavior. */
        let levelUpBonus = 0;
        /** Provides xp earned behavior. */
        let xpEarned = 0;
        /** Provides new win streak behavior. */
        let newWinStreak;
        if (data.isCorrect) {
            stats.wins += 1;
            stats.totalWins += 1;
            stats.totalGuessesInWins += data.attempts;
            /** Provides max attempts behavior. */
            const maxAttempts = data.gameMode === "challenge" ? constants_1.MAX_ATTEMPTS_CHALLENGE : constants_1.MAX_ATTEMPTS_CLASSIC;
            xpEarned =
                (data.gameMode === "challenge" ? constants_1.BASE_SCORE_CHALLENGE : constants_1.BASE_SCORE_CLASSIC) +
                    Math.max(0, (maxAttempts - data.attempts + 1) * 10);
            stats.xp += xpEarned;
            stats.totalScore += xpEarned;
            /** Provides previous level behavior. */
            const previousLevel = currentStats.level ?? (0, constants_1.getLevelFromXp)(currentStats.xp);
            stats.level = (0, constants_1.getLevelFromXp)(stats.xp);
            if (stats.level > previousLevel)
                levelUpBonus = constants_1.LEVEL_UP_COIN_BONUS;
            if (data.gameMode === "challenge") {
                newWinStreak = (0, dailyStreak_1.computeNextDailyWinStreak)(currentStats.winStreak, user.lastDailyChallengeCompletedAt, (0, dailyCalendar_1.getDailyMidnight)(data.locale, data.challengeDate), data.locale, user.lastCompletedDailyChallengeKey);
                stats.winStreak = newWinStreak;
                stats.bestStreak = Math.max(stats.bestStreak, newWinStreak);
                stats.challengeWins += 1;
                stats.dailyPuzzlesCompleted += 1;
                progress.dailyChallengeIndex += 1;
                progress.dailyChallengeCurrentQuestion = 1;
                baseWinCoins = (0, game_1.getSoloWinCoins)("challenge", data.difficultyBand);
                dailyStreakBonus = (0, constants_1.getStreakRewardBonus)(newWinStreak);
            }
            else {
                progress.classicIndex += 1;
                stats.highestLevelClassic = Math.max(stats.highestLevelClassic, progress.classicIndex);
                baseWinCoins = (0, game_1.getSoloWinCoins)("classic", data.difficultyBand);
            }
        }
        else if (data.gameMode === "challenge") {
            newWinStreak = 0;
            stats.winStreak = 0;
        }
        stats.averageGuesses = stats.totalWins > 0 ? Number((stats.totalGuessesInWins / stats.totalWins).toFixed(2)) : 0;
        stats.winRate = stats.gamesPlayed > 0 ? Number(((stats.totalWins / stats.gamesPlayed) * 100).toFixed(2)) : 0;
        /** Provides pre achievement coins behavior. */
        const preAchievementCoins = Number(user.coins ?? 0) + baseWinCoins + dailyStreakBonus + levelUpBonus;
        /** Provides projected user behavior. */
        const projectedUser = { ...user, coins: preAchievementCoins, stats, progress };
        /** Provides new achievements behavior. */
        const newAchievements = (0, achievements_1.findNewAchievements)(projectedUser, {
            gameMode: data.gameMode,
            isCorrect: data.isCorrect,
            attempts: data.attempts,
            gameOver: true,
        });
        /** Provides newly unlocked achievement ids behavior. */
        const newlyUnlockedAchievementIds = newAchievements.map((entry) => entry.achievementId);
        /** Provides achievement bonus behavior. */
        const achievementBonus = data.isCorrect ? (0, game_2.countCoinRewardAchievements)(newlyUnlockedAchievementIds) * constants_1.ACHIEVEMENT_UNLOCK_COIN_REWARD : 0;
        /** Provides coins earned behavior. */
        const coinsEarned = data.isCorrect ? baseWinCoins + dailyStreakBonus + levelUpBonus + achievementBonus : 0;
        /** Provides new balance behavior. */
        const newBalance = Number(user.coins ?? 0) + coinsEarned;
        /** Provides response behavior. */
        const response = {
            attempts: data.attempts,
            isCorrect: data.isCorrect,
            coinsEarned,
            newlyUnlockedAchievementIds,
            scoreEarned: xpEarned,
            xpEarned,
            newXp: stats.xp,
            newLevel: stats.level,
            leveledUp: stats.level > currentStats.level,
            ...(newWinStreak !== undefined ? { newWinStreak } : {}),
            ...(data.isCorrect
                ? {
                    rewardBreakdown: {
                        baseWinCoins,
                        levelUpBonus,
                        dailyStreakBonus,
                        achievementBonus,
                        totalAwarded: coinsEarned,
                        newBalance,
                    },
                }
                : {}),
        };
        transaction.update(userRef, {
            ...profileRepair,
            coins: newBalance,
            stats,
            progress,
            unlockedAchievements: [...(user.unlockedAchievements ?? []), ...newAchievements],
            ...(data.gameMode === "challenge" && data.isCorrect
                ? {
                    lastDailyChallengeCompletedAt: data.challengeDate === (0, dailyCalendar_1.getDailyDate)(data.locale)
                        ? firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp()
                        : firebaseAdmin_1.admin.firestore.Timestamp.fromDate((0, dailyCalendar_1.getDailyMidnight)(data.locale, data.challengeDate)),
                    lastCompletedDailyChallengeKey: data.challengeDate ?? data.completionKey,
                }
                : {}),
            ...(data.gameMode === "challenge" ? { lastDailyChallengeAttemptedKey: data.challengeDate } : {}),
        });
        createCompletionReceipt(response);
        clearMatchingCompletionBinding();
        return { response, classicIndex: progress.classicIndex };
    });
    /** Referral settlement can extend the public result without changing its committed supply context. */
    let result = committed.response;
    // A failed settlement makes the callable retryable. On retry the completion
    // receipt replays safely and the referral transaction resumes idempotently.
    if (data.isCorrect) {
        /** Provides facebook referral behavior. */
        const facebookReferral = await (0, facebookReferrals_1.settleFacebookReferralAfterAuthoritativeWin)(auth.uid);
        /** Provides reddit referral behavior. */
        const redditReferral = await (0, redditReferrals_1.settleRedditReferralAfterAuthoritativeWin)(auth.uid);
        /** Provides referral behavior. */
        const referral = {
            inviteeCoins: facebookReferral.inviteeCoins + redditReferral.inviteeCoins,
        };
        if (referral.inviteeCoins > 0 && result.rewardBreakdown) {
            result = {
                ...result,
                coinsEarned: result.coinsEarned + referral.inviteeCoins,
                rewardBreakdown: {
                    ...result.rewardBreakdown,
                    referralBonus: referral.inviteeCoins,
                    totalAwarded: result.rewardBreakdown.totalAwarded + referral.inviteeCoins,
                    newBalance: result.rewardBreakdown.newBalance + referral.inviteeCoins,
                },
            };
        }
    }
    /** Losses and anonymous Daily wins have no derived projection work. */
    const publishLeaderboard = data.isCorrect && !auth.isAnonymous;
    /** Classic wins still prepare subsequent content for both anonymous and named players. */
    const prepareClassicSupply = data.isCorrect && data.gameMode === "classic";
    if (!publishLeaderboard && !prepareClassicSupply)
        return result;
    // These effects are derived, overwrite-safe, and retried on receipt replay;
    // they cannot make the already-committed player reward partial.
    try {
        /** Ranking checks current authority; content reuses committed progress; both settle before responding. */
        const projections = [];
        if (publishLeaderboard)
            projections.push((0, leaderboard_1.updateLeaderboardEntry)(auth.uid));
        if (prepareClassicSupply && committed.classicIndex !== undefined) {
            projections.push((0, riddleSupply_1.triggerClassicRiddleGenerationIfNeeded)(auth.uid, committed.classicIndex, data.locale));
        }
        /** One failed projection cannot suppress or leave the other running past the response. */
        const settled = await Promise.allSettled(projections);
        for (const projection of settled)
            if (projection.status === "rejected") {
                functions.logger.error("Recoverable post-completion projection failed.", (0, errorMetadata_1.getSafeErrorMetadata)(projection.reason));
                (0, sentry_1.captureException)(projection.reason);
            }
    }
    catch (error) {
        functions.logger.error("Recoverable post-completion projection failed.", (0, errorMetadata_1.getSafeErrorMetadata)(error));
        (0, sentry_1.captureException)(error);
    }
    return result;
}
//# sourceMappingURL=completeGameLogic.js.map