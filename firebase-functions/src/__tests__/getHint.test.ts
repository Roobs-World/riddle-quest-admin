import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import {HttpsError} from "firebase-functions/v2/https";

/** Provides mock purchase authoritative hint behavior. */
const mockPurchaseAuthoritativeHint = jest.fn();
/** Provides mock run with jest account operation lease behavior. */
const mockRunWithJestAccountOperationLease = jest.fn(
  async (_userId: string, _timeoutSeconds: number, operation: () => Promise<unknown>) => operation(),
);

jest.mock("../jest/jestAccountDeletion", () => ({
  ...jest.requireActual<typeof import("../jest/jestAccountDeletion")>("../jest/jestAccountDeletion"),
  runWithJestAccountOperationLease: mockRunWithJestAccountOperationLease,
}));

jest.mock("firebase-functions/v2/https", () => {
  /** Provides actual behavior. */
  const actual = jest.requireActual("firebase-functions/v2/https") as typeof import("firebase-functions/v2/https");
  return {
    HttpsError: actual.HttpsError,
    onCall: jest.fn((_options: unknown, handler: unknown) => handler),
  };
});
jest.mock("../gameplay/singlePlayerSession", () => ({
  purchaseAuthoritativeHint: (...args: unknown[]) => mockPurchaseAuthoritativeHint(...args),
  getIssuedAuthoritativeSession: jest.fn(),
  grantAuthoritativeContinue: jest.fn(),
  skipAuthoritativeRiddle: jest.fn(),
}));
jest.mock("../gameplay/firestoreService", () => ({
  getUser: jest.fn(),
  updateUserCoins: jest.fn(),
}));
jest.mock("../riddles/riddleSupply", () => ({triggerClassicRiddleGenerationIfNeeded: jest.fn()}));

import {getHint} from "../gameplay/gameLogic";

/** Provides data behavior. */
const data = {
  riddleId: "rid-1",
  gameMode: "classic" as const,
  sessionToken: "00000000-0000-4000-8000-000000000001",
  requestId: "hint-request-0001",
  currentAttempt: ["a", "p", "p", "z", "z"],
};

describe("getHint callable", () => {
  beforeEach(() => jest.clearAllMocks());

  it("delegates a validated session-bound idempotent hint request", async () => {
    mockPurchaseAuthoritativeHint.mockResolvedValue({
      revealedLetter: "L",
      index: 3,
      coinsCost: 50,
      newCoins: 150,
      newlyUnlockedAchievementIds: ["hint_user"],
    });

    await expect((getHint as any)({auth: {uid: "user123"}, data})).resolves.toMatchObject({
      revealedLetter: "L",
      index: 3,
      newCoins: 150,
    });
    expect(mockPurchaseAuthoritativeHint).toHaveBeenCalledWith("user123", data);
  });

  it("rejects missing session and request identities before charging", async () => {
    await expect(
      (getHint as any)({
        auth: {uid: "user123"},
        data: {riddleId: "rid-1", gameMode: "classic", currentAttempt: []},
      }),
    ).rejects.toMatchObject({code: "invalid-argument"});
    expect(mockPurchaseAuthoritativeHint).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    await expect((getHint as any)({auth: undefined, data})).rejects.toThrow(HttpsError);
  });
});
