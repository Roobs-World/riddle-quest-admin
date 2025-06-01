import * as dotenv from "dotenv";
dotenv.config({path: ".env"}); // Load .env file from firebase-functions directory

// Import necessary testing libraries and modules
import {describe, it, expect, beforeAll, afterAll, beforeEach, afterEach} from "@jest/globals";
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https";

// Import the functions to test
import {notifyRewardedAdCompleted} from "../adClientCallbacks";
import {createUser} from "./testUtils";

// 🚨 CRITICAL SAFETY CHECK - PREVENT PRODUCTION DATA DESTRUCTION 🚨
const FIREBASE_PROJECT_ID = "qwordly-6ba44";
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;

// 🚨 ABSOLUTE SAFETY: This test MUST NEVER run against production
if (FIREBASE_PROJECT_ID === "qwordly-6ba44" && !FIRESTORE_EMULATOR_HOST) {
  throw new Error(`
🚨🚨🚨 CRITICAL SAFETY VIOLATION 🚨🚨🚨

This test is ABSOLUTELY FORBIDDEN from running against production!

PROJECT ID: ${FIREBASE_PROJECT_ID} (PRODUCTION)
EMULATOR: ${FIRESTORE_EMULATOR_HOST || "NOT SET"}

Integration tests can modify or delete production data!
Running this test against production DESTROYS USER DATA!

TO FIX:
1. Change FIREBASE_PROJECT_ID to a test project (NOT qwordly-6ba44)
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
    console.log("Connecting to live Firestore project.");
  } catch (error) {
    console.error("🚨 Firebase Admin SDK initialization failed. Error: ", error);
    throw error;
  }
}

let firestore: admin.firestore.Firestore;

describe("Rewarded Ad Client Callbacks - Integration Tests", () => {
  const wrappedNotifyRewardedAdCompleted = testEnv.wrap(notifyRewardedAdCompleted);
  const testUserId = "testUserAdCallbacks";
  const initialUserData = {
    email: "ad@example.com",
    coins: 100,
    progress: {classicIndex: 1, dailyChallengeIndex: 0, tutorialIndex: 0},
    stats: {
      gamesPlayed: 1,
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
  };

  beforeAll(async () => {
    try {
      firestore = admin.firestore();

      // Test Firebase connection
      await firestore.collection("_test").doc("connection").set({timestamp: new Date()});
      await firestore.collection("_test").doc("connection").delete();

      console.log("✅ Firebase connection successful for Ad Callbacks integration tests");

      // Optional: Verify GOOGLE_APPLICATION_CREDENTIALS is set for clarity during test runs
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.warn(
          "\n⚠️ GOOGLE_APPLICATION_CREDENTIALS not set. Tests will likely fail to connect to live Firestore. ⚠️\n",
        );
      }
    } catch (error) {
      console.error("❌ Firebase connection failed for Ad Callbacks integration tests:", error);
      throw new Error("Firebase connection failed. Check credentials and network.");
    }
  }, 30000);

  beforeEach(async () => {
    try {
      // Clear Firestore data for the test user before each test
      const userRef = firestore.collection("users").doc(testUserId);
      await userRef.delete().catch(() => {}); // Ignore error if document doesn't exist

      // Create a fresh test user with initial data
      await createUser(firestore, testUserId, initialUserData);
    } catch (error) {
      console.error("❌ Setup failed in beforeEach:", error);
      throw error;
    }
  }, 30000);

  afterEach(async () => {
    try {
      // Clear Firestore data for the test user after each test
      const userRef = firestore.collection("users").doc(testUserId);
      await userRef.delete().catch(() => {}); // Ignore error if document doesn't exist
    } catch (error) {
      console.warn("⚠️ Cleanup warning in afterEach:", error);
    }
  }, 15000);

  afterAll(async () => {
    try {
      testEnv.cleanup();
    } catch (error) {
      console.warn("⚠️ Final cleanup warning:", error);
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

  it("should successfully notify rewarded ad completion for authenticated user", async () => {
    const adDetails = {
      placementId: "test_placement_id",
      creativeId: "test_creative_id",
      networkName: "AppLovin",
    };

    const request = constructOnCallRequest({adDetails});

    const result = await wrappedNotifyRewardedAdCompleted(request);

    // Should return success message (function only logs, doesn't award coins)
    expect(result).toEqual({
      success: true,
      message: "Rewarded ad completion notification received.",
    });

    // Verify coins were NOT changed (this function only logs)
    const userDoc = await firestore.collection("users").doc(testUserId).get();
    expect(userDoc.data()?.coins).toBe(initialUserData.coins);
  }, 15000);

  it("should throw unauthenticated error if user is not authenticated", async () => {
    const adDetails = {
      placementId: "test_placement_id",
      creativeId: "test_creative_id",
      networkName: "AppLovin",
    };

    const request = constructOnCallRequest({adDetails}, null); // No authentication

    await expect(wrappedNotifyRewardedAdCompleted(request)).rejects.toThrow(
      new HttpsError("unauthenticated", "The function must be called while authenticated."),
    );
  }, 10000);

  it("should handle minimal ad details", async () => {
    const adDetails = {}; // Minimal ad details

    const request = constructOnCallRequest({adDetails});

    const result = await wrappedNotifyRewardedAdCompleted(request);

    expect(result).toEqual({
      success: true,
      message: "Rewarded ad completion notification received.",
    });

    // Verify coins were NOT changed
    const userDoc = await firestore.collection("users").doc(testUserId).get();
    expect(userDoc.data()?.coins).toBe(initialUserData.coins);
  }, 15000);

  it("should handle missing adDetails field", async () => {
    const request = constructOnCallRequest({}); // No adDetails

    const result = await wrappedNotifyRewardedAdCompleted(request);

    expect(result).toEqual({
      success: true,
      message: "Rewarded ad completion notification received.",
    });
  }, 10000);
});
