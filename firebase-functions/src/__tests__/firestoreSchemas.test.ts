/* eslint-disable @typescript-eslint/no-explicit-any */
import {describe, expect, test, beforeEach, jest} from "@jest/globals";

// Mock the profanity filter
const mockValidateUsernameForProfanity = jest.fn();

jest.mock("../utils/profanityFilter", () => ({
  validateUsernameForProfanity: mockValidateUsernameForProfanity,
}));

// Import the schemas after mocking
import {
  loginSchema,
  signUpSchema,
  PlayerProgressSchema,
  PlayerStatsSchema,
  PlayerSchema,
  FirestoreRiddleSchema,
  type LoginFormData,
  type SignUpFormData,
  type Player,
  type FirestoreRiddle,
} from "../validation/firestoreSchemas";

describe("Firestore Schemas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock: no profanity detected
    mockValidateUsernameForProfanity.mockReturnValue("");
  });

  describe("loginSchema", () => {
    test("should validate correct login data", () => {
      const validLogin = {
        email: "test@example.com",
        password: "password123",
      };

      const result = loginSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validLogin);
      }
    });

    test("should reject invalid email", () => {
      const invalidLogin = {
        email: "invalid-email",
        password: "password123",
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Invalid email address");
      }
    });

    test("should reject short password", () => {
      const invalidLogin = {
        email: "test@example.com",
        password: "123",
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Password must be at least 6 characters long");
      }
    });

    test("should reject missing fields", () => {
      const incompleteLogin = {
        email: "test@example.com",
      };

      const result = loginSchema.safeParse(incompleteLogin);
      expect(result.success).toBe(false);
    });
  });

  describe("signUpSchema", () => {
    test("should validate correct signup data", () => {
      const validSignup = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "password123",
      };

      const result = signUpSchema.safeParse(validSignup);
      expect(result.success).toBe(true);
      expect(mockValidateUsernameForProfanity).toHaveBeenCalledWith("testuser");
    });

    test("should reject username with profanity", () => {
      mockValidateUsernameForProfanity.mockReturnValue("Username contains inappropriate language");

      const invalidSignup = {
        username: "badword",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "password123",
      };

      const result = signUpSchema.safeParse(invalidSignup);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Username contains inappropriate language. Please choose a different username.",
        );
      }
    });

    test("should reject mismatched passwords", () => {
      const invalidSignup = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "differentpassword",
      };

      const result = signUpSchema.safeParse(invalidSignup);
      expect(result.success).toBe(false);
      if (!result.success) {
        const passwordError = result.error.issues.find((issue) => issue.path.includes("confirmPassword"));
        expect(passwordError?.message).toBe("Passwords do not match");
      }
    });

    test("should reject empty username", () => {
      const invalidSignup = {
        username: "",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "password123",
      };

      const result = signUpSchema.safeParse(invalidSignup);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Username is required");
      }
    });

    test("should reject invalid email in signup", () => {
      const invalidSignup = {
        username: "testuser",
        email: "invalid-email",
        password: "password123",
        confirmPassword: "password123",
      };

      const result = signUpSchema.safeParse(invalidSignup);
      expect(result.success).toBe(false);
      if (!result.success) {
        const emailError = result.error.issues.find((issue) => issue.path.includes("email"));
        expect(emailError?.message).toBe("Invalid email address");
      }
    });
  });

  describe("PlayerProgressSchema", () => {
    test("should validate correct progress data", () => {
      const validProgress = {
        classicIndex: 5,
        dailyChallengeIndex: 3,
        tutorialIndex: 1,
      };

      const result = PlayerProgressSchema.safeParse(validProgress);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validProgress);
      }
    });

    test("should apply default values", () => {
      const emptyProgress = {};

      const result = PlayerProgressSchema.safeParse(emptyProgress);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          classicIndex: 0,
          dailyChallengeIndex: 0,
          tutorialIndex: 0,
        });
      }
    });

    test("should reject negative values", () => {
      const invalidProgress = {
        classicIndex: -1,
        dailyChallengeIndex: 3,
        tutorialIndex: 1,
      };

      const result = PlayerProgressSchema.safeParse(invalidProgress);
      expect(result.success).toBe(false);
    });

    test("should reject non-integer values", () => {
      const invalidProgress = {
        classicIndex: 5.5,
        dailyChallengeIndex: 3,
        tutorialIndex: 1,
      };

      const result = PlayerProgressSchema.safeParse(invalidProgress);
      expect(result.success).toBe(false);
    });
  });

  describe("PlayerStatsSchema", () => {
    test("should validate correct stats data", () => {
      const validStats = {
        dailyPuzzlesCompleted: 10,
        bestStreak: 5,
        totalWordsGuessed: 100,
        winRate: 0.75,
        averageGuesses: 3.5,
        totalScore: 1000,
        highestLevelClassic: 15,
        gamesPlayed: 20,
        wins: 15,
        challengeWins: 8,
        winStreak: 3,
        totalWins: 15,
        totalGuessesInWins: 45,
      };

      const result = PlayerStatsSchema.safeParse(validStats);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validStats);
      }
    });

    test("should apply default values", () => {
      const emptyStats = {};

      const result = PlayerStatsSchema.safeParse(emptyStats);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dailyPuzzlesCompleted).toBe(0);
        expect(result.data.bestStreak).toBe(0);
        expect(result.data.winRate).toBe(0);
        expect(result.data.gamesPlayed).toBe(0);
      }
    });

    test("should reject negative integer values", () => {
      const invalidStats = {
        gamesPlayed: -1,
        wins: 5,
      };

      const result = PlayerStatsSchema.safeParse(invalidStats);
      expect(result.success).toBe(false);
    });

    test("should reject negative decimal values", () => {
      const invalidStats = {
        winRate: -0.5,
        averageGuesses: 3.0,
      };

      const result = PlayerStatsSchema.safeParse(invalidStats);
      expect(result.success).toBe(false);
    });

    test("should accept zero values", () => {
      const zeroStats = {
        gamesPlayed: 0,
        wins: 0,
        winRate: 0,
        averageGuesses: 0,
      };

      const result = PlayerStatsSchema.safeParse(zeroStats);
      expect(result.success).toBe(true);
    });
  });

  describe("PlayerSchema", () => {
    test("should validate complete player data", () => {
      const validPlayer = {
        userId: "user123",
        email: "test@example.com",
        username: "testuser",
        displayName: "Test User",
        avatarUrl: "https://example.com/avatar.jpg",
        xp: 100,
        coins: 50,
        hasPurchasedApp: true,
        createdAt: 1640995200000,
        registeredAt: 1640995200000,
        lastLogin: 1640995200000,
        lastDailyChallengeCompletedAt: 1640995200000,
        stats: {
          gamesPlayed: 10,
          wins: 8,
          winRate: 0.8,
        },
        progress: {
          classicIndex: 5,
          dailyChallengeIndex: 3,
          tutorialIndex: 1,
        },
      };

      const result = PlayerSchema.safeParse(validPlayer);
      expect(result.success).toBe(true);
      expect(mockValidateUsernameForProfanity).toHaveBeenCalledWith("testuser");
    });

    test("should validate minimal player data with defaults", () => {
      const minimalPlayer = {
        userId: "user123",
        username: "testuser",
      };

      const result = PlayerSchema.safeParse(minimalPlayer);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.xp).toBe(0);
        expect(result.data.coins).toBe(0);
        expect(result.data.hasPurchasedApp).toBe(false);
        expect(result.data.stats).toBeDefined();
        expect(result.data.progress).toBeDefined();
      }
    });

    test("should reject player with profane username", () => {
      mockValidateUsernameForProfanity.mockReturnValue("Username contains inappropriate language");

      const invalidPlayer = {
        userId: "user123",
        username: "badword",
      };

      const result = PlayerSchema.safeParse(invalidPlayer);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Username contains inappropriate language. Please choose a different username.",
        );
      }
    });

    test("should reject invalid email", () => {
      const invalidPlayer = {
        userId: "user123",
        username: "testuser",
        email: "invalid-email",
      };

      const result = PlayerSchema.safeParse(invalidPlayer);
      expect(result.success).toBe(false);
    });

    test("should reject invalid avatar URL", () => {
      const invalidPlayer = {
        userId: "user123",
        username: "testuser",
        avatarUrl: "not-a-url",
      };

      const result = PlayerSchema.safeParse(invalidPlayer);
      expect(result.success).toBe(false);
    });

    test("should reject negative XP", () => {
      const invalidPlayer = {
        userId: "user123",
        username: "testuser",
        xp: -10,
      };

      const result = PlayerSchema.safeParse(invalidPlayer);
      expect(result.success).toBe(false);
    });

    test("should reject negative coins", () => {
      const invalidPlayer = {
        userId: "user123",
        username: "testuser",
        coins: -5,
      };

      const result = PlayerSchema.safeParse(invalidPlayer);
      expect(result.success).toBe(false);
    });

    test("should reject missing required fields", () => {
      const incompletePlayer = {
        email: "test@example.com",
      };

      const result = PlayerSchema.safeParse(incompletePlayer);
      expect(result.success).toBe(false);
    });
  });

  describe("FirestoreRiddleSchema", () => {
    test("should validate complete riddle data", () => {
      const validRiddle = {
        riddleId: "riddle123",
        dailyIndex: 5,
        classicIndex: 10,
        text: "What has keys but no locks?",
        answer: "keyboard",
        difficulty: "medium",
        category: "technology",
      };

      const result = FirestoreRiddleSchema.safeParse(validRiddle);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validRiddle);
      }
    });

    test("should validate minimal riddle data", () => {
      const minimalRiddle = {
        riddleId: "riddle123",
        text: "What has keys but no locks?",
        answer: "keyboard",
      };

      const result = FirestoreRiddleSchema.safeParse(minimalRiddle);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.riddleId).toBe("riddle123");
        expect(result.data.text).toBe("What has keys but no locks?");
        expect(result.data.answer).toBe("keyboard");
      }
    });

    test("should reject riddle with empty answer", () => {
      const invalidRiddle = {
        riddleId: "riddle123",
        text: "What has keys but no locks?",
        answer: "",
      };

      const result = FirestoreRiddleSchema.safeParse(invalidRiddle);
      expect(result.success).toBe(false);
    });

    test("should reject riddle with negative indices", () => {
      const invalidRiddle = {
        riddleId: "riddle123",
        dailyIndex: -1,
        text: "What has keys but no locks?",
        answer: "keyboard",
      };

      const result = FirestoreRiddleSchema.safeParse(invalidRiddle);
      expect(result.success).toBe(false);
    });

    test("should reject riddle with non-integer indices", () => {
      const invalidRiddle = {
        riddleId: "riddle123",
        classicIndex: 5.5,
        text: "What has keys but no locks?",
        answer: "keyboard",
      };

      const result = FirestoreRiddleSchema.safeParse(invalidRiddle);
      expect(result.success).toBe(false);
    });

    test("should reject riddle missing required fields", () => {
      const incompleteRiddle = {
        riddleId: "riddle123",
        text: "What has keys but no locks?",
      };

      const result = FirestoreRiddleSchema.safeParse(incompleteRiddle);
      expect(result.success).toBe(false);
    });
  });

  describe("Type Inference", () => {
    test("should correctly infer LoginFormData type", () => {
      const loginData: LoginFormData = {
        email: "test@example.com",
        password: "password123",
      };

      expect(typeof loginData.email).toBe("string");
      expect(typeof loginData.password).toBe("string");
    });

    test("should correctly infer SignUpFormData type", () => {
      const signupData: SignUpFormData = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "password123",
      };

      expect(typeof signupData.username).toBe("string");
      expect(typeof signupData.email).toBe("string");
      expect(typeof signupData.password).toBe("string");
      expect(typeof signupData.confirmPassword).toBe("string");
    });

    test("should correctly infer Player type", () => {
      const player: Player = {
        userId: "user123",
        username: "testuser",
        xp: 0,
        coins: 0,
        hasPurchasedApp: false,
        stats: {
          dailyPuzzlesCompleted: 0,
          bestStreak: 0,
          totalWordsGuessed: 0,
          winRate: 0,
          averageGuesses: 0,
          totalScore: 0,
          highestLevelClassic: 0,
          gamesPlayed: 0,
          wins: 0,
          challengeWins: 0,
          winStreak: 0,
          totalWins: 0,
          totalGuessesInWins: 0,
        },
        progress: {
          classicIndex: 0,
          dailyChallengeIndex: 0,
          tutorialIndex: 0,
        },
      };

      expect(typeof player.userId).toBe("string");
      expect(typeof player.username).toBe("string");
      expect(typeof player.xp).toBe("number");
      expect(typeof player.coins).toBe("number");
      expect(typeof player.hasPurchasedApp).toBe("boolean");
      expect(typeof player.stats).toBe("object");
      expect(typeof player.progress).toBe("object");
    });

    test("should correctly infer FirestoreRiddle type", () => {
      const riddle: FirestoreRiddle = {
        riddleId: "riddle123",
        text: "What has keys but no locks?",
        answer: "keyboard",
      };

      expect(typeof riddle.riddleId).toBe("string");
      expect(typeof riddle.text).toBe("string");
      expect(typeof riddle.answer).toBe("string");
    });
  });

  describe("Edge Cases", () => {
    test("should handle very long usernames", () => {
      const longUsername = "a".repeat(1000);
      const player = {
        userId: "user123",
        username: longUsername,
      };

      const result = PlayerSchema.safeParse(player);
      expect(result.success).toBe(true);
      expect(mockValidateUsernameForProfanity).toHaveBeenCalledWith(longUsername);
    });

    test("should handle special characters in riddle text", () => {
      const riddle = {
        riddleId: "riddle123",
        text: "What's the answer? It's 100% correct!",
        answer: "test",
      };

      const result = FirestoreRiddleSchema.safeParse(riddle);
      expect(result.success).toBe(true);
    });

    test("should handle maximum safe integer values", () => {
      const player = {
        userId: "user123",
        username: "testuser",
        xp: Number.MAX_SAFE_INTEGER,
        coins: Number.MAX_SAFE_INTEGER,
      };

      const result = PlayerSchema.safeParse(player);
      expect(result.success).toBe(true);
    });

    test("should handle decimal win rates", () => {
      const stats = {
        winRate: 0.123456789,
        averageGuesses: 3.14159,
      };

      const result = PlayerStatsSchema.safeParse(stats);
      expect(result.success).toBe(true);
    });
  });
});
