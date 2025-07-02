import firestore from "@react-native-firebase/firestore";
import { getApp } from "@react-native-firebase/app";
import { getCallableFunction } from "../../utils/firebaseFunctions";

// Firebase App mock
jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(() => ({
    name: "mocked-app",
    options: {},
  })),
}));

// Mocks for callable functions
const mockInitializeRiddleDatabase = jest.fn();
const mockGenerateClassicRiddles = jest.fn();

jest.mock("../../utils/firebaseFunctions", () => ({
  getCallableFunction: jest.fn((functionName: string) => {
    if (functionName === "initializeRiddleDatabase")
      return mockInitializeRiddleDatabase;
    if (functionName === "generateClassicRiddles")
      return mockGenerateClassicRiddles;
    return jest.fn(() => Promise.resolve({ data: {} }));
  }),
}));

// Single, persistent mock for the .get() firestore method.
const mockGet = jest.fn();

// Renamed and will be assigned the mock functions by the factory for tests to inspect.
let mockFirestoreCollection: jest.Mock;
let mockFirestoreWhere: jest.Mock;
let mockFirestoreLimit: jest.Mock;

jest.mock("@react-native-firebase/firestore", () => {
  const firestoreMockFactory = () => {
    // Define all mock functions locally first.
    const localLimit = jest.fn(() => ({ get: mockGet }));
    const localWhere = jest.fn(() => ({ limit: localLimit })); // Closes over localLimit

    const localCollection = jest.fn(); // Declare first
    localCollection.mockImplementation(() => ({
      // Then implement
      where: localWhere, // Closes over localWhere
      collection: localCollection, // Refers to itself for chaining
    }));

    // Assign the local mocks to the outer-scoped, `mock` prefixed variables
    // so that tests can access and assert on them.
    mockFirestoreLimit = localLimit;
    mockFirestoreWhere = localWhere;
    mockFirestoreCollection = localCollection;

    // This is what firestore() should return
    return { collection: localCollection };
  };

  return jest.fn(firestoreMockFactory); // Correctly return a jest.fn() that calls the factory.
});

