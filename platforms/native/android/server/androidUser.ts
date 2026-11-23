import {createHash} from "node:crypto";
import type {Firestore, Transaction} from "firebase-admin/firestore";
import {reserveUsernameForNewUser} from "../../../../firebase-functions/src/profile/usernameReservations";

/** Sign-in providers the Android app may present when provisioning its Global Game Account. */
export const ANDROID_ACCOUNT_PROVIDERS = Object.freeze(["anonymous", "google.com"] as const);
/** Sign-in provider accepted for Android account provisioning. */
export type AndroidAccountProvider = (typeof ANDROID_ACCOUNT_PROVIDERS)[number];

/** Whether a Firebase sign-in provider may provision an Android account. */
export function isAndroidAccountProvider(provider: unknown): provider is AndroidAccountProvider {
  return typeof provider === "string" && (ANDROID_ACCOUNT_PROVIDERS as readonly string[]).includes(provider);
}

/**
 * Creates the initial server-authoritative profile for one Android Firebase identity.
 *
 * @remarks
 * Mirrors the Jest starting balance, stats, and progress so every hosted
 * target begins the same game. The username derives from the Firebase uid
 * rather than any device identifier, and the provider is retained so a later
 * Google sign-in link can be audited.
 */
export function createAndroidUser(uid: string, provider: AndroidAccountProvider): Record<string, unknown> {
  /** Creation time shared by every timestamp field. */
  const now = Date.now();
  /** Generated, unique-by-construction display name reserved on creation. */
  const username = `Android ${createHash("sha256").update(uid).digest("hex").slice(0, 16)}`;
  return {
    userId: uid,
    email: `${uid}@players.android.invalid`,
    username,
    coins: 300,
    hasPurchasedApp: false,
    hasActiveSubscription: false,
    createdAt: now,
    registeredAt: now,
    lastLogin: now,
    preferredLanguage: "en",
    androidProvider: provider,
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

/** Creates an Android profile payload and atomically claims its generated username. */
export function createReservedAndroidUser(
  transaction: Transaction,
  db: Firestore,
  uid: string,
  provider: AndroidAccountProvider,
): Record<string, unknown> {
  /** Initial profile before reservation fields. */
  const user = createAndroidUser(uid, provider);
  return {...user, ...reserveUsernameForNewUser(transaction, db, uid, String(user.username))};
}
