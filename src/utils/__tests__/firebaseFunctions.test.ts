import {z} from "zod";
import {
  FirebaseCallableValidationError,
  getFirebaseFunctions,
  getCallableFunction,
  getValidatedCallableFunction,
} from "../firebaseFunctions";

// Mock Firebase modules
jest.mock("@react-native-firebase/functions", () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(),
  connectFunctionsEmulator: jest.fn(),
}));

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(),
}));

const mockGetFunctions = require("@react-native-firebase/functions").getFunctions;
const mockHttpsCallable = require("@react-native-firebase/functions").httpsCallable;
const mockConnectFunctionsEmulator = require("@react-native-firebase/functions").connectFunctionsEmulator;
const mockGetApp = require("@react-native-firebase/app").getApp;

describe("firebaseFunctions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST;
    delete process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT;
  });

  describe("getFirebaseFunctions", () => {
    it("should call getFunctions with correct app and region", () => {
      const mockApp = {name: "test-app"};
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
      const mockApp = {name: "test-app"};
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
      const mockApp = {name: "test-app"};
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
      const mockApp = {name: "test-app"};
      const mockCallable1 = {call: jest.fn()};
      const mockCallable2 = {call: jest.fn()};
      const mockFunctions = {};

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);
      mockHttpsCallable.mockReturnValueOnce(mockCallable1).mockReturnValueOnce(mockCallable2);

      const result1 = getCallableFunction("generateRiddles");
      const result2 = getCallableFunction("submitGuess");

      expect(mockHttpsCallable).toHaveBeenCalledTimes(2);
      expect(mockHttpsCallable).toHaveBeenNthCalledWith(1, mockFunctions, "generateRiddles");
      expect(mockHttpsCallable).toHaveBeenNthCalledWith(2, mockFunctions, "submitGuess");
      expect(result1).toBe(mockCallable1);
      expect(result2).toBe(mockCallable2);
    });

    it("should handle empty function name", () => {
      const mockApp = {name: "test-app"};
      const mockCallable = {call: jest.fn()};
      const mockFunctions = {};

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);
      mockHttpsCallable.mockReturnValue(mockCallable);

      const result = getCallableFunction("");

      expect(mockHttpsCallable).toHaveBeenCalledWith(mockFunctions, "");
      expect(result).toBe(mockCallable);
    });

    it("should create new callable functions for each call", () => {
      const mockApp = {name: "test-app"};
      const mockCallable1 = {call: jest.fn()};
      const mockCallable2 = {call: jest.fn()};
      const mockFunctions = {};

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);
      mockHttpsCallable.mockReturnValueOnce(mockCallable1).mockReturnValueOnce(mockCallable2);

      const result1 = getCallableFunction("testFunction");
      const result2 = getCallableFunction("testFunction");

      expect(mockHttpsCallable).toHaveBeenCalledTimes(2);
      expect(result1).toBe(mockCallable1);
      expect(result2).toBe(mockCallable2);
    });
  });

  describe("getValidatedCallableFunction", () => {
    it("should validate request data before calling Firebase and response data after receipt", async () => {
      const mockApp = {name: "test-app"};
      const mockFunctions = {};
      const mockCallable = jest.fn().mockResolvedValue({data: {ok: true}});

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);
      mockHttpsCallable.mockReturnValue(mockCallable);

      const callable = getValidatedCallableFunction(
        "testFunction",
        z.object({name: z.string().min(1)}),
        z.object({ok: z.boolean()}),
      );

      await expect(callable({name: "Qwordly"})).resolves.toEqual({ok: true});
      expect(mockCallable).toHaveBeenCalledWith({name: "Qwordly"});
    });

    it("should reject invalid request data without calling Firebase", async () => {
      const mockCallable = jest.fn().mockResolvedValue({data: {ok: true}});

      mockGetApp.mockReturnValue({name: "test-app"});
      mockGetFunctions.mockReturnValue({});
      mockHttpsCallable.mockReturnValue(mockCallable);

      const callable = getValidatedCallableFunction(
        "testFunction",
        z.object({name: z.string().min(1)}),
        z.object({ok: z.boolean()}),
      );

      await expect(callable({name: ""})).rejects.toBeInstanceOf(FirebaseCallableValidationError);
      expect(mockCallable).not.toHaveBeenCalled();
    });

    it("should reject invalid response data", async () => {
      const mockCallable = jest.fn().mockResolvedValue({data: {ok: "yes"}});

      mockGetApp.mockReturnValue({name: "test-app"});
      mockGetFunctions.mockReturnValue({});
      mockHttpsCallable.mockReturnValue(mockCallable);

      const callable = getValidatedCallableFunction(
        "testFunction",
        z.object({name: z.string().min(1)}),
        z.object({ok: z.boolean()}),
      );

      await expect(callable({name: "Qwordly"})).rejects.toBeInstanceOf(FirebaseCallableValidationError);
      expect(mockCallable).toHaveBeenCalledWith({name: "Qwordly"});
    });
  });

  describe("Integration", () => {
    it("should work together to create callable functions", () => {
      const mockApp = {name: "test-app"};
      const mockCallable = {
        call: jest.fn().mockResolvedValue({data: "test-result"}),
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
      const mockApp = {name: "test-app"};

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockImplementation(() => {
        throw new Error("Firebase initialization failed");
      });

      expect(() => getFirebaseFunctions()).toThrow("Firebase initialization failed");
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
      const mockApp = {name: "test-app"};
      const mockFunctions = {};

      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);

      getFirebaseFunctions();

      expect(mockGetFunctions).toHaveBeenCalledWith(mockApp, "us-central1");
    });

    it("should work with different app instances", () => {
      const mockApp1 = {name: "app1"};
      const mockApp2 = {name: "app2"};
      const mockFunctions1 = {};
      const mockFunctions2 = {};

      mockGetApp.mockReturnValueOnce(mockApp1).mockReturnValueOnce(mockApp2);
      mockGetFunctions.mockReturnValueOnce(mockFunctions1).mockReturnValueOnce(mockFunctions2);

      const result1 = getFirebaseFunctions();
      const result2 = getFirebaseFunctions();

      expect(mockGetFunctions).toHaveBeenNthCalledWith(1, mockApp1, "us-central1");
      expect(mockGetFunctions).toHaveBeenNthCalledWith(2, mockApp2, "us-central1");
      expect(result1).toBe(mockFunctions1);
      expect(result2).toBe(mockFunctions2);
    });

    it("should connect to the functions emulator when emulator env vars are present", () => {
      const mockApp = {name: "test-app"};
      const mockFunctions = {};

      process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST = "10.0.2.2";
      process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT = "5001";
      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);

      const result = getFirebaseFunctions();

      expect(mockConnectFunctionsEmulator).toHaveBeenCalledWith(mockFunctions, "10.0.2.2", 5001);
      expect(result).toBe(mockFunctions);
    });

    it("should only connect to the functions emulator once per instance", () => {
      const mockApp = {name: "test-app"};
      const mockFunctions = {};

      process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST = "10.0.2.2";
      process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT = "5001";
      mockGetApp.mockReturnValue(mockApp);
      mockGetFunctions.mockReturnValue(mockFunctions);

      getFirebaseFunctions();
      getFirebaseFunctions();

      expect(mockConnectFunctionsEmulator).toHaveBeenCalledTimes(1);
    });
  });
});
