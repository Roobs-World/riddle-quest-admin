import {PlayerSchema, FirestoreRiddleSchema, loginSchema, signUpSchema} from "../firestoreSchemas";

describe("firestoreSchemas", () => {
  describe("loginSchema", () => {
    it("should validate correct login data", () => {
      const validLogin = {
        email: "test@example.com",
        password: "password123",
      };

      const result = loginSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
    });

    it("should reject login with invalid email", () => {
      const invalidLogin = {
        email: "invalid-email",
        password: "password123",
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });

    it("should reject login with short password", () => {
      const invalidLogin = {
        email: "test@example.com",
        password: "123", // Too short
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });
  });

  describe("signUpSchema", () => {
    it("should validate correct sign up data", () => {
      const validSignUp = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "password123",
      };

      const result = signUpSchema.safeParse(validSignUp);
      expect(result.success).toBe(true);
    });

    it("should reject sign up with mismatched passwords", () => {
      const invalidSignUp = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "different",
      };

      const result = signUpSchema.safeParse(invalidSignUp);
      expect(result.success).toBe(false);
    });

    it("should reject sign up with empty username", () => {
      const invalidSignUp = {
        username: "",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "password123",
      };

      const result = signUpSchema.safeParse(invalidSignUp);
      expect(result.success).toBe(false);
    });
  });

  describe("PlayerSchema", () => {
    it("should validate correct player data", () => {
      const validPlayer = {
        userId: "user123",
        username: "testuser",
        email: "test@example.com",
        displayName: "Test User",
        coins: 50,
      };

      const result = PlayerSchema.safeParse(validPlayer);
      expect(result.success).toBe(true);
    });

    it("should reject player with invalid email", () => {
      const invalidPlayer = {
        userId: "user123",
        username: "testuser",
        email: "invalid-email",
      };

      const result = PlayerSchema.safeParse(invalidPlayer);
      expect(result.success).toBe(false);
    });

    it("should reject player with negative coins", () => {
      const invalidPlayer = {
        userId: "user123",
        username: "testuser",
        coins: -10,
      };

      const result = PlayerSchema.safeParse(invalidPlayer);
      expect(result.success).toBe(false);
    });

    it("should handle player with default values", () => {
      const minimalPlayer = {
        userId: "user123",
        username: "testuser",
        email: "test@example.com",
      };

      const result = PlayerSchema.safeParse(minimalPlayer);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.coins).toBe(0);
        expect(result.data.hasPurchasedApp).toBe(false);
      }
    });

    it("should validate player stats structure", () => {
      const playerWithStats = {
        userId: "user123",
        username: "testuser",
        email: "test@example.com",
        stats: {
          gamesPlayed: 10,
          wins: 6,
          winRate: 0.6,
          averageGuesses: 4.2,
        },
      };

      const result = PlayerSchema.safeParse(playerWithStats);
      expect(result.success).toBe(true);
    });

    it("should validate player progress structure", () => {
      const playerWithProgress = {
        userId: "user123",
        username: "testuser",
        email: "test@example.com",
        progress: {
          classicIndex: 5,
          dailyChallengeIndex: 10,
        },
      };

      const result = PlayerSchema.safeParse(playerWithProgress);
      expect(result.success).toBe(true);
    });

    it("should coerce Firestore timestamp-like values to millis", () => {
      const playerWithTimestamp = {
        userId: "user123",
        username: "testuser",
        email: "test@example.com",
        lastDailyChallengeCompletedAt: {
          toMillis: () => 1710000000000,
        },
      };

      const result = PlayerSchema.safeParse(playerWithTimestamp);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lastDailyChallengeCompletedAt).toBe(1710000000000);
      }
    });
  });

  describe("FirestoreRiddleSchema", () => {
    it("should validate correct riddle data", () => {
      const validRiddle = {
        riddleId: "riddle123",
        text: "What has four legs but cannot walk?",
        answer: "TABLE",
        category: "objects",
        dailyIndex: 5,
      };

      const result = FirestoreRiddleSchema.safeParse(validRiddle);
      expect(result.success).toBe(true);
    });

    it("should reject riddle with empty answer", () => {
      const invalidRiddle = {
        riddleId: "riddle123",
        text: "What has four legs but cannot walk?",
        answer: "", // Empty answer should be invalid
      };

      const result = FirestoreRiddleSchema.safeParse(invalidRiddle);
      expect(result.success).toBe(false);
    });

    it("should reject riddle without riddleId", () => {
      const invalidRiddle = {
        text: "What has four legs but cannot walk?",
        answer: "TABLE",
      };

      const result = FirestoreRiddleSchema.safeParse(invalidRiddle);
      expect(result.success).toBe(false);
    });

    it("should handle riddle with optional fields", () => {
      const riddleWithOptionals = {
        riddleId: "riddle123",
        text: "What has four legs but cannot walk?",
        answer: "TABLE",
        // Optional fields not provided
      };

      const result = FirestoreRiddleSchema.safeParse(riddleWithOptionals);
      expect(result.success).toBe(true);
    });

    it("should handle riddle with both daily and classic indices", () => {
      const riddleWithIndices = {
        riddleId: "riddle123",
        text: "What has four legs but cannot walk?",
        answer: "TABLE",
        dailyIndex: 5,
        classicIndex: 10,
      };

      const result = FirestoreRiddleSchema.safeParse(riddleWithIndices);
      expect(result.success).toBe(true);
    });

    it("should reject riddle with negative indices", () => {
      const invalidRiddle = {
        riddleId: "riddle123",
        text: "What has four legs but cannot walk?",
        answer: "TABLE",
        dailyIndex: -1, // Negative index should be invalid
      };

      const result = FirestoreRiddleSchema.safeParse(invalidRiddle);
      expect(result.success).toBe(false);
    });
  });

  describe("schema error handling", () => {
    it("should provide detailed error messages for invalid data", () => {
      const invalidData = {
        userId: 123, // Should be string
        username: "", // Should not be empty
        coins: "not a number", // Should be number
      };

      const result = PlayerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        expect(result.error.issues[0]).toHaveProperty("message");
      }
    });

    it("should handle completely invalid input", () => {
      const result = PlayerSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it("should handle undefined input", () => {
      const result = PlayerSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });

    it("should handle array input when object expected", () => {
      const result = PlayerSchema.safeParse([]);
      expect(result.success).toBe(false);
    });

    it("should handle primitive input when object expected", () => {
      const result = PlayerSchema.safeParse("invalid");
      expect(result.success).toBe(false);
    });
  });
});
