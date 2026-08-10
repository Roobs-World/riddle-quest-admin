import {HttpsError} from "firebase-functions/v2/https";

const mockHandleCompleteGameLogic = jest.fn();
const mockRunGameCompletionOnce = jest.fn();
const mockOnCall = jest.fn((_options: unknown, handler: unknown) => handler);

jest.mock("firebase-functions/v2/https", () => {
  const actual = jest.requireActual("firebase-functions/v2/https") as typeof import("firebase-functions/v2/https");
  return {HttpsError: actual.HttpsError, onCall: (...args: [unknown, unknown]) => mockOnCall(...args)};
});
jest.mock("../gameplay/submitGuessLogic", () => ({
  handleCompleteGameLogic: (...args: unknown[]) => mockHandleCompleteGameLogic(...args),
}));
jest.mock("../gameplay/gameCompletionGuard", () => ({
  runGameCompletionOnce: (...args: unknown[]) => mockRunGameCompletionOnce(...args),
}));

import {completeGame} from "../gameplay/completeGameCallable";

const response = {
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
    mockHandleCompleteGameLogic.mockReset();
    mockRunGameCompletionOnce.mockReset();
    mockHandleCompleteGameLogic.mockResolvedValue(response);
    mockRunGameCompletionOnce.mockImplementation(async (
      _uid: string,
      _mode: string,
      _riddleId: string,
      operation: () => Promise<unknown>,
    ) => operation());
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
    const data = {riddleId: "riddle-1", gameMode: "classic", attempts: 2, isCorrect: true};

    await expect((completeGame as any)({
      auth: {uid: "user-1", token: provider === undefined ? {} : {firebase: {sign_in_provider: provider}}},
      data,
    })).resolves.toEqual(response);

    expect(mockRunGameCompletionOnce).toHaveBeenCalledWith(
      "user-1",
      "classic",
      "riddle-1",
      expect.any(Function),
    );
    expect(mockHandleCompleteGameLogic).toHaveBeenCalledWith(data, {uid: "user-1", isAnonymous});
  });

  it("rejects malformed completion payloads before persistence", async () => {
    await expect((completeGame as any)({
      auth: {uid: "user-1", token: {}},
      data: {riddleId: "", gameMode: "classic", attempts: 0, isCorrect: true},
    })).rejects.toMatchObject({code: "invalid-argument"});
    expect(mockRunGameCompletionOnce).not.toHaveBeenCalled();
  });
});
