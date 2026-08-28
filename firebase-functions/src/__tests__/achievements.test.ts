import {evaluateAchievements} from "../gameplay/achievements";
import * as firestoreService from "../gameplay/firestoreService";
import type {Player} from "../validation/firestoreSchemas";

jest.mock("../gameplay/firestoreService", () => ({
  getUser: jest.fn(),
  appendUnlockedAchievements: jest.fn().mockResolvedValue(undefined),
}));

/** Provides mock get user behavior. */
const mockGetUser = firestoreService.getUser as jest.MockedFunction<typeof firestoreService.getUser>;
/** Provides mock append unlocked achievements behavior. */
const mockAppendUnlockedAchievements = firestoreService.appendUnlockedAchievements as jest.MockedFunction<
  typeof firestoreService.appendUnlockedAchievements
>;

/** Creates user. */
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

/** Provides base context behavior. */
const baseContext = {
  gameMode: "classic" as const,
  isCorrect: true,
  attempts: 2,
  gameOver: true,
};

/** Tracks ed stat achievement cases. */
const trackedStatAchievementCases: Array<[string, Partial<NonNullable<Player["stats"]>>]> = [
  ["wins_50", {totalWins: 50}],
  ["wins_100", {totalWins: 100}],
  ["games_25", {gamesPlayed: 25}],
  ["games_100", {gamesPlayed: 100}],
  ["streak_14", {bestStreak: 14}],
  ["streak_30", {bestStreak: 30}],
  ["classic_25", {highestLevelClassic: 25}],
  ["classic_50", {highestLevelClassic: 50}],
  ["classic_100", {highestLevelClassic: 100}],
  ["daily_7", {dailyPuzzlesCompleted: 7}],
  ["daily_30", {dailyPuzzlesCompleted: 30}],
  ["daily_100", {dailyPuzzlesCompleted: 100}],
  ["challenge_5", {challengeWins: 5}],
  ["challenge_25", {challengeWins: 25}],
  ["challenge_50", {challengeWins: 50}],
  ["hints_10", {totalHintsUsed: 10}],
  ["hints_25", {totalHintsUsed: 25}],
  ["level_5", {level: 5}],
  ["level_10", {level: 10}],
  ["level_20", {level: 20}],
  ["xp_1000", {xp: 1000}],
  ["xp_5000", {xp: 5000}],
  ["win_rate_80", {gamesPlayed: 10, winRate: 80}],
  ["efficient_10", {totalWins: 10, averageGuesses: 3}],
];

