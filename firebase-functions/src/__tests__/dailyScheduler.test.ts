import {ScheduledEvent} from "firebase-functions/v2/scheduler";
// Import the function to test directly
import {scheduledTaskHandler} from "../dailyScheduler";
// Mock dependencies

// Define a simple mock interface for a Firestore DocumentSnapshot
interface MockFirestoreDocumentSnapshot<T> {
  exists: boolean;
  data(): T | undefined;
  // Add other DocumentSnapshot properties/methods if needed by tests
}

interface MockFirestoreQuerySnapshot<T> {
  empty: boolean;
  size: number;
  docs: MockFirestoreDocumentSnapshot<T>[];
  // Add other QuerySnapshot properties/methods if needed by tests
}

// Declare and initialize mock functions for firebase-admin
// Correctly type the mocks to accept the expected resolved/rejected values
const mockFirestoreSet: jest.Mock<Promise<void>, any[]> = jest.fn();
const mockFirestoreGet: jest.Mock<Promise<MockFirestoreDocumentSnapshot<any>>, any[]> = jest.fn();

// Mock firebase-admin with a simplified structure
jest.mock("firebase-admin", () => {
  const mockFirestore = jest.fn(() => ({
    collection: jest.fn((collectionPath: string) => {
      if (collectionPath === "dailyChallenge") {
        return {
          doc: jest.fn((docPath: string) => {
            if (docPath === "current") {
              return {
                get: mockFirestoreGet,
                set: mockFirestoreSet,
              };
            }
            return {get: jest.fn(), set: jest.fn()};
          }),
          where: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({docs: [], empty: true, size: 0} as MockFirestoreQuerySnapshot<any>),
          })),
        };
      }
      return {doc: jest.fn()};
    }),
  })) as jest.Mock & {
    FieldValue: {
      serverTimestamp: jest.Mock;
    };
  };

  // Add FieldValue as a static property on the firestore function
  (mockFirestore as any).FieldValue = {
    serverTimestamp: jest.fn(() => new Date()),
  };

  return {
    initializeApp: jest.fn(),
    firestore: mockFirestore,
  };
});

// Mock openaiService - use jest.fn() directly in the factory to avoid hoisting issues
jest.mock("../openaiService", () => ({
  generateUniqueRiddle: jest.fn(),
}));

// Get reference to the mocked function after the mock is set up
const mockGenerateUniqueRiddle = jest.mocked(require("../openaiService").generateUniqueRiddle);

// Mock firebase-functions/v2/scheduler (partially, we are testing the handler function directly)
// The main utility of onSchedule is to wrap the function and define schedule/retry config.
// For unit testing the logic *inside* the scheduled function, we call it directly.

// Mock firebase-functions logger
jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Get reference to the mocked logger functions after the mock is set up
const mockLogger = jest.mocked(require("firebase-functions").logger);

// Helper to create a mock ScheduledEvent context
const mockScheduledEvent = (data?: unknown): ScheduledEvent => {
  return {
    id: "test-event-id",
    data: data || {},
    source: "//firebase.googleapis.com/projects/test-project/triggers/test-trigger",
    specversion: "1.0",
    type: "google.cloud.scheduler.job.v1.executed",
    time: new Date().toISOString(),
    // Add other properties as required by ScheduledEvent type or your function's usage
    scheduleTime: new Date().toISOString(),
    timeZone: "UTC",
    retryCount: 0,
    // Cast to satisfy the type, ensure all used fields are present
  } as ScheduledEvent;
};

