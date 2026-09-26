import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import {type CallableRequest, HttpsError} from "firebase-functions/v2/https";

/** Provides mock grant authoritative continue behavior. */
const mockGrantAuthoritativeContinue = jest.fn();
/** Provides mock get issued authoritative session behavior. */
const mockGetIssuedAuthoritativeSession = jest.fn();
/** Provides mock skip authoritative riddle behavior. */
const mockSkipAuthoritativeRiddle = jest.fn();
/** Provides mock trigger classic riddle generation if needed behavior. */
const mockTriggerClassicRiddleGenerationIfNeeded = jest.fn();
/** Provides mock run with jest account operation lease behavior. */
const mockRunWithJestAccountOperationLease = jest.fn(
  async (_userId: string, _timeoutSeconds: number, operation: () => Promise<unknown>) => operation(),
);

jest.mock("../jest/jestAccountDeletion", () => ({
  ...jest.requireActual<typeof import("../jest/jestAccountDeletion")>("../jest/jestAccountDeletion"),
  runWithJestAccountOperationLease: mockRunWithJestAccountOperationLease,
}));

jest.mock("../gameplay/singlePlayerSession", () => ({
  grantAuthoritativeContinue: (...args: unknown[]) => mockGrantAuthoritativeContinue(...args),
  getIssuedAuthoritativeSession: (...args: unknown[]) => mockGetIssuedAuthoritativeSession(...args),
  purchaseAuthoritativeHint: jest.fn(),
  skipAuthoritativeRiddle: (...args: unknown[]) => mockSkipAuthoritativeRiddle(...args),
}));

jest.mock("../riddles/riddleSupply", () => ({
  triggerClassicRiddleGenerationIfNeeded: (...args: unknown[]) => mockTriggerClassicRiddleGenerationIfNeeded(...args),
}));

jest.mock("firebase-functions/v2/https", () => {
  /** Provides actual behavior. */
  const actual = jest.requireActual("firebase-functions/v2/https") as typeof import("firebase-functions/v2/https");
  return {
    ...actual,
    onCall: jest.fn((optionsOrHandler: unknown, handler?: unknown) =>
      typeof optionsOrHandler === "function" ? optionsOrHandler : handler,
    ),
  };
});

import {skipRiddle, spendCoins} from "../gameplay/gameLogic";

/** Defines the session token value. */
const SESSION_TOKEN = "00000000-0000-4000-8000-000000000001";
/** Provides request behavior. */
const request = <T>(data: T, authenticated = true): CallableRequest<T> => ({
  data,
  auth: authenticated
    ? {uid: "player-1", token: {} as CallableRequest<T>["auth"] extends infer _ ? any : never}
    : undefined,
  rawRequest: {} as CallableRequest<T>["rawRequest"],
  acceptsStreaming: false,
});

describe("authoritative game economy callables", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGrantAuthoritativeContinue.mockResolvedValue(125);
    mockGetIssuedAuthoritativeSession.mockResolvedValue({locale: "fr"});
    mockSkipAuthoritativeRiddle.mockResolvedValue({
      newCoins: 100,
      newProgress: {classicIndex: 3, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
      costDeducted: 100,
    });
    mockTriggerClassicRiddleGenerationIfNeeded.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated continue requests", async () => {
    await expect(
      spendCoins(
        request(
          {
            reason: "continue" as const,
            gameMode: "classic" as const,
            riddleId: "classic-2",
            sessionToken: SESSION_TOKEN,
            requestId: "continue-request-1",
          },
          false,
        ),
      ),
    ).rejects.toMatchObject({code: "unauthenticated"});
  });

  it("rejects legacy unaffiliated hint and skip spending", async () => {
    for (const reason of ["hint", "skip"] as const) {
      await expect(spendCoins(request({reason}))).rejects.toMatchObject({
        code: "invalid-argument",
        message: "Invalid reason specified. Only 'continue' is supported.",
      });
    }
    expect(mockGrantAuthoritativeContinue).not.toHaveBeenCalled();
  });

  it("delegates paid continue to the idempotent session transaction", async () => {
    /** Provides result behavior. */
    const result = await spendCoins(
      request({
        reason: "continue" as const,
        gameMode: "challenge" as const,
        riddleId: "daily-2026-08-11",
        sessionToken: SESSION_TOKEN,
        requestId: "continue-request-1",
        amount: 100,
      }),
    );

    expect(result).toEqual({newCoins: 125});
    expect(mockGrantAuthoritativeContinue).toHaveBeenCalledWith(
      "player-1",
      "challenge",
      "daily-2026-08-11",
      "continue-request-1",
      SESSION_TOKEN,
    );
  });

  it("rejects a conflicting client-supplied continue cost", async () => {
    await expect(
      spendCoins(
        request({
          reason: "continue" as const,
          gameMode: "classic" as const,
          riddleId: "classic-2",
          sessionToken: SESSION_TOKEN,
          requestId: "continue-request-1",
          amount: 1,
        }),
      ),
    ).rejects.toMatchObject({code: "invalid-argument"});
    expect(mockGrantAuthoritativeContinue).not.toHaveBeenCalled();
  });

  it("delegates Classic skip to the session-bound transaction", async () => {
    /** Provides result behavior. */
    const result = await skipRiddle(
      request({
        riddleId: "classic-2",
        gameMode: "classic" as const,
        sessionToken: SESSION_TOKEN,
        requestId: "skip-request-1",
      }),
    );

    expect(result).toMatchObject({success: true, costDeducted: 100, newCoins: 100});
    expect(mockGetIssuedAuthoritativeSession).toHaveBeenCalledWith("player-1", SESSION_TOKEN, "classic", "classic-2");
    expect(mockSkipAuthoritativeRiddle).toHaveBeenCalledWith("player-1", {
      riddleId: "classic-2",
      gameMode: "classic",
      sessionToken: SESSION_TOKEN,
      requestId: "skip-request-1",
    });
  });

  it("rejects Daily skip before invoking any transaction", async () => {
    await expect(
      skipRiddle(
        request({
          riddleId: "daily-2026-08-11",
          gameMode: "challenge" as const,
          sessionToken: SESSION_TOKEN,
          requestId: "skip-request-1",
        }),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<HttpsError>>({
        code: "failed-precondition",
      }),
    );
    expect(mockSkipAuthoritativeRiddle).not.toHaveBeenCalled();
  });
});
