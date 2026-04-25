import * as dotenv from "dotenv";
dotenv.config({path: ".env"}); // Load .env file from firebase-functions directory

// Import necessary testing libraries and modules
import {describe, it, expect, beforeAll, afterAll, beforeEach} from "@jest/globals";
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https";

// Import the functions to test
import {updateAvatar} from "../profile";
import {createUser} from "./testUtils";

// 🚨 CRITICAL SAFETY CHECK - PREVENT PRODUCTION DATA DESTRUCTION 🚨
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;

// 🚨 ABSOLUTE SAFETY: This test MUST NEVER run against production
if (FIREBASE_PROJECT_ID === "Riddle Quest-6ba44" && !FIRESTORE_EMULATOR_HOST) {
  throw new Error(`
🚨🚨🚨 CRITICAL SAFETY VIOLATION 🚨🚨🚨

This test is ABSOLUTELY FORBIDDEN from running against production!

PROJECT ID: ${FIREBASE_PROJECT_ID} (PRODUCTION)
EMULATOR: ${FIRESTORE_EMULATOR_HOST || "NOT SET"}

Integration tests can modify or delete production data!
Running this test against production DESTROYS USER DATA!

TO FIX:
1. Change FIREBASE_PROJECT_ID to a test project (NOT Riddle Quest-6ba44)
2. Use a dedicated test Firebase project
3. NEVER run integration tests against production

PRODUCTION DATA PROTECTION: This test is BLOCKED for safety.
  `);
}

// If using emulators, log it for clarity
if (FIRESTORE_EMULATOR_HOST) {
  console.log(`🧪 Running tests with Firestore emulator at ${FIRESTORE_EMULATOR_HOST}`);
}

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
  const wrappedUpdateAvatar = testEnv.wrap(updateAvatar);
  const testUserId = "testUserProfile";
  const initialUserData = {
    email: "profile@example.com",
    coins: 100,
    progress: {classicIndex: 5, dailyChallengeIndex: 2, dailyChallengeCurrentQuestion: 0},
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
    try {
      firestore = admin.firestore();

      // Test Firebase connection with retry logic
      let connectionAttempts = 0;
      const maxAttempts = 3;
      let connectionSuccessful = false;

      while (connectionAttempts < maxAttempts && !connectionSuccessful) {
        try {
          connectionAttempts++;
          console.log(`🔄 Firebase connection attempt ${connectionAttempts}/${maxAttempts}`);

          const testDoc = firestore.collection("_test").doc("connection");
          await testDoc.set({timestamp: new Date(), attempt: connectionAttempts});
          await testDoc.delete();

          connectionSuccessful = true;
          console.log("✅ Firebase connection successful for Profile integration tests");
        } catch (attemptError) {
          console.warn(`⚠️ Connection attempt ${connectionAttempts} failed:`, attemptError);
          if (connectionAttempts < maxAttempts) {
            // Wait 2 seconds before retry
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      if (!connectionSuccessful) {
        throw new Error(`Firebase connection failed after ${maxAttempts} attempts. Check emulator status and network.`);
      }
    } catch (error) {
      console.error("❌ Firebase connection failed for Profile integration tests:", error);
      throw error;
    }
  }, 60000);

  beforeEach(async () => {
    try {
      // Clear and create fresh test user data
      const userRef = firestore.collection("users").doc(testUserId);
      await userRef.delete().catch(() => {}); // Ignore error if doc doesn't exist
      await createUser(firestore, testUserId, initialUserData);
    } catch (error) {
      console.error("❌ Setup failed in beforeEach:", error);
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    try {
      // Clean up test data
      await firestore
        .collection("users")
        .doc(testUserId)
        .delete()
        .catch(() => {});
      testEnv.cleanup();
    } catch (error) {
      console.warn("⚠️ Cleanup warning:", error);
    }
  }, 15000);

  // Helper to construct the request object
  const constructOnCallRequest = <T = unknown>(data: T, authContextArg?: {uid: string} | null): CallableRequest<T> => {
    const auth = authContextArg === undefined ? {uid: testUserId} : authContextArg;
    return {
      data: data,
      auth: auth,
      rawRequest: {headers: {}, body: {}},
    } as CallableRequest<T>;
  };

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
    }, 15000);

    it("should throw unauthenticated if called without authentication", async () => {
      const request = constructOnCallRequest({avatarUrl: "any_url.png"}, null);
      await expect(wrappedUpdateAvatar(request)).rejects.toThrow(
        new HttpsError("unauthenticated", "The function must be called while authenticated."),
      );
    }, 10000);

    it("should throw invalid-argument for missing avatarUrl", async () => {
      const request = constructOnCallRequest({}); // Cast to satisfy type, but data is missing
      await expect(wrappedUpdateAvatar(request)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid or missing avatar URL."),
      );
    }, 10000);

    it("should throw invalid-argument for non-string avatarUrl", async () => {
      const request = constructOnCallRequest({avatarUrl: 123}); // Invalid type
      await expect(wrappedUpdateAvatar(request)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid or missing avatar URL."),
      );
    }, 10000);
  });
});
