import {describe, expect, jest, beforeEach, afterEach} from "@jest/globals";
import {CallableRequest, HttpsError} from "firebase-functions/v2/https";

// Initialize all mock functions before any imports to ensure proper hoisting
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();

// Mock firebase-functions/v2 for logger
jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

interface MockOnCallHandler {
  (handler: unknown): unknown;
}

// Also mock the https module to make sure onCall works correctly
jest.mock("firebase-functions/v2/https", () => {
  const actualHttps = jest.requireActual("firebase-functions/v2/https") as typeof import("firebase-functions/v2/https");
  return {
    ...actualHttps,
    onCall: jest.fn((handler: unknown) => handler) as MockOnCallHandler, // Simple passthrough for testing
  };
});

// Import after mocks are set up
const {notifyRewardedAdCompleted} = require("../adClientCallbacks");

interface RewardedAdCompletionData {
  adDetails?: {
    placementId?: string;
    creativeId?: string;
    networkName?: string;
    [key: string]: unknown;
  };
}

describe("notifyRewardedAdCompleted Callable Function", () => {
  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should throw HttpsError if called unauthenticated", async () => {
    const mockRequest = {
      auth: undefined,
      data: {
        adDetails: {
          placementId: "defaultPlacement",
        },
      },
    } as unknown as CallableRequest<RewardedAdCompletionData>;

    await expect(notifyRewardedAdCompleted(mockRequest)).rejects.toThrow(
      new HttpsError("unauthenticated", "The function must be called while authenticated."),
    );
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  it("should log ad completion and return success if authenticated with adDetails", async () => {
    const mockUserId = "testUser123";
    const mockAdDetails = {
      placementId: "rewardedVideoPlacement",
      creativeId: "creativeXYZ",
      networkName: "AppLovin",
    };

    const mockRequest = {
      auth: {uid: mockUserId, token: {} as Record<string, unknown>},
      data: {adDetails: mockAdDetails},
    } as unknown as CallableRequest<RewardedAdCompletionData>;

    const result = await notifyRewardedAdCompleted(mockRequest);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      `Rewarded ad completed client-side for user ${mockUserId}. Details: ${JSON.stringify(mockAdDetails)}`,
    );
    expect(result).toEqual({
      success: true,
      message: "Ad completion received. Reward will be credited once validated.",
      pendingValidation: true,
    });
  });

  it("should handle empty adDetails gracefully if authenticated", async () => {
    const mockUserId = "testUser456";
    const mockRequest = {
      auth: {uid: mockUserId, token: {} as Record<string, unknown>},
      data: {adDetails: {}},
    } as unknown as CallableRequest<RewardedAdCompletionData>;

    const result = await notifyRewardedAdCompleted(mockRequest);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      `Rewarded ad completed client-side for user ${mockUserId}. Details: ${JSON.stringify({})}`,
    );
    expect(result).toEqual({
      success: true,
      message: "Ad completion received. Reward will be credited once validated.",
      pendingValidation: true,
    });
  });

  it("should log specific ad details when provided if authenticated", async () => {
    const mockUserId = "testUser789";
    const specificAdDetails = {
      placementId: "specificPlacement",
      someOtherDetail: "value123",
    };

    const mockRequest = {
      auth: {uid: mockUserId, token: {} as Record<string, unknown>},
      data: {adDetails: specificAdDetails},
    } as unknown as CallableRequest<RewardedAdCompletionData>;

    const result = await notifyRewardedAdCompleted(mockRequest);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      `Rewarded ad completed client-side for user ${mockUserId}. Details: ${JSON.stringify(specificAdDetails)}`,
    );
    expect(result).toEqual({
      success: true,
      message: "Ad completion received. Reward will be credited once validated.",
      pendingValidation: true,
    });
  });

  it("should process successfully if adDetails are missing in request.data and auth is present", async () => {
    const mockRequest = {
      auth: {uid: "testUserNoDetails", token: {} as Record<string, unknown>},
      data: {},
    } as unknown as CallableRequest<RewardedAdCompletionData>;

    const result = await notifyRewardedAdCompleted(mockRequest);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      `Rewarded ad completed client-side for user testUserNoDetails. Details: undefined`,
    );
    expect(result).toEqual({
      success: true,
      message: "Ad completion received. Reward will be credited once validated.",
      pendingValidation: true,
    });
  });
});
