const mockGetDocs = jest.fn();
const mockGetCallableFunction = jest.fn();
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
const mockCaptureException = jest.fn();
const mockStartTransaction = jest.fn(() => ({finish: jest.fn()}));

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({})),
  getDocs: (...args: any[]) => mockGetDocs.apply(null, args),
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  limit: jest.fn(() => ({})),
}));

jest.mock("../firebaseApp", () => ({
  getFirebaseApp: jest.fn(() => ({name: "[DEFAULT]", appCheck: jest.fn()})),
}));

jest.mock("../../utils/firebaseFunctions", () => ({
  getCallableFunction: (...args: any[]) => mockGetCallableFunction.apply(null, args),
}));

jest.mock("../../utils/logger", () => ({
  logger: mockLogger,
}));

jest.mock("../../utils/sentry", () => ({
  captureException: (...args: any[]) => mockCaptureException.apply(null, args),
  startTransaction: (...args: any[]) => mockStartTransaction.apply(null, args),
}));

describe("RiddleInitializationService expected access denials", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockGetDocs.mockResolvedValue({empty: true, size: 0});
    mockGetCallableFunction.mockImplementation((functionName: string) => {
      if (functionName === "initializeRiddleDatabase") {
        return jest.fn().mockRejectedValue({
          code: "permission-denied",
          message: "Access denied",
        });
      }
      return jest.fn().mockResolvedValue({data: {}});
    });
  });

  it("keeps expected startup denials at warning level", async () => {
    const {RiddleInitializationService} = require("../RiddleInitializationService");

    await RiddleInitializationService.checkAndInitializeRiddles();

    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining("Error during riddle initialization check:"),
      expect.anything(),
    );
    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(RiddleInitializationService.getInitializationStatus()).toEqual({
      isInitializing: false,
      hasInitialized: false,
      initializationFailed: true,
    });
  });
});
