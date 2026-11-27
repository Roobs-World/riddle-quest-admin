import {HttpsError} from "firebase-functions/v2/https";

/** Provides mock complete authoritative game behavior. */
const mockCompleteAuthoritativeGame = jest.fn();
/** Provides mock on call behavior. */
const mockOnCall = jest.fn((_options: unknown, handler: unknown) => handler);
/** Provides mock run with jest account operation lease behavior. */
const mockRunWithJestAccountOperationLease = jest.fn(
  async (_userId: string, _timeoutSeconds: number, operation: () => Promise<unknown>) => operation(),
);

jest.mock("../shared/accountDeletion", () => ({
  ...jest.requireActual<typeof import("../shared/accountDeletion")>("../shared/accountDeletion"),
  runWithJestAccountOperationLease: mockRunWithJestAccountOperationLease,
}));

jest.mock("firebase-functions/v2/https", () => {
  /** Provides actual behavior. */
  const actual = jest.requireActual("firebase-functions/v2/https") as typeof import("firebase-functions/v2/https");
  return {HttpsError: actual.HttpsError, onCall: (...args: [unknown, unknown]) => mockOnCall(...args)};
});
jest.mock("../gameplay/sessions/completeGameLogic", () => ({
  completeAuthoritativeGame: (...args: unknown[]) => mockCompleteAuthoritativeGame(...args),
}));

import {completeGame} from "../gameplay/callables/completeGameCallable";

/** Provides response behavior. */
const response = {
  attempts: 2,
  isCorrect: true,
  coinsEarned: 10,
  newlyUnlockedAchievementIds: [],
  scoreEarned: 100,
  xpEarned: 20,
  newXp: 30,
  newLevel: 2,
  leveledUp: false,
};

describe("completeGame callable", () => {
  beforeEach(() => {
    mockCompleteAuthoritativeGame.mockReset();
    mockCompleteAuthoritativeGame.mockResolvedValue(response);
  });

  it("rejects unauthenticated completion attempts", async () => {
    await expect((completeGame as any)({auth: undefined, data: {}})).rejects.toThrow(
      new HttpsError("unauthenticated", "The function must be called while authenticated."),
    );
  });

  it.each([
    ["password", false],
    ["anonymous", true],
    [undefined, false],
  ])("runs one validated completion for %s identities", async (provider, isAnonymous) => {
    /** Provides data behavior. */
    const data = {
      riddleId: "riddle-1",
      gameMode: "classic",
      sessionToken: "00000000-0000-4000-8000-000000000001",
    };

    await expect(
      (completeGame as any)({
        auth: {uid: "user-1", token: provider === undefined ? {} : {firebase: {sign_in_provider: provider}}},
        data,
      }),
    ).resolves.toEqual(response);

    expect(mockCompleteAuthoritativeGame).toHaveBeenCalledWith(data, {uid: "user-1", isAnonymous});
  });

  it("rejects malformed completion payloads before persistence", async () => {
    await expect(
      (completeGame as any)({
        auth: {uid: "user-1", token: {}},
        data: {
          riddleId: "",
          gameMode: "classic",
          sessionToken: "00000000-0000-4000-8000-000000000001",
          attempts: 1,
          isCorrect: true,
        },
      }),
    ).rejects.toMatchObject({code: "invalid-argument"});
    expect(mockCompleteAuthoritativeGame).not.toHaveBeenCalled();
  });

  it("rejects forged client correctness and attempt fields", async () => {
    await expect(
      (completeGame as any)({
        auth: {uid: "user-1", token: {}},
        data: {
          riddleId: "riddle-1",
          gameMode: "classic",
          sessionToken: "00000000-0000-4000-8000-000000000001",
          attempts: 1,
          isCorrect: true,
        },
      }),
    ).rejects.toMatchObject({code: "invalid-argument"});
    expect(mockCompleteAuthoritativeGame).not.toHaveBeenCalled();
  });
});
