import {describe, expect} from "@jest/globals";

// Import the module
import * as iapConfig from "../iapConfig";

describe("iapConfig", () => {
  // Add beforeEach to reset module state
  beforeEach(() => {
    // Reset the module state before each test
    iapConfig.resetIapConfig();
  });

  describe("Constants", () => {
    test("should export NO_ADS_PRODUCT_ID", () => {
      expect(iapConfig.NO_ADS_PRODUCT_ID).toBe("com.roobsworld.riddlequest.no_ads");
    });

    test("should export BACKEND_COIN_PRODUCT_DETAILS", () => {
      expect(iapConfig.BACKEND_COIN_PRODUCT_DETAILS).toEqual({
        COIN_PACK_TINY: {id: "com.roobsworld.riddlequest.coinpack1", coins: 250, label: "STARTER"},
        COIN_PACK_SMALL: {id: "com.roobsworld.riddlequest.coinpack2", coins: 550},
        COIN_PACK_MID: {id: "com.roobsworld.riddlequest.coinpack3", coins: 900},
        COIN_PACK_LARGE: {id: "com.roobsworld.riddlequest.coinpack4", coins: 1600, label: "POPULAR"},
        COIN_PACK_HUGE: {id: "com.roobsworld.riddlequest.coinpack5", coins: 3400},
        COIN_PACK_MEGA: {id: "com.roobsworld.riddlequest.coinpack6", coins: 7000, label: "BEST VALUE"},
      });
    });
  });

  describe("Functions", () => {
    test("should export initializeIapConfig function", () => {
      expect(typeof iapConfig.initializeIapConfig).toBe("function");
    });

    test("should export getIapGoogleCredentials function", () => {
      expect(typeof iapConfig.getIapGoogleCredentials).toBe("function");
    });

    test("should export getAppleSharedSecret function", () => {
      expect(typeof iapConfig.getAppleSharedSecret).toBe("function");
    });
  });

  describe("Basic functionality", () => {
    it("should warn when getter functions are called before initialization", () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

      // These should warn because module is not initialized
      iapConfig.getIapGoogleCredentials();
      iapConfig.getAppleSharedSecret();

      expect(consoleWarnSpy).toHaveBeenCalledWith("[iapConfig] getIapGoogleCredentials called before initialization!");
      expect(consoleWarnSpy).toHaveBeenCalledWith("[iapConfig] getAppleSharedSecret called before initialization!");

      consoleWarnSpy.mockRestore();
    });
  });

  // New comprehensive tests for missing coverage
  describe("Initialization Scenarios", () => {
    beforeEach(() => {
      // Reset environment variables for each test
      delete process.env.APPLE_SHARED_SECRET;
      delete process.env.GOOGLE_SERVICE_ACCOUNT;
      delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;
      delete process.env.FUNCTIONS_EMULATOR;
      delete process.env.IS_FIREBASE_FUNCTIONS_TEST;
      // Don't delete JEST_WORKER_ID as we need it for Jest environment detection
      jest.clearAllMocks();
      // Reset the module state
      iapConfig.resetIapConfig();
    });

    it("should handle Firebase Functions Test environment with valid service account file", () => {
      // Set up Firebase Functions test environment
      process.env.IS_FIREBASE_FUNCTIONS_TEST = "true";
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH = "test-service-account.json";

      // Override Jest detection temporarily
      const originalJestWorker = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;

      // Mock file system operations
      const mockExistsSync = jest.spyOn(require("fs"), "existsSync").mockReturnValue(true);
      const mockReadFileSync = jest.spyOn(require("fs"), "readFileSync").mockReturnValue(
        JSON.stringify({
          client_email: "test@serviceaccount.com",
          private_key: "-----BEGIN PRIVATE KEY-----\nTEST_KEY\n-----END PRIVATE KEY-----",
        }),
      );

      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      iapConfig.initializeIapConfig();

      expect(mockExistsSync).toHaveBeenCalled();
      expect(mockReadFileSync).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Successfully loaded and parsed service account"),
      );

      // Restore Jest environment
      if (originalJestWorker) {
        process.env.JEST_WORKER_ID = originalJestWorker;
      }
      mockExistsSync.mockRestore();
      mockReadFileSync.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it("should handle missing service account file in Firebase Functions test environment", () => {
      process.env.IS_FIREBASE_FUNCTIONS_TEST = "true";
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH = "missing-file.json";

      // Override Jest detection temporarily
      const originalJestWorker = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;

      const mockExistsSync = jest.spyOn(require("fs"), "existsSync").mockReturnValue(false);
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      iapConfig.initializeIapConfig();

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Service account file NOT FOUND"));

      // Restore Jest environment
      if (originalJestWorker) {
        process.env.JEST_WORKER_ID = originalJestWorker;
      }
      mockExistsSync.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it("should handle JSON parse error when reading service account file", () => {
      process.env.IS_FIREBASE_FUNCTIONS_TEST = "true";
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH = "invalid.json";

      // Override Jest detection temporarily
      const originalJestWorker = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;

      const mockExistsSync = jest.spyOn(require("fs"), "existsSync").mockReturnValue(true);
      const mockReadFileSync = jest.spyOn(require("fs"), "readFileSync").mockReturnValue("invalid json");
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      iapConfig.initializeIapConfig();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error reading/parsing service account from file"),
      );

      // Restore Jest environment
      if (originalJestWorker) {
        process.env.JEST_WORKER_ID = originalJestWorker;
      }
      mockExistsSync.mockRestore();
      mockReadFileSync.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it("should handle production environment with valid GOOGLE_SERVICE_ACCOUNT", () => {
      // Override Jest detection temporarily
      const originalJestWorker = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;

      process.env.GOOGLE_SERVICE_ACCOUNT = JSON.stringify({
        client_email: "prod@serviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\\nPROD_KEY\\n-----END PRIVATE KEY-----",
      });

      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      iapConfig.initializeIapConfig();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Successfully parsed GOOGLE_SERVICE_ACCOUNT from process.env"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Processed private key (standardized newlines)"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("iapGoogleCredentials CONSTRUCTED"));

      // Restore Jest environment
      if (originalJestWorker) {
        process.env.JEST_WORKER_ID = originalJestWorker;
      }
      consoleLogSpy.mockRestore();
    });

    it("should handle production environment with invalid GOOGLE_SERVICE_ACCOUNT JSON", () => {
      // Override Jest detection temporarily
      const originalJestWorker = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;

      process.env.GOOGLE_SERVICE_ACCOUNT = "invalid json string";

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      iapConfig.initializeIapConfig();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error parsing GOOGLE_SERVICE_ACCOUNT JSON string"),
      );

      // Restore Jest environment
      if (originalJestWorker) {
        process.env.JEST_WORKER_ID = originalJestWorker;
      }
      consoleErrorSpy.mockRestore();
    });

    it("should handle production environment with missing client_email or private_key", () => {
      // Override Jest detection temporarily
      const originalJestWorker = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;

      process.env.GOOGLE_SERVICE_ACCOUNT = JSON.stringify({
        client_email: "test@serviceaccount.com",
        // Missing private_key
      });

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      iapConfig.initializeIapConfig();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Parsed GOOGLE_SERVICE_ACCOUNT is missing client_email or private_key"),
      );

      // Restore Jest environment
      if (originalJestWorker) {
        process.env.JEST_WORKER_ID = originalJestWorker;
      }
      consoleErrorSpy.mockRestore();
    });

    it("should handle production environment with missing GOOGLE_SERVICE_ACCOUNT", () => {
      // Override Jest detection temporarily
      const originalJestWorker = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;

      // Don't set GOOGLE_SERVICE_ACCOUNT

      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      iapConfig.initializeIapConfig();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("GOOGLE_SERVICE_ACCOUNT is missing in process.env"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("iapGoogleCredentials object is UNDEFINED"));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("finalGoogleServiceAccountForIap was also undefined"),
      );

      // Restore Jest environment
      if (originalJestWorker) {
        process.env.JEST_WORKER_ID = originalJestWorker;
      }
      consoleLogSpy.mockRestore();
    });

    it("should handle missing APPLE_SHARED_SECRET in non-Jest environment", () => {
      // Temporarily override Jest detection
      const originalJestWorker = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;

      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      iapConfig.initializeIapConfig();

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("[iapConfig] Missing APPLE_SHARED_SECRET"));

      // Restore Jest environment
      if (originalJestWorker) {
        process.env.JEST_WORKER_ID = originalJestWorker;
      }
      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it("should handle Jest environment without service account path", () => {
      // Ensure we're in Jest environment
      process.env.JEST_WORKER_ID = "1";

      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      iapConfig.initializeIapConfig();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("GOOGLE_SERVICE_ACCOUNT_JSON_PATH not set. This is okay for unit tests"),
      );

      consoleLogSpy.mockRestore();
    });

    it("should skip re-initialization when already initialized in non-Jest environment", () => {
      // Temporarily override Jest detection
      const originalJestWorker = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;

      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      // First initialization
      iapConfig.initializeIapConfig();

      // Clear the spy to check only the second call
      consoleLogSpy.mockClear();

      // Second initialization should be skipped
      iapConfig.initializeIapConfig();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Already initialized. Skipping re-initialization"),
      );

      // Restore Jest environment
      if (originalJestWorker) {
        process.env.JEST_WORKER_ID = originalJestWorker;
      }
      consoleLogSpy.mockRestore();
    });

    it("should handle credentials with partial configuration", () => {
      // Override Jest detection temporarily
      const originalJestWorker = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;

      process.env.GOOGLE_SERVICE_ACCOUNT = JSON.stringify({
        client_email: "partial@serviceaccount.com",
        // Missing private_key to test the undefined credentials path
      });

      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      iapConfig.initializeIapConfig();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("iapGoogleCredentials object is UNDEFINED"));
      // The specific log message may vary based on the exact configuration
      const logMessages = consoleLogSpy.mock.calls.map((call) => call[0]);
      const hasExpectedMessage = logMessages.some(
        (msg) =>
          msg?.toString().includes("Details of finalGoogleServiceAccountForIap") ||
          msg?.toString().includes("finalGoogleServiceAccountForIap was also undefined"),
      );
      expect(hasExpectedMessage).toBe(true);

      // Restore Jest environment
      if (originalJestWorker) {
        process.env.JEST_WORKER_ID = originalJestWorker;
      }
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});
