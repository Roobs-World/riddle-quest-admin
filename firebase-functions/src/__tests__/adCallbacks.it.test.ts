// Import necessary testing libraries and modules
import {describe, it, beforeAll, afterAll, beforeEach} from "@jest/globals";
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https";

// Import the function to test
import {awardedAdCallback} from "../adCallbacks";

// Import test utilities
import {createUser} from "./testUtils.js";

// Initialize firebase-functions-test in offline mode
const testEnv = functionsTest();

// Ensure Firebase app is initialized before tests run
if (!admin.apps.length) {
  admin.initializeApp();
}

let firestore: admin.firestore.Firestore;

describe("Rewarded Ad Callbacks - Integration Tests", () => {
  const wrappedRewardedAdCallback = testEnv.wrap(awardedAdCallback);
  const testUserId = "testUserAdCallbacks";

  beforeAll(async () => {
    // Check if Firestore emulator is configured
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      console.error(
        "\n🔥🔥🔥 FIRESTORE_EMULATOR_HOST is not set. Integration tests will likely time out or hit live Firestore. 🔥🔥🔥\n",
      );
      // Optionally, throw an error to halt tests if emulator is strictly required
      // throw new Error("FIRESTORE_EMULATOR_HOST not set. Ensure emulators are running and configured.");
    }
    // Initialize Firestore after testEnv is set up
    firestore = admin.firestore();
  });

  beforeEach(async () => {
    // Clear Firestore data for the test user before each test
    const userRef = firestore.collection("users").doc(testUserId);
    const collections = await userRef.listCollections();
    for (const collection of collections) {
      const snapshot = await collection.get();
      const batch = firestore.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
    await userRef.delete().catch(() => {}); // Ignore error if document doesn't exist

    // Create a fresh test user with initial coins
    await createUser(firestore, testUserId, {
      coins: 50,
      progress: {classicIndex: 0, dailyChallengeIndex: 0, tutorialIndex: 0},
      stats: {},
    });
  });

  afterAll(() => {
    testEnv.cleanup(); // Clean up firebase-functions-test
  });

  // Helper to construct the request object for onCall v2 functions
  const constructOnCallRequest = (
    data: Record<string, unknown>,
    authContextArg?: {uid: string} | null,
  ): CallableRequest<any> => {
    const auth = authContextArg === undefined ? {uid: testUserId} : authContextArg;
    return {
      data: data,
      auth: auth,
      rawRequest: {headers: {}, body: {}},
    } as CallableRequest<any>;
  };

  it("should grant coins for a valid rewarded ad callback", async () => {
    const initialCoins = 50;
    const coinsToAward = 25; // Assuming rewarded ads grant 25 coins

    const request = constructOnCallRequest({
      // Simulate data expected by rewardedAdCallback
      reward: {
        amount: coinsToAward,
        type: "coins", // Or whatever type is used in adCallbacks
      },
    });

    const result = await wrappedRewardedAdCallback(request);

    // Expect a success response (adjust based on actual function return type)
    expect(result).toEqual({success: true, newCoinBalance: initialCoins + coinsToAward});

    // Verify coins updated in Firestore
    const userDoc = await firestore.collection("users").doc(testUserId).get();
    expect(userDoc.data()?.coins).toBe(initialCoins + coinsToAward);
  });

  it("should throw unauthenticated error if user is not authenticated", async () => {
    const request = constructOnCallRequest(
      {
        reward: {amount: 25, type: "coins"},
      },
      null,
    ); // Explicitly unauthenticated

    await expect(wrappedRewardedAdCallback(request)).rejects.toThrow(
      new HttpsError("unauthenticated", "The function must be called while authenticated."),
    );
  });

  it("should throw invalid-argument error for missing reward data", async () => {
    const request = constructOnCallRequest({}); // Missing reward data

    await expect(wrappedRewardedAdCallback(request)).rejects.toThrow(
      new HttpsError("invalid-argument", "Invalid rewarded ad callback data."),
    );
  });

  it("should throw invalid-argument error for invalid reward structure", async () => {
    const request = constructOnCallRequest({
      reward: {amount: 25}, // Missing type
    });

    await expect(wrappedRewardedAdCallback(request)).rejects.toThrow(
      new HttpsError("invalid-argument", "Invalid rewarded ad callback data."),
    );

    const request2 = constructOnCallRequest({
      reward: {type: "coins"}, // Missing amount
    });

    await expect(wrappedRewardedAdCallback(request2)).rejects.toThrow(
      new HttpsError("invalid-argument", "Invalid rewarded ad callback data."),
    );

    const request3 = constructOnCallRequest({
      reward: {amount: 25, type: 123}, // Invalid type
    });

    await expect(wrappedRewardedAdCallback(request3)).rejects.toThrow(
      new HttpsError("invalid-argument", "Invalid rewarded ad callback data."),
    );
  });

  it("should throw not-found if user data not found", async () => {
    // Delete the test user to simulate user data not found
    await firestore.collection("users").doc(testUserId).delete();

    const request = constructOnCallRequest({
      reward: {amount: 25, type: "coins"},
    });

    await expect(wrappedRewardedAdCallback(request)).rejects.toThrow(
      new HttpsError("not-found", "User data not found."),
    );
  });

  // TODO: Add tests for duplicate callbacks if the implementation includes idempotency checks
});
