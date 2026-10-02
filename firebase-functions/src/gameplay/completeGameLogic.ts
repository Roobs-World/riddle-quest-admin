import {getSoloWinCoins, normalizeEconomyDifficulty, type EconomyDifficulty} from "@qwordly/core/game";
import {getDailyDate, getDailyMidnight, shiftDailyDate} from "@qwordly/core/validation/dailyCalendar";
import {countCoinRewardAchievements} from "@qwordly/core/game";
import * as functions from "firebase-functions";
import {createHash} from "node:crypto";
import {admin} from "../shared/firebaseAdmin";
import {HttpsError} from "firebase-functions/v2/https";
import {getUser, ensureUserDocumentComplete} from "./firestoreService";
import type {Player, PlayerStats} from "../validation/firestoreSchemas";
import type {CompleteGameRequestData, CompleteGameResponseData} from "@qwordly/core/validation/requestSchemas";
import {findNewAchievements} from "./achievements";
import {updateLeaderboardEntry} from "./leaderboard";
import {captureException} from "../shared/sentry";
import {
  MAX_ATTEMPTS_CLASSIC,
  MAX_ATTEMPTS_CHALLENGE,
  getStreakRewardBonus,
  ACHIEVEMENT_UNLOCK_COIN_REWARD,
  LEVEL_UP_COIN_BONUS,
  BASE_SCORE_CLASSIC,
  BASE_SCORE_CHALLENGE,
  getLevelFromXp,
} from "../shared/constants";
import {SUPPORTED_LOCALES, type SupportedLocale} from "@qwordly/core/validation";
import {computeNextDailyWinStreak, getCompletionDay} from "../daily/dailyStreak";
import {triggerClassicRiddleGenerationIfNeeded} from "../riddles/riddleSupply";
import {lowerCaseGraphemes} from "@qwordly/core/game";
import {finalizeAuthoritativeSession} from "./singlePlayerSession";
import {assertPlayableSinglePlayerAnswer} from "./singlePlayerAnswerPolicy";
import {getSafeErrorMetadata} from "../shared/errorMetadata";
import {completionBindingMatches, getSinglePlayerCompletionBindingRef} from "./singlePlayerCompletionBinding";
import {settleFacebookReferralAfterAuthoritativeWin} from "../facebook/facebookReferrals";
import {settleRedditReferralAfterAuthoritativeWin} from "../reddit/redditReferrals";

// ---------------------------------------------------------------------------
// completeGame - called once when a server-validated game truly ends.
// This function handles all server-side side effects: coins, stats, progress
// advancement, and achievements.
// ---------------------------------------------------------------------------

/** Describes a completion derived exclusively from trusted backend state. */
export type AuthoritativeCompleteGameData = CompleteGameRequestData & {
  /** Server-counted number of accepted guesses. */
  attempts: number;
  /** Difficulty from the private canonical session snapshot. */
  difficultyBand?: EconomyDifficulty;
  /** Correctness derived from the canonical riddle and persisted final guess. */
  isCorrect: boolean;
  /** Rollover-safe key used only by the completion receipt. */
  completionKey: string;
  /** Locale-independent entitlement key used by pending terminal recovery. */
  entitlementCompletionKey: string;
  /** Locale immutably bound to the private play session. */
  locale: SupportedLocale;
  /** Classic entitlement index immutably bound to the session. */
  classicIndex?: number;
  /** Daily regional entitlement date immutably bound to the session. */
  challengeDate?: string;
  /** Server-committed terminal time used only for bounded regional rollover recovery. */
  terminalAt?: Date;
};

/** Narrow recovery window around regional midnight for a committed terminal win. */
export const DAILY_COMPLETION_ROLLOVER_GRACE_MS = 15 * 60 * 1_000;
/** Retains loss replay receipts beyond the longest valid private session. */
export const LOSS_COMPLETION_RECEIPT_TTL_MS = 45 * 24 * 60 * 60 * 1_000;

