import * as dotenv from "dotenv";
dotenv.config({path: ".env"}); // Load .env file from firebase-functions directory

// Import necessary testing libraries and modules
import {describe, it, beforeAll, afterAll, beforeEach} from "@jest/globals";
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https";

// Import the function to test
import {notifyRewardedAdCompleted} from "../adClientCallbacks";

// Import test utilities
import {createUser} from "./testUtils";

const FIREBASE_PROJECT_ID = "qwordly-6ba44";

// NOTE: To run these tests against the Firebase Emulator, set the FIRESTORE_EMULATOR_HOST
// environment variable before running the tests. For example:
// FIRESTORE_EMULATOR_HOST="localhost:8080" npm test

// Initialize firebase-functions-test. This DOES NOT initialize admin.initializeApp()
// when used with a live project. We must do that manually.
const testEnv = functionsTest();

// Initialize Firebase Admin manually for testing against live project
let options;
if (!admin.apps.length) {
  try {
    options = {
      projectId: FIREBASE_PROJECT_ID,
    };
    console.log("Connecting to live Firestore project.");
    admin.initializeApp(options);
  } catch (error) {
    console.error("🚨 Firebase Admin SDK initialization failed:", error);
    throw error;
  }
}

let firestore: admin.firestore.Firestore;

describe("Rewarded Ad Client Callbacks - Integration Tests", () => {
  const wrappedNotifyRewardedAdCompleted = testEnv.wrap(notifyRewardedAdCompleted);
  const testUserId = "testUserAdClientCallbacks";

  beforeAll(async () => {
    // Initialize Firestore instance after admin app is initialized.
    firestore = admin.firestore();
    // Optional: Verify GOOGLE_APPLICATION_CREDENTIALS_PATH is set for clarity during test runs
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_PATH) {
      console.warn(
        "\n⚠️ GOOGLE_APPLICATION_CREDENTIALS_PATH is not set in .env. Tests will likely fail to connect to live Firestore. ⚠️\n",
      );
    }
  });

  beforeEach(async () => {
    // Clear Firestore data for the test user before each test
    const userRef = firestore.collection("users").doc(testUserId);
    await userRef.delete().catch(() => {}); // Ignore error if document doesn't exist

    // Create a fresh test user with initial coins and proper stats structure
    await createUser(firestore, testUserId, {
      coins: 50,
      progress: {classicIndex: 0, dailyChallengeIndex: 0, tutorialIndex: 0},
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
    });
  }, 60000);

  afterAll(() => {
    testEnv.cleanup(); // Clean up firebase-functions-test
  });

  afterEach(async () => {
    // Clear Firestore data for the test user after each test
    const userRef = firestore.collection("users").doc(testUserId);
    await userRef.delete().catch(() => {}); // Ignore error if document doesn't exist
  }, 60000);

  // Helper to construct the request object for onCall v2 functions
  const constructOnCallRequest = (
    data: Record<string, unknown>,
    authContextArg?: {uid: string} | null,
  ): CallableRequest<Record<string, unknown>> => {
    const auth = authContextArg === undefined ? {uid: testUserId} : authContextArg;
    return {
      data: data,
      auth: auth,
      rawRequest: {headers: {}, body: {}},
    } as CallableRequest<Record<string, unknown>>;
  };

  it("should successfully notify rewarded ad completion for authenticated user", async () => {
    const adDetails = {
      placementId: "test_placement_id",
      creativeId: "test_creative_id",
      networkName: "AppLovin",
    };

    const request = constructOnCallRequest({
      adDetails: adDetails,
    });

    const result = await wrappedNotifyRewardedAdCompleted(request);

    // Expect a success response
    expect(result).toEqual({
      success: true,
      message: "Rewarded ad completion notification received.",
    });
  });

  it("should throw unauthenticated error if user is not authenticated", async () => {
    const adDetails = {
      placementId: "test_placement_id",
      creativeId: "test_creative_id",
      networkName: "AppLovin",
    };

    const request = constructOnCallRequest(
      {
        adDetails: adDetails,
      },
      null,
    ); // Explicitly unauthenticated

    await expect(wrappedNotifyRewardedAdCompleted(request)).rejects.toThrow(
      new HttpsError("unauthenticated", "The function must be called while authenticated."),
    );
  });

  it("should handle minimal ad details", async () => {
    const adDetails = {}; // Minimal ad details

    const request = constructOnCallRequest({
      adDetails: adDetails,
    });

    const result = await wrappedNotifyRewardedAdCompleted(request);

    expect(result).toEqual({
      success: true,
      message: "Rewarded ad completion notification received.",
    });
  });

  it("should handle missing adDetails field", async () => {
    const request = constructOnCallRequest({}); // Missing adDetails

    const result = await wrappedNotifyRewardedAdCompleted(request);

    expect(result).toEqual({
      success: true,
      message: "Rewarded ad completion notification received.",
    });
  });
});
