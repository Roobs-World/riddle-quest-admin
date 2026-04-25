import * as dotenv from "dotenv";
dotenv.config({path: ".env"}); // Load .env file from firebase-functions directory

// Import necessary testing libraries and modules
import {describe, it, beforeAll, afterAll, beforeEach} from "@jest/globals";

// Mock console methods to reduce noise during test runs
const originalConsoleTime = console.time;
const originalConsoleTimeEnd = console.timeEnd;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Suppress console timing and log output during tests
  console.time = jest.fn();
  console.timeEnd = jest.fn();
  console.log = jest.fn(); // Also suppress console.log to reduce noise
});

afterAll(() => {
  // Restore console methods after tests
  console.time = originalConsoleTime;
  console.timeEnd = originalConsoleTimeEnd;
  console.log = originalConsoleLog;
});

// 🚨 CRITICAL SAFETY CHECK - PREVENT PRODUCTION DATA DESTRUCTION 🚨
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;

// 🚨 ABSOLUTE SAFETY: This test MUST NEVER run against production
// This test deletes riddles with classicIndex 0, 1, 2 - destroying essential game data!
if (FIREBASE_PROJECT_ID === "Riddle Quest-6ba44" && !FIRESTORE_EMULATOR_HOST) {
  throw new Error(`
🚨🚨🚨 CRITICAL SAFETY VIOLATION 🚨🚨🚨

This test is ABSOLUTELY FORBIDDEN from running against production!

PROJECT ID: ${FIREBASE_PROJECT_ID} (PRODUCTION)
EMULATOR: ${FIRESTORE_EMULATOR_HOST || "NOT SET"}

This test DELETES essential riddles (classicIndex 0, 1, 2) that new users need to play!
Running this test against production DESTROYS USER DATA and breaks the game!

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

import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https"; // Import HttpsError and CallableRequest

// Import the functions to test (these will interact with the emulator)
import {spendCoins} from "../gameLogic";
import {createUser} from "./testUtils"; // Import createUser from testUtils

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
    throw error; // Re-throw the error to fail the test run if initialization fails
  }
}

let firestore: admin.firestore.Firestore;

describe("Game Logic - Integration Tests", () => {
  // Wrap the callable functions for testing
  const wrappedSpendCoins = testEnv.wrap(spendCoins);

  const testUserId = "testUserGameLogic";

  beforeAll(async () => {
    try {
      // Initialize Firestore instance after admin app is initialized.
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
          console.log("✅ Firebase connection successful for GameLogic integration tests");
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
      console.error("❌ Firebase connection failed for GameLogic integration tests:", error);
      throw error;
    }
  }, 60000);

  beforeEach(async () => {
    console.time("beforeEach_total");
    // Clear Firestore data for the test user and specific test riddles
    const userRef = firestore.collection("users").doc(testUserId);

    // Delete all documents in subcollections for the test user
    console.time("beforeEach_deleteSubcollections");
    const collections = await userRef.listCollections();
    const subcollectionDeletePromises = collections.map(async (collection) => {
      const snapshot = await collection.get();
      const batch = firestore.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    });
    await Promise.all([...subcollectionDeletePromises]);
    console.timeEnd("beforeEach_deleteSubcollections");

    // Execute subcollection deletions and user document deletion in parallel
    // The user document deletion is now separate for clearer timing
    console.time("beforeEach_deleteUserDoc");
    await userRef.delete().catch(() => {}); // Ignore error if document doesn't exist
    console.timeEnd("beforeEach_deleteUserDoc");

    // Clear all riddles with classicIndex 0, 1, 2 and specific test riddles to prevent interference
    console.time("beforeEach_deleteTestRiddles");
    const testClassicIndices = [0, 1, 2];
    const testRiddleIds = ["testRiddle1", "testRiddle2", "testRiddle3", "riddle-123"];

    // Multiple cleanup approaches to handle Firestore's eventual consistency
    // 1. Delete by classicIndex to remove any existing riddles that might interfere
    for (const classicIndex of testClassicIndices) {
      let hasMore = true;
      while (hasMore) {
        const riddlesQuery = await firestore
          .collection("riddles")
          .where("classicIndex", "==", classicIndex)
          .limit(500) // Process in batches
          .get();

        if (riddlesQuery.empty) {
          hasMore = false;
        } else {
          const riddlesBatch = firestore.batch();
          riddlesQuery.docs.forEach((doc) => {
            riddlesBatch.delete(doc.ref);
          });
          await riddlesBatch.commit();

          // If we got fewer than 500, we're done
          if (riddlesQuery.docs.length < 500) {
            hasMore = false;
          }
        }
      }
    }

    // 2. Also delete specific test riddle IDs
    const riddlesBatch = firestore.batch();
    testRiddleIds.forEach((riddleId) => {
      riddlesBatch.delete(firestore.collection("riddles").doc(riddleId));
    });
    await riddlesBatch.commit();

    // 3. Additional cleanup: delete any documents that start with "test" or contain auto-generated IDs
    const allRiddlesSnapshot = await firestore.collection("riddles").get();
    const finalCleanupBatch = firestore.batch();
    let needsFinalCleanup = false;

    allRiddlesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      // Delete any riddles with classicIndex 0, 1, or 2, or test-related IDs
      if (
        (data.classicIndex !== undefined && testClassicIndices.includes(data.classicIndex)) ||
        doc.id.startsWith("test") ||
        doc.id.length > 15 // Likely auto-generated ID
      ) {
        finalCleanupBatch.delete(doc.ref);
        needsFinalCleanup = true;
      }
    });

    if (needsFinalCleanup) {
      await finalCleanupBatch.commit();
    }

    console.timeEnd("beforeEach_deleteTestRiddles");

    // Create a fresh test user
    console.time("beforeEach_createUser");
    await createUser(firestore, testUserId, {
      coins: 100,
      progress: {classicIndex: 0, dailyChallengeIndex: 0},
      stats: {
        dailyPuzzlesCompleted: 0,
        bestStreak: 0,
        totalWordsGuessed: 0,
        winRate: 0,
        averageGuesses: 0,
        totalScore: 0,
        highestLevelClassic: 0,
        gamesPlayed: 0,
        totalGuessesInWins: 0,
        wins: 0,
        challengeWins: 0,
        winStreak: 0,
        totalWins: 0,
      },
    }); // Create user with initial coins and progress
    console.timeEnd("beforeEach_createUser");

    // Add dummy riddles for testing
    console.time("beforeEach_createRiddles");
    await firestore
      .collection("riddles")
      .doc("testRiddle1")
      .set({answer: "apple", text: "I have no voice, but I can tell you a story. What am I?", classicIndex: 0}); // Added classicIndex
    await firestore
      .collection("riddles")
      .doc("testRiddle2")
      .set({answer: "banana", text: "I am yellow and curved. What am I?", classicIndex: 1});
    await firestore
      .collection("riddles")
      .doc("testRiddle3")
      .set({answer: "cherry", text: "I am a small red fruit. What am I?", classicIndex: 2}); // Added another riddle
    // Add riddle-123 for specific test cases that might use it
    await firestore.collection("riddles").doc("riddle-123").set({
      answer: "keyboard",
      text: "I have keys but no lock, and space but no room. You can enter but can't go outside. What am I?",
    });
    console.timeEnd("beforeEach_createRiddles");
    console.timeEnd("beforeEach_total");
  }, 120000);

  afterAll(() => {
    testEnv.cleanup(); // Clean up firebase-functions-test
  });

  afterEach(async () => {
    console.time("afterEach_total");
    // Clear Firestore data for the test user and specific test riddles
    const userRef = firestore.collection("users").doc(testUserId);

    // Delete all documents in subcollections for the test user
    console.time("afterEach_deleteSubcollections");
    const collections = await userRef.listCollections();
    const subcollectionDeletePromises = collections.map(async (collection) => {
      const snapshot = await collection.get();
      const batch = firestore.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    });
    // Execute subcollection deletions and user document deletion in parallel
    // await Promise.all([
    //   ...subcollectionDeletePromises,
    //   userRef.delete().catch(() => {}), // Ignore error if document doesn't exist
    // ]);
    await Promise.all(subcollectionDeletePromises);
    console.timeEnd("afterEach_deleteSubcollections");

    console.time("afterEach_deleteUserDoc");
    await userRef.delete().catch(() => {}); // Ignore error if document doesn't exist
    console.timeEnd("afterEach_deleteUserDoc");

    // Clear all riddles with classicIndex 0, 1, 2 and specific test riddles to prevent interference
    console.time("afterEach_deleteTestRiddles");
    const testClassicIndices = [0, 1, 2];
    const testRiddleIds = ["testRiddle1", "testRiddle2", "testRiddle3", "riddle-123"];

    // Delete by classicIndex to remove any existing riddles that might interfere
    const riddlesBatch = firestore.batch();
    for (const classicIndex of testClassicIndices) {
      const riddlesQuery = await firestore.collection("riddles").where("classicIndex", "==", classicIndex).get();
      riddlesQuery.docs.forEach((doc) => {
        riddlesBatch.delete(doc.ref);
      });
    }

    // Also delete specific test riddle IDs
    testRiddleIds.forEach((riddleId) => {
      riddlesBatch.delete(firestore.collection("riddles").doc(riddleId));
    });

    await riddlesBatch.commit();
    console.timeEnd("afterEach_deleteTestRiddles");
    console.timeEnd("afterEach_total");
  }, 120000);

  // Helper to construct the request object for onCall v2 functions
  const constructOnCallRequest = (
    data: Record<string, unknown>,
    authContextArg?: {uid: string} | null,
  ): CallableRequest<Record<string, unknown>> => {
    // Default to an authenticated context if authContextArg is undefined
    const auth = authContextArg === undefined ? {uid: testUserId} : authContextArg;
    return {
      data: data,
      auth: auth,
      rawRequest: {headers: {}, body: {}},
    } as CallableRequest<Record<string, unknown>>;
  };

  // --- spendCoins Integration Tests ---
  describe("spendCoins", () => {
    it("should deduct specified amount of coins", async () => {
      const initialCoins = 100;
      const amountToSpend = 50;
      const reason = "hint";

      // Ensure test user exists before making the request
      const userDoc = await firestore.collection("users").doc(testUserId).get();
      expect(userDoc.exists).toBe(true);
      expect(userDoc.data()?.coins).toBe(initialCoins);

      const request = constructOnCallRequest({amount: amountToSpend, reason});

      const result = await wrappedSpendCoins(request);

      expect(result).toEqual({newCoins: initialCoins - amountToSpend});

      // Verify coins deducted in Firestore
      const updatedUserDoc = await firestore.collection("users").doc(testUserId).get();
      expect(updatedUserDoc.data()?.coins).toBe(initialCoins - amountToSpend);
    });

    it("should throw failed-precondition if insufficient coins", async () => {
      // Ensure user exists before updating
      const userDocBefore = await firestore.collection("users").doc(testUserId).get();
      expect(userDocBefore.exists).toBe(true);

      await firestore.collection("users").doc(testUserId).update({coins: 10}); // Insufficient coins

      // Verify update worked
      const userDocAfter = await firestore.collection("users").doc(testUserId).get();
      expect(userDocAfter.data()?.coins).toBe(10);

      const amountToSpend = 50;
      const reason = "hint";
      const request = constructOnCallRequest({amount: amountToSpend, reason});

      await expect(wrappedSpendCoins(request)).rejects.toThrow(
        new HttpsError("failed-precondition", "Insufficient coins to spend."),
      );
    });

    it("should throw unauthenticated if user is not authenticated", async () => {
      const amountToSpend = 50;
      const reason = "hint";
      const request = constructOnCallRequest({amount: amountToSpend, reason}, null);

      await expect(wrappedSpendCoins(request)).rejects.toThrow(
        new HttpsError("unauthenticated", "The function must be called while authenticated."),
      );
    });

    it("should throw invalid-argument for invalid amount", async () => {
      let request = constructOnCallRequest({amount: 0, reason: "hint"});
      await expect(wrappedSpendCoins(request)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid amount specified."),
      );

      request = constructOnCallRequest({amount: -10, reason: "hint"});
      await expect(wrappedSpendCoins(request)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid amount specified."),
      );
    });

    it("should throw invalid-argument for invalid reason", async () => {
      const request = constructOnCallRequest({amount: 50, reason: "buy_powerup"});
      await expect(wrappedSpendCoins(request)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid reason specified."),
      );
    });

    it("should throw not-found if user data not found", async () => {
      // Store current user data
      const userDocSnap = await firestore.collection("users").doc(testUserId).get();
      const userData = userDocSnap.data();

      // Delete the test user to simulate user data not found
      await firestore.collection("users").doc(testUserId).delete();

      const amountToSpend = 50;
      const reason = "hint";
      const request = constructOnCallRequest({amount: amountToSpend, reason});

      await expect(wrappedSpendCoins(request)).rejects.toThrow(new HttpsError("not-found", "User data not found."));

      // Restore user data for next test
      if (userData) {
        await firestore.collection("users").doc(testUserId).set(userData);
      }
    });
  });
});
