/**
 * Tests for installGlobalErrorLogging utility
 *
 * This module wraps console.error to log stack traces and hooks into
 * React Native's ErrorUtils for global error handling in development.
 */

// Store original console.error before any mocking
const originalConsoleError = console.error;

describe("installGlobalErrorLogging", () => {
  // Track module state between tests
  let installGlobalErrorLogging: () => void;

  // Mock global state
  let mockErrorUtils: {
    getGlobalHandler: jest.Mock;
    setGlobalHandler: jest.Mock;
  };
  let mockPreviousHandler: jest.Mock;

  beforeEach(() => {
    // Reset module cache to test fresh installations
    jest.resetModules();

    // Reset __DEV__ to true for tests
    (global as any).__DEV__ = true;

    // Setup mock ErrorUtils
    mockPreviousHandler = jest.fn();
    mockErrorUtils = {
      getGlobalHandler: jest.fn(() => mockPreviousHandler),
      setGlobalHandler: jest.fn(),
    };

    // Clear ErrorUtils on globalThis
    (globalThis as any).ErrorUtils = undefined;

    // Restore original console.error
    console.error = originalConsoleError;

    // Re-import the module for fresh state
    installGlobalErrorLogging =
      require("../installGlobalErrorLogging").installGlobalErrorLogging;
  });

  afterEach(() => {
    // Cleanup
    (globalThis as any).ErrorUtils = undefined;
    console.error = originalConsoleError;
    jest.clearAllMocks();
  });

  describe("Installation Guard", () => {
    it("should not install in production mode (__DEV__ = false)", () => {
      (global as any).__DEV__ = false;

      // Re-import with __DEV__ = false
      jest.resetModules();
      const { installGlobalErrorLogging: freshInstall } = require("../installGlobalErrorLogging");

      const originalError = console.error;
      freshInstall();

      // console.error should not be modified
      expect(console.error).toBe(originalError);
    });

    it("should only install once when called multiple times", () => {
      const wrapperBefore = console.error;

      installGlobalErrorLogging();
      const wrapperAfter = console.error;

      // First call should wrap console.error
      expect(wrapperAfter).not.toBe(wrapperBefore);

      // Second call should not re-wrap
      installGlobalErrorLogging();
      expect(console.error).toBe(wrapperAfter);
    });
  });

  describe("Console Error Wrapping", () => {
    it("should wrap console.error", () => {
      const originalError = console.error;

      installGlobalErrorLogging();

      expect(console.error).not.toBe(originalError);
    });

    it("should call original console.error with all arguments", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      installGlobalErrorLogging();
      console.error("test", "message", 123);

      expect(mockConsoleError).toHaveBeenCalledWith("test", "message", 123);
    });

    it("should log stack trace when first argument is an Error with stack", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      installGlobalErrorLogging();

      const testError = new Error("Test error");
      testError.stack = "Error: Test error\n    at test.ts:1:1";

      console.error(testError);

      // Should be called twice: once with the error, once with the stack
      expect(mockConsoleError).toHaveBeenCalledTimes(2);
      expect(mockConsoleError).toHaveBeenNthCalledWith(1, testError);
      expect(mockConsoleError).toHaveBeenNthCalledWith(
        2,
        "[debug:error-stack]",
        testError.stack
      );
    });

    it("should not log stack when first argument is not an Error", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      installGlobalErrorLogging();
      console.error("just a string");

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith("just a string");
    });

    it("should not log stack when Error has no stack property", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      installGlobalErrorLogging();

      const errorWithoutStack = new Error("No stack");
      (errorWithoutStack as any).stack = undefined;

      console.error(errorWithoutStack);

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
    });

    it("should handle null first argument", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      installGlobalErrorLogging();
      console.error(null);

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith(null);
    });

    it("should handle undefined first argument", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      installGlobalErrorLogging();
      console.error(undefined);

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith(undefined);
    });

    it("should handle empty arguments", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      installGlobalErrorLogging();
      console.error();

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith();
    });
  });

  describe("ErrorUtils Integration", () => {
    it("should set global handler when ErrorUtils is available", () => {
      (globalThis as any).ErrorUtils = mockErrorUtils;

      installGlobalErrorLogging();

      expect(mockErrorUtils.setGlobalHandler).toHaveBeenCalledTimes(1);
      expect(mockErrorUtils.setGlobalHandler).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it("should not set global handler when ErrorUtils is undefined", () => {
      (globalThis as any).ErrorUtils = undefined;

      expect(() => {
        installGlobalErrorLogging();
      }).not.toThrow();
    });

    it("should not set global handler when setGlobalHandler is missing", () => {
      (globalThis as any).ErrorUtils = {
        getGlobalHandler: jest.fn(),
        // setGlobalHandler is missing
      };

      expect(() => {
        installGlobalErrorLogging();
      }).not.toThrow();
    });

    it("should retrieve previous handler via getGlobalHandler", () => {
      (globalThis as any).ErrorUtils = mockErrorUtils;

      installGlobalErrorLogging();

      expect(mockErrorUtils.getGlobalHandler).toHaveBeenCalledTimes(1);
    });

    it("should handle missing getGlobalHandler gracefully", () => {
      (globalThis as any).ErrorUtils = {
        setGlobalHandler: jest.fn(),
        // getGlobalHandler is missing
      };

      expect(() => {
        installGlobalErrorLogging();
      }).not.toThrow();
    });
  });

  describe("Global Error Handler Behavior", () => {
    it("should log error details to console", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      (globalThis as any).ErrorUtils = mockErrorUtils;

      installGlobalErrorLogging();

      // Get the handler that was set
      const setHandler = mockErrorUtils.setGlobalHandler.mock.calls[0][0];

      const testError = new Error("Global test error");
      testError.stack = "Error: Global test error\n    at global.ts:1:1";

      setHandler(testError, true);

      // Check that error details were logged
      expect(mockConsoleError).toHaveBeenCalledWith(
        "[debug:global-error]",
        expect.objectContaining({
          message: "Global test error",
          name: "Error",
          stack: testError.stack,
          isFatal: true,
        })
      );
    });

    it("should call previous handler when it exists", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      (globalThis as any).ErrorUtils = mockErrorUtils;

      installGlobalErrorLogging();

      const setHandler = mockErrorUtils.setGlobalHandler.mock.calls[0][0];

      const testError = new Error("Test error");
      setHandler(testError, false);

      expect(mockPreviousHandler).toHaveBeenCalledWith(testError, false);
    });

    it("should handle isFatal=false correctly", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      (globalThis as any).ErrorUtils = mockErrorUtils;

      installGlobalErrorLogging();

      const setHandler = mockErrorUtils.setGlobalHandler.mock.calls[0][0];

      const testError = new Error("Non-fatal error");
      setHandler(testError, false);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[debug:global-error]",
        expect.objectContaining({
          isFatal: false,
        })
      );
    });

    it("should handle undefined isFatal parameter", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      (globalThis as any).ErrorUtils = mockErrorUtils;

      installGlobalErrorLogging();

      const setHandler = mockErrorUtils.setGlobalHandler.mock.calls[0][0];

      const testError = new Error("Error with undefined fatal");
      setHandler(testError, undefined);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[debug:global-error]",
        expect.objectContaining({
          isFatal: false, // !!undefined = false
        })
      );
    });

    it("should handle error without message property", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      (globalThis as any).ErrorUtils = mockErrorUtils;

      installGlobalErrorLogging();

      const setHandler = mockErrorUtils.setGlobalHandler.mock.calls[0][0];

      const customError = {} as Error;
      setHandler(customError, true);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[debug:global-error]",
        expect.objectContaining({
          message: undefined,
        })
      );
    });

    it("should not call previous handler when it is not a function", () => {
      const mockErrorUtilsNoPrevious = {
        getGlobalHandler: jest.fn(() => undefined),
        setGlobalHandler: jest.fn(),
      };

      (globalThis as any).ErrorUtils = mockErrorUtilsNoPrevious;

      installGlobalErrorLogging();

      const setHandler = mockErrorUtilsNoPrevious.setGlobalHandler.mock.calls[0][0];

      // Should not throw when previous handler is undefined
      expect(() => {
        setHandler(new Error("Test"), true);
      }).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("should handle Error subclasses", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      installGlobalErrorLogging();

      class CustomError extends Error {
        code: string;
        constructor(message: string, code: string) {
          super(message);
          this.name = "CustomError";
          this.code = code;
        }
      }

      const customError = new CustomError("Custom error message", "ERR_001");

      console.error(customError);

      expect(mockConsoleError).toHaveBeenCalledTimes(2);
      expect(mockConsoleError).toHaveBeenNthCalledWith(1, customError);
    });

    it("should handle TypeError instances", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      installGlobalErrorLogging();

      const typeError = new TypeError("Type error message");
      console.error(typeError);

      expect(mockConsoleError).toHaveBeenCalledTimes(2);
    });

    it("should handle SyntaxError instances", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      installGlobalErrorLogging();

      const syntaxError = new SyntaxError("Syntax error message");
      console.error(syntaxError);

      expect(mockConsoleError).toHaveBeenCalledTimes(2);
    });

    it("should handle mixed argument types", () => {
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      installGlobalErrorLogging();

      console.error("prefix", new Error("error"), { key: "value" }, 123);

      // Only called once since first arg is not an Error
      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        "prefix",
        expect.any(Error),
        { key: "value" },
        123
      );
    });
  });
});
