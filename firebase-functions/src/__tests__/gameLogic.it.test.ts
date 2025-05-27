import * as dotenv from "dotenv";
dotenv.config({path: ".env"}); // Load .env file from firebase-functions directory

// Import necessary testing libraries and modules
import {describe, it, beforeAll, afterAll, beforeEach} from "@jest/globals";

import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https"; // Import HttpsError and CallableRequest

// Import the functions to test (these will interact with the emulator)
import {getHint, spendCoins, skipRiddle} from "../gameLogic";
import {createUser} from "./testUtils"; // Import createUser from testUtils

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
    throw error; // Re-throw the error to fail the test run if initialization fails
  }
}

let firestore: admin.firestore.Firestore;

describe("Game Logic - Integration Tests", () => {
  // Wrap the callable functions for testing
  const wrappedGetHint = testEnv.wrap(getHint);
  const wrappedSpendCoins = testEnv.wrap(spendCoins);
  const wrappedSkipRiddle = testEnv.wrap(skipRiddle);

  const testUserId = "testUserGameLogic";

  beforeAll(async () => {
    // Initialize Firestore instance after admin app is initialized.
    firestore = admin.firestore();
  });

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

    // Clear only the specific test riddles created in this suite
    console.time("beforeEach_deleteTestRiddles");
    const testRiddleIds = ["testRiddle1", "testRiddle2", "testRiddle3", "riddle-123"];
    const riddlesBatch = firestore.batch();
    testRiddleIds.forEach((riddleId) => {
      riddlesBatch.delete(firestore.collection("riddles").doc(riddleId));
    });
    await riddlesBatch.commit();
    console.timeEnd("beforeEach_deleteTestRiddles");

    // Create a fresh test user
    console.time("beforeEach_createUser");
    await createUser(firestore, testUserId, {
      coins: 100,
      progress: {classicIndex: 0, dailyChallengeIndex: 0, tutorialIndex: 0},
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
    // Add dummy riddles for testing
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

    // Clear only the specific test riddles created in this suite
    console.time("afterEach_deleteTestRiddles");
    const testRiddleIds = ["testRiddle1", "testRiddle2", "testRiddle3", "riddle-123"];
    const riddlesBatch = firestore.batch();
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

  // --- getHint Integration Tests ---
  describe("getHint", () => {
    it("should reveal a hint and deduct coins", async () => {
      const riddleId = "testRiddle1";
      const initialCoins = 100;
      const hintCost = 50;
      const currentAttempt = ["a", "", "", "", ""]; // 'a' _ _ _ _ for 'apple'

      const request = constructOnCallRequest({currentAttempt, riddleId});

      const result = await wrappedGetHint(request);

      expect(result).toEqual({
        revealedLetter: "P",
        index: 1,
        coinsCost: hintCost,
      });

      // Verify coins deducted in Firestore
      const userDoc = await firestore.collection("users").doc(testUserId).get();
      expect(userDoc.data()?.coins).toBe(initialCoins - hintCost);

      // Verify hint index stored in gameState
      const gameStateDoc = await firestore
        .collection("users")
        .doc(testUserId)
        .collection("riddleStates")
        .doc(riddleId)
        .get();
      expect(gameStateDoc.data()?.hintRevealedIndices).toEqual([1]);
    });

    it("should throw failed-precondition if insufficient coins", async () => {
      await firestore.collection("users").doc(testUserId).update({coins: 10}); // Insufficient coins
      const riddleId = "testRiddle1";
      const currentAttempt = ["a", "", "", "", ""];
      const request = constructOnCallRequest({currentAttempt, riddleId});

      await expect(wrappedGetHint(request)).rejects.toThrow(
        new HttpsError("failed-precondition", "Insufficient coins to get a hint."),
      );
    });

    it("should return null if no hint is available", async () => {
      const riddleId = "testRiddle1";
      // Simulate all letters guessed or revealed
      const currentAttempt = ["a", "p", "p", "l", "e"]; // Correct guess
      // Pre-set game state to indicate some hints revealed (if applicable, though not strictly needed for a fully correct guess)
      await firestore
        .collection("users")
        .doc(testUserId)
        .collection("riddleStates")
        .doc(riddleId)
        .set({hintRevealedIndices: [1, 3], isCompleted: false}, {merge: true});

      const request = constructOnCallRequest({currentAttempt, riddleId});

      const result = await wrappedGetHint(request);
      expect(result).toBeNull();
    });

    it("should throw unauthenticated if user is not authenticated", async () => {
      const riddleId = "testRiddle1";
      const currentAttempt = ["a", "", "", "", ""];
      const request = constructOnCallRequest({currentAttempt, riddleId}, null);

      await expect(wrappedGetHint(request)).rejects.toThrow(
        new HttpsError("unauthenticated", "The user must be authenticated to get a hint."),
      );
    });

    it("should throw not-found if riddle does not exist", async () => {
      const riddleId = "nonexistentRiddle";
      const currentAttempt = ["a", "", "", "", ""];
      const request = constructOnCallRequest({currentAttempt, riddleId});

      await expect(wrappedGetHint(request)).rejects.toThrow(
        new HttpsError("not-found", `Riddle with ID ${riddleId} not found.`),
      );
    });

    it("should throw internal if riddle has no answer field", async () => {
      const riddleId = "testRiddleWithoutAnswer";
      await firestore.collection("riddles").doc(riddleId).set({text: "A riddle without an answer"});
      const currentAttempt = ["a", "", "", "", ""];
      const request = constructOnCallRequest({currentAttempt, riddleId});

      await expect(wrappedGetHint(request)).rejects.toThrow(
        new HttpsError("internal", `Answer not found for riddle ID ${riddleId}.`),
      );
    });

    it("should throw not-found if user data not found", async () => {
      // Delete the test user to simulate user data not found
      await firestore.collection("users").doc(testUserId).delete();

      const riddleId = "testRiddle1";
      const currentAttempt = ["a", "", "", "", ""];
      const request = constructOnCallRequest({currentAttempt, riddleId});

      await expect(wrappedGetHint(request)).rejects.toThrow(new HttpsError("not-found", "User data not found."));
    });
  });

  // --- spendCoins Integration Tests ---
  describe("spendCoins", () => {
    it("should deduct specified amount of coins", async () => {
      const initialCoins = 100;
      const amountToSpend = 50;
      const reason = "skip";

      const request = constructOnCallRequest({amount: amountToSpend, reason});

      const result = await wrappedSpendCoins(request);

      expect(result).toEqual({newCoins: initialCoins - amountToSpend});

      // Verify coins deducted in Firestore
      const userDoc = await firestore.collection("users").doc(testUserId).get();
      expect(userDoc.data()?.coins).toBe(initialCoins - amountToSpend);
    });

    it("should throw failed-precondition if insufficient coins", async () => {
      await firestore.collection("users").doc(testUserId).update({coins: 10}); // Insufficient coins
      const amountToSpend = 50;
      const reason = "skip";
      const request = constructOnCallRequest({amount: amountToSpend, reason});

      await expect(wrappedSpendCoins(request)).rejects.toThrow(
        new HttpsError("failed-precondition", "Insufficient coins to spend."),
      );
    });

    it("should throw unauthenticated if user is not authenticated", async () => {
      const amountToSpend = 50;
      const reason = "skip";
      const request = constructOnCallRequest({amount: amountToSpend, reason}, null);

      await expect(wrappedSpendCoins(request)).rejects.toThrow(
        new HttpsError("unauthenticated", "The function must be called while authenticated."),
      );
    });

    it("should throw invalid-argument for invalid amount", async () => {
      let request = constructOnCallRequest({amount: 0, reason: "skip"});
      await expect(wrappedSpendCoins(request)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid amount specified."),
      );

      request = constructOnCallRequest({amount: -10, reason: "skip"});
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
      // Delete the test user to simulate user data not found
      await firestore.collection("users").doc(testUserId).delete();

      const amountToSpend = 50;
      const reason = "skip";
      const request = constructOnCallRequest({amount: amountToSpend, reason});

      await expect(wrappedSpendCoins(request)).rejects.toThrow(new HttpsError("not-found", "User data not found."));
    });
  });

  // --- skipRiddle Integration Tests ---
  describe("skipRiddle", () => {
    it("should skip current riddle, deduct coins, and provide next riddle", async () => {
      const currentRiddleId = "testRiddle1"; // classicIndex 0
      const nextRiddleId = "testRiddle2"; // classicIndex 1
      const initialCoins = 100;
      const skipCost = 50;

      // Set user's classic progress to match the current riddle's index
      await firestore
        .collection("users")
        .doc(testUserId)
        .update({progress: {classicIndex: 0}});

      const request = constructOnCallRequest({gameMode: "Classic", riddleId: currentRiddleId});

      const result = await wrappedSkipRiddle(request);

      expect(result).toEqual({
        newRiddleIndex: 1, // classicIndex of testRiddle2
        newQuestion: "I am yellow and curved. What am I?",
        newAnswerLength: 6, // "banana".length
        coinsCost: skipCost,
        newRiddleId: nextRiddleId,
      });

      // Verify coins deducted in Firestore
      const userDoc = await firestore.collection("users").doc(testUserId).get();
      expect(userDoc.data()?.coins).toBe(initialCoins - skipCost);

      // Verify user's classicIndex is updated
      expect(userDoc.data()?.progress?.classicIndex).toBe(1);
    });

    it("should log trigger for riddle generation if no next riddle exists in Classic mode", async () => {
      const currentRiddleId = "testRiddle3"; // This is the last riddle in our setup with classicIndex 2

      // Set user's classic progress to match the last riddle's index
      await firestore
        .collection("users")
        .doc(testUserId)
        .update({progress: {classicIndex: 2}});

      const request = constructOnCallRequest({gameMode: "Classic", riddleId: currentRiddleId});

      const mockFunctionCallsAdd = jest.fn();
      // Create a mock collection that only affects the "functionCalls" path
      const originalCollection = firestore.collection.bind(firestore);
      const collectionSpy = jest.spyOn(firestore, "collection").mockImplementation((path: string) => {
        if (path === "functionCalls") {
          return {add: mockFunctionCallsAdd} as {add: jest.Mock};
        }
        return originalCollection(path);
      });

      // Expect the function to throw an error when no next riddle exists
      await expect(wrappedSkipRiddle(request)).rejects.toThrow(
        new HttpsError(
          "not-found",
          "No more classic riddles available. More are being generated. Please try again soon.",
        ),
      );

      expect(mockFunctionCallsAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "generateClassicRiddles",
          status: "requested",
        }),
      );
      collectionSpy.mockRestore(); // Restore the spy
    });

    it("should throw failed-precondition if insufficient coins", async () => {
      await firestore.collection("users").doc(testUserId).update({coins: 10}); // Insufficient coins
      const currentRiddleId = "testRiddle1";
      const request = constructOnCallRequest({gameMode: "Classic", riddleId: currentRiddleId});

      await expect(wrappedSkipRiddle(request)).rejects.toThrow(
        new HttpsError("failed-precondition", "Insufficient coins to skip the riddle."),
      );
    });

    it("should throw unauthenticated if user is not authenticated", async () => {
      const currentRiddleId = "testRiddle1";
      const request = constructOnCallRequest({gameMode: "Classic", riddleId: currentRiddleId}, null);

      await expect(wrappedSkipRiddle(request)).rejects.toThrow(
        new HttpsError("unauthenticated", "The user must be authenticated to skip a riddle."),
      );
    });

    it("should throw not-found if user data not found", async () => {
      // Delete the test user to simulate user data not found
      await firestore.collection("users").doc(testUserId).delete();

      const currentRiddleId = "testRiddle1";
      const request = constructOnCallRequest({gameMode: "Classic", riddleId: currentRiddleId});

      await expect(wrappedSkipRiddle(request)).rejects.toThrow(new HttpsError("not-found", "User data not found."));
    });

    it("should throw not-found if current riddle does not exist", async () => {
      const currentRiddleId = "nonexistentRiddle";
      const request = constructOnCallRequest({gameMode: "Classic", riddleId: currentRiddleId});

      await expect(wrappedSkipRiddle(request)).rejects.toThrow(
        new HttpsError("not-found", "Current riddle not found."),
      );
    });

    it("should throw error when no next riddle exists and generation is triggered", async () => {
      const currentRiddleId = "testRiddle3"; // Last riddle
      const initialCoins = 100;
      await firestore
        .collection("users")
        .doc(testUserId)
        .update({coins: initialCoins, progress: {classicIndex: 2}});

      const request = constructOnCallRequest({gameMode: "Classic", riddleId: currentRiddleId});

      const mockFunctionCallsAdd = jest.fn().mockResolvedValue({});
      // Create a mock collection that only affects the "functionCalls" path
      const originalCollection = firestore.collection.bind(firestore);
      const collectionSpy = jest.spyOn(firestore, "collection").mockImplementation((path: string) => {
        if (path === "functionCalls") {
          return {add: mockFunctionCallsAdd} as {add: jest.Mock};
        }
        return originalCollection(path);
      });

      // Expect the function to throw an error when no next riddle exists
      await expect(wrappedSkipRiddle(request)).rejects.toThrow(
        new HttpsError(
          "not-found",
          "No more classic riddles available. More are being generated. Please try again soon.",
        ),
      );

      // Verify coins were deducted before the check for next riddle
      const userDocAfter = await firestore.collection("users").doc(testUserId).get();
      expect(userDocAfter.data()?.coins).toBe(initialCoins - 50); // Coins should be deducted
      expect(mockFunctionCallsAdd).toHaveBeenCalledTimes(1); // Generation should be triggered

      collectionSpy.mockRestore(); // Restore the spy
    });
  });
});
