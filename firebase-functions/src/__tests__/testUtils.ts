// Test utilities for common Firebase Functions testing patterns
import * as admin from "firebase-admin";
import {Player} from "../validation/firestoreSchemas";

/**
 * Creates a test user in Firestore with default values
 * @param firestore - The Firestore instance to use
 * @param userId - The user ID to create
 * @param overrides - Optional properties to override defaults
 * @returns Promise that resolves when user is created
 */
export async function createUser(
  firestore: admin.firestore.Firestore,
  userId: string,
  overrides: Partial<Player> = {},
): Promise<void> {
  const defaultUser: Player = {
    userId,
    email: `${userId}@test.com`,
    username: `User${userId}`,
    xp: 0,
    coins: 100,
    hasPurchasedApp: false,
    progress: {
      classicIndex: 1,
      dailyChallengeIndex: 1,
    },
    stats: {
      gamesPlayed: 0,
      wins: 0,
      totalWins: 0,
      winStreak: 0,
      bestStreak: 0,
      averageGuesses: 0,
      winRate: 0,
      challengeWins: 0,
      totalGuessesInWins: 0,
      dailyPuzzlesCompleted: 0,
      totalWordsGuessed: 0,
      totalScore: 0,
      highestLevelClassic: 0,
    },
    registeredAt: Date.now(),
    lastLogin: Date.now(),
  };

  // Filter out undefined values from overrides to prevent Firestore validation errors
  const filteredOverrides: Partial<Player> = {};
  Object.keys(overrides).forEach((key) => {
    const value = (overrides as Record<string, unknown>)[key];
    if (value !== undefined) {
      (filteredOverrides as Record<string, unknown>)[key] = value;
    }
  });

  const userData = {
    ...defaultUser,
    ...filteredOverrides,
  };

  await firestore.collection("users").doc(userId).set(userData);
}

/**
 * Deletes a test user from Firestore and all subcollections
 * @param userId - The user ID to delete
 */
export async function deleteUser(userId: string): Promise<void> {
  const userRef = admin.firestore().collection("users").doc(userId);

  // Delete any subcollections
  const processedPurchases = await userRef.collection("processedPurchases").get();
  const deletePromises = processedPurchases.docs.map((doc) => doc.ref.delete());
  await Promise.all(deletePromises);

  // Delete the user document
  await userRef.delete();
}

/**
 * Creates a test riddle in Firestore
 * @param riddleId - The riddle ID
 * @param text - The riddle text
 * @param answer - The riddle answer
 */
export async function createTestRiddle(riddleId: string, text: string, answer: string): Promise<void> {
  await admin.firestore().collection("riddles").doc(riddleId).set({
    riddleId,
    text,
    answer,
  });
}

/**
 * Deletes a test riddle from Firestore
 * @param riddleId - The riddle ID to delete
 */
export async function deleteTestRiddle(riddleId: string): Promise<void> {
  await admin.firestore().collection("riddles").doc(riddleId).delete();
}

/**
 * Creates the current daily riddle document in Firestore
 * @param date - Date string (YYYY-MM-DD)
 * @param riddleId - The riddle ID for this daily challenge
 */
export async function createDailyChallenge(date: string, riddleId: string): Promise<void> {
  await admin.firestore().collection("dailyRiddles").doc("current").set({
    riddleId: "current",
    sourceRiddleId: riddleId,
    dailyIndex: 0,
    category: "daily",
    createdAt: Date.now(),
    timestamp: date,
  });
}

/**
 * Deletes the current daily riddle document from Firestore
 * @param _date - Unused legacy date parameter (kept for call-site compatibility)
 */
export async function deleteDailyChallenge(_date: string): Promise<void> {
  await admin.firestore().collection("dailyRiddles").doc("current").delete();
}

/**
 * Helper to get today's date string in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Helper to get a date string relative to today
 * @param daysOffset - Number of days to offset from today (negative for past dates)
 */
export function getDateString(daysOffset: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split("T")[0];
}

/**
 * Cleans up all test data for a user
 * @param userId - The user ID to clean up
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  await deleteUser(userId);
}

/**
 * Waits for a specified number of milliseconds
 * @param ms - Milliseconds to wait
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
