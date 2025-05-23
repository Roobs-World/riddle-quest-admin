import * as admin from "firebase-admin";
// Removed unused import: import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import type {Player, PlayerStatsUpdate} from "./validation/firestoreSchemas.js";
// Removed import for non-existent models.js: import type { GameState } from "./models.js";
import * as functions from "firebase-functions";

// const db = admin.firestore(); // Replaced with lazy initialization
let dbInstance: admin.firestore.Firestore;

function getDb(): admin.firestore.Firestore {
  if (!dbInstance) {
    dbInstance = admin.firestore();
  }
  return dbInstance;
}

// Define a type for PlayerUpdate that allows partial updates and FieldValue
export type PlayerUpdate = {
  userId?: string;
  dailyChallengeIndex?: number | admin.firestore.FieldValue;
  tutorialIndex?: number | admin.firestore.FieldValue;
  classicIndex?: number | admin.firestore.FieldValue;
  coins?: number | admin.firestore.FieldValue;
  username?: string;
  email?: string;
  registeredAt?: Date | null;
  lastLogin?: Date | null;
  lastDailyChallengeCompletedAt?: Date | null;
  currentRiddle?: string; // Define currentRiddle property directly
  avatarUrl?: string | null;
  bestStreak?: number | admin.firestore.FieldValue;
  totalWordsGuessed?: number | admin.firestore.FieldValue;
  winRate?: number | admin.firestore.FieldValue;
  totalScore?: number | admin.firestore.FieldValue;
  highestLevelClassic?: number | admin.firestore.FieldValue;
  gamesPlayed?: number | admin.firestore.FieldValue;
  classicLevel?: number | admin.firestore.FieldValue;
  challengeWins?: number | admin.firestore.FieldValue;
};

/**
 * Fetches a user document by ID.
 *
 * @param userId - The ID of the user.
 * @return A promise that resolves with the user document data, or undefined if not found.
 */
export async function getUser(userId: string): Promise<Player | undefined> {
  const userRef = getDb().collection("users").doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    functions.logger.info(`User document not found for ID ${userId}`);
    return undefined;
  }
  return userDoc.data() as Player | undefined;
}

/**
 * Updates the last completed daily challenge date for a user.
 *
 * @param userId - The ID of the user.
 * @param date - The date string to set.
 * @return A promise that resolves when the update is complete.
 */
export async function updateUserLastCompletedDailyChallengeDate(userId: string, date: string): Promise<void> {
  try {
    await getDb().collection("users").doc(userId).update({lastDailyChallengeCompletedAt: date});
  } catch (error) {
    console.error(`Error updating last completed daily challenge date for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Updates the coin balance for a user.
 *
 * @param userId - The ID of the user.
 * @param coinsToAdd - The number of coins to add (can be negative to subtract).
 * @param transaction - Optional. The Firestore transaction to use.
 * @return A promise that resolves when the update is complete.
 */
export async function updateUserCoins(
  userId: string,
  coinsToAdd: number,
  transaction?: admin.firestore.Transaction,
): Promise<void> {
  const userRef = getDb().collection("users").doc(userId);

  const updateOperation = async (txn: admin.firestore.Transaction) => {
    const userDoc = await txn.get(userRef);

    if (!userDoc.exists) {
      throw new Error(`User with ID ${userId} not found.`);
    }

    const currentCoins = (userDoc.data()?.coins as number) || 0;
    const newCoins = currentCoins + coinsToAdd;

    if (newCoins < 0) {
      throw new Error(
        `Insufficient coins for user ${userId}. Current: ${currentCoins}, Attempted to spend: ${-coinsToAdd}.`,
      );
    }

    txn.update(userRef, {coins: newCoins});
  };

  if (transaction) {
    await updateOperation(transaction);
  } else {
    // Use a transaction if one is not provided
    await getDb().runTransaction(updateOperation);
  }

  console.log(`User ${userId} coins updated by ${coinsToAdd}.`);
}

/**
 * Updates the stats for a user.
 *
 * @param userId - The ID of the user.
 * @param statsUpdate - An object containing the stats to update.
 * @param transaction - Optional. The Firestore transaction to use.
 * @return A promise that resolves when the update is complete.
 */
export async function updateUserStats(
  userId: string,
  statsUpdate: PlayerStatsUpdate,
  transaction?: admin.firestore.Transaction,
): Promise<void> {
  const userRef = getDb().collection("users").doc(userId);

  const updateOperation = async (txn: admin.firestore.Transaction) => {
    // Fetch the current stats within the transaction to merge updates
    const userDoc = await txn.get(userRef);
    if (!userDoc.exists) {
      throw new Error(`User with ID ${userId} not found.`);
    }
    const currentStats = userDoc.data()?.stats || {};

    txn.update(userRef, {stats: {...currentStats, ...statsUpdate}});
  };

  if (transaction) {
    await updateOperation(transaction);
  } else {
    // Use a transaction if one is not provided
    await getDb().runTransaction(updateOperation);
  }

  console.log(`Stats for user ${userId} updated.`);
}

/**
 * Updates the profile for a user.
 *
 * @param userId - The ID of the user.
 * @param profileUpdate - An object containing the profile fields to update.
 * @return A promise that resolves when the update is complete.
 */
export async function updateUserProfile(userId: string, profileUpdate: Partial<Player>): Promise<void> {
  try {
    await getDb().collection("users").doc(userId).update(profileUpdate);
  } catch (error) {
    console.error(`Error updating profile for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Fetches a riddle document by ID.
 *
 * @param riddleId - The ID of the riddle.
 * @return A promise that resolves with the riddle document data, or undefined if not found.
 */
export async function getRiddle(
  riddleId: string,
): Promise<{answer: string; text: string; riddleId: string} | undefined> {
  const riddleRef = getDb().collection("riddles").doc(riddleId);
  const riddleDoc = await riddleRef.get();

  if (!riddleDoc.exists) {
    functions.logger.info(`Riddle document not found for ID ${riddleId}`);
    return undefined;
  }

  const data = riddleDoc.data();
  if (!data) {
    return undefined;
  }

  return {
    answer: data.answer,
    text: data.text,
    riddleId: data.riddleId || riddleId,
  };
}
