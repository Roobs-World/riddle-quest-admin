// Import necessary testing libraries and modules
import {describe, it, beforeAll, afterAll, beforeEach} from "@jest/globals";
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https"; // Import HttpsError and CallableRequest

// Import the functions to test (these will interact with the emulator)
import {getHint, spendCoins, skipRiddle} from "../gameLogic";
import {createUser} from "./testUtils.js"; // Import createUser from testUtils with .js extension

// Initialize firebase-functions-test in offline mode
const testEnv = functionsTest();

// Ensure Firebase app is initialized before tests run
if (!admin.apps.length) {
  admin.initializeApp();
}

let firestore: admin.firestore.Firestore;

describe("Game Logic - Integration Tests", () => {
  // Wrap the callable functions for testing
  const wrappedGetHint = testEnv.wrap(getHint);
  const wrappedSpendCoins = testEnv.wrap(spendCoins);
  const wrappedSkipRiddle = testEnv.wrap(skipRiddle);

  const testUserId = "testUserGameLogic";

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
    // Clear Firestore data for the test user and riddles collection
    const userRef = firestore.collection("users").doc(testUserId);
    // Delete all documents in subcollections first
    const collections = await userRef.listCollections();
    for (const collection of collections) {
      const snapshot = await collection.get();
      const batch = firestore.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
    // Delete the user document
    await userRef.delete().catch(() => {}); // Ignore error if document doesn't exist

    // Clear the riddles collection
    const riddlesSnapshot = await firestore.collection("riddles").get();
    const riddlesBatch = firestore.batch();
    riddlesSnapshot.docs.forEach((doc) => {
      riddlesBatch.delete(doc.ref);
    });
    await riddlesBatch.commit();

    // Create a fresh test user
    await createUser(firestore, testUserId, {
      coins: 100,
      progress: {classicIndex: 0, dailyChallengeIndex: 0, tutorialIndex: 0},
      stats: {},
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
  });

  afterAll(() => {
    testEnv.cleanup(); // Clean up firebase-functions-test
  });

  // Helper to construct the request object for onCall v2 functions
  const constructOnCallRequest = (
    data: Record<string, unknown>,
    authContextArg?: {uid: string} | null,
  ): CallableRequest<any> => {
    // Default to an authenticated context if authContextArg is undefined
    const auth = authContextArg === undefined ? {uid: testUserId} : authContextArg;
    return {
      data: data,
      auth: auth,
      rawRequest: {headers: {}, body: {}},
    } as CallableRequest<any>;
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
      const auth = {uid: testUserId} as any;

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

      await expect(wrappedSpendCoins(request)).rejects.toThrow(
        new HttpsError("not-found", "Could not retrieve updated user data after spending coins."),
      );
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
      const initialCoins = 100;

      // Set user's classic progress to match the last riddle's index
      await firestore
        .collection("users")
        .doc(testUserId)
        .update({progress: {classicIndex: 2}});

      const request = constructOnCallRequest({gameMode: "Classic", riddleId: currentRiddleId});

      // Mock the functionCalls collection to check for the addition
      const mockFunctionCallsAdd = jest.fn();
      const originalCollection = firestore.collection;
      jest.spyOn(firestore, "collection").mockImplementation((path: string) => {
        if (path === "functionCalls") {
          return {add: mockFunctionCallsAdd} as any; // Mock the add method
        }
        return originalCollection.call(firestore, path);
      });

      const result = await wrappedSkipRiddle(request);

      expect(result).toBeNull(); // Should return null if generation is triggered
      expect(mockFunctionCallsAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "generateClassicRiddles",
          status: "requested",
        }),
      );

      // Restore original Firestore collection implementation
      (firestore.collection as jest.Mock).mockRestore();
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

    it("should not update user progress or deduct coins if no next riddle and generation is triggered", async () => {
      const currentRiddleId = "testRiddle3"; // Last riddle
      const initialCoins = 100;
      await firestore
        .collection("users")
        .doc(testUserId)
        .update({coins: initialCoins, progress: {classicIndex: 2}});

      const request = constructOnCallRequest({gameMode: "Classic", riddleId: currentRiddleId});

      // Mock functionCalls to prevent actual triggering and check it was called
      const mockFunctionCallsAdd = jest.fn().mockResolvedValue({});
      const originalCollection = firestore.collection;
      jest.spyOn(firestore, "collection").mockImplementation((path: string) => {
        if (path === "functionCalls") {
          return {add: mockFunctionCallsAdd} as any;
        }
        return originalCollection.call(firestore, path);
      });

      await wrappedSkipRiddle(request);

      // Verify coins were NOT deducted (should happen before the check for next riddle)
      // Re-fetch user to check state after the function call
      const userDocAfter = await firestore.collection("users").doc(testUserId).get();
      expect(userDocAfter.data()?.coins).toBe(initialCoins);
      expect(userDocAfter.data()?.progress?.classicIndex).toBe(2); // Should not increment
      expect(mockFunctionCallsAdd).toHaveBeenCalledTimes(1); // Generation should be triggered

      // Restore mock
      (firestore.collection as jest.Mock).mockRestore();
    });
  });
});
