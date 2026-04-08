import {
  getFirebaseFunctions,
  getCallableFunction,
} from "../firebaseFunctions";

// Mock Firebase modules
jest.mock("@react-native-firebase/functions", () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(),
}));

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(),
}));

const mockGetFunctions =
  require("@react-native-firebase/functions").getFunctions;
const mockHttpsCallable =
  require("@react-native-firebase/functions").httpsCallable;
const mockGetApp = require("@react-native-firebase/app").getApp;

describe("firebaseFunctions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getFirebaseFunctions", () => {
    it("should call getFunctions with correct app and region", () => {
      const mockApp = { name: "test-app" };
      const mockFunctions = {
        httpsCallable: jest.fn(),
        useEmulator: jest.fn(),
      };

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);

      const result = getFirebaseFunctions();

      expect(mockGetApp).toHaveBeenCalledTimes(1);
      expect(mockGetFunctions).toHaveBeenCalledWith(mockApp, "us-central1");
      expect(result).toBe(mockFunctions);
    });

    it("should return the same functions instance on multiple calls", () => {
      const mockApp = { name: "test-app" };
      const mockFunctions = {
        httpsCallable: jest.fn(),
        useEmulator: jest.fn(),
      };

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);

      const result1 = getFirebaseFunctions();
      const result2 = getFirebaseFunctions();

      expect(result1).toBe(result2);
      expect(mockGetFunctions).toHaveBeenCalledTimes(2);
    });
  });

  describe("getCallableFunction", () => {
    it("should create a callable function with correct name", () => {
      const mockApp = { name: "test-app" };
      const mockCallable = {
        call: jest.fn(),
        timeout: 540000,
      };
      const mockFunctions = {};

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);
      mockHttpsCallable.mockReturnValue(mockCallable);

      const functionName = "submitGuess";
      const result = getCallableFunction(functionName);

      expect(mockHttpsCallable).toHaveBeenCalledWith(mockFunctions, functionName);
      expect(result).toBe(mockCallable);
    });

    it("should work with different function names", () => {
      const mockApp = { name: "test-app" };
      const mockCallable1 = { call: jest.fn() };
      const mockCallable2 = { call: jest.fn() };
      const mockFunctions = {};

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);
      mockHttpsCallable
        .mockReturnValueOnce(mockCallable1)
        .mockReturnValueOnce(mockCallable2);

      const result1 = getCallableFunction("generateRiddles");
      const result2 = getCallableFunction("submitGuess");

      expect(mockHttpsCallable).toHaveBeenCalledTimes(2);
      expect(mockHttpsCallable).toHaveBeenNthCalledWith(
        1,
        mockFunctions,
        "generateRiddles"
      );
      expect(mockHttpsCallable).toHaveBeenNthCalledWith(
        2,
        mockFunctions,
        "submitGuess"
      );
      expect(result1).toBe(mockCallable1);
      expect(result2).toBe(mockCallable2);
    });

    it("should handle empty function name", () => {
      const mockApp = { name: "test-app" };
      const mockCallable = { call: jest.fn() };
      const mockFunctions = {};

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);
      mockHttpsCallable.mockReturnValue(mockCallable);

      const result = getCallableFunction("");

      expect(mockHttpsCallable).toHaveBeenCalledWith(mockFunctions, "");
      expect(result).toBe(mockCallable);
    });

    it("should create new callable functions for each call", () => {
      const mockApp = { name: "test-app" };
      const mockCallable1 = { call: jest.fn() };
      const mockCallable2 = { call: jest.fn() };
      const mockFunctions = {};

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);
      mockHttpsCallable
        .mockReturnValueOnce(mockCallable1)
        .mockReturnValueOnce(mockCallable2);

      const result1 = getCallableFunction("testFunction");
      const result2 = getCallableFunction("testFunction");

      expect(mockHttpsCallable).toHaveBeenCalledTimes(2);
      expect(result1).toBe(mockCallable1);
      expect(result2).toBe(mockCallable2);
    });
  });

  describe("Integration", () => {
    it("should work together to create callable functions", () => {
      const mockApp = { name: "test-app" };
      const mockCallable = {
        call: jest.fn().mockResolvedValue({ data: "test-result" }),
      };
      const mockFunctions = {};

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);
      mockHttpsCallable.mockReturnValue(mockCallable);

      // Test the full flow
      const callable = getCallableFunction("testFunction");

      expect(mockGetApp).toHaveBeenCalledWith();
      expect(mockGetFunctions).toHaveBeenCalledWith(mockApp, "us-central1");
      expect(mockHttpsCallable).toHaveBeenCalledWith(mockFunctions, "testFunction");
      expect(callable).toBe(mockCallable);
    });

    it("should handle errors from Firebase functions", () => {
      const mockApp = { name: "test-app" };

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockImplementation(() => {
        throw new Error("Firebase initialization failed");
      });

      expect(() => getFirebaseFunctions()).toThrow(
        "Firebase initialization failed"
      );
    });

    it("should handle errors from getApp", () => {
      mockGetApp.mockImplementation(() => {
        throw new Error("App initialization failed");
      });

      expect(() => getFirebaseFunctions()).toThrow("App initialization failed");
    });
  });

  describe("Configuration", () => {
    it("should always use us-central1 region", () => {
      const mockApp = { name: "test-app" };
      const mockFunctions = {};

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);

      getFirebaseFunctions();

      expect(mockGetFunctions).toHaveBeenCalledWith(mockApp, "us-central1");
    });

    it("should work with different app instances", () => {
      const mockApp1 = { name: "app1" };
      const mockApp2 = { name: "app2" };
      const mockFunctions1 = {};
      const mockFunctions2 = {};

      mockGetApp.mockReturnValueOnce(mockApp1).mockReturnValueOnce(mockApp2);
      mockGetFunctions
        .mockReturnValueOnce(mockFunctions1)
        .mockReturnValueOnce(mockFunctions2);

      const result1 = getFirebaseFunctions();
      const result2 = getFirebaseFunctions();

      expect(mockGetFunctions).toHaveBeenNthCalledWith(
        1,
        mockApp1,
        "us-central1"
      );
      expect(mockGetFunctions).toHaveBeenNthCalledWith(
        2,
        mockApp2,
        "us-central1"
      );
      expect(result1).toBe(mockFunctions1);
      expect(result2).toBe(mockFunctions2);
    });
  });
});
