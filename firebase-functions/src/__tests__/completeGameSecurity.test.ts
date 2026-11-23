/** Provides mock get user behavior. */
const mockGetUser = jest.fn();
/** Provides mock finalize authoritative session behavior. */
const mockFinalizeAuthoritativeSession = jest.fn();

jest.mock("../gameplay/firestoreService", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  prepareUserDocumentCompletion: jest.requireActual<typeof import("../gameplay/firestoreService")>("../gameplay/firestoreService").prepareUserDocumentCompletion,
  updateUserCoins: jest.fn(),
  updateUserStats: jest.fn(),
}));
jest.mock("../gameplay/sessions/singlePlayerSession", () => ({
  finalizeAuthoritativeSession: (...args: unknown[]) => mockFinalizeAuthoritativeSession(...args),
}));
jest.mock("../gameplay/achievements", () => ({evaluateAchievements: jest.fn()}));
jest.mock("../gameplay/leaderboard", () => ({updateLeaderboardEntry: jest.fn()}));
jest.mock("../riddles/riddleSupply", () => ({triggerClassicRiddleGenerationIfNeeded: jest.fn()}));

import {deriveAuthoritativeCompletion} from "../gameplay/sessions/completeGameLogic";

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

    await expect(
      deriveAuthoritativeCompletion(
        {
          riddleId: "riddle-1",
          gameMode: "classic",
          sessionToken: "00000000-0000-4000-8000-000000000001",
        },
        {uid: "user-1"},
      ),
    ).resolves.toEqual({
      riddleId: "riddle-1",
      gameMode: "classic",
      sessionToken: "00000000-0000-4000-8000-000000000001",
      attempts: 3,
      difficultyBand: "easy",
      isCorrect: true,
      completionKey: "classic:1",
      entitlementCompletionKey: "classic:1",
      locale: "en",
      classicIndex: 1,
    });
  });

  it("ignores caller difficulty and uses only the private session snapshot", async () => {
    /** Private server snapshot without authored difficulty, representing a legacy session. */
    const state = {attempts: 2, lastGuess: "piano", answer: "piano", locale: "en", completionKey: "classic:1", classicIndex: 1};
    /** Forged difficulty is deliberately supplied alongside an otherwise valid completion. */
    const request = {riddleId: "riddle-1", gameMode: "classic" as const, sessionToken: "00000000-0000-4000-8000-000000000001", difficultyBand: "hard"};
    mockFinalizeAuthoritativeSession.mockResolvedValue(state);
    await expect(deriveAuthoritativeCompletion(request, {uid: "user-1"})).resolves.toMatchObject({difficultyBand: "easy"});
    mockFinalizeAuthoritativeSession.mockResolvedValue({...state, difficultyBand: "medium"});
    await expect(deriveAuthoritativeCompletion(request, {uid: "user-1"})).resolves.toMatchObject({difficultyBand: "medium"});
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

    await expect(
      deriveAuthoritativeCompletion(
        {
          riddleId: "riddle-1",
          gameMode: "challenge",
          sessionToken: "00000000-0000-4000-8000-000000000001",
        },
        {uid: "user-1"},
      ),
    ).resolves.toMatchObject({attempts: 5, isCorrect: false});
  });
});
