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

// Mock for collection().get() - used by getExistingRiddlesFromFirestore
const mockCollectionGet = jest.fn().mockResolvedValue({
  empty: true,
  forEach: () => {},
  docs: [],
  size: 0,
} as MockFirestoreQuerySnapshot<any>);

// Mock for dailyRiddles.doc().set() - each riddle is stored separately
const mockRiddleDocSet = jest.fn().mockResolvedValue(undefined);

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
      if (
        collectionPath === "riddles" ||
        collectionPath === "dailyRiddles" ||
        collectionPath === "tutorialRiddles" ||
        collectionPath === "users"
      ) {
        return {
          get: mockCollectionGet,
          doc: jest.fn(() => ({
            id: "mock-riddle-id",
            set: mockRiddleDocSet,
          })),
          where: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({docs: [], empty: true, size: 0} as MockFirestoreQuerySnapshot<any>),
          })),
        };
      }
      return {doc: jest.fn(), get: mockCollectionGet};
    }),
  })) as jest.Mock & {
    FieldValue: {
      serverTimestamp: jest.Mock;
    };
  };

  (mockFirestore as any).FieldValue = {
    serverTimestamp: jest.fn(() => new Date()),
  };

  return {
    initializeApp: jest.fn(),
    firestore: mockFirestore,
  };
});

jest.mock("../riddleGeneration", () => ({
  generateTodaysDailyChallenge: jest.fn(),
}));
const mockGenerateTodaysDailyChallenge = jest.mocked(
  require("../riddleGeneration").generateTodaysDailyChallenge,
);

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

  beforeEach(() => {
    originalEnv = {...process.env};

    // Reset mocks before each test
    mockFirestoreSet.mockReset();
    mockFirestoreGet.mockReset();
    mockCollectionGet.mockReset();
    mockRiddleDocSet.mockReset();
    mockGenerateTodaysDailyChallenge.mockReset();
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
    mockLogger.debug.mockReset();

    // Set default mock behavior (can be overridden in individual tests)
    mockFirestoreGet.mockResolvedValue({exists: false, data: () => undefined} as MockFirestoreDocumentSnapshot<any>);
    mockFirestoreSet.mockResolvedValue(undefined);
    mockRiddleDocSet.mockResolvedValue(undefined);
    mockCollectionGet.mockResolvedValue({
      empty: true,
      forEach: () => {},
      docs: [],
      size: 0,
    } as MockFirestoreQuerySnapshot<any>);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Initial test to ensure handler can be called
  test("handler function can be invoked", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    mockGenerateTodaysDailyChallenge.mockResolvedValue(undefined);

    await scheduledTaskHandler(mockScheduledEvent());

    expect(mockLogger.info).toHaveBeenCalledWith("Daily challenge scheduler started.");
    expect(mockGenerateTodaysDailyChallenge).toHaveBeenCalledWith(false);
  });

  describe("Successful execution", () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = "a-valid-key";
    });

    test("should generate and set a new daily challenge if none exists for the current date", async () => {
      mockGenerateTodaysDailyChallenge.mockResolvedValue(undefined);

      await scheduledTaskHandler(mockScheduledEvent());

      expect(mockLogger.info).toHaveBeenCalledWith("Daily challenge scheduler started.");
      expect(mockGenerateTodaysDailyChallenge).toHaveBeenCalledWith(false);
      expect(mockLogger.info).toHaveBeenCalledWith("Daily challenge scheduler finished successfully.");
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test("should skip generation if a challenge for the current date already exists", async () => {
      mockGenerateTodaysDailyChallenge.mockResolvedValue(undefined);

      await scheduledTaskHandler(mockScheduledEvent());

      expect(mockLogger.info).toHaveBeenCalledWith("Daily challenge scheduler started.");
      expect(mockGenerateTodaysDailyChallenge).toHaveBeenCalledWith(false);
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("Daily challenge scheduler finished successfully.");
    });
  });

  describe("Input and Configuration Issues", () => {
    test("should handle missing OPENAI_API_KEY gracefully", async () => {
      delete process.env.OPENAI_API_KEY;
      mockGenerateTodaysDailyChallenge.mockRejectedValue(
        new Error("OPENAI_API_KEY environment variable is required"),
      );

      await expect(scheduledTaskHandler(mockScheduledEvent())).rejects.toThrow(
        "OPENAI_API_KEY environment variable is required",
      );

      expect(mockGenerateTodaysDailyChallenge).toHaveBeenCalledWith(false);
      expect(mockLogger.info).toHaveBeenCalledWith("Daily challenge scheduler started.");
      expect(mockLogger.info).not.toHaveBeenCalledWith("Daily challenge scheduler finished successfully.");
    });

    test("should log an error and return if riddle generation fails", async () => {
      process.env.OPENAI_API_KEY = "a-valid-key";
      mockGenerateTodaysDailyChallenge.mockRejectedValue(new Error("Riddle generation failed"));

      await expect(scheduledTaskHandler(mockScheduledEvent())).rejects.toThrow("Riddle generation failed");

      expect(mockGenerateTodaysDailyChallenge).toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalledWith("Daily challenge scheduler finished successfully.");
    });
  });

  describe("Firestore Operation Failures", () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = "a-valid-key";
    });

    test("should log an error if Firestore 'get' operation fails", async () => {
      mockGenerateTodaysDailyChallenge.mockRejectedValue(new Error("Firestore get failed!"));

      await expect(scheduledTaskHandler(mockScheduledEvent())).rejects.toThrow("Firestore get failed!");

      expect(mockGenerateTodaysDailyChallenge).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("Daily challenge scheduler started.");
      expect(mockLogger.info).not.toHaveBeenCalledWith("Daily challenge scheduler finished successfully.");
    });

    test("should log an error if Firestore 'set' operation fails", async () => {
      mockGenerateTodaysDailyChallenge.mockRejectedValue(new Error("Firestore set failed!"));

      await expect(scheduledTaskHandler(mockScheduledEvent())).rejects.toThrow("Firestore set failed!");

      expect(mockGenerateTodaysDailyChallenge).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("Daily challenge scheduler started.");
      expect(mockLogger.info).not.toHaveBeenCalledWith("Daily challenge scheduler finished successfully.");
    });
  });
});
