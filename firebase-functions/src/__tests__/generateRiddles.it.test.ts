/* eslint-disable */
// @ts-nocheck

// Mock services before any imports

// Define top-level mock constants for service functions
const mockGenerateUniqueRiddle = jest.fn();

jest.mock("../openaiService", () => ({
  generateUniqueRiddle: function () {
    // eslint-disable-next-line prefer-rest-params
    return mockGenerateUniqueRiddle.apply(this, arguments);
  },
}));

// Mock functions.config() BEFORE importing firebase-functions
const mockConfigData = {
  // Note: sheets config removed as part of migration to Firestore-only storage
  openai: {
    api_key: "test-openai-key",
  },
};

jest.mock("firebase-functions", () => {
  const actualFunctions = jest.requireActual("firebase-functions") as Record<string, any>;
  return {
    ...actualFunctions,
    config: () => mockConfigData,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
});

// Import necessary testing libraries and modules
import {describe, it, expect, jest, beforeEach, afterEach, afterAll} from "@jest/globals";
import * as dotenv from "dotenv";
dotenv.config({path: ".env"}); // Load .env file from firebase-functions directory

import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";

// Import the function to test AFTER mocks are set up
import {generateAndAppendRiddles} from "../generateRiddles";

// Get the mocked functions for use in tests

// const mockGenerateUniqueRiddle = jest.mocked(require("../openaiService").generateUniqueRiddle); // Removed

const FIREBASE_PROJECT_ID = "qwordly-6ba44";

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

describe("generateAndAppendRiddles - Firestore Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGenerateUniqueRiddle.mockReset();

    // Set up environment variables for tests
    process.env.OPENAI_API_KEY = "test-openai-key";
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  it("should generate and store riddles in Firestore successfully", async () => {
    const numberOfRiddles = 2;

    // Mock successful riddle generation
    mockGenerateUniqueRiddle
      .mockResolvedValueOnce(["What has keys but no locks?", "keyboard"])
      .mockResolvedValueOnce(["What runs but never walks?", "river"]);

    await generateAndAppendRiddles(numberOfRiddles);

    expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(numberOfRiddles);

    // Verify riddles were stored in Firestore by querying them
    const riddlesSnapshot = await admin.firestore().collection("riddles").get();
    const storedRiddles = riddlesSnapshot.docs.map((doc) => doc.data());

    // Check that we have at least the riddles we just generated
    expect(storedRiddles.length).toBeGreaterThanOrEqual(numberOfRiddles);

    // Check that our generated riddles are in the collection
    const keyboardRiddle = storedRiddles.find((riddle) => riddle.answer === "keyboard");
    const riverRiddle = storedRiddles.find((riddle) => riddle.answer === "river");

    expect(keyboardRiddle).toBeDefined();
    expect(keyboardRiddle.text).toBe("What has keys but no locks?");
    expect(keyboardRiddle.category).toBe("classic");
    expect(keyboardRiddle.classicIndex).toBeGreaterThanOrEqual(0);

    expect(riverRiddle).toBeDefined();
    expect(riverRiddle.text).toBe("What runs but never walks?");
    expect(riverRiddle.category).toBe("classic");
    expect(riverRiddle.classicIndex).toBeGreaterThanOrEqual(0);
  });

  it("should handle duplicate riddles and retry", async () => {
    const numberOfRiddles = 1;

    // First, add a riddle to Firestore to create a duplicate scenario
    const testRiddleRef = admin.firestore().collection("riddles").doc();
    await testRiddleRef.set({
      riddleId: testRiddleRef.id,
      text: "existing question",
      answer: "existing answer",
      classicIndex: 999,
      category: "classic",
    });

    // Mock riddle generation - first is duplicate, second is unique
    mockGenerateUniqueRiddle
      .mockResolvedValueOnce(["existing question", "existing answer"]) // Duplicate
      .mockResolvedValueOnce(["What has keys but no locks?", "keyboard"]); // Unique

    await generateAndAppendRiddles(numberOfRiddles);

    expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(2);

    // Verify the unique riddle was stored
    const riddlesSnapshot = await admin.firestore().collection("riddles").where("answer", "==", "keyboard").get();

    expect(riddlesSnapshot.size).toBe(1);

    // Clean up test data
    await testRiddleRef.delete();
    if (!riddlesSnapshot.empty) {
      await riddlesSnapshot.docs[0].ref.delete();
    }
  });

  it("should assign correct classic indices", async () => {
    const numberOfRiddles = 2;

    // Get current highest classic index
    const existingRiddlesSnapshot = await admin
      .firestore()
      .collection("riddles")
      .where("classicIndex", ">=", 0)
      .orderBy("classicIndex", "desc")
      .limit(1)
      .get();

    const expectedStartIndex = existingRiddlesSnapshot.empty
      ? 0
      : existingRiddlesSnapshot.docs[0].data().classicIndex + 1;

    // Mock riddle generation
    mockGenerateUniqueRiddle
      .mockResolvedValueOnce(["Test riddle 1", "answer1"])
      .mockResolvedValueOnce(["Test riddle 2", "answer2"]);

    await generateAndAppendRiddles(numberOfRiddles);

    // Verify the riddles have correct indices
    const newRiddlesSnapshot = await admin
      .firestore()
      .collection("riddles")
      .where("answer", "in", ["answer1", "answer2"])
      .get();

    expect(newRiddlesSnapshot.size).toBe(2);

    const riddles = newRiddlesSnapshot.docs.map((doc) => doc.data()).sort((a, b) => a.classicIndex - b.classicIndex);
    expect(riddles[0].classicIndex).toBe(expectedStartIndex);
    expect(riddles[1].classicIndex).toBe(expectedStartIndex + 1);

    // Clean up test data
    for (const doc of newRiddlesSnapshot.docs) {
      await doc.ref.delete();
    }
  });

  it("should throw error when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(generateAndAppendRiddles(1)).rejects.toThrow("Missing required environment variable: OPENAI_API_KEY");
  });
});
