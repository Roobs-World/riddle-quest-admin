import {
  Player,
  PlayerStats,
  Riddle,
  PurchaseValidationResponse,
} from "../Player";

describe("Player Types", () => {
  describe("Player", () => {
    it("should have all required properties", () => {
      const player: Player = {
        userId: "test-user-123",
        progress: {
          dailyChallengeIndex: 5,
          classicIndex: 3,
        },
        coins: 100,
        username: "testuser",
        email: "test@example.com",
        displayName: "Test User",
        registeredAt: new Date(),
        lastLogin: new Date(),
      };

      expect(player.userId).toBe("test-user-123");
      expect(player.progress.dailyChallengeIndex).toBe(5);
      expect(player.progress.classicIndex).toBe(3);
      expect(player.coins).toBe(100);
      expect(player.username).toBe("testuser");
      expect(player.email).toBe("test@example.com");
      expect(player.displayName).toBe("Test User");
      expect(player.registeredAt).toBeInstanceOf(Date);
      expect(player.lastLogin).toBeInstanceOf(Date);
    });

    it("should accept optional properties", () => {
      const player: Player = {
        userId: "test-user-123",
        progress: {
          dailyChallengeIndex: 5,
          classicIndex: 3,
        },
        coins: 100,
        username: "testuser",
        email: "test@example.com",
        displayName: "Test User",
        registeredAt: new Date(),
        lastLogin: new Date(),
        lastDailyChallengeCompletedAt: new Date(),
        currentRiddle: {
          answer: "HELLO",
          text: "A common greeting",
        },
        avatarUrl: "https://example.com/avatar.jpg",
        stats: {
          xp: 0,
          level: 1,
          gamesPlayed: 50,
          wins: 30,
          winStreak: 5,
          bestStreak: 10,
          totalWordsGuessed: 150,
          winRate: 0.6,
          totalScore: 1000,
          highestLevelClassic: 15,
          challengeWins: 8,
        },
        hasPurchasedApp: true,
      };

      expect(player.lastDailyChallengeCompletedAt).toBeInstanceOf(Date);
      expect(player.currentRiddle?.answer).toBe("HELLO");
      expect(player.currentRiddle?.text).toBe("A common greeting");
      expect(player.avatarUrl).toBe("https://example.com/avatar.jpg");
      expect(player.stats?.gamesPlayed).toBe(50);
      expect(player.hasPurchasedApp).toBe(true);
    });

    it("should accept null values for nullable properties", () => {
      const player: Player = {
        userId: "test-user-123",
        progress: {
          dailyChallengeIndex: 0,
          classicIndex: 0,
        },
        coins: 0,
        username: "newuser",
        email: "new@example.com",
        displayName: "New User",
        registeredAt: null,
        lastLogin: null,
        avatarUrl: null,
      };

      expect(player.registeredAt).toBeNull();
      expect(player.lastLogin).toBeNull();
      expect(player.avatarUrl).toBeNull();
    });
  });

  describe("PlayerStats", () => {
    it("should accept numeric values", () => {
      const stats: PlayerStats = {
        xp: 0,
        level: 1,
        gamesPlayed: 25,
        wins: 15,
        winStreak: 3,
        bestStreak: 7,
        totalWordsGuessed: 75,
        winRate: 0.6,
        totalScore: 500,
        highestLevelClassic: 10,
        challengeWins: 5,
      };

      expect(stats.gamesPlayed).toBe(25);
      expect(stats.wins).toBe(15);
      expect(stats.winStreak).toBe(3);
      expect(stats.bestStreak).toBe(7);
      expect(stats.totalWordsGuessed).toBe(75);
      expect(stats.winRate).toBe(0.6);
      expect(stats.totalScore).toBe(500);
      expect(stats.highestLevelClassic).toBe(10);
      expect(stats.challengeWins).toBe(5);
    });

    it("should work with zero values", () => {
      const stats: PlayerStats = {
        xp: 0,
        level: 1,
        gamesPlayed: 0,
        wins: 0,
        winStreak: 0,
        bestStreak: 0,
        totalWordsGuessed: 0,
        winRate: 0,
        totalScore: 0,
        highestLevelClassic: 0,
        challengeWins: 0,
      };

      expect(stats.gamesPlayed).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.winRate).toBe(0);
    });
  });

  describe("Riddle", () => {
    it("should have answer and text properties", () => {
      const riddle: Riddle = {
        answer: "WORLD",
        text: "The planet we live on",
      };

      expect(riddle.answer).toBe("WORLD");
      expect(riddle.text).toBe("The planet we live on");
    });

    it("should accept various answer formats", () => {
      const riddles: Riddle[] = [
        { answer: "HELLO", text: "A greeting" },
        { answer: "PEACE", text: "Harmony" },
        { answer: "SMILE", text: "Happy expression" },
      ];

      riddles.forEach((riddle) => {
        expect(typeof riddle.answer).toBe("string");
        expect(typeof riddle.text).toBe("string");
        expect(riddle.answer.length).toBeGreaterThan(0);
        expect(riddle.text.length).toBeGreaterThan(0);
      });
    });
  });

  describe("PurchaseValidationResponse", () => {
    it("should handle successful purchase", () => {
      const response: PurchaseValidationResponse = {
        success: true,
        newCoins: 500,
      };

      expect(response.success).toBe(true);
      expect(response.newCoins).toBe(500);
    });

    it("should handle failed purchase", () => {
      const response: PurchaseValidationResponse = {
        success: false,
      };

      expect(response.success).toBe(false);
      expect(response.newCoins).toBeUndefined();
    });

    it("should handle successful purchase without coins", () => {
      const response: PurchaseValidationResponse = {
        success: true,
      };

      expect(response.success).toBe(true);
      expect(response.newCoins).toBeUndefined();
    });
  });
});


