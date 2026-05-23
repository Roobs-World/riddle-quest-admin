/**
 * @fileoverview Unit tests for featureFlags configuration.
 *
 * Tests feature flag functionality including version checking
 * and environment variable handling.
 */

// Store original env
const originalEnv = process.env;

// Mock React Native Platform before any imports
jest.mock("react-native", () => ({
  Platform: {
    constants: {
      reactNativeVersion: {
        major: 0,
        minor: 84,
        patch: 0,
      },
    },
  },
}));

describe("featureFlags", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("featureFlags.sharedAnimationBackendExperimental", () => {
    it("should be false when env var is not set", () => {
      delete process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND;

      const { featureFlags } = require("../featureFlags");

      expect(featureFlags.sharedAnimationBackendExperimental).toBe(false);
    });

    it('should be true when env var is "true"', () => {
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      const { featureFlags } = require("../featureFlags");

      expect(featureFlags.sharedAnimationBackendExperimental).toBe(true);
    });

    it('should be false when env var is "false"', () => {
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "false";

      const { featureFlags } = require("../featureFlags");

      expect(featureFlags.sharedAnimationBackendExperimental).toBe(false);
    });

    it("should be false when env var has other value", () => {
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "yes";

      const { featureFlags } = require("../featureFlags");

      expect(featureFlags.sharedAnimationBackendExperimental).toBe(false);
    });

    it("should be false when env var is empty string", () => {
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "";

      const { featureFlags } = require("../featureFlags");

      expect(featureFlags.sharedAnimationBackendExperimental).toBe(false);
    });
  });

  describe("isSharedAnimationBackendFlagRequested", () => {
    it("should return false when flag is not requested", () => {
      delete process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND;

      const { isSharedAnimationBackendFlagRequested } = require("../featureFlags");

      expect(isSharedAnimationBackendFlagRequested()).toBe(false);
    });

    it("should return true when flag is requested", () => {
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      const { isSharedAnimationBackendFlagRequested } = require("../featureFlags");

      expect(isSharedAnimationBackendFlagRequested()).toBe(true);
    });
  });

  describe("isSharedAnimationBackendEnabled", () => {
    it("should return false when flag is not set", () => {
      delete process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND;

      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(false);
    });

    it("should return false when flag is true but version is too low (0.84.0)", () => {
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      // Reset module with version 0.84.0 already set in mock
      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(false);
    });
  });

  describe("version checking - isRn0851OrHigher", () => {
    // These tests require re-mocking Platform with different versions

    it("should return true for version 0.85.1", () => {
      jest.resetModules();
      jest.doMock("react-native", () => ({
        Platform: {
          constants: {
            reactNativeVersion: {
              major: 0,
              minor: 85,
              patch: 1,
            },
          },
        },
      }));
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(true);
    });

    it("should return true for version 0.85.2 (higher patch)", () => {
      jest.resetModules();
      jest.doMock("react-native", () => ({
        Platform: {
          constants: {
            reactNativeVersion: {
              major: 0,
              minor: 85,
              patch: 2,
            },
          },
        },
      }));
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(true);
    });

    it("should return true for version 0.86.0 (higher minor)", () => {
      jest.resetModules();
      jest.doMock("react-native", () => ({
        Platform: {
          constants: {
            reactNativeVersion: {
              major: 0,
              minor: 86,
              patch: 0,
            },
          },
        },
      }));
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(true);
    });

    it("should return true for version 1.0.0 (higher major)", () => {
      jest.resetModules();
      jest.doMock("react-native", () => ({
        Platform: {
          constants: {
            reactNativeVersion: {
              major: 1,
              minor: 0,
              patch: 0,
            },
          },
        },
      }));
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(true);
    });

    it("should return false for version 0.85.0 (lower patch)", () => {
      jest.resetModules();
      jest.doMock("react-native", () => ({
        Platform: {
          constants: {
            reactNativeVersion: {
              major: 0,
              minor: 85,
              patch: 0,
            },
          },
        },
      }));
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(false);
    });

    it("should return false for version 0.84.5 (lower minor)", () => {
      jest.resetModules();
      jest.doMock("react-native", () => ({
        Platform: {
          constants: {
            reactNativeVersion: {
              major: 0,
              minor: 84,
              patch: 5,
            },
          },
        },
      }));
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(false);
    });

    it("should handle missing reactNativeVersion gracefully", () => {
      jest.resetModules();
      jest.doMock("react-native", () => ({
        Platform: {
          constants: {},
        },
      }));
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(false);
    });

    it("should handle missing constants gracefully", () => {
      jest.resetModules();
      jest.doMock("react-native", () => ({
        Platform: {},
      }));
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(false);
    });

    it("should handle partial version object", () => {
      jest.resetModules();
      jest.doMock("react-native", () => ({
        Platform: {
          constants: {
            reactNativeVersion: {
              major: 0,
              // missing minor and patch
            },
          },
        },
      }));
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(false);
    });

    it("should handle null version values", () => {
      jest.resetModules();
      jest.doMock("react-native", () => ({
        Platform: {
          constants: {
            reactNativeVersion: {
              major: null,
              minor: null,
              patch: null,
            },
          },
        },
      }));
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(false);
    });
  });

  describe("combined flag and version behavior", () => {
    it("should return false when flag is false even if version is high enough", () => {
      jest.resetModules();
      jest.doMock("react-native", () => ({
        Platform: {
          constants: {
            reactNativeVersion: {
              major: 0,
              minor: 85,
              patch: 1,
            },
          },
        },
      }));
      delete process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND;

      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(false);
    });

    it("should return false when version is too low even if flag is true", () => {
      jest.resetModules();
      jest.doMock("react-native", () => ({
        Platform: {
          constants: {
            reactNativeVersion: {
              major: 0,
              minor: 80,
              patch: 0,
            },
          },
        },
      }));
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(false);
    });

    it("should return true only when both conditions are met", () => {
      jest.resetModules();
      jest.doMock("react-native", () => ({
        Platform: {
          constants: {
            reactNativeVersion: {
              major: 0,
              minor: 85,
              patch: 1,
            },
          },
        },
      }));
      process.env.EXPO_PUBLIC_ENABLE_SHARED_ANIMATION_BACKEND = "true";

      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(isSharedAnimationBackendEnabled()).toBe(true);
    });
  });

  describe("featureFlags object structure", () => {
    it("should export featureFlags as an object", () => {
      const { featureFlags } = require("../featureFlags");

      expect(typeof featureFlags).toBe("object");
      expect(featureFlags).not.toBeNull();
    });

    it("should have sharedAnimationBackendExperimental property", () => {
      const { featureFlags } = require("../featureFlags");

      expect(featureFlags).toHaveProperty("sharedAnimationBackendExperimental");
      expect(typeof featureFlags.sharedAnimationBackendExperimental).toBe(
        "boolean"
      );
    });
  });

  describe("exported functions", () => {
    it("should export isSharedAnimationBackendEnabled as a function", () => {
      const { isSharedAnimationBackendEnabled } = require("../featureFlags");

      expect(typeof isSharedAnimationBackendEnabled).toBe("function");
    });

    it("should export isSharedAnimationBackendFlagRequested as a function", () => {
      const { isSharedAnimationBackendFlagRequested } = require("../featureFlags");

      expect(typeof isSharedAnimationBackendFlagRequested).toBe("function");
    });
  });
});
