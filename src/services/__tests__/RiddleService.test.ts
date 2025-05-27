import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
// Remove the direct import of 'functions' here if the mock is comprehensive
// import functions from "@react-native-firebase/functions";
import * as RiddleServiceModule from "../RiddleService"; // Import all exports from the module
const { RiddleService, delay } = RiddleServiceModule; // Destructure for use, delay is now the actual function
import {
  // GenerateClassicRiddlesOutputSchema, // Not used if mock is simpler
  SubmitGuessOutputSchema,
  GuessFeedbackSchema,
  SubmitGuessInputSchema,
} from "../../validation/cloudFunctionsSchemas";
import { z } from "zod";
import { act } from "react-test-renderer";

// File-scoped mocks for Firebase services
const mockGenerateClassicRiddlesCallable = jest.fn();
const mockSubmitGuessCallable = jest.fn();

jest.mock("@react-native-firebase/functions", () => {
  // This is the factory function that will be called when 'functions()' is invoked.
  return () => ({
    // httpsCallable is a method on the object returned by functions()
    httpsCallable: jest.fn((functionName: string) => {
      if (functionName === "generateClassicRiddles") {
        return mockGenerateClassicRiddlesCallable;
      }
      if (functionName === "submitGuess") {
        return mockSubmitGuessCallable;
      }
      // Fallback for any other function name if used by the SUT but not specifically mocked here
      console.warn(
        `RiddleService.test.ts: Firebase function mock for '${functionName}' not specifically defined, returning generic mock.`
      );
      return jest
        .fn()
        .mockResolvedValue({ data: { genericMockSuccess: true } });
    }),
    // If RiddleService uses other methods from the functions module, mock them here too.
    // e.g., useEmulator: jest.fn(),
  });
});

// Mocks for firestore are in jest.setup.js
// We will access the chained mock functions directly in tests.

