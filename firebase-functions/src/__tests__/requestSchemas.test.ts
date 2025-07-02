/* eslint-disable @typescript-eslint/no-explicit-any */
import {describe, expect, test} from "@jest/globals";

// Import types and interfaces to test
import type {
  FeedbackColorValue,
  FeedbackItem,
  SubmitGuessRequestData,
  SubmitGuessAuthContext,
  SubmitGuessResponseData,
} from "../validation/requestSchemas";

describe("Request Schemas", () => {
  describe("FeedbackColorValue", () => {
    test("should accept valid color values", () => {
      const validColors: FeedbackColorValue[] = ["green", "yellow", "red"];

      validColors.forEach((color) => {
        const feedback: FeedbackItem = {
          letter: "A",
          status: color,
        };
        expect(feedback.status).toBe(color);
      });
    });

    test("should be used in FeedbackItem correctly", () => {
      const greenFeedback: FeedbackItem = {
        letter: "A",
        status: "green",
      };

      const yellowFeedback: FeedbackItem = {
        letter: "B",
        status: "yellow",
      };

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
      const challengeRequest: SubmitGuessRequestData = {
        guess: "WORLD",
        riddleId: "daily_2024-01-15",
        gameMode: "challenge",
        attempts: 1,
      };

      expect(challengeRequest.gameMode).toBe("challenge");
    });

    test("should accept classic game mode", () => {
      const classicRequest: SubmitGuessRequestData = {
        guess: "ANSWER",
        riddleId: "classic_level_5",
        gameMode: "classic",
        attempts: 2,
      };

      expect(classicRequest.gameMode).toBe("classic");
    });

    test("should handle different guess lengths", () => {
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
      const riddleIds = [
        "daily_2024-01-15",
        "classic_level_1",
        "tutorial_intro",
        "custom_riddle_abc123",
        "riddle_12345",
      ];

      riddleIds.forEach((riddleId) => {
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
      const attemptCounts = [1, 2, 3, 4, 5, 10, 100];

      attemptCounts.forEach((attempts) => {
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
      const authContext: SubmitGuessAuthContext = {
        uid: "user123",
      };

      expect(authContext).toHaveProperty("uid");
      expect(typeof authContext.uid).toBe("string");
    });

    test("should handle different UID formats", () => {
      const uids = [
        "user123",
        "firebase_auth_uid_abc123def456",
        "google_oauth_12345",
        "anonymous_temp_user",
        "test-user-id",
      ];

      uids.forEach((uid) => {
        const authContext: SubmitGuessAuthContext = {
          uid: uid,
        };

        expect(authContext.uid).toBe(uid);
        expect(typeof authContext.uid).toBe("string");
      });
    });

    test("should be extensible for additional auth properties", () => {
      // Test that the interface can be extended (compile-time test)
      interface ExtendedAuthContext extends SubmitGuessAuthContext {
        token?: string;
        role?: string;
      }

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
      expect(incorrectResponse.correctAnswer).toBeUndefined();
    });

    test("should handle game over response with correct answer", () => {
      const gameOverResponse: SubmitGuessResponseData = {
        feedback: [
          {letter: "F", status: "red"},
          {letter: "A", status: "yellow"},
          {letter: "I", status: "red"},
          {letter: "L", status: "red"},
        ],
        isCorrect: false,
        correctAnswer: "WORD",
      };

      expect(gameOverResponse.isCorrect).toBe(false);
      expect(gameOverResponse.correctAnswer).toBe("WORD");
      expect(gameOverResponse.coinsEarned).toBeUndefined();
    });

    test("should handle optional properties correctly", () => {
      // Response with no optional properties
      const basicResponse: SubmitGuessResponseData = {
        feedback: [{letter: "A", status: "green"}],
        isCorrect: true,
      };

      // Response with coinsEarned
      const responseWithCoins: SubmitGuessResponseData = {
        feedback: [{letter: "B", status: "green"}],
        isCorrect: true,
        coinsEarned: 15,
      };

      // Response with correctAnswer
      const responseWithAnswer: SubmitGuessResponseData = {
        feedback: [{letter: "C", status: "red"}],
        isCorrect: false,
        correctAnswer: "TEST",
      };

      // Response with both optional properties
      const responseWithBoth: SubmitGuessResponseData = {
        feedback: [{letter: "D", status: "green"}],
        isCorrect: true,
        coinsEarned: 10,
        correctAnswer: "BONUS", // Could be provided even when correct for logging
      };

      expect(basicResponse.coinsEarned).toBeUndefined();
      expect(basicResponse.correctAnswer).toBeUndefined();

      expect(responseWithCoins.coinsEarned).toBe(15);
      expect(responseWithCoins.correctAnswer).toBeUndefined();

      expect(responseWithAnswer.coinsEarned).toBeUndefined();
      expect(responseWithAnswer.correctAnswer).toBe("TEST");

      expect(responseWithBoth.coinsEarned).toBe(10);
      expect(responseWithBoth.correctAnswer).toBe("BONUS");
    });

    test("should handle empty feedback array", () => {
      const emptyFeedbackResponse: SubmitGuessResponseData = {
        feedback: [],
        isCorrect: false,
      };

      expect(emptyFeedbackResponse.feedback).toEqual([]);
      expect(Array.isArray(emptyFeedbackResponse.feedback)).toBe(true);
      expect(emptyFeedbackResponse.feedback.length).toBe(0);
    });

    test("should handle various feedback combinations", () => {
      const mixedFeedback: FeedbackItem[] = [
        {letter: "T", status: "green"}, // Correct position
        {letter: "E", status: "yellow"}, // Wrong position
        {letter: "S", status: "red"}, // Not in word
        {letter: "T", status: "green"}, // Correct position (repeated letter)
      ];

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
      const requestData: SubmitGuessRequestData = {
        guess: "HELLO",
        riddleId: "daily_2024-01-15",
        gameMode: "challenge",
        attempts: 3,
      };

      // Mock auth context
      const authContext: SubmitGuessAuthContext = {
        uid: "user123",
      };

      // Mock response data
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
      const shortRequest: SubmitGuessRequestData = {
        guess: "I",
        riddleId: "short_riddle",
        gameMode: "classic",
        attempts: 1,
      };

      const shortResponse: SubmitGuessResponseData = {
        feedback: [{letter: "I", status: "green"}],
        isCorrect: true,
        coinsEarned: 25, // Bonus for first attempt
      };

      // Very long guess
      const longRequest: SubmitGuessRequestData = {
        guess: "ENCYCLOPEDIA",
        riddleId: "long_riddle",
        gameMode: "challenge",
        attempts: 5,
      };

      const longResponse: SubmitGuessResponseData = {
        feedback: "ENCYCLOPEDIA".split("").map((letter) => ({
          letter: letter,
          status: "red" as FeedbackColorValue,
        })),
        isCorrect: false,
        correctAnswer: "DICTIONARY",
      };

      expect(shortRequest.guess.length).toBe(1);
      expect(shortResponse.feedback.length).toBe(1);
      expect(longRequest.guess.length).toBe(12);
      expect(longResponse.feedback.length).toBe(12);
    });
  });
});
