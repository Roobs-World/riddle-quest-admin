import {evaluateAchievements} from "../achievements";
import * as firestoreService from "../firestoreService";
import type {Player} from "../validation/firestoreSchemas";

jest.mock("../firestoreService", () => ({
  getUser: jest.fn(),
  appendUnlockedAchievements: jest.fn().mockResolvedValue(undefined),
}));

const mockGetUser = firestoreService.getUser as jest.MockedFunction<typeof firestoreService.getUser>;
const mockAppendUnlockedAchievements = firestoreService.appendUnlockedAchievements as jest.MockedFunction<
  typeof firestoreService.appendUnlockedAchievements
>;

function makeUser(overrides: Partial<Player> = {}): Player {
  return {
    userId: "user-1",
    email: "u@example.com",
    username: "user",
    coins: 100,
    hasPurchasedApp: false,
    stats: {
      gamesPlayed: 0,
      wins: 0,
      winStreak: 0,
      bestStreak: 0,
      totalWordsGuessed: 0,
      winRate: 0,
      averageGuesses: 0,
      totalScore: 0,
      highestLevelClassic: 0,
      challengeWins: 0,
      totalWins: 0,
      totalGuessesInWins: 0,
      dailyPuzzlesCompleted: 0,
      totalHintsUsed: 0,
    },
    progress: {
      classicIndex: 0,
      dailyChallengeIndex: 0,
      dailyChallengeCurrentQuestion: 0,
    },
    unlockedAchievements: [],
    ...overrides,
  };
}

const baseContext = {
  gameMode: "classic" as const,
  isCorrect: true,
  attempts: 2,
  gameOver: true,
};

describe("evaluateAchievements", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns [] when user is not found", async () => {
    mockGetUser.mockResolvedValue(undefined);
    const result = await evaluateAchievements("user-1", baseContext);
    expect(result).toEqual([]);
    expect(mockAppendUnlockedAchievements).not.toHaveBeenCalled();
  });

  it("returns [] when user has no new achievements to unlock", async () => {
    const user = makeUser({stats: {totalWins: 0, bestStreak: 0, highestLevelClassic: 0, dailyPuzzlesCompleted: 0, totalHintsUsed: 0} as any});
    mockGetUser.mockResolvedValue(user);
    const result = await evaluateAchievements("user-1", baseContext);
    expect(result).toEqual([]);
    expect(mockAppendUnlockedAchievements).not.toHaveBeenCalled();
  });

  it("unlocks first_win when totalWins >= 1 and not already unlocked", async () => {
    const user = makeUser({
      stats: {...makeUser().stats, totalWins: 1, gamesPlayed: 1} as any,
      unlockedAchievements: [],
    });
    mockGetUser.mockResolvedValue(user);
    const result = await evaluateAchievements("user-1", baseContext);
    expect(result).toContain("first_win");
    expect(mockAppendUnlockedAchievements).toHaveBeenCalledWith(
      "user-1",
      expect.arrayContaining([expect.objectContaining({achievementId: "first_win", unlockedAt: expect.any(Number)})]),
    );
  });

  it("does not unlock first_win when already in unlockedAchievements", async () => {
    const user = makeUser({
      stats: {...makeUser().stats, totalWins: 5} as any,
      unlockedAchievements: [{achievementId: "first_win", unlockedAt: 123}],
    });
    mockGetUser.mockResolvedValue(user);
    const result = await evaluateAchievements("user-1", baseContext);
    expect(result).not.toContain("first_win");
    const appended = mockAppendUnlockedAchievements.mock.calls[0]?.[1] ?? [];
    expect(appended.some((e: {achievementId: string}) => e.achievementId === "first_win")).toBe(false);
  });

  it("unlocks perfect_guess when isCorrect and attempts === 1", async () => {
    const user = makeUser({
      stats: {...makeUser().stats, totalWins: 0} as any,
      unlockedAchievements: [],
    });
    mockGetUser.mockResolvedValue(user);
    const result = await evaluateAchievements("user-1", {
      ...baseContext,
      isCorrect: true,
      attempts: 1,
    });
    expect(result).toContain("perfect_guess");
  });

  it("unlocks hint_user when totalHintsUsed >= 1", async () => {
    const user = makeUser({
      stats: {...makeUser().stats, totalHintsUsed: 1} as any,
      unlockedAchievements: [],
    });
    mockGetUser.mockResolvedValue(user);
    const result = await evaluateAchievements("user-1", baseContext);
    expect(result).toContain("hint_user");
  });

  it("unlocks first_purchase when hasPurchasedApp is true", async () => {
    const user = makeUser({
      hasPurchasedApp: true,
      unlockedAchievements: [],
    });
    mockGetUser.mockResolvedValue(user);
    const result = await evaluateAchievements("user-1", baseContext);
    expect(result).toContain("first_purchase");
  });
});
