import * as dotenv from "dotenv";
dotenv.config({path: ".env"}); // Load .env file from firebase-functions directory

// Import necessary testing libraries and modules
import {describe, it, expect, beforeAll, afterAll, beforeEach} from "@jest/globals";
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https";

// Import the functions to test
import {resetStats, updateAvatar} from "../profile";
import {PlayerSchema} from "../validation/firestoreSchemas";
import {createUser} from "./testUtils";

const FIREBASE_PROJECT_ID = "qwordly-6ba44";

// Initialize firebase-functions-test
const testEnv = functionsTest();

// Manually initialize Firebase Admin SDK for testing against the live project
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: FIREBASE_PROJECT_ID,
    });
  } catch (error) {
    console.error("🚨 Firebase Admin SDK initialization failed. Error: ", error);
    throw error;
  }
}

let firestore: admin.firestore.Firestore;

describe("Profile Functions - Integration Tests", () => {
  jest.setTimeout(30000);
  const wrappedResetStats = testEnv.wrap(resetStats);
  const wrappedUpdateAvatar = testEnv.wrap(updateAvatar);
  const testUserId = "testUserProfile";
  const initialUserData = {
    email: "profile@example.com",
    coins: 100,
    progress: {classicIndex: 5, dailyChallengeIndex: 2, tutorialIndex: 1},
    stats: {
      gamesWon: 10,
      hintsUsed: 5,
      riddlesSolved: 20,
      riddlesSkipped: 3,
      classicRiddlesSolved: 15,
      dailyChallengesCompleted: 2,
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
    },
    avatarUrl: "initial_avatar.png",
    userId: testUserId,
    username: "testUserProfile",
    xp: 0,
    createdAt: undefined,
    registeredAt: undefined,
    lastLogin: undefined,
    lastDailyChallengeCompletedAt: undefined,
    displayName: undefined,
  };

  beforeAll(async () => {
    firestore = admin.firestore();
  });

  beforeEach(async () => {
    // Clear and create fresh test user data
    const userRef = firestore.collection("users").doc(testUserId);
    await userRef.delete().catch(() => {}); // Ignore error if doc doesn't exist
    await createUser(firestore, testUserId, initialUserData);
  }, 60000);

  afterAll(() => {
    testEnv.cleanup();
  });

  // Helper to construct the request object
  const constructOnCallRequest = <T = unknown>(data: T, authContextArg?: {uid: string} | null): CallableRequest<T> => {
    const auth = authContextArg === undefined ? {uid: testUserId} : authContextArg;
    return {
      data: data,
      auth: auth,
      rawRequest: {headers: {}, body: {}},
    } as CallableRequest<T>;
  };

  describe("resetStats", () => {
    it("should reset user stats to default values", async () => {
      const request = constructOnCallRequest({}); // No data needed for resetStats

      const result = await wrappedResetStats(request);
      expect(result).toEqual({success: true, message: "Stats reset successfully."});

      const userDoc = await firestore.collection("users").doc(testUserId).get();
      const userData = userDoc.data();

      const defaultStats = PlayerSchema.shape.stats.parse({});
      expect(userData?.stats).toEqual(defaultStats);
      // Ensure other fields are not reset by this specific function
      expect(userData?.coins).toBe(initialUserData.coins);
      expect(userData?.progress).toEqual(initialUserData.progress);
      expect(userData?.avatarUrl).toBe(initialUserData.avatarUrl);
    });

    it("should throw unauthenticated if called without authentication", async () => {
      const request = constructOnCallRequest({}, null);
      await expect(wrappedResetStats(request)).rejects.toThrow(
        new HttpsError("unauthenticated", "The function must be called while authenticated."),
      );
    });

    // Test for non-existent user is tricky as Firestore update would create the doc path
    // but the function targets a specific user doc based on auth.uid.
    // If auth.uid doesn't exist, the update will simply create a new doc with reset stats,
    // which might not be an "error" from Firestore's perspective but a no-op for an intended user.
    // The function itself doesn't explicitly check if the user doc exists before updating.
  });

  describe("updateAvatar", () => {
    it("should update the user avatar URL", async () => {
      const newAvatarUrl = "new_updated_avatar.png";
      const request = constructOnCallRequest({avatarUrl: newAvatarUrl});

      const result = await wrappedUpdateAvatar(request);
      expect(result).toEqual({success: true, message: "Avatar URL updated successfully."});

      const userDoc = await firestore.collection("users").doc(testUserId).get();
      expect(userDoc.data()?.avatarUrl).toBe(newAvatarUrl);
      // Ensure other fields are not affected
      expect(userDoc.data()?.coins).toBe(initialUserData.coins);
    });

    it("should throw unauthenticated if called without authentication", async () => {
      const request = constructOnCallRequest({avatarUrl: "any_url.png"}, null);
      await expect(wrappedUpdateAvatar(request)).rejects.toThrow(
        new HttpsError("unauthenticated", "The function must be called while authenticated."),
      );
    });

    it("should throw invalid-argument for missing avatarUrl", async () => {
      const request = constructOnCallRequest({}); // Cast to satisfy type, but data is missing
      await expect(wrappedUpdateAvatar(request)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid or missing avatar URL."),
      );
    });

    it("should throw invalid-argument for non-string avatarUrl", async () => {
      const request = constructOnCallRequest({avatarUrl: 123}); // Invalid type
      await expect(wrappedUpdateAvatar(request)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid or missing avatar URL."),
      );
    });
  });
});