describe("evaluateAchievements", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns [] when user is not found", async () => {
    mockGetUser.mockResolvedValue(undefined);
    /** Provides result behavior. */
    const result = await evaluateAchievements("user-1", baseContext);
    expect(result).toEqual([]);
    expect(mockAppendUnlockedAchievements).not.toHaveBeenCalled();
  });

  it("contains persistence failures so achievement evaluation cannot fail gameplay", async () => {
    mockGetUser.mockRejectedValue(new Error("Firestore unavailable"));

    await expect(evaluateAchievements("user-1", baseContext)).resolves.toEqual([]);
    expect(mockAppendUnlockedAchievements).not.toHaveBeenCalled();
  });

  it("returns [] when user has no new achievements to unlock", async () => {
    /** Provides r. */
    const user = makeUser({
      stats: {totalWins: 0, bestStreak: 0, highestLevelClassic: 0, dailyPuzzlesCompleted: 0, totalHintsUsed: 0} as any,
    });
    mockGetUser.mockResolvedValue(user);
    /** Provides result behavior. */
    const result = await evaluateAchievements("user-1", baseContext);
    expect(result).toEqual([]);
    expect(mockAppendUnlockedAchievements).not.toHaveBeenCalled();
  });

  it("uses safe defaults when legacy player counters are absent", async () => {
    mockGetUser.mockResolvedValue({
      ...makeUser(),
      stats: undefined,
      coins: undefined,
      unlockedAchievements: undefined,
    } as unknown as Player);

    await expect(evaluateAchievements("user-1", baseContext)).resolves.toEqual([]);
    expect(mockAppendUnlockedAchievements).not.toHaveBeenCalled();
  });

  it("requires both minimum activity and quality thresholds", async () => {
    mockGetUser.mockResolvedValue(
      makeUser({
        stats: {gamesPlayed: 10, winRate: 79, totalWins: 10} as Player["stats"],
      }),
    );

    /** Provides result behavior. */
    const result = await evaluateAchievements("user-1", baseContext);
    expect(result).not.toContain("win_rate_80");
    expect(result).not.toContain("efficient_10");

    mockGetUser.mockResolvedValue(
      makeUser({
        stats: {gamesPlayed: 10} as Player["stats"],
      }),
    );
    await expect(evaluateAchievements("user-1", baseContext)).resolves.not.toContain("win_rate_80");
  });

  it("unlocks first_win when totalWins >= 1 and not already unlocked", async () => {
    /** Provides r. */
    const user = makeUser({
      stats: {...makeUser().stats, totalWins: 1, gamesPlayed: 1} as any,
      unlockedAchievements: [],
    });
    mockGetUser.mockResolvedValue(user);
    /** Provides result behavior. */
    const result = await evaluateAchievements("user-1", baseContext);
    expect(result).toContain("first_win");
    expect(mockAppendUnlockedAchievements).toHaveBeenCalledWith(
      "user-1",
      expect.arrayContaining([expect.objectContaining({achievementId: "first_win", unlockedAt: expect.any(Number)})]),
    );
  });

  it("does not unlock first_win when already in unlockedAchievements", async () => {
    /** Provides r. */
    const user = makeUser({
      stats: {...makeUser().stats, totalWins: 5} as any,
      unlockedAchievements: [{achievementId: "first_win", unlockedAt: 123}],
    });
    mockGetUser.mockResolvedValue(user);
    /** Provides result behavior. */
    const result = await evaluateAchievements("user-1", baseContext);
    expect(result).not.toContain("first_win");
    /** Provides appended behavior. */
    const appended = mockAppendUnlockedAchievements.mock.calls[0]?.[1] ?? [];
    expect(
      appended.some(
        (e: {
          /** Stores achievement id. */ /** Stores achievement id. */ /** Stores achievement id. */
          /** Stores achievement id. */
          achievementId: string;
        }) => e.achievementId === "first_win",
      ),
    ).toBe(false);
  });

  it("unlocks perfect_guess when isCorrect and attempts === 1", async () => {
    /** Provides r. */
    const user = makeUser({
      stats: {...makeUser().stats, totalWins: 0} as any,
      unlockedAchievements: [],
    });
    mockGetUser.mockResolvedValue(user);
    /** Provides result behavior. */
    const result = await evaluateAchievements("user-1", {
      ...baseContext,
      isCorrect: true,
      attempts: 1,
    });
    expect(result).toContain("perfect_guess");
  });

  it("unlocks hint_user when totalHintsUsed >= 1", async () => {
    /** Provides r. */
    const user = makeUser({
      stats: {...makeUser().stats, totalHintsUsed: 1} as any,
      unlockedAchievements: [],
    });
    mockGetUser.mockResolvedValue(user);
    /** Provides result behavior. */
    const result = await evaluateAchievements("user-1", baseContext);
    expect(result).toContain("hint_user");
  });

  it.each(trackedStatAchievementCases)(
    "unlocks %s when its tracked stat reaches the threshold",
    async (achievementId, statsOverride) => {
      /** Provides r. */
      const user = makeUser({
        stats: {...makeUser().stats, ...statsOverride},
        unlockedAchievements: [],
      });
      mockGetUser.mockResolvedValue(user);

      /** Provides result behavior. */
      const result = await evaluateAchievements("user-1", baseContext);

      expect(result).toContain(achievementId);
    },
  );

  it("unlocks coin_hoarder when the player has at least 1,000 coins", async () => {
    /** Provides r. */
    const user = makeUser({
      coins: 1000,
      unlockedAchievements: [],
    });
    mockGetUser.mockResolvedValue(user);

    /** Provides result behavior. */
    const result = await evaluateAchievements("user-1", baseContext);

    expect(result).toContain("coin_hoarder");
  });

  it("unlocks treasure_vault when the player has at least 2,500 coins", async () => {
    /** Provides r. */
    const user = makeUser({
      coins: 2500,
      unlockedAchievements: [],
    });
    mockGetUser.mockResolvedValue(user);

    /** Provides result behavior. */
    const result = await evaluateAchievements("user-1", baseContext);

    expect(result).toContain("treasure_vault");
  });

  it.each([
    ["classic_perfect", {...baseContext, gameMode: "classic" as const, attempts: 1}],
    ["challenge_perfect", {...baseContext, gameMode: "challenge" as const, attempts: 1}],
    ["last_chance", {...baseContext, gameMode: "classic" as const, attempts: 5}],
    ["classic_last_chance", {...baseContext, gameMode: "classic" as const, attempts: 5}],
    ["challenge_last_chance", {...baseContext, gameMode: "challenge" as const, attempts: 5}],
    ["lesson_learned", {...baseContext, isCorrect: false, gameOver: true, attempts: 5}],
  ])("unlocks %s from the current solve context", async (achievementId, context) => {
    /** Provides r. */
    const user = makeUser({
      unlockedAchievements: [],
    });
    mockGetUser.mockResolvedValue(user);

    /** Provides result behavior. */
    const result = await evaluateAchievements("user-1", context);

    expect(result).toContain(achievementId);
  });

  it("does not unlock efficiency achievement before 10 wins", async () => {
    /** Provides r. */
    const user = makeUser({
      stats: {...makeUser().stats, totalWins: 9, averageGuesses: 2.5},
      unlockedAchievements: [],
    });
    mockGetUser.mockResolvedValue(user);

    /** Provides result behavior. */
    const result = await evaluateAchievements("user-1", baseContext);

    expect(result).not.toContain("efficient_10");
  });

  it("unlocks first_purchase when hasPurchasedApp is true", async () => {
    /** Provides r. */
    const user = makeUser({
      hasPurchasedApp: true,
      unlockedAchievements: [],
    });
    mockGetUser.mockResolvedValue(user);
    /** Provides result behavior. */
    const result = await evaluateAchievements("user-1", baseContext);
    expect(result).toContain("first_purchase");
  });
});
