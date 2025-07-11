import type { IUserDataService } from "../IUserDataService";
import type { Player } from "../../../validation/firestoreSchemas";

describe("IUserDataService", () => {
  const mockPlayer: Player = {
    userId: "test-user-123",
    username: "testuser",
    email: "test@example.com",
    coins: 50,
    hasPurchasedApp: false,
    stats: {
      dailyPuzzlesCompleted: 5,
      bestStreak: 3,
      totalWordsGuessed: 20,
      winRate: 0.8,
      averageGuesses: 4.2,
      totalScore: 500,
      highestLevelClassic: 10,
      gamesPlayed: 25,
      wins: 20,
      challengeWins: 5,
      winStreak: 2,
      totalWins: 20,
      totalGuessesInWins: 84,
    },
    progress: {
      classicIndex: 5,
      dailyChallengeIndex: 3,
      tutorialIndex: 2,
    },
  };

  it("should allow implementing the interface", () => {
    class TestUserDataService implements IUserDataService {
      async saveUserProgress(
        userId: string,
        progress: Player["progress"]
      ): Promise<void> {}
      async loadUserProgress(userId: string): Promise<Player | null> {
        return null;
      }
      async createUserDocument(
        userId: string,
        userData: Player
      ): Promise<void> {}
      async updateUserDocument(
        userId: string,
        updates: Partial<Player>
      ): Promise<void> {}
      async updateClassicIndex(
        userId: string,
        newIndex: number
      ): Promise<void> {}
      async updateUserCoins(
        userId: string,
        newCoinAmount: number
      ): Promise<void> {}
      async userExists(userId: string): Promise<boolean> {
        return false;
      }
    }

    const service = new TestUserDataService();
    expect(service).toBeInstanceOf(TestUserDataService);
    expect(typeof service.saveUserProgress).toBe("function");
    expect(typeof service.loadUserProgress).toBe("function");
    expect(typeof service.createUserDocument).toBe("function");
    expect(typeof service.updateUserDocument).toBe("function");
    expect(typeof service.updateClassicIndex).toBe("function");
    expect(typeof service.updateUserCoins).toBe("function");
    expect(typeof service.userExists).toBe("function");
  });

  it("should define methods that return correct promise types", async () => {
    const mockService: IUserDataService = {
      saveUserProgress: jest.fn().mockResolvedValue(undefined),
      loadUserProgress: jest.fn().mockResolvedValue(mockPlayer),
      createUserDocument: jest.fn().mockResolvedValue(undefined),
      updateUserDocument: jest.fn().mockResolvedValue(undefined),
      updateClassicIndex: jest.fn().mockResolvedValue(undefined),
      updateUserCoins: jest.fn().mockResolvedValue(undefined),
      userExists: jest.fn().mockResolvedValue(true),
    };

    await expect(
      mockService.saveUserProgress("user123", mockPlayer.progress)
    ).resolves.toBeUndefined();
    await expect(mockService.loadUserProgress("user123")).resolves.toEqual(
      mockPlayer
    );
    await expect(
      mockService.createUserDocument("user123", mockPlayer)
    ).resolves.toBeUndefined();
    await expect(
      mockService.updateUserDocument("user123", { coins: 100 })
    ).resolves.toBeUndefined();
    await expect(
      mockService.updateClassicIndex("user123", 10)
    ).resolves.toBeUndefined();
    await expect(
      mockService.updateUserCoins("user123", 200)
    ).resolves.toBeUndefined();
    await expect(mockService.userExists("user123")).resolves.toBe(true);
  });

  it("should handle method parameters correctly", () => {
    const mockService: IUserDataService = {
      saveUserProgress: jest.fn(),
      loadUserProgress: jest.fn(),
      createUserDocument: jest.fn(),
      updateUserDocument: jest.fn(),
      updateClassicIndex: jest.fn(),
      updateUserCoins: jest.fn(),
      userExists: jest.fn(),
    };

    const progress = {
      classicIndex: 5,
      dailyChallengeIndex: 3,
      tutorialIndex: 2,
    };
    const updates = { coins: 150 };

    mockService.saveUserProgress("user123", progress);
    mockService.loadUserProgress("user456");
    mockService.createUserDocument("user789", mockPlayer);
    mockService.updateUserDocument("user123", updates);
    mockService.updateClassicIndex("user123", 15);
    mockService.updateUserCoins("user123", 300);
    mockService.userExists("user123");

    expect(mockService.saveUserProgress).toHaveBeenCalledWith(
      "user123",
      progress
    );
    expect(mockService.loadUserProgress).toHaveBeenCalledWith("user456");
    expect(mockService.createUserDocument).toHaveBeenCalledWith(
      "user789",
      mockPlayer
    );
    expect(mockService.updateUserDocument).toHaveBeenCalledWith(
      "user123",
      updates
    );
    expect(mockService.updateClassicIndex).toHaveBeenCalledWith("user123", 15);
    expect(mockService.updateUserCoins).toHaveBeenCalledWith("user123", 300);
    expect(mockService.userExists).toHaveBeenCalledWith("user123");
  });

  it("should work with null return values and false boolean returns", async () => {
    const mockService: IUserDataService = {
      saveUserProgress: jest.fn().mockResolvedValue(undefined),
      loadUserProgress: jest.fn().mockResolvedValue(null),
      createUserDocument: jest.fn().mockResolvedValue(undefined),
      updateUserDocument: jest.fn().mockResolvedValue(undefined),
      updateClassicIndex: jest.fn().mockResolvedValue(undefined),
      updateUserCoins: jest.fn().mockResolvedValue(undefined),
      userExists: jest.fn().mockResolvedValue(false),
    };

    await expect(
      mockService.loadUserProgress("nonexistent")
    ).resolves.toBeNull();
    await expect(mockService.userExists("nonexistent")).resolves.toBe(false);
  });

  it("should handle partial player updates", async () => {
    const mockService: IUserDataService = {
      saveUserProgress: jest.fn(),
      loadUserProgress: jest.fn(),
      createUserDocument: jest.fn(),
      updateUserDocument: jest.fn(),
      updateClassicIndex: jest.fn(),
      updateUserCoins: jest.fn(),
      userExists: jest.fn(),
    };

    // Test various partial updates
    const partialUpdates: Partial<Player>[] = [
      { coins: 100 },
      { username: "newusername" },
      { coins: 200 },
      {
        stats: {
          dailyPuzzlesCompleted: 0,
          bestStreak: 0,
          totalWordsGuessed: 0,
          winRate: 0,
          averageGuesses: 0,
          totalScore: 0,
          highestLevelClassic: 0,
          gamesPlayed: 15,
          wins: 10,
          challengeWins: 0,
          winStreak: 0,
          totalWins: 0,
          totalGuessesInWins: 0,
        },
      },
      {
        progress: {
          classicIndex: 8,
          dailyChallengeIndex: 0,
          tutorialIndex: 0,
        },
      },
    ];

    for (const update of partialUpdates) {
      mockService.updateUserDocument("user123", update);
    }

    expect(mockService.updateUserDocument).toHaveBeenCalledTimes(
      partialUpdates.length
    );
  });
});