describe("RiddleService", () => {
  const testUserId = "testUser123";
  const today = new Date().toISOString().slice(0, 10);
  const todayDocId = `${testUserId}_${today}`;

  beforeEach(() => {
    jest.clearAllMocks();
    const authSingleton = auth() as any; // Get the singleton mock
    authSingleton.__setMockUser({ uid: testUserId }); // Set the mock user
  });

  describe("fetchDailyRiddle", () => {
    it("should return null if no authenticated user", async () => {
      const authSingleton = auth() as any;
      authSingleton.__clearMockUser(); // Clear the mock user for this test
      const riddle = await RiddleService.fetchDailyRiddle();
      expect(riddle).toBeNull();
    });

    it("should return completedToday: true if user has already completed for the day", async () => {
      (
        firestore().collection("users").doc(testUserId).get as jest.Mock
      ).mockResolvedValueOnce({
        exists: true,
        data: () => ({
          lastCompletedDailyChallengeDate: new Date().toISOString(), // Completed today
        }),
      });
      const result = await RiddleService.fetchDailyRiddle();
      expect(result).toEqual({ completedToday: true });
    });

    it("should return null if no daily challenge doc for today", async () => {
      (
        firestore().collection("users").doc(testUserId).get as jest.Mock
      ).mockResolvedValueOnce({
        exists: true,
        data: () => ({}), // User doc (no completion info or old completion)
      });
      (
        firestore().collection("dailyChallenge").doc(today).get as jest.Mock
      ).mockResolvedValueOnce({
        exists: () => false, // No daily challenge doc - use function
      });
      const result = await RiddleService.fetchDailyRiddle();
      expect(result).toBeNull();
    });

    it("should fetch the next available daily riddle", async () => {
      const mockRiddleId = "dailyRiddle001";
      const mockRiddleData = { text: "Daily riddle text", answer: "ANSWER" };

      (
        firestore().collection("users").doc(testUserId).get as jest.Mock
      ).mockResolvedValueOnce({
        exists: true,
        data: () => ({}), // User hasn't completed today
      });
      (
        firestore().collection("dailyChallenge").doc(today).get as jest.Mock
      ).mockResolvedValueOnce({
        exists: () => true, // Use function
        data: () => ({ riddleIds: [mockRiddleId, "dailyRiddle002"] }),
      });
      (
        firestore().collection("userDailyChallengeAttempts").doc(todayDocId)
          .get as jest.Mock
      ).mockResolvedValueOnce({
        exists: true,
        data: () => ({ completedIndex: 0 }), // User has completed 0 riddles today
      });
      (
        firestore().collection("riddles").doc(mockRiddleId).get as jest.Mock
      ).mockResolvedValueOnce({
        exists: () => true, // Use function
        data: () => mockRiddleData,
        id: mockRiddleId,
      });

      const result = await RiddleService.fetchDailyRiddle();
      expect(result).toEqual({
        ...mockRiddleData,
        riddleId: mockRiddleId,
        completedToday: false,
        answerLength: mockRiddleData.answer.length,
      });
    });

    it("should return completedToday: true if all daily riddles are completed", async () => {
      const mockRiddleId = "dailyRiddle001";
      (
        firestore().collection("users").doc(testUserId).get as jest.Mock
      ).mockResolvedValueOnce({
        exists: true,
        data: () => ({}), // User hasn't completed today initially
      });
      (
        firestore().collection("dailyChallenge").doc(today).get as jest.Mock
      ).mockResolvedValueOnce({
        exists: () => true, // Use function
        data: () => ({ riddleIds: [mockRiddleId] }), // Only one riddle for the day
      });
      (
        firestore().collection("userDailyChallengeAttempts").doc(todayDocId)
          .get as jest.Mock
      ).mockResolvedValueOnce({
        exists: true,
        data: () => ({ completedIndex: 1 }), // User completed the only riddle
      });
      // Mock the update call
      (
        firestore().collection("users").doc(testUserId).update as jest.Mock
      ).mockResolvedValueOnce(undefined);

      const result = await RiddleService.fetchDailyRiddle();
      expect(result).toEqual({ completedToday: true });
      expect(
        firestore().collection("users").doc(testUserId).update
      ).toHaveBeenCalledWith({
        lastCompletedDailyChallengeDate: expect.any(String),
      });
    });
  });

  describe("fetchClassicRiddle", () => {
    const classicLevel = 1;
    const mockClassicRiddleId = "classic001";
    const mockClassicRiddleData = {
      text: "Classic riddle",
      answer: "CLASSIC",
      classicIndex: classicLevel,
    };

    // Use fake timers for this describe block
    beforeEach(() => {
      jest.useFakeTimers();
      // Clear the mock calls for generateClassicRiddlesCallable before each test
      mockGenerateClassicRiddlesCallable.mockClear();
      // Default behavior for generateClassicRiddles unless overridden
      mockGenerateClassicRiddlesCallable.mockResolvedValue({
        data: { success: true, newRiddlesAdded: 1 },
      });
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllTimers(); // Clear any pending timers
    });

    it("should fetch a classic riddle successfully on first try", async () => {
      const queryGetMock = firestore()
        .collection("riddles")
        .where("classicIndex", "==", classicLevel)
        .limit(1).get as jest.Mock;
      queryGetMock.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: mockClassicRiddleId, data: () => mockClassicRiddleData }],
      });

      const result = await RiddleService.fetchClassicRiddle(classicLevel);
      expect(result).toEqual({
        ...mockClassicRiddleData,
        riddleId: mockClassicRiddleId,
        answerLength: mockClassicRiddleData.answer.length,
      });
      expect(queryGetMock).toHaveBeenCalledTimes(1);
      expect(mockGenerateClassicRiddlesCallable).not.toHaveBeenCalled();
    });

    it("should call generateClassicRiddles and retry if riddle not found initially", async () => {
      const queryGetMock = firestore()
        .collection("riddles")
        .where("classicIndex", "==", classicLevel)
        .limit(1).get as jest.Mock;

      queryGetMock
        .mockResolvedValueOnce({ empty: true, docs: [] }) // First attempt: not found
        .mockResolvedValueOnce({
          // Second attempt (after retry): found
          empty: false,
          docs: [
            { id: mockClassicRiddleId, data: () => mockClassicRiddleData },
          ],
        });

      // mockGenerateClassicRiddlesCallable is set in beforeEach to add 1 riddle

      let resultPromise = RiddleService.fetchClassicRiddle(classicLevel);

      // Allow microtasks to run (e.g., the first firestore().get())
      await act(async () => {
        await Promise.resolve();
      });

      // Advance timer for the first delay after generation attempt
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      const result = await resultPromise; // Now await the result

      expect(mockGenerateClassicRiddlesCallable).toHaveBeenCalledTimes(1);
      expect(queryGetMock).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        ...mockClassicRiddleData,
        riddleId: mockClassicRiddleId,
        answerLength: mockClassicRiddleData.answer.length,
      });
    }, 10000); // Increased timeout slightly, though fake timers should make it fast

    it("should return null if riddle not found after all retries", async () => {
      const classicLevel = 1; // Local to test for clarity
      const queryGetMock = firestore()
        .collection("riddles")
        .where("classicIndex", "==", classicLevel)
        .limit(1).get as jest.Mock;

      // Ensure firestore().get() ALWAYS returns empty for this test
      queryGetMock.mockResolvedValue({ empty: true, docs: [] });

      // Ensure generateClassicRiddles ALWAYS indicates no new riddles were added
      mockGenerateClassicRiddlesCallable.mockResolvedValue({
        data: { success: true, newRiddlesAdded: 0 },
      });

      const resultPromise = RiddleService.fetchClassicRiddle(classicLevel);

      // Max retries is 3, so loop for retries 0, 1, 2 (3 generation attempts)
      // Each attempt involves a firestore get, then (if empty and retry < maxRetries) a function call and a delay.
      // The final attempt (retry = 3) involves a firestore get, then returns null if still empty.

      // Initial get + 3 retries that call generate + 1 final get
      // Delays happen after generation attempts for retry < maxRetries (i.e., retry 0, 1, 2)
      for (let i = 0; i < 3; i++) {
        // For retry = 0, 1, 2
        // Allow generateClassicRiddlesCallable and subsequent firestore.get() to resolve for the current attempt
        await act(async () => {
          await Promise.resolve();
        }); // Drain microtask queue for promises to settle
        act(() => {
          jest.advanceTimersByTime(5000);
        }); // Advance for the delay
      }
      // Allow the final firestore.get() (for retry=3) to resolve
      await act(async () => {
        await Promise.resolve();
      });

      const result = await resultPromise;

      expect(result).toBeNull();
      // generateClassicRiddles is called when retry < maxRetries (0, 1, 2)
      expect(mockGenerateClassicRiddlesCallable).toHaveBeenCalledTimes(3);
      // Firestore get is called for each attempt (0, 1, 2, 3)
      expect(queryGetMock).toHaveBeenCalledTimes(4);
    });
  });

  describe("fetchTutorialRiddle", () => {
    const tutorialLevel = 1;
    const mockTutorialRiddleId = "tutorial001";
    const mockTutorialRiddleData = {
      text: "Tutorial riddle",
      answer: "TUTOR",
      category: "tutorial",
      tutorialIndex: tutorialLevel,
    };

    it("should fetch a tutorial riddle successfully", async () => {
      const tutorialQueryGetMock = firestore()
        .collection("riddles")
        .where("category", "==", "tutorial")
        .where("tutorialIndex", "==", tutorialLevel)
        .limit(1).get as jest.Mock;

      tutorialQueryGetMock.mockResolvedValueOnce({
        empty: false,
        docs: [
          { id: mockTutorialRiddleId, data: () => mockTutorialRiddleData },
        ],
      });

      const result = await RiddleService.fetchTutorialRiddle(tutorialLevel);
      expect(result).toEqual({
        ...mockTutorialRiddleData,
        riddleId: mockTutorialRiddleId,
        answerLength: mockTutorialRiddleData.answer.length,
      });
      expect(tutorialQueryGetMock).toHaveBeenCalledTimes(1);
    });

    it("should return null if tutorial riddle not found", async () => {
      const tutorialQueryGetMock = firestore()
        .collection("riddles")
        .where("category", "==", "tutorial")
        .where("tutorialIndex", "==", tutorialLevel)
        .limit(1).get as jest.Mock;

      tutorialQueryGetMock.mockResolvedValueOnce({ empty: true, docs: [] });

      const result = await RiddleService.fetchTutorialRiddle(tutorialLevel);
      expect(result).toBeNull();
      expect(tutorialQueryGetMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("submitGuess", () => {
    const mockRiddleId = "riddle123";
    const mockGuess = "GUESS";
    const mockSubmitGuessDataClassic: z.infer<typeof SubmitGuessInputSchema> = {
      guess: mockGuess,
      riddleId: mockRiddleId,
      gameMode: "classic",
      attempts: 1,
    };

    const minimalValidSubmitGuessOutput = {
      feedback: [{ letter: "G", status: "green" as const }],
      isCorrect: true,
    };

    const fullSubmitGuessOutput = {
      feedback: [{ letter: "G", status: "green" as const }],
      isCorrect: true,
      coinsEarned: 10,
      correctAnswer: "ANSWER",
    };

    it("should call submitGuess callable and return validated data (minimal)", async () => {
      mockSubmitGuessCallable.mockResolvedValueOnce({
        data: minimalValidSubmitGuessOutput,
      });
      const result = await RiddleService.submitGuess(
        mockSubmitGuessDataClassic
      );
      expect(mockSubmitGuessCallable).toHaveBeenCalledWith(
        mockSubmitGuessDataClassic
      );
      expect(result).toEqual(minimalValidSubmitGuessOutput);
    });

    it("should call submitGuess callable and return validated data (with optionals)", async () => {
      mockSubmitGuessCallable.mockResolvedValueOnce({
        data: fullSubmitGuessOutput,
      });
      const result = await RiddleService.submitGuess(
        mockSubmitGuessDataClassic
      );
      expect(mockSubmitGuessCallable).toHaveBeenCalledWith(
        mockSubmitGuessDataClassic
      );
      expect(result).toEqual(fullSubmitGuessOutput);
    });

    it("should throw if submitGuess callable fails", async () => {
      mockSubmitGuessCallable.mockRejectedValueOnce(
        new Error("Callable failed")
      );
      await expect(
        RiddleService.submitGuess(mockSubmitGuessDataClassic)
      ).rejects.toThrow("Failed to submit guess.");
    });

    it("should throw if callable output is invalid (e.g. missing isCorrect)", async () => {
      const invalidOutputFromFunction = {
        data: { feedback: [{ letter: "G", status: "green" as const }] },
      };
      mockSubmitGuessCallable.mockResolvedValueOnce(invalidOutputFromFunction);
      await expect(
        RiddleService.submitGuess(mockSubmitGuessDataClassic)
      ).rejects.toThrow("Invalid guess data provided.");
    });
  });
});
