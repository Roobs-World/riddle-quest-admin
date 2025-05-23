// Import necessary testing libraries and modules
import {describe, it, expect, beforeAll, afterAll, beforeEach, jest} from "@jest/globals";
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import {HttpsError, CallableRequest as CallableRequestV2} from "firebase-functions/v2/https"; // For V2 onCall
import * as functions from "firebase-functions"; // For V1 CallableRequest

// Import the functions to test
import {setCompletedDailyChallenge, hasCompletedDailyChallenge} from "../dailyChallenge.js";
import {createUser} from "./testUtils.js";

// Initialize firebase-functions-test
const testEnv = functionsTest();

// Ensure Firebase app is initialized before tests run
if (!admin.apps.length) {
  admin.initializeApp();
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
  const wrappedSetCompletedDailyChallenge = testEnv.wrap(setCompletedDailyChallenge as any);
  const wrappedHasCompletedDailyChallenge = testEnv.wrap(hasCompletedDailyChallenge);
  const testUserId = "testUserDailyChallenge";
  const initialUserData = {
    email: "daily@example.com",
    coins: 50,
    progress: {classicIndex: 1, dailyChallengeIndex: 0, tutorialIndex: 0},
    stats: {gamesWon: 1},
    lastDailyChallengeCompletedAt: null, // Initially not completed
  };

  beforeAll(async () => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      console.error("\n🔥🔥🔥 FIRESTORE_EMULATOR_HOST is not set. Integration tests will likely time out. 🔥🔥🔥\n");
    }
    firestore = admin.firestore();
  });

  beforeEach(async () => {
    const userRef = firestore.collection("users").doc(testUserId);
    await userRef.delete().catch(() => {});
    await createUser(firestore, testUserId, initialUserData);
    // Reset a field that might be set by tests to ensure clean state
    await firestore.collection("users").doc(testUserId).update({
      lastDailyChallengeCompletedAt: null,
    });
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  // Helper for V1 CallableRequest
  const constructV1Request = (
    data: unknown, // V1 data can be anything
    auth?: {uid: string},
  ): functions.https.CallableRequest => {
    return {
      data: data,
      auth: auth,
      rawRequest: {headers: {}, body: {data: data}}, // Simplified rawRequest for V1
    } as functions.https.CallableRequest;
  };

  // Helper for V2 CallableRequest
  const constructV2Request = <T = unknown>(data: T, authContextArg?: {uid: string} | null): CallableRequestV2<T> => {
    const auth = authContextArg === undefined ? {uid: testUserId} : authContextArg;
    return {
      data: data,
      auth: auth,
      rawRequest: {headers: {}, body: {data: data}}, // V2 also has this structure
    } as CallableRequestV2<T>;
  };

  describe("setCompletedDailyChallenge (V1 style)", () => {
    it("should set lastDailyChallengeCompletedAt to the current date", async () => {
      const request = constructV1Request({}, {uid: testUserId});

      const result = await wrappedSetCompletedDailyChallenge(request);
      expect(result).toEqual({message: "Last completed daily challenge date set successfully."});

      const userDoc = await firestore.collection("users").doc(testUserId).get();
      const userData = userDoc.data();
      expect(userData?.lastDailyChallengeCompletedAt).toBeDefined();
      // Compare only the date part
      const completedDate = new Date(userData?.lastDailyChallengeCompletedAt as string).toDateString();
      const todayDate = new Date().toDateString();
      expect(completedDate).toBe(todayDate);
    });

    it("should throw unauthenticated if called without authentication", async () => {
      const request = constructV1Request({}, undefined); // No auth
      await expect(wrappedSetCompletedDailyChallenge(request)).rejects.toThrow(
        new functions.https.HttpsError(
          "unauthenticated",
          "The user must be authenticated to set completed daily challenge.",
        ),
      );
    });
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
    });

    it("should return false if user completed daily challenge yesterday", async () => {
      await firestore.collection("users").doc(testUserId).update({
        lastDailyChallengeCompletedAt: getYesterdayISOString(),
      });
      const request = constructV2Request({id: testUserId});
      const result = await wrappedHasCompletedDailyChallenge(request);
      expect(result).toBe(false);
    });

    it("should return false if user has never completed a daily challenge", async () => {
      // Ensure lastDailyChallengeCompletedAt is null (set in beforeEach)
      const request = constructV2Request({id: testUserId});
      const result = await wrappedHasCompletedDailyChallenge(request);
      expect(result).toBe(false);
    });

    it("should return false if user does not exist", async () => {
      const request = constructV2Request({id: "nonExistentUser"});
      const result = await wrappedHasCompletedDailyChallenge(request);
      expect(result).toBe(false);
    });

    it("should throw internal error if firestoreService.getUser fails unexpectedly", async () => {
      const mockGetUser = jest.spyOn(require("../firestoreService.js"), "getUser");
      mockGetUser.mockRejectedValue(new Error("Firestore kaboom!"));

      const request = constructV2Request({id: testUserId});
      await expect(wrappedHasCompletedDailyChallenge(request)).rejects.toThrow(
        new HttpsError("internal", "An error occurred while checking daily challenge status."),
      );
      mockGetUser.mockRestore();
    });
  });
});
