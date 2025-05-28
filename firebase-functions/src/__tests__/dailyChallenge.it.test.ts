// Import necessary testing libraries and modules
import {describe, it, expect, beforeAll, afterAll, beforeEach, jest} from "@jest/globals";
import * as dotenv from "dotenv";
dotenv.config({path: ".env"}); // Load .env file from firebase-functions directory

import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import {HttpsError, CallableRequest as CallableRequestV2} from "firebase-functions/v2/https"; // For V2 onCall

// Import the functions to test
import {setCompletedDailyChallenge, hasCompletedDailyChallenge} from "../dailyChallenge";
import {createUser} from "./testUtils";

const FIREBASE_PROJECT_ID = "qwordly-6ba44";

// Initialize firebase-functions-test. This DOES NOT initialize admin.initializeApp()
// when used with a live project. We must do that manually.
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

// Helper to get ISO date string for yesterday
const getYesterdayISOString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString();
};

const getTodayISOString = () => {
  return new Date().toISOString();
};

describe("Daily Challenge Functions - Integration Tests", () => {
  const wrappedSetCompletedDailyChallenge = testEnv.wrap(setCompletedDailyChallenge);
  const wrappedHasCompletedDailyChallenge = testEnv.wrap(hasCompletedDailyChallenge);
  const testUserId = "testUserDailyChallenge";
  const initialUserData = {
    email: "daily@example.com",
    coins: 50,
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
    lastDailyChallengeCompletedAt: undefined, // Use undefined instead of null
  };

  beforeAll(async () => {
    try {
      // Initialize Firestore instance after admin app is initialized.
      firestore = admin.firestore();

      // Test Firebase connection
      await firestore.collection("_test").doc("connection").set({timestamp: new Date()});
      await firestore.collection("_test").doc("connection").delete();

      console.log("✅ Firebase connection successful for Daily Challenge integration tests");

      // Optional: Verify GOOGLE_APPLICATION_CREDENTIALS is set for clarity during test runs
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.warn(
          "\n⚠️ GOOGLE_APPLICATION_CREDENTIALS not set. Tests will likely fail to connect to live Firestore. ⚠️\n",
        );
      }
    } catch (error) {
      console.error("❌ Firebase connection failed for Daily Challenge integration tests:", error);
      throw new Error("Firebase connection failed. Check credentials and network.");
    }
  }, 30000);

  beforeEach(async () => {
    try {
      const userRef = firestore.collection("users").doc(testUserId);
      await userRef.delete().catch(() => {});
      await createUser(firestore, testUserId, initialUserData);
      // Reset a field that might be set by tests to ensure clean state
      await firestore.collection("users").doc(testUserId).update({
        lastDailyChallengeCompletedAt: admin.firestore.FieldValue.delete(),
      });
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

  // Helper for V2 CallableRequest
  const constructV2Request = <T = unknown>(data: T, authContextArg?: {uid: string} | null): CallableRequestV2<T> => {
    const auth = authContextArg === undefined ? {uid: testUserId} : authContextArg;
    return {
      data: data,
      auth: auth,
      rawRequest: {headers: {}, body: {data: data}}, // V2 also has this structure
    } as CallableRequestV2<T>;
  };

  describe("setCompletedDailyChallenge (V2 style)", () => {
    it("should set lastDailyChallengeCompletedAt to the current date", async () => {
      const request = constructV2Request({});

      const result = await wrappedSetCompletedDailyChallenge(request);
      expect(result).toEqual({message: "Last completed daily challenge date set successfully."});

      const userDoc = await firestore.collection("users").doc(testUserId).get();
      const userData = userDoc.data();
      expect(userData?.lastDailyChallengeCompletedAt).toBeDefined();
      // Compare only the date part
      const completedDate = new Date(userData?.lastDailyChallengeCompletedAt as string).toDateString();
      const todayDate = new Date().toDateString();
      expect(completedDate).toBe(todayDate);
    }, 15000);

    it("should throw unauthenticated if called without authentication", async () => {
      const request = constructV2Request({}, null); // No auth
      await expect(wrappedSetCompletedDailyChallenge(request)).rejects.toThrow(
        new HttpsError("unauthenticated", "The user must be authenticated to set completed daily challenge."),
      );
    }, 10000);
  });

  describe("hasCompletedDailyChallenge (V2)", () => {
    it("should return true if user completed daily challenge today", async () => {
      // First, set as completed today
      await firestore.collection("users").doc(testUserId).update({
        lastDailyChallengeCompletedAt: getTodayISOString(),
      });
      const request = constructV2Request({id: testUserId});
      const result = await wrappedHasCompletedDailyChallenge(request);
      expect(result).toBe(true);
    }, 15000);

    it("should return false if user completed daily challenge yesterday", async () => {
      await firestore.collection("users").doc(testUserId).update({
        lastDailyChallengeCompletedAt: getYesterdayISOString(),
      });
      const request = constructV2Request({id: testUserId});
      const result = await wrappedHasCompletedDailyChallenge(request);
      expect(result).toBe(false);
    }, 15000);

    it("should return false if user has never completed a daily challenge", async () => {
      // Ensure lastDailyChallengeCompletedAt is null (set in beforeEach)
      const request = constructV2Request({id: testUserId});
      const result = await wrappedHasCompletedDailyChallenge(request);
      expect(result).toBe(false);
    }, 15000);

    it("should return false if user does not exist", async () => {
      const request = constructV2Request({id: "nonExistentUser"});
      const result = await wrappedHasCompletedDailyChallenge(request);
      expect(result).toBe(false);
    }, 15000);

    it("should throw internal error if firestoreService.getUser fails unexpectedly", async () => {
      // eslint-disable-next-line
      const mockGetUser = jest.spyOn(require("../firestoreService"), "getUser");
      mockGetUser.mockRejectedValue(new Error("Firestore kaboom!"));

      const request = constructV2Request({id: testUserId});
      await expect(wrappedHasCompletedDailyChallenge(request)).rejects.toThrow(
        new HttpsError("internal", "An error occurred while checking daily challenge status."),
      );
      mockGetUser.mockRestore();
    }, 15000);
  });
});
