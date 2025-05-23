// Import necessary testing libraries and modules
import {describe, it, expect, beforeAll, afterAll, beforeEach} from "@jest/globals";
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https";

// Import the functions to test
import {resetStats, updateAvatar} from "../profile.js";
import {PlayerSchema} from "../validation/firestoreSchemas.js";
import {createUser} from "./testUtils.js";

// Initialize firebase-functions-test
const testEnv = functionsTest();

// Ensure Firebase app is initialized before tests run
if (!admin.apps.length) {
  admin.initializeApp();
}

let firestore: admin.firestore.Firestore;

describe("Profile Functions - Integration Tests", () => {
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
    },
    avatarUrl: "initial_avatar.png",
  };

  beforeAll(async () => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      console.error("\n🔥🔥🔥 FIRESTORE_EMULATOR_HOST is not set. Integration tests will likely time out. 🔥🔥🔥\n");
    }
    firestore = admin.firestore();
  });

  beforeEach(async () => {
    // Clear and create fresh test user data
    const userRef = firestore.collection("users").doc(testUserId);
    await userRef.delete().catch(() => {}); // Ignore error if doc doesn't exist
    await createUser(firestore, testUserId, initialUserData);
  });

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
      const request = constructOnCallRequest({} as {avatarUrl: string}); // Cast to satisfy type, but data is missing
      await expect(wrappedUpdateAvatar(request)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid or missing avatar URL."),
      );
    });

    it("should throw invalid-argument for non-string avatarUrl", async () => {
      const request = constructOnCallRequest({avatarUrl: 123 as any}); // Invalid type
      await expect(wrappedUpdateAvatar(request)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid or missing avatar URL."),
      );
    });
  });
});
