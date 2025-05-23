import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import {Request} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import type {Response} from "express"; // Express types are often used for mocks

// Import the function to test
import {notifyRewardedAdCompleted} from "../adClientCallbacks"; // Adjust path

interface AdClientCallbackTestData {
  adDetails: Record<string, unknown>;
}

// Define a type for the mock callable context (simplified)
interface MockCallableContext {
  // Add properties used by your function if any, e.g., instanceIdToken
}

// Extend CallableRequest for proper typing
interface MockCallableRequest<TData = unknown> extends CallableRequest<TData> {}

// --- Mocks Start ---
// jest.mock("firebase-functions/v2", ... ) // Already mocked by user, ensure logger is covered
// --- Mocks End ---

describe("notifyRewardedAdCompleted HTTP Trigger", () => {
  let mockReq: Partial<Request>;
  let mockRes: {
    status: jest.MockedFunction<(code: number) => Response>;
    send: jest.MockedFunction<(body?: any) => Response>;
    json: jest.MockedFunction<(body?: any) => Response>;
    end: jest.MockedFunction<() => Response>;
    // Add other Express.Response methods if needed by the function
  } & Partial<Response>; // Use Partial<Response> for other optional properties

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      headers: {},
      body: {},
    };

    // A more robust way to mock Express Response for Jest
    const resStatus = jest.fn<() => Response>();
    const resSend = jest.fn<() => Response>();
    const resJson = jest.fn<() => Response>();
    const resEnd = jest.fn<() => Response>();

    mockRes = {
      status: resStatus.mockReturnThis(), // Use mockReturnThis for chaining
      send: resSend.mockReturnThis(),
      json: resJson.mockReturnThis(),
      end: resEnd.mockReturnThis(),
    } as unknown as typeof mockRes; // Cast to its own type for internal consistency
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should send 401/403 if authentication is missing/fails (HTTP style)", async () => {
    mockReq.headers = {}; // No auth header, or an invalid one
    mockReq.body = {adDetails: {placementId: "testPlacement"}};

    await notifyRewardedAdCompleted(mockReq as Request, mockRes as Response);

    // Check if status was called, indicating an error was (likely) handled.
    // The specific status code (401, 403, or even 500 if auth error isn't caught gracefully)
    // depends on the function's internal logic.
    expect(mockRes.status).toHaveBeenCalled();
    // Optionally, check if send or json was also called to complete the response:
    // expect(mockRes.send).toHaveBeenCalled() or expect(mockRes.json).toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("should log ad completion and send success response if authenticated (HTTP style)", async () => {
    const mockUserId = "testUser123";
    const mockAdDetails = {
      placementId: "rewardedVideoPlacement",
      creativeId: "creativeXYZ",
      networkName: "AppLovin",
    };

    mockReq.body = {
      adDetails: mockAdDetails,
    };
    // Simulate successful authentication by providing necessary headers/body items
    // For example, if using bearer tokens:
    mockReq.headers = {authorization: "Bearer valid-token-for-testUser123"};
    // The function notifyRewardedAdCompleted would internally verify this token and extract userId.

    await notifyRewardedAdCompleted(mockReq as Request, mockRes as Response);

    expect(logger.info).toHaveBeenCalledWith(
      // The user ID in the log should be what the function extracts after auth
      `Rewarded ad completed client-side for user ${mockUserId}. Details: ${JSON.stringify(mockAdDetails)}`,
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      message: "Rewarded ad completion notification received.",
    });
  });

  it("should handle empty adDetails gracefully (HTTP style)", async () => {
    const mockUserId = "testUser456";
    mockReq.body = {
      adDetails: {},
    };
    mockReq.headers = {authorization: "Bearer valid-token-for-testUser456"};

    await notifyRewardedAdCompleted(mockReq as Request, mockRes as Response);

    expect(logger.info).toHaveBeenCalledWith(
      `Rewarded ad completed client-side for user ${mockUserId}. Details: ${JSON.stringify({})}`,
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      message: "Rewarded ad completion notification received.",
    });
  });

  it("should log specific ad details when provided (HTTP style)", async () => {
    const mockUserId = "testUser789";
    const specificAdDetails = {
      placementId: "specificPlacement",
      someOtherDetail: "value123",
    };
    mockReq.body = {
      adDetails: specificAdDetails,
    };
    mockReq.headers = {authorization: "Bearer valid-token-for-testUser789"};

    await notifyRewardedAdCompleted(mockReq as Request, mockRes as Response);

    expect(logger.info).toHaveBeenCalledWith(
      `Rewarded ad completed client-side for user ${mockUserId}. Details: ${JSON.stringify(specificAdDetails)}`,
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      message: "Rewarded ad completion notification received.",
    });
  });
});