// System Under Test - loaded after all mocks are declared.
describe("RiddleInitializationService", () => {
  let RiddleInitializationService: typeof import("../RiddleInitializationService").RiddleInitializationService;
  let LOCAL_MINIMUM_RIDDLE_BATCH_SIZE: number;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules(); // Reset modules to ensure SUT re-imports and re-runs factory

    // Re-import SUT inside beforeEach to get a fresh instance with fresh mocks
    const serviceModule = jest.requireActual("../RiddleInitializationService");
    RiddleInitializationService = serviceModule.RiddleInitializationService;
    // Temporary workaround for linter error: Hardcode known value.
    // LOCAL_MINIMUM_RIDDLE_BATCH_SIZE = RiddleInitializationService.MINIMUM_RIDDLE_BATCH_SIZE;
    LOCAL_MINIMUM_RIDDLE_BATCH_SIZE = 50;

    jest.clearAllMocks(); // Clear call history etc. for all mocks
    RiddleInitializationService.resetInitializationFlags();

    mockGet.mockReset();

    // Default resolutions for callable functions
    mockInitializeRiddleDatabase.mockResolvedValue({
      data: { success: true, message: "DB Initialized via mock (default)" },
    });
    mockGenerateClassicRiddles.mockResolvedValue({
      data: { success: true, message: "Riddles Generated via mock (default)" },
    });

    // Spy on console messages
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // No need to unmock firestore as it's a standard top-level mock now.
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("getInitializationStatus", () => {
    it("should return the initial status flags", () => {
      expect(RiddleInitializationService.getInitializationStatus()).toEqual({
        isInitializing: false,
        hasInitialized: false,
        initializationFailed: false,
      });
    });

    it("should reflect changes in status flags", async () => {
      // 1. Initial DB check: empty
      // 2. Verification DB check (after initializeRiddleDatabase): not empty
      mockGet
        .mockResolvedValueOnce({ empty: true, size: 0 })
        .mockResolvedValueOnce({ empty: false, size: 1 });

      await RiddleInitializationService.checkAndInitializeRiddles();
      expect(RiddleInitializationService.getInitializationStatus()).toEqual({
        isInitializing: false,
        hasInitialized: true,
        initializationFailed: false,
      });
    });
  });

  describe("resetInitializationFlags", () => {
    it("should reset all flags to false", () => {
      // Manually set flags to non-default states
      (RiddleInitializationService as any).isInitializing = true;
      (RiddleInitializationService as any).hasInitialized = true;
      (RiddleInitializationService as any).initializationFailed = true;

      RiddleInitializationService.resetInitializationFlags();

      expect(RiddleInitializationService.getInitializationStatus()).toEqual({
        isInitializing: false,
        hasInitialized: false,
        initializationFailed: false,
      });
    });
  });

  describe("checkAndInitializeRiddles", () => {
    it("should not initialize if already initializing", async () => {
      (RiddleInitializationService as any).isInitializing = true;
      await RiddleInitializationService.checkAndInitializeRiddles();
      expect(mockGet).not.toHaveBeenCalled();
      expect(mockInitializeRiddleDatabase).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "🔒 Riddle initialization already in progress or completed, skipping..."
      );
      (RiddleInitializationService as any).isInitializing = false;
    });

    it("should not initialize if already initialized", async () => {
      (RiddleInitializationService as any).hasInitialized = true;
      await RiddleInitializationService.checkAndInitializeRiddles();
      expect(mockGet).not.toHaveBeenCalled();
      expect(mockInitializeRiddleDatabase).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "🔒 Riddle initialization already in progress or completed, skipping..."
      );
      (RiddleInitializationService as any).hasInitialized = false;
    });

    it("should skip initialization if riddles already exist in DB", async () => {
      // Simulate global config indicating not populated, but direct riddle check finds riddles
      mockGet
        .mockResolvedValueOnce({
          // For riddlesGlobalConfig.doc('config').get()
          exists: true,
          data: () => ({ isPopulated: false }), // Not populated via global config
        })
        .mockResolvedValueOnce({ empty: false, size: 10 }); // Riddles collection not empty

      await RiddleInitializationService.checkAndInitializeRiddles();

      expect(mockGet).toHaveBeenCalledTimes(1); // Only the first check on riddles collection if global config is bypassed or not used as primary check
      // Based on current service code, the first .get() is on 'riddles'. If it's not empty, it returns.
      // The provided test setup had mockGet called 0 times. Let's adjust based on service logic.
      // Service does: .collection("riddles").where("classicIndex", ">=", 0).limit(1).get();
      // If this is not empty, it logs and returns.

      expect(mockInitializeRiddleDatabase).not.toHaveBeenCalled();
      expect(RiddleInitializationService.getInitializationStatus()).toEqual({
        isInitializing: false,
        hasInitialized: true, // Set because riddles were found
        initializationFailed: false,
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "✅ Riddle database already has riddles - no initialization needed"
      );
    });

    it("should call initializeRiddleDatabase if db is empty and function succeeds", async () => {
      // 1. Initial DB check: empty
      // 2. Verification DB check (after successful initializeRiddleDatabase): not empty
      mockGet
        .mockResolvedValueOnce({ empty: true, size: 0 })
        .mockResolvedValueOnce({ empty: false, size: 10 });

      // Ensure getCallableFunction is also checked if needed by the logic, though it's mocked globally
      // For this test, focusing on initializeRiddleDatabase call itself.

      await RiddleInitializationService.checkAndInitializeRiddles();

      expect(mockInitializeRiddleDatabase).toHaveBeenCalledWith({});
      expect(mockGenerateClassicRiddles).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "✅ Riddle database successfully initialized!"
      );
      expect(RiddleInitializationService.getInitializationStatus()).toEqual({
        isInitializing: false,
        hasInitialized: true,
        initializationFailed: false,
      });
    });

    it("should call fallback generateClassicRiddles if initializeRiddleDatabase fails", async () => {
      mockGet
        .mockResolvedValueOnce({ empty: true, size: 0 }) // Initial DB check on 'riddles' is empty
        .mockResolvedValueOnce({ empty: false, size: 5 }); // Verification check after fallback is not empty

      mockInitializeRiddleDatabase.mockRejectedValueOnce(
        new Error("Cloud function failed")
      );

      await RiddleInitializationService.checkAndInitializeRiddles();

      expect(mockInitializeRiddleDatabase).toHaveBeenCalledWith({});
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "❌ Error calling initializeRiddleDatabase:",
        expect.any(Error)
      );
      expect(mockGenerateClassicRiddles).toHaveBeenCalledWith({});
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("✅ Classic riddles generation result:"),
        expect.anything()
      );
      expect(RiddleInitializationService.getInitializationStatus()).toEqual({
        isInitializing: false,
        hasInitialized: true,
        initializationFailed: false,
      });
    });

    it("should set initializationFailed if both callable functions fail", async () => {
      mockGet.mockResolvedValueOnce({ empty: true, size: 0 }); // Initial DB check on 'riddles' is empty

      mockInitializeRiddleDatabase.mockRejectedValueOnce(
        new Error("Cloud function failed")
      );
      mockGenerateClassicRiddles.mockRejectedValueOnce(
        new Error("Fallback also failed")
      );

      await RiddleInitializationService.checkAndInitializeRiddles();

      expect(mockInitializeRiddleDatabase).toHaveBeenCalledTimes(1);
      expect(mockGenerateClassicRiddles).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "❌ Error calling initializeRiddleDatabase:",
        expect.any(Error)
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        // "❌ Error calling generateClassicRiddles as fallback:",
        "❌ Error calling generateClassicRiddles:",
        expect.any(Error)
      );
      expect(RiddleInitializationService.getInitializationStatus()).toEqual({
        isInitializing: false,
        hasInitialized: false,
        initializationFailed: true,
      });
    });

    it("should set initializationFailed if initialization completes but no riddles found (e.g. functions succeed but create no data)", async () => {
      mockGet
        .mockResolvedValueOnce({ empty: true, size: 0 }) // Initial DB check
        .mockResolvedValueOnce({ empty: true, size: 0 }); // Verification check is also empty

      await RiddleInitializationService.checkAndInitializeRiddles();

      expect(mockInitializeRiddleDatabase).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "❌ Error during riddle initialization check:",
        expect.objectContaining({
          message:
            "Riddle initialization completed but no riddles found in database",
        })
      );
      expect(RiddleInitializationService.getInitializationStatus()).toEqual({
        isInitializing: false,
        hasInitialized: false,
        initializationFailed: true,
      });
    });

    it("should set initializationFailed on firestore error during initial check", async () => {
      mockGet.mockRejectedValueOnce(new Error("Firestore read error"));
      const consoleErrorSpy = jest.spyOn(console, "error");

      await RiddleInitializationService.checkAndInitializeRiddles();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "❌ Error during riddle initialization check:",
        expect.any(Error)
      );
      expect(mockInitializeRiddleDatabase).not.toHaveBeenCalled();
      expect(RiddleInitializationService.getInitializationStatus()).toEqual({
        isInitializing: false,
        hasInitialized: false,
        initializationFailed: true,
      });
      consoleErrorSpy.mockRestore();
    });
  });

  describe("hasEnoughRiddles", () => {
    it("should return true if riddle count is >= specified minimum (default 10)", async () => {
      mockGet.mockResolvedValueOnce({ empty: false, size: 100 });
      const result = await RiddleInitializationService.hasEnoughRiddles(); // minimumCount = 10
      expect(result).toBe(true);
      expect(mockFirestoreCollection).toHaveBeenCalledWith("riddles");
      expect(mockFirestoreWhere).toHaveBeenCalledWith("classicIndex", ">=", 0);
      expect(mockFirestoreLimit).toHaveBeenCalledWith(10); // Uses default minimumCount
    });

    it("should return false if riddle count is < specified minimum (default 10)", async () => {
      mockGet.mockResolvedValueOnce({ empty: false, size: 5 }); // size < minimumCount (10)
      const result = await RiddleInitializationService.hasEnoughRiddles(); // minimumCount = 10
      expect(result).toBe(false);
      expect(mockFirestoreCollection).toHaveBeenCalledWith("riddles");
      expect(mockFirestoreWhere).toHaveBeenCalledWith("classicIndex", ">=", 0);
      expect(mockFirestoreLimit).toHaveBeenCalledWith(10); // Uses default minimumCount
    });

    it("should return false if database is empty for hasEnoughRiddles", async () => {
      mockGet.mockResolvedValueOnce({ empty: true, size: 0 });
      const result = await RiddleInitializationService.hasEnoughRiddles();
      expect(result).toBe(false);
    });

    it("should handle firestore errors gracefully in hasEnoughRiddles", async () => {
      mockGet.mockRejectedValueOnce(new Error("Firestore fetch failed"));
      const result = await RiddleInitializationService.hasEnoughRiddles();
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error checking riddle count:",
        expect.any(Error)
      );
    });

    it("should query with the provided minimumCount or its default", async () => {
      mockGet.mockResolvedValueOnce({ empty: false, size: 60 });
      await RiddleInitializationService.hasEnoughRiddles(); // Call with no param (minimumCount = 10)
      expect(mockFirestoreLimit).toHaveBeenCalledWith(10);

      // Clear mock calls for the next assertion if calls are cumulative, or ensure it's the last call being checked.
      // Assuming mockFirestoreLimit is cleared by clearAllMocks in beforeEach, this should be fine.
      // Or, more robustly, check specific calls if Jest supports it easily, or check last call.
      // For simplicity, let's assume clearAllMocks handles it or check the last call implicitly.

      mockGet.mockResolvedValueOnce({ empty: false, size: 60 }); // Reset mock for next call
      await RiddleInitializationService.hasEnoughRiddles(5); // Call with param minimumCount = 5
      expect(mockFirestoreLimit).toHaveBeenCalledWith(5);
    });
  });
});
