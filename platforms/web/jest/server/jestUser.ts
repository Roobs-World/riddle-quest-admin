import {createHash} from "node:crypto";
import type {Firestore, Transaction} from "firebase-admin/firestore";
import {reserveUsernameForNewUser} from "../../../../firebase-functions/src/profile/usernameReservations";

/** Creates the initial server-authoritative profile for one Jest platform identity. */
export function createJestUser(uid: string, playerId: string): Record<string, unknown> {
  /** Provides now behavior. */
  const now = Date.now();
  /** Provides rname. */
  const username = `Jest ${createHash("sha256").update(playerId).digest("hex").slice(0, 19)}`;
  return {
    userId: uid,
    email: `${uid}@players.jest.invalid`,
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

/** Creates a Jest profile payload and atomically claims its generated username. */
export function createReservedJestUser(
  transaction: Transaction,
  db: Firestore,
  uid: string,
  playerId: string,
): Record<string, unknown> {
  /** Provides r. */
  const user = createJestUser(uid, playerId);
  /** Provides rname. */
  const username = String(user.username);
  return {...user, ...reserveUsernameForNewUser(transaction, db, uid, username)};
}
