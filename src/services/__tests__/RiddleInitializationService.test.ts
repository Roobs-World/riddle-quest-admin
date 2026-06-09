// Mock refs assigned in jest.mock factory (must use let for hoisting)
let mockGetDocs: jest.Mock;
let mockCollection: jest.Mock;
let mockWhere: jest.Mock;
let mockLimit: jest.Mock;
let mockQuery: jest.Mock;

let mockGet: jest.Mock;

jest.mock("@react-native-firebase/firestore", () => {
  mockGetDocs = jest.fn();
  mockLimit = jest.fn(() => ({}));
  mockWhere = jest.fn(() => ({}));
  mockCollection = jest.fn(() => ({}));
  mockQuery = jest.fn(() => ({}));
  mockGet = mockGetDocs;

  return {
    __esModule: true,
    getFirestore: jest.fn(() => ({})),
    getDocs: mockGetDocs,
    collection: mockCollection,
    query: mockQuery,
    where: mockWhere,
    limit: mockLimit,
    default: jest.fn(() => ({})),
  };
});

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(() => ({name: "mocked-app", options: {}})),
}));

const mockInitializeRiddleDatabase = jest.fn();

jest.mock("../../utils/firebaseFunctions", () => ({
  getCallableFunction: jest.fn((functionName: string) => {
    if (functionName === "initializeRiddleDatabase") return mockInitializeRiddleDatabase;
    return jest.fn(() => Promise.resolve({data: {}}));
  }),
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("RiddleInitializationService", () => {
  let RiddleInitializationService: typeof import("../RiddleInitializationService").RiddleInitializationService;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    const serviceModule = jest.requireActual("../RiddleInitializationService");
    RiddleInitializationService = serviceModule.RiddleInitializationService;

    jest.clearAllMocks();
    RiddleInitializationService.resetInitializationFlags();

    mockGetDocs.mockReset();
    mockGet = mockGetDocs;
    mockCollection.mockReset();
    mockWhere.mockReset();
    mockLimit.mockReset();
    mockQuery.mockReset();

    mockCollection.mockReturnValue({});
    mockWhere.mockReturnValue({});
    mockLimit.mockReturnValue({});
    mockQuery.mockReturnValue({});

    mockInitializeRiddleDatabase.mockResolvedValue({
      data: {success: true, message: "DB Initialized via mock (default)"},
    });

    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
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
      mockGet.mockResolvedValueOnce({empty: true, size: 0}).mockResolvedValueOnce({empty: false, size: 1});

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
      const loggerMock = require("../../utils/logger").logger;
      (RiddleInitializationService as any).isInitializing = true;
      await RiddleInitializationService.checkAndInitializeRiddles();
      expect(mockGet).not.toHaveBeenCalled();
      expect(mockInitializeRiddleDatabase).not.toHaveBeenCalled();
      expect(loggerMock.debug).toHaveBeenCalledWith(
        "Riddle initialization already in progress or completed, skipping...",
      );
      (RiddleInitializationService as any).isInitializing = false;
    });

    it("should not initialize if already initialized", async () => {
      const loggerMock = require("../../utils/logger").logger;
      (RiddleInitializationService as any).hasInitialized = true;
      await RiddleInitializationService.checkAndInitializeRiddles();
      expect(mockGet).not.toHaveBeenCalled();
      expect(mockInitializeRiddleDatabase).not.toHaveBeenCalled();
      expect(loggerMock.debug).toHaveBeenCalledWith(
        "Riddle initialization already in progress or completed, skipping...",
      );
      (RiddleInitializationService as any).hasInitialized = false;
    });

    it("should skip initialization if riddles already exist in DB", async () => {
      const loggerMock = require("../../utils/logger").logger;
      mockGet.mockResolvedValueOnce({empty: false, size: 10});

      await RiddleInitializationService.checkAndInitializeRiddles();

      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockInitializeRiddleDatabase).not.toHaveBeenCalled();
      expect(RiddleInitializationService.getInitializationStatus()).toEqual({
        isInitializing: false,
        hasInitialized: true,
        initializationFailed: false,
      });
      expect(loggerMock.debug).toHaveBeenCalledWith(
        "Classic riddles database already has riddles for locale en - no initialization needed",
      );
    });

    it("should call initializeRiddleDatabase if db is empty and function succeeds", async () => {
      const loggerMock = require("../../utils/logger").logger;
      mockGet.mockResolvedValueOnce({empty: true, size: 0}).mockResolvedValueOnce({empty: false, size: 10});

      await RiddleInitializationService.checkAndInitializeRiddles();

      expect(mockInitializeRiddleDatabase).toHaveBeenCalledWith({});
      expect(loggerMock.info).toHaveBeenCalledWith("Classic riddles database successfully initialized for locale en!");
      expect(RiddleInitializationService.getInitializationStatus()).toEqual({
        isInitializing: false,
        hasInitialized: true,
        initializationFailed: false,
      });
    });

    it("should mark initialization failed if initializeRiddleDatabase fails", async () => {
      const loggerMock = require("../../utils/logger").logger;
      mockGet.mockResolvedValueOnce({empty: true, size: 0});
      mockInitializeRiddleDatabase.mockRejectedValueOnce(new Error("Cloud function failed"));

      await RiddleInitializationService.checkAndInitializeRiddles();

      expect(mockInitializeRiddleDatabase).toHaveBeenCalledWith({});
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.stringContaining("Error during riddle initialization check:"),
        expect.any(Error),
      );
      expect(RiddleInitializationService.getInitializationStatus()).toEqual({
        isInitializing: false,
        hasInitialized: false,
        initializationFailed: true,
      });
    });

    it("should set initializationFailed if initialization completes but no riddles are found", async () => {
      mockGet.mockResolvedValueOnce({empty: true, size: 0}).mockResolvedValueOnce({empty: true, size: 0});

      await RiddleInitializationService.checkAndInitializeRiddles();

      expect(mockInitializeRiddleDatabase).toHaveBeenCalledWith({});
      expect(RiddleInitializationService.getInitializationStatus()).toEqual({
        isInitializing: false,
        hasInitialized: false,
        initializationFailed: true,
      });
    });

    it("should set initializationFailed on firestore error during initial check", async () => {
      mockGet.mockRejectedValueOnce(new Error("Firestore read error"));
      const logger = require("../../utils/logger").logger;

      await RiddleInitializationService.checkAndInitializeRiddles();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error during riddle initialization check:"),
        expect.any(Error),
      );
      expect(mockInitializeRiddleDatabase).not.toHaveBeenCalled();
      expect(RiddleInitializationService.getInitializationStatus()).toEqual({
        isInitializing: false,
        hasInitialized: false,
        initializationFailed: true,
      });
    });
  });

  describe("hasEnoughRiddles", () => {
    it("should return true if riddle count is >= specified minimum (default 10)", async () => {
      mockGet.mockResolvedValueOnce({empty: false, size: 10});
      const result = await RiddleInitializationService.hasEnoughRiddles();
      expect(result).toBe(true);
      expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), "localizedRiddles/en/riddles");
      expect(mockWhere).toHaveBeenCalledWith("classicIndex", ">=", 0);
      expect(mockLimit).toHaveBeenCalledWith(10);
    });

    it("should return false if riddle count is < specified minimum (default 10)", async () => {
      mockGet.mockResolvedValueOnce({empty: false, size: 5});
      const result = await RiddleInitializationService.hasEnoughRiddles();
      expect(result).toBe(false);
      expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), "localizedRiddles/en/riddles");
      expect(mockWhere).toHaveBeenCalledWith("classicIndex", ">=", 0);
      expect(mockLimit).toHaveBeenCalledWith(10);
    });

    it("should return false if database is empty for hasEnoughRiddles", async () => {
      mockGet.mockResolvedValueOnce({empty: true, size: 0});
      const result = await RiddleInitializationService.hasEnoughRiddles();
      expect(result).toBe(false);
    });

    it("should handle firestore errors gracefully in hasEnoughRiddles", async () => {
      mockGet.mockRejectedValueOnce(new Error("Firestore fetch failed"));
      const logger = require("../../utils/logger").logger;
      const result = await RiddleInitializationService.hasEnoughRiddles();
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith("Error checking riddle count:", expect.any(Error));
    });

    it("should query with the provided minimumCount or its default", async () => {
      mockGet.mockResolvedValueOnce({empty: false, size: 60});
      await RiddleInitializationService.hasEnoughRiddles();
      expect(mockLimit).toHaveBeenCalledWith(10);

      mockGet.mockResolvedValueOnce({empty: false, size: 60});
      await RiddleInitializationService.hasEnoughRiddles(5);
      expect(mockLimit).toHaveBeenCalledWith(5);
    });
  });
});
