const mockGetUser = jest.fn();
const mockFinalizeAuthoritativeSession = jest.fn();

jest.mock("../gameplay/firestoreService", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  ensureUserDocumentComplete: jest.fn(),
  updateUserCoins: jest.fn(),
  updateUserStats: jest.fn(),
}));
jest.mock("../gameplay/singlePlayerSession", () => ({
  finalizeAuthoritativeSession: (...args: unknown[]) => mockFinalizeAuthoritativeSession(...args),
}));
jest.mock("../gameplay/achievements", () => ({evaluateAchievements: jest.fn()}));
jest.mock("../gameplay/leaderboard", () => ({updateLeaderboardEntry: jest.fn()}));
jest.mock("../riddles/riddleSupply", () => ({triggerClassicRiddleGenerationIfNeeded: jest.fn()}));

import {deriveAuthoritativeCompletion} from "../gameplay/completeGameLogic";

describe("secure game completion derivation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({preferredLanguage: "en"});
  });

  it("derives a win and attempt count from canonical riddle plus server state", async () => {
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 3,
      lastGuess: "PIANO",
      isCorrect: false,
      terminal: true,
      answer: "piano",
      locale: "en",
      completionKey: "classic:1",
      classicIndex: 1,
    });

    await expect(deriveAuthoritativeCompletion(
      {
        riddleId: "riddle-1",
        gameMode: "classic",
        sessionToken: "00000000-0000-4000-8000-000000000001",
      },
      {uid: "user-1"},
    )).resolves.toEqual({
      riddleId: "riddle-1",
      gameMode: "classic",
      sessionToken: "00000000-0000-4000-8000-000000000001",
      attempts: 3,
      isCorrect: true,
      completionKey: "classic:1",
      entitlementCompletionKey: "classic:1",
      locale: "en",
      classicIndex: 1,
    });
  });

  it("does not trust a stale stored correctness flag", async () => {
    mockFinalizeAuthoritativeSession.mockResolvedValue({
      attempts: 5,
      lastGuess: "crane",
      isCorrect: true,
      terminal: true,
      answer: "piano",
      locale: "fr",
      completionKey: "challenge:2026-08-11",
      challengeDate: "2026-08-11",
    });

    await expect(deriveAuthoritativeCompletion(
      {
        riddleId: "riddle-1",
        gameMode: "challenge",
        sessionToken: "00000000-0000-4000-8000-000000000001",
      },
      {uid: "user-1"},
    )).resolves.toMatchObject({attempts: 5, isCorrect: false});
  });
});
