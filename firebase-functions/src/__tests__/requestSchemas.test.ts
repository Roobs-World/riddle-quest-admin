import {describe, expect, test} from "@jest/globals";

import {
  CompleteGameRequestDataSchema,
  CompleteGameResponseDataSchema,
  SubmitGuessRequestDataSchema,
  SubmitGuessResponseDataSchema,
} from "@riddle-quest/core/validation/requestSchemas";

// Import types and interfaces to test
import type {
  FeedbackColorValue,
  FeedbackItem,
  SubmitGuessRequestData,
  SubmitGuessAuthContext,
  SubmitGuessResponseData,
} from "@riddle-quest/core/validation/requestSchemas";

describe("Request Schemas", () => {
  describe("Zod callable contracts", () => {
    test("validates submitGuess request and response payloads", () => {
      expect(
        SubmitGuessRequestDataSchema.parse({
          guess: "HELLO",
          riddleId: "classic_level_1",
          gameMode: "classic",
          attempts: 2,
        }),
      ).toEqual({
        guess: "HELLO",
        riddleId: "classic_level_1",
        gameMode: "classic",
        attempts: 2,
      });

      expect(
        SubmitGuessResponseDataSchema.parse({
          feedback: [
            {letter: "h", status: "green"},
            {letter: "i", status: "red"},
          ],
          isCorrect: false,
          gameOver: false,
          coinsEarned: 0,
          newlyUnlockedAchievementIds: [],
        }),
      ).toEqual({
        feedback: [
          {letter: "h", status: "green"},
          {letter: "i", status: "red"},
        ],
        isCorrect: false,
        gameOver: false,
        coinsEarned: 0,
        newlyUnlockedAchievementIds: [],
      });
    });

    test("rejects malformed submitGuess payloads", () => {
      expect(() =>
        SubmitGuessRequestDataSchema.parse({
          guess: "",
          riddleId: "classic_level_1",
          gameMode: "classic",
          attempts: 2,
        }),
      ).toThrow();
      expect(() =>
        SubmitGuessResponseDataSchema.parse({
          feedback: [{letter: "ab", status: "green"}],
          isCorrect: false,
          gameOver: false,
        }),
      ).toThrow();
    });

    test("validates completeGame request and response payloads", () => {
      expect(
        CompleteGameRequestDataSchema.parse({
          riddleId: "daily_2026-05-27",
          gameMode: "challenge",
          sessionToken: "00000000-0000-4000-8000-000000000001",
        }),
      ).toEqual({
        riddleId: "daily_2026-05-27",
        gameMode: "challenge",
        sessionToken: "00000000-0000-4000-8000-000000000001",
      });

      expect(
        CompleteGameResponseDataSchema.parse({
          attempts: 3,
          isCorrect: true,
          coinsEarned: 20,
          newlyUnlockedAchievementIds: ["first_win"],
          scoreEarned: 80,
          xpEarned: 80,
          newXp: 180,
          newLevel: 2,
          leveledUp: true,
          newWinStreak: 1,
        }),
      ).toEqual({
        attempts: 3,
        isCorrect: true,
        coinsEarned: 20,
        newlyUnlockedAchievementIds: ["first_win"],
        scoreEarned: 80,
        xpEarned: 80,
        newXp: 180,
        newLevel: 2,
        leveledUp: true,
        newWinStreak: 1,
      });
    });
  });

  describe("FeedbackColorValue", () => {
    test("should accept valid color values", () => {
      /** Provides valid colors behavior. */
      const validColors: FeedbackColorValue[] = ["green", "yellow", "red"];

      validColors.forEach((color) => {
        /** Provides feedback behavior. */
        const feedback: FeedbackItem = {
          letter: "A",
          status: color,
        };
        expect(feedback.status).toBe(color);
      });
    });

    test("should be used in FeedbackItem correctly", () => {
      /** Provides green feedback behavior. */
      const greenFeedback: FeedbackItem = {
        letter: "A",
        status: "green",
      };

      /** Provides yellow feedback behavior. */
      const yellowFeedback: FeedbackItem = {
        letter: "B",
        status: "yellow",
      };

      /** Provides red feedback behavior. */
      const redFeedback: FeedbackItem = {
        letter: "C",
        status: "red",
      };

      expect(greenFeedback.status).toBe("green");
      expect(yellowFeedback.status).toBe("yellow");
      expect(redFeedback.status).toBe("red");
    });
  });

  describe("FeedbackItem", () => {
    test("should have correct structure with letter and status", () => {
      /** Provides feedback behavior. */
      const feedback: FeedbackItem = {
        letter: "T",
        status: "green",
      };

      expect(feedback).toHaveProperty("letter");
      expect(feedback).toHaveProperty("status");
      expect(typeof feedback.letter).toBe("string");
      expect(["green", "yellow", "red"]).toContain(feedback.status);
    });

    test("should work with different letters and statuses", () => {
      /** Provides feedback items behavior. */
      const feedbackItems: FeedbackItem[] = [
        {letter: "H", status: "green"},
        {letter: "E", status: "yellow"},
        {letter: "L", status: "red"},
        {letter: "L", status: "green"},
        {letter: "O", status: "yellow"},
      ];

      feedbackItems.forEach((item) => {
        expect(typeof item.letter).toBe("string");
        expect(item.letter.length).toBe(1);
        expect(["green", "yellow", "red"]).toContain(item.status);
      });
    });

    test("should support both uppercase and lowercase letters", () => {
      /** Provides feedback items behavior. */
      const feedbackItems: FeedbackItem[] = [
        {letter: "a", status: "green"},
        {letter: "A", status: "yellow"},
        {letter: "z", status: "red"},
        {letter: "Z", status: "green"},
      ];

      feedbackItems.forEach((item) => {
        expect(typeof item.letter).toBe("string");
        expect(["green", "yellow", "red"]).toContain(item.status);
      });
    });
  });

  describe("SubmitGuessRequestData", () => {
    test("should have correct structure", () => {
      /** Requests data. */
      const requestData: SubmitGuessRequestData = {
        guess: "HELLO",
        riddleId: "riddle123",
        gameMode: "challenge",
        attempts: 3,
      };

      expect(requestData).toHaveProperty("guess");
      expect(requestData).toHaveProperty("riddleId");
      expect(requestData).toHaveProperty("gameMode");
      expect(requestData).toHaveProperty("attempts");
    });

    test("should accept challenge game mode", () => {
      /** Provides challenge request behavior. */
      const challengeRequest: SubmitGuessRequestData = {
        guess: "WORLD",
        riddleId: "daily_2024-01-15",
        gameMode: "challenge",
        attempts: 1,
      };

      expect(challengeRequest.gameMode).toBe("challenge");
    });

    test("should accept classic game mode", () => {
      /** Provides classic request behavior. */
      const classicRequest: SubmitGuessRequestData = {
        guess: "ANSWER",
        riddleId: "classic_level_5",
        gameMode: "classic",
        attempts: 2,
      };

      expect(classicRequest.gameMode).toBe("classic");
    });

    test("should handle different guess lengths", () => {
      /** Requests s. */
      const requests: SubmitGuessRequestData[] = [
        {guess: "CAT", riddleId: "riddle1", gameMode: "classic", attempts: 1},
        {guess: "WORD", riddleId: "riddle2", gameMode: "challenge", attempts: 2},
        {guess: "HELLO", riddleId: "riddle3", gameMode: "classic", attempts: 3},
        {guess: "ELEPHANT", riddleId: "riddle4", gameMode: "challenge", attempts: 4},
      ];

      requests.forEach((request) => {
        expect(typeof request.guess).toBe("string");
        expect(request.guess.length).toBeGreaterThan(0);
        expect(["challenge", "classic"]).toContain(request.gameMode);
        expect(typeof request.attempts).toBe("number");
        expect(request.attempts).toBeGreaterThan(0);
      });
    });

    test("should handle various riddle ID formats", () => {
      /** Provides riddle ids behavior. */
      const riddleIds = ["daily_2024-01-15", "classic_level_1", "custom_riddle_abc123", "riddle_12345"];

      riddleIds.forEach((riddleId) => {
        /** Provides request behavior. */
        const request: SubmitGuessRequestData = {
          guess: "TEST",
          riddleId: riddleId,
          gameMode: "classic",
          attempts: 1,
        };

        expect(request.riddleId).toBe(riddleId);
        expect(typeof request.riddleId).toBe("string");
      });
    });

    test("should handle different attempt counts", () => {
      /** Provides attempt counts behavior. */
      const attemptCounts = [1, 2, 3, 4, 5, 10, 100];

      attemptCounts.forEach((attempts) => {
        /** Provides request behavior. */
        const request: SubmitGuessRequestData = {
          guess: "GUESS",
          riddleId: "test_riddle",
          gameMode: "classic",
          attempts: attempts,
        };

        expect(request.attempts).toBe(attempts);
        expect(typeof request.attempts).toBe("number");
      });
    });
  });

  describe("SubmitGuessAuthContext", () => {
    test("should have correct structure with uid", () => {
      /** Provides auth context behavior. */
      const authContext: SubmitGuessAuthContext = {
        uid: "user123",
      };

      expect(authContext).toHaveProperty("uid");
      expect(typeof authContext.uid).toBe("string");
    });

    test("should handle different UID formats", () => {
      /** Provides uids behavior. */
      const uids = [
        "user123",
        "firebase_auth_uid_abc123def456",
        "google_oauth_12345",
        "anonymous_temp_user",
        "test-user-id",
      ];

      uids.forEach((uid) => {
        /** Provides auth context behavior. */
        const authContext: SubmitGuessAuthContext = {
          uid: uid,
        };

        expect(authContext.uid).toBe(uid);
        expect(typeof authContext.uid).toBe("string");
      });
    });

    test("should be extensible for additional auth properties", () => {
      // Test that the interface can be extended (compile-time test)
      /** Defines the contract for extended auth context. */
      interface ExtendedAuthContext extends SubmitGuessAuthContext {
        /** Stores token. */
        token?: string;
        /** Stores role. */
        role?: string;
      }

      /** Provides extended auth behavior. */
      const extendedAuth: ExtendedAuthContext = {
        uid: "user123",
        token: "auth_token_abc",
        role: "player",
      };

      expect(extendedAuth.uid).toBe("user123");
      expect(extendedAuth.token).toBe("auth_token_abc");
      expect(extendedAuth.role).toBe("player");
    });
  });

  describe("SubmitGuessResponseData", () => {
    test("should have correct structure with feedback and isCorrect", () => {
      /** Provides response behavior. */
      const response: SubmitGuessResponseData = {
        feedback: [
          {letter: "H", status: "green"},
          {letter: "E", status: "yellow"},
          {letter: "L", status: "red"},
        ],
        isCorrect: false,
      };

      expect(response).toHaveProperty("feedback");
      expect(response).toHaveProperty("isCorrect");
      expect(Array.isArray(response.feedback)).toBe(true);
      expect(typeof response.isCorrect).toBe("boolean");
    });

    test("should handle correct guess response", () => {
      /** Provides correct response behavior. */
      const correctResponse: SubmitGuessResponseData = {
        feedback: [
          {letter: "W", status: "green"},
          {letter: "O", status: "green"},
          {letter: "R", status: "green"},
          {letter: "D", status: "green"},
        ],
        isCorrect: true,
        coinsEarned: 20,
      };

      expect(correctResponse.isCorrect).toBe(true);
      expect(correctResponse.coinsEarned).toBe(20);
      expect(correctResponse.feedback.every((item) => item.status === "green")).toBe(true);
    });

    test("should handle incorrect guess response", () => {
      /** Provides incorrect response behavior. */
      const incorrectResponse: SubmitGuessResponseData = {
        feedback: [
          {letter: "W", status: "red"},
          {letter: "R", status: "yellow"},
          {letter: "O", status: "red"},
          {letter: "N", status: "red"},
          {letter: "G", status: "red"},
        ],
        isCorrect: false,
      };

      expect(incorrectResponse.isCorrect).toBe(false);
      expect(incorrectResponse.coinsEarned).toBeUndefined();
      expect(incorrectResponse).not.toHaveProperty("correctAnswer");
    });

    test("rejects answer disclosure in a game-over response", () => {
      expect(
        SubmitGuessResponseDataSchema.safeParse({
          feedback: [
            {letter: "F", status: "red"},
            {letter: "A", status: "yellow"},
            {letter: "I", status: "red"},
            {letter: "L", status: "red"},
          ],
          isCorrect: false,
          gameOver: true,
          correctAnswer: "WORD",
        }).success,
      ).toBe(false);
    });

    test("should handle optional properties correctly", () => {
      // Response with no optional properties
      /** Provides basic response behavior. */
      const basicResponse: SubmitGuessResponseData = {
        feedback: [{letter: "A", status: "green"}],
        isCorrect: true,
      };

      // Response with coinsEarned
      /** Provides response with coins behavior. */
      const responseWithCoins: SubmitGuessResponseData = {
        feedback: [{letter: "B", status: "green"}],
        isCorrect: true,
        coinsEarned: 15,
      };

      /** Provides response with coins and achievements behavior. */
      const responseWithCoinsAndAchievements: SubmitGuessResponseData = {
        feedback: [{letter: "D", status: "green"}],
        isCorrect: true,
        coinsEarned: 10,
        newlyUnlockedAchievementIds: ["first_win"],
      };

      expect(basicResponse.coinsEarned).toBeUndefined();
      expect(basicResponse).not.toHaveProperty("correctAnswer");

      expect(responseWithCoins.coinsEarned).toBe(15);
      expect(responseWithCoins).not.toHaveProperty("correctAnswer");
      expect(responseWithCoinsAndAchievements.coinsEarned).toBe(10);
      expect(responseWithCoinsAndAchievements.newlyUnlockedAchievementIds).toEqual(["first_win"]);
    });

    test("should handle empty feedback array", () => {
      /** Provides empty feedback response behavior. */
      const emptyFeedbackResponse: SubmitGuessResponseData = {
        feedback: [],
        isCorrect: false,
      };

      expect(emptyFeedbackResponse.feedback).toEqual([]);
      expect(Array.isArray(emptyFeedbackResponse.feedback)).toBe(true);
      expect(emptyFeedbackResponse.feedback.length).toBe(0);
    });

    test("should handle various feedback combinations", () => {
      /** Provides mixed feedback behavior. */
      const mixedFeedback: FeedbackItem[] = [
        {letter: "T", status: "green"}, // Correct position
        {letter: "E", status: "yellow"}, // Wrong position
        {letter: "S", status: "red"}, // Not in word
        {letter: "T", status: "green"}, // Correct position (repeated letter)
      ];

      /** Provides response behavior. */
      const response: SubmitGuessResponseData = {
        feedback: mixedFeedback,
        isCorrect: false,
      };

      expect(response.feedback.length).toBe(4);
      expect(response.feedback[0].status).toBe("green");
      expect(response.feedback[1].status).toBe("yellow");
      expect(response.feedback[2].status).toBe("red");
      expect(response.feedback[3].status).toBe("green");
    });
  });

  describe("Type Integration", () => {
    test("should work together in a complete request-response flow", () => {
      // Mock request data
      /** Requests data. */
      const requestData: SubmitGuessRequestData = {
        guess: "HELLO",
        riddleId: "daily_2024-01-15",
        gameMode: "challenge",
        attempts: 3,
      };

      // Mock auth context
      /** Provides auth context behavior. */
      const authContext: SubmitGuessAuthContext = {
        uid: "user123",
      };

      // Mock response data
      /** Provides response data behavior. */
      const responseData: SubmitGuessResponseData = {
        feedback: [
          {letter: "H", status: "green"},
          {letter: "E", status: "yellow"},
          {letter: "L", status: "red"},
          {letter: "L", status: "red"},
          {letter: "O", status: "green"},
        ],
        isCorrect: false,
      };

      // Verify all types work together
      expect(requestData.guess.length).toBe(responseData.feedback.length);
      expect(typeof authContext.uid).toBe("string");
      expect(typeof requestData.attempts).toBe("number");
      expect(typeof responseData.isCorrect).toBe("boolean");
    });

    test("should handle edge cases consistently", () => {
      // Very short guess
      /** Provides short request behavior. */
      const shortRequest: SubmitGuessRequestData = {
        guess: "I",
        riddleId: "short_riddle",
        gameMode: "classic",
        attempts: 1,
      };

      /** Provides short response behavior. */
      const shortResponse: SubmitGuessResponseData = {
        feedback: [{letter: "I", status: "green"}],
        isCorrect: true,
        coinsEarned: 25, // Bonus for first attempt
      };

      // Very long guess
      /** Provides long request behavior. */
      const longRequest: SubmitGuessRequestData = {
        guess: "ENCYCLOPEDIA",
        riddleId: "long_riddle",
        gameMode: "challenge",
        attempts: 5,
      };

      /** Provides long response behavior. */
      const longResponse: SubmitGuessResponseData = {
        feedback: "ENCYCLOPEDIA".split("").map((letter) => ({
          letter: letter,
          status: "red" as FeedbackColorValue,
        })),
        isCorrect: false,
      };

      expect(shortRequest.guess.length).toBe(1);
      expect(shortResponse.feedback.length).toBe(1);
      expect(longRequest.guess.length).toBe(12);
      expect(longResponse.feedback.length).toBe(12);
    });
  });
});
