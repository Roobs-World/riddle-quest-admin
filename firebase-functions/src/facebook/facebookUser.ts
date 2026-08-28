import {createHash} from "node:crypto";
import type {Firestore, Transaction} from "firebase-admin/firestore";
import {reserveUsernameForNewUser} from "../profile/usernameReservations";

/** Creates a game-owned profile without copying Meta profile data. */
export function createFacebookUser(uid: string): Record<string, unknown> {
  /** Provides now behavior. */
  const now = Date.now();
  /** Provides rname. */
  const username = `Player ${createHash("sha256").update(uid).digest("hex").slice(0, 17)}`;
  return {
    userId: uid,
    email: `${uid}@players.facebook.invalid`,
    username,
    coins: 300,
    hasPurchasedApp: false,
    hasActiveSubscription: false,
    createdAt: now,
    registeredAt: now,
    lastLogin: now,
    preferredLanguage: "en",
    stats: {
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
    },
    progress: {classicIndex: 1, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
    unlockedAchievements: [],
  };
}

/** Creates reserved facebook user. */
export function createReservedFacebookUser(
  transaction: Transaction,
  db: Firestore,
  uid: string,
): Record<string, unknown> {
  /** Provides r. */
  const user = createFacebookUser(uid);
  return {...user, ...reserveUsernameForNewUser(transaction, db, uid, String(user.username))};
}