/** Parses a server timestamp without trusting caller-provided time. */
function toTrustedDate(value: unknown): Date | undefined {
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
export function isDailyCompletionDateEligible(
  challengeDate: string | undefined,
  isCorrect: boolean,
  terminalAt: Date | undefined,
  now = new Date(),
  locale = "UTC",
): boolean {
  if (!challengeDate) return false;
  /** Provides today behavior. */
  const today = getDailyDate(locale, now);
  if (challengeDate === today) return true;
  if (!isCorrect || !terminalAt) return false;
  /** Provides rollover behavior. */
  if (!/^\d{4}-\d{2}-\d{2}$/.test(challengeDate)) return false;
  /** Authoritative next regional midnight used to validate terminal Daily recovery. */
  const rollover = getDailyMidnight(locale, shiftDailyDate(challengeDate, 1));
  /** Provides rollover ms behavior. */
  const rolloverMs = rollover.getTime();
  return (
    terminalAt.getTime() >= rolloverMs - DAILY_COMPLETION_ROLLOVER_GRACE_MS &&
    terminalAt.getTime() <= rolloverMs + DAILY_COMPLETION_ROLLOVER_GRACE_MS &&
    now.getTime() >= rolloverMs &&
    now.getTime() <= rolloverMs + DAILY_COMPLETION_ROLLOVER_GRACE_MS
  );
}

/** Resolves the canonical locale used by authoritative riddle validation. */
const resolveUserLocale = (preferredLanguage: string | undefined): SupportedLocale =>
  SUPPORTED_LOCALES.includes(preferredLanguage as SupportedLocale) ? (preferredLanguage as SupportedLocale) : "en";

/**
 * Loads the canonical riddle and derives the terminal outcome from server-owned
 * attempt state. No client-provided correctness or attempt count is accepted.
 */
export async function deriveAuthoritativeCompletion(
  data: CompleteGameRequestData,
  auth: {
    /** Stores uid. */
    uid: string; /** Stores is anonymous. */
    /** Stores is anonymous. */
    isAnonymous?: boolean;
  },
): Promise<AuthoritativeCompleteGameData> {
  /** Provides state behavior. */
  const state = await finalizeAuthoritativeSession(auth.uid, data.gameMode, data.riddleId, data.sessionToken);
  if (!state.lastGuess || state.attempts < 1 || state.attempts > 6) {
    throw new HttpsError("failed-precondition", "The authoritative game state is incomplete.");
  }
  assertPlayableSinglePlayerAnswer(state.answer);
  /** Provides locale behavior. */
  const locale = resolveUserLocale(state.locale);
  /** Normalizes d answer. */
  const normalizedAnswer = lowerCaseGraphemes(state.answer.trim(), locale).join("");
  /** Normalizes d guess. */
  const normalizedGuess = lowerCaseGraphemes(state.lastGuess.trim(), locale).join("");
  return {
    ...data,
    attempts: state.attempts,
    difficultyBand: normalizeEconomyDifficulty(state.difficultyBand),
    isCorrect: normalizedGuess === normalizedAnswer,
    completionKey:
      normalizedGuess === normalizedAnswer ? state.completionKey : `${state.completionKey}:loss:${data.sessionToken}`,
    entitlementCompletionKey: state.completionKey,
    locale,
    ...(state.classicIndex !== undefined ? {classicIndex: state.classicIndex} : {}),
    ...(state.challengeDate ? {challengeDate: state.challengeDate} : {}),
    ...(toTrustedDate(state.terminalAt) ? {terminalAt: toTrustedDate(state.terminalAt)} : {}),
  };
}

/** Resolves and executes one replay-safe authoritative completion. */
export async function completeAuthoritativeGame(
  data: CompleteGameRequestData,
  auth: {
    /** Stores uid. */
    uid: string; /** Stores is anonymous. */
    /** Stores is anonymous. */
    isAnonymous?: boolean;
  },
): Promise<CompleteGameResponseData> {
  /** Provides outcome behavior. */
  const outcome = await deriveAuthoritativeCompletion(data, auth);
  return commitAuthoritativeCompletion(outcome, auth);
}

/** Fully populated numeric stats used by the atomic completion transaction. */
const defaultPlayerStats = (): PlayerStats => ({
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
async function commitAuthoritativeCompletion(
  data: AuthoritativeCompleteGameData,
  auth: {
    /** Stores uid. */
    uid: string; /** Stores is anonymous. */
    /** Stores is anonymous. */
    isAnonymous?: boolean;
  },
): Promise<CompleteGameResponseData> {
  await ensureUserDocumentComplete(auth.uid);
  /** Provides receipt id behavior. */
  const receiptId = createHash("sha256").update(`${auth.uid}\0${data.gameMode}\0${data.completionKey}`).digest("hex");
  /** Provides db behavior. */
  const db = admin.firestore();
  /** Provides r ref. */
  const userRef = db.collection("users").doc(auth.uid);
  /** Provides receipt ref behavior. */
  const receiptRef = db.collection("gameCompletionReceipts").doc(receiptId);
  /** Provides completion binding ref behavior. */
  const completionBindingRef = getSinglePlayerCompletionBindingRef(
    auth.uid,
    data.gameMode,
    data.entitlementCompletionKey,
  );

  /** Provides result behavior. */
  let result = await db.runTransaction(async (transaction) => {
    /** Provides [receipt snapshot, user snapshot, completion binding snapshot] behavior. */
    const [receiptSnapshot, userSnapshot, completionBindingSnapshot] = await Promise.all([
      transaction.get(receiptRef),
      transaction.get(userRef),
      transaction.get(completionBindingRef),
    ]);
    /** Clears matching completion binding. */
    const clearMatchingCompletionBinding = () => {
      if (
        completionBindingSnapshot.exists &&
        completionBindingMatches(completionBindingSnapshot.data(), {
          sessionToken: data.sessionToken,
          gameMode: data.gameMode,
          completionKey: data.entitlementCompletionKey,
          riddleId: data.riddleId,
        })
      )
        transaction.delete(completionBindingRef);
    };
    /** Creates completion receipt. */
    const createCompletionReceipt = (response: CompleteGameResponseData) =>
      transaction.create(receiptRef, {
        userId: auth.uid,
        gameMode: data.gameMode,
        completionKey: data.completionKey,
        status: "completed",
        result: response,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(!data.isCorrect
          ? {
              expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + LOSS_COMPLETION_RECEIPT_TTL_MS),
            }
          : {}),
      });
    if (receiptSnapshot.exists) {
      /** Provides cached behavior. */
      const cached = receiptSnapshot.data()?.result;
      if (receiptSnapshot.data()?.status === "completed" && cached) {
        clearMatchingCompletionBinding();
        return cached as CompleteGameResponseData;
      }
      throw new HttpsError("data-loss", "The game completion receipt is invalid.");
    }
    if (!userSnapshot.exists) throw new HttpsError("not-found", "User data not found.");

    /** Provides r. */
    const user = userSnapshot.data() as Player;
    /** Provides current stats behavior. */
    const currentStats: PlayerStats = {...defaultPlayerStats(), ...(user.stats ?? {})};
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
        throw new HttpsError("permission-denied", "Classic progression no longer matches this completion.");
      }
      if (data.classicIndex !== progress.classicIndex) {
        if (data.classicIndex < progress.classicIndex) supersededCompletion = true;
        else throw new HttpsError("permission-denied", "Classic progression no longer matches this completion.");
      }
    }
    if (data.gameMode === "challenge") {
      /** Provides now behavior. */
      const now = new Date();
      /** Provides last completed key behavior. */
      const lastCompletedKey =
        typeof user.lastCompletedDailyChallengeKey === "string"
          ? user.lastCompletedDailyChallengeKey
          : getCompletionDay(user.lastDailyChallengeCompletedAt, data.locale);
      /** Provides last attempted key behavior. */
      const lastAttemptedKey =
        typeof user.lastDailyChallengeAttemptedKey === "string" ? user.lastDailyChallengeAttemptedKey : undefined;
      if (!data.isCorrect && lastCompletedKey && data.challengeDate && lastCompletedKey >= data.challengeDate) {
        supersededCompletion = true;
      } else {
        if (!isDailyCompletionDateEligible(data.challengeDate, data.isCorrect, data.terminalAt, now, data.locale)) {
          throw new HttpsError("permission-denied", "This daily challenge is no longer current.");
        }
        if (
          data.challengeDate !== getDailyDate(data.locale, now) &&
          lastAttemptedKey &&
          lastAttemptedKey > data.challengeDate!
        ) {
          throw new HttpsError("permission-denied", "A newer daily challenge was already attempted.");
        }
        if (lastCompletedKey && lastCompletedKey >= data.challengeDate!) {
          throw new HttpsError("failed-precondition", "This daily challenge is already complete or out of order.");
        }
      }
    }
    if (supersededCompletion) {
      /** Provides response behavior. */
      const response: CompleteGameResponseData = {
        attempts: data.attempts,
        isCorrect: data.isCorrect,
        coinsEarned: 0,
        newlyUnlockedAchievementIds: [],
        scoreEarned: 0,
        xpEarned: 0,
        newXp: currentStats.xp,
        newLevel: currentStats.level,
        leveledUp: false,
        ...(data.gameMode === "challenge" ? {newWinStreak: currentStats.winStreak} : {}),
      };
      createCompletionReceipt(response);
      clearMatchingCompletionBinding();
      return response;
    }
    /** Provides stats behavior. */
    const stats: PlayerStats = {...currentStats};

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
    let newWinStreak: number | undefined;

    if (data.isCorrect) {
      stats.wins += 1;
      stats.totalWins += 1;
      stats.totalGuessesInWins += data.attempts;
      /** Provides max attempts behavior. */
      const maxAttempts = data.gameMode === "challenge" ? MAX_ATTEMPTS_CHALLENGE : MAX_ATTEMPTS_CLASSIC;
      xpEarned =
        (data.gameMode === "challenge" ? BASE_SCORE_CHALLENGE : BASE_SCORE_CLASSIC) +
        Math.max(0, (maxAttempts - data.attempts + 1) * 10);
      stats.xp += xpEarned;
      stats.totalScore += xpEarned;
      /** Provides previous level behavior. */
      const previousLevel = currentStats.level ?? getLevelFromXp(currentStats.xp);
      stats.level = getLevelFromXp(stats.xp);
      if (stats.level > previousLevel) levelUpBonus = LEVEL_UP_COIN_BONUS;

      if (data.gameMode === "challenge") {
        newWinStreak = computeNextDailyWinStreak(
          currentStats.winStreak,
          user.lastDailyChallengeCompletedAt,
          getDailyMidnight(data.locale, data.challengeDate!),
          data.locale,
          user.lastCompletedDailyChallengeKey,
        );
        stats.winStreak = newWinStreak;
        stats.bestStreak = Math.max(stats.bestStreak, newWinStreak);
        stats.challengeWins += 1;
        stats.dailyPuzzlesCompleted += 1;
        progress.dailyChallengeIndex += 1;
        progress.dailyChallengeCurrentQuestion = 1;
        baseWinCoins = getSoloWinCoins("challenge", data.difficultyBand);
        dailyStreakBonus = getStreakRewardBonus(newWinStreak);
      } else {
        progress.classicIndex += 1;
        stats.highestLevelClassic = Math.max(stats.highestLevelClassic, progress.classicIndex);
        baseWinCoins = getSoloWinCoins("classic", data.difficultyBand);
      }
    } else if (data.gameMode === "challenge") {
      newWinStreak = 0;
      stats.winStreak = 0;
    }

    stats.averageGuesses = stats.totalWins > 0 ? Number((stats.totalGuessesInWins / stats.totalWins).toFixed(2)) : 0;
    stats.winRate = stats.gamesPlayed > 0 ? Number(((stats.totalWins / stats.gamesPlayed) * 100).toFixed(2)) : 0;

    /** Provides pre achievement coins behavior. */
    const preAchievementCoins = Number(user.coins ?? 0) + baseWinCoins + dailyStreakBonus + levelUpBonus;
    /** Provides projected user behavior. */
    const projectedUser: Player = {...user, coins: preAchievementCoins, stats, progress};
    /** Provides new achievements behavior. */
    const newAchievements = findNewAchievements(projectedUser, {
      gameMode: data.gameMode,
      isCorrect: data.isCorrect,
      attempts: data.attempts,
      gameOver: true,
    });
    /** Provides newly unlocked achievement ids behavior. */
    const newlyUnlockedAchievementIds = newAchievements.map((entry) => entry.achievementId);
    /** Provides achievement bonus behavior. */
    const achievementBonus = data.isCorrect ? countCoinRewardAchievements(newlyUnlockedAchievementIds) * ACHIEVEMENT_UNLOCK_COIN_REWARD : 0;
    /** Provides coins earned behavior. */
    const coinsEarned = data.isCorrect ? baseWinCoins + dailyStreakBonus + levelUpBonus + achievementBonus : 0;
    /** Provides new balance behavior. */
    const newBalance = Number(user.coins ?? 0) + coinsEarned;
    /** Provides response behavior. */
    const response: CompleteGameResponseData = {
      attempts: data.attempts,
      isCorrect: data.isCorrect,
      coinsEarned,
      newlyUnlockedAchievementIds,
      scoreEarned: xpEarned,
      xpEarned,
      newXp: stats.xp,
      newLevel: stats.level,
      leveledUp: stats.level > currentStats.level,
      ...(newWinStreak !== undefined ? {newWinStreak} : {}),
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
      coins: newBalance,
      stats,
      progress,
      unlockedAchievements: [...(user.unlockedAchievements ?? []), ...newAchievements],
      ...(data.gameMode === "challenge" && data.isCorrect
        ? {
            lastDailyChallengeCompletedAt:
              data.challengeDate === getDailyDate(data.locale)
                ? admin.firestore.FieldValue.serverTimestamp()
                : admin.firestore.Timestamp.fromDate(getDailyMidnight(data.locale, data.challengeDate!)),
            lastCompletedDailyChallengeKey: data.challengeDate ?? data.completionKey,
          }
        : {}),
      ...(data.gameMode === "challenge" ? {lastDailyChallengeAttemptedKey: data.challengeDate} : {}),
    });
    createCompletionReceipt(response);
    clearMatchingCompletionBinding();
    return response;
  });

  // A failed settlement makes the callable retryable. On retry the completion
  // receipt replays safely and the referral transaction resumes idempotently.
  if (data.isCorrect) {
    /** Provides facebook referral behavior. */
    const facebookReferral = await settleFacebookReferralAfterAuthoritativeWin(auth.uid);
    /** Provides reddit referral behavior. */
    const redditReferral = await settleRedditReferralAfterAuthoritativeWin(auth.uid);
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

  // These effects are derived, overwrite-safe, and retried on receipt replay;
  // they cannot make the already-committed player reward partial.
  try {
    /** Provides r. */
    const user = await getUser(auth.uid);
    /** Independent projections share the same committed profile and settle before responding. */
    const projections: Promise<unknown>[] = [];
    if (data.isCorrect && user && !auth.isAnonymous) {
      projections.push(updateLeaderboardEntry(
        auth.uid,
        user.username,
        {
          level: user.stats.level,
          xp: user.stats.xp,
          totalWins: user.stats.totalWins,
          bestStreak: user.stats.bestStreak,
        },
        user.avatarUrl ?? null,
      ));
    }
    if (data.isCorrect && data.gameMode === "classic" && user) {
      projections.push(triggerClassicRiddleGenerationIfNeeded(auth.uid, user.progress.classicIndex, data.locale));
    }
    /** One failed projection cannot suppress or leave the other running past the response. */
    const settled = await Promise.allSettled(projections);
    for (const projection of settled) if (projection.status === "rejected") {
      functions.logger.error("Recoverable post-completion projection failed.", getSafeErrorMetadata(projection.reason));
      captureException(projection.reason);
    }
  } catch (error) {
    functions.logger.error("Recoverable post-completion projection failed.", getSafeErrorMetadata(error));
    captureException(error);
  }
  return result;
}