describe("dailyChallengeScheduler", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Backup original process.env and then clear for controlled testing
    originalEnv = {...process.env};
    jest.resetModules(); // Clears module cache, helpful for env variables and mocks
    // We need to be careful with resetModules if mocks are defined in the same file and are not re-established.
    // For now, relying on mock function resets (mockReset, mockClear).

    // Reset mocks before each test
    mockFirestoreSet.mockReset();
    mockFirestoreGet.mockReset();
    mockGenerateUniqueRiddle.mockReset();
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
    mockLogger.debug.mockReset();

    // Mock console
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Set default mock behavior (can be overridden in individual tests)
    // Ensure the resolved value matches the expected return type of the mocked method
    mockFirestoreGet.mockResolvedValue({exists: false, data: () => undefined} as MockFirestoreDocumentSnapshot<any>); // Default: No existing challenge document
    // For Promise<void>, resolving with undefined or no value is correct
    mockFirestoreSet.mockResolvedValue(undefined); // Default: Successful set
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
    // Restore console
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // Initial test to ensure handler can be called
  test("handler function can be invoked", async () => {
    process.env.OPENAI_API_KEY = "test-key"; // Ensure API key is set for a basic run
    // Call the handler directly with a mock context
    await scheduledTaskHandler(mockScheduledEvent());
    // Basic assertion: check that it didn't throw an unhandled error implicitly by resolving
    // More specific assertions will be in dedicated tests.
    expect(consoleLogSpy).toHaveBeenCalledWith("Daily challenge scheduler started.");
  });

  describe("Successful execution", () => {
    beforeEach(() => {
      // Ensure API key is set for these successful execution tests
      process.env.OPENAI_API_KEY = "a-valid-key";
    });

    test("should generate and set a new daily challenge if none exists for the current date", async () => {
      const mockRiddle = "A test riddle?";
      const mockAnswer = "TESTANS";
      mockGenerateUniqueRiddle.mockResolvedValue([mockRiddle, mockAnswer]);

      // Explicitly set Firestore mock behavior for this test
      // Ensure the resolved value matches the expected return type of the mocked method
      mockFirestoreGet.mockResolvedValue({exists: false, data: () => undefined} as MockFirestoreDocumentSnapshot<any>); // Simulate no existing challenge document

      const currentDate = new Date();
      const expectedDateString = currentDate.toISOString().split("T")[0];

      await scheduledTaskHandler(mockScheduledEvent());

      expect(consoleLogSpy).toHaveBeenCalledWith("Daily challenge scheduler started.");
      expect(consoleLogSpy).toHaveBeenCalledWith("dailyChallengeRef created.");
      expect(consoleLogSpy).toHaveBeenCalledWith("dailyChallengeDoc fetched.", false);
      expect(mockFirestoreGet).toHaveBeenCalledTimes(1);
      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(`Generating fresh riddle using OpenAI for ${expectedDateString}...`);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `Successfully generated daily riddle: "${mockRiddle}" → "${mockAnswer}"`,
      );

      expect(mockFirestoreSet).toHaveBeenCalledTimes(1);
      const expectedChallengeData = {
        riddleId: `daily_${expectedDateString}`,
        text: mockRiddle,
        answer: mockAnswer,
        date: expectedDateString,
        createdAt: expect.any(Date), // FieldValue.serverTimestamp() is mocked to return new Date()
        generatedBy: "openai",
      };
      expect(mockFirestoreSet).toHaveBeenCalledWith(expect.objectContaining(expectedChallengeData));
      expect(consoleLogSpy).toHaveBeenCalledWith(`Daily challenge set for ${expectedDateString}: "${mockRiddle}"`);
      expect(consoleLogSpy).toHaveBeenCalledWith("Daily challenge scheduler finished.");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test("should skip generation if a challenge for the current date already exists", async () => {
      const currentDate = new Date();
      const expectedDateString = currentDate.toISOString().split("T")[0];

      // Explicitly set Firestore mock behavior for this test
      // Ensure the resolved value matches the expected return type of the mocked method
      mockFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => ({date: expectedDateString, riddleId: "daily_old", text: "Old riddle"}),
      } as MockFirestoreDocumentSnapshot<any>);

      await scheduledTaskHandler(mockScheduledEvent());

      expect(consoleLogSpy).toHaveBeenCalledWith("Daily challenge scheduler started.");
      expect(consoleLogSpy).toHaveBeenCalledWith("dailyChallengeRef created.");
      expect(consoleLogSpy).toHaveBeenCalledWith("dailyChallengeDoc fetched.", true);
      expect(mockFirestoreGet).toHaveBeenCalledTimes(1);

      // Verify both the functions.logger.info and console.log calls for lines 30-34
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Daily challenge already exists for ${expectedDateString}. Skipping generation.`,
      );
      expect(consoleLogSpy).toHaveBeenCalledWith("Existing challenge is for today, skipping generation.");

      // Ensure no new riddle generation or Firestore set occurred
      expect(mockGenerateUniqueRiddle).not.toHaveBeenCalled();
      expect(mockFirestoreSet).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      // Ensure it logs successful completion since no error occurred
      expect(consoleLogSpy).toHaveBeenCalledWith("Daily challenge scheduler finished.");
    });
  });

  describe("Input and Configuration Issues", () => {
    test("should handle missing OPENAI_API_KEY gracefully", async () => {
      delete process.env.OPENAI_API_KEY; // Ensure key is not set

      // Set up mock for generation to fail (which it should when no API key)
      mockGenerateUniqueRiddle.mockRejectedValue(new Error("OPENAI_API_KEY environment variable is required"));

      await scheduledTaskHandler(mockScheduledEvent());

      expect(mockFirestoreGet).toHaveBeenCalledTimes(1);
      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(1);
      expect(mockFirestoreSet).not.toHaveBeenCalled();
      // The function should log the error but NOT finish normally since it returns early on OpenAI error
      expect(consoleLogSpy).toHaveBeenCalledWith("Daily challenge scheduler started.");
      expect(consoleLogSpy).not.toHaveBeenCalledWith("Daily challenge scheduler finished.");
    });

    test("should log an error and return if riddle generation fails", async () => {
      process.env.OPENAI_API_KEY = "a-valid-key";
      // Set Firestore mock behavior
      // Ensure the resolved value matches the expected return type of the mocked method
      mockFirestoreGet.mockResolvedValue({exists: false, data: () => undefined} as MockFirestoreDocumentSnapshot<any>); // Simulate no existing challenge document
      // Explicitly set riddle generation mock behavior
      mockGenerateUniqueRiddle.mockResolvedValue(null); // Simulate OpenAI failure

      await scheduledTaskHandler(mockScheduledEvent());

      // The implementation logs "generateUniqueRiddle returned null." when null is returned
      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(1);
      // Ensure it doesn't proceed to set a challenge
      expect(mockFirestoreSet).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalledWith("Daily challenge scheduler finished.");
    });
  });

  describe("Firestore Operation Failures", () => {
    beforeEach(() => {
      // Ensure API key is set for these Firestore failure tests
      process.env.OPENAI_API_KEY = "a-valid-key";
    });

    test("should log an error if Firestore 'get' operation fails", async () => {
      const firestoreGetError = new Error("Firestore get failed!");
      // Explicitly set Firestore mock behavior for this test
      mockFirestoreGet.mockRejectedValue(firestoreGetError);

      await scheduledTaskHandler(mockScheduledEvent());

      // The catch block in dailyScheduler.ts should be called with the error
      expect(mockFirestoreGet).toHaveBeenCalledTimes(1); // The get operation was attempted
      expect(mockGenerateUniqueRiddle).not.toHaveBeenCalled();
      expect(mockFirestoreSet).not.toHaveBeenCalled();
      // The function catches all errors and does NOT finish normally - it logs the error and exits
      expect(consoleLogSpy).toHaveBeenCalledWith("Daily challenge scheduler started.");
      expect(consoleLogSpy).not.toHaveBeenCalledWith("Daily challenge scheduler finished.");
    });

    test("should log an error if Firestore 'set' operation fails", async () => {
      // Setup for a successful path until the set operation
      // Ensure the resolved value matches the expected return type of the mocked method
      mockFirestoreGet.mockResolvedValue({exists: false, data: () => undefined} as MockFirestoreDocumentSnapshot<any>); // Simulate no existing challenge document
      mockGenerateUniqueRiddle.mockResolvedValue(["Test Riddle", "ANSWER"]); // Successful riddle gen

      const firestoreSetError = new Error("Firestore set failed!");
      // Explicitly set Firestore mock behavior for this test
      mockFirestoreSet.mockRejectedValue(firestoreSetError);

      await scheduledTaskHandler(mockScheduledEvent());

      // Ensure get and generate were called
      expect(mockFirestoreGet).toHaveBeenCalledTimes(1);
      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(1);
      // Ensure set was attempted
      expect(mockFirestoreSet).toHaveBeenCalledTimes(1);
      // The set operation fails, so function returns early and doesn't log completion
      expect(consoleLogSpy).toHaveBeenCalledWith("Daily challenge scheduler started.");
      expect(consoleLogSpy).toHaveBeenCalledWith("Attempting to set daily challenge document.");
      expect(consoleLogSpy).not.toHaveBeenCalledWith("Daily challenge scheduler finished.");
    });
  });
});
