import { generateFeedbackEmojiGrid } from "../gameUtils";
import type { SubmittedGuess } from "../../hooks/types";

describe("gameUtils", () => {
  describe("generateFeedbackEmojiGrid", () => {
    it("should return empty string for empty guess array", () => {
      const result = generateFeedbackEmojiGrid([]);
      expect(result).toBe("");
    });

    it("should generate correct emojis for single guess with all green feedback", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["A", "P", "P", "L", "E"],
          feedback: ["green", "green", "green", "green", "green"],
        },
      ];

      const result = generateFeedbackEmojiGrid(guesses);
      expect(result).toBe("🟩🟩🟩🟩🟩");
    });

    it("should generate correct emojis for single guess with all yellow feedback", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["A", "P", "P", "L", "E"],
          feedback: ["yellow", "yellow", "yellow", "yellow", "yellow"],
        },
      ];

      const result = generateFeedbackEmojiGrid(guesses);
      expect(result).toBe("🟨🟨🟨🟨🟨");
    });

    it("should generate correct emojis for single guess with all red feedback", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["A", "P", "P", "L", "E"],
          feedback: ["red", "red", "red", "red", "red"],
        },
      ];

      const result = generateFeedbackEmojiGrid(guesses);
      expect(result).toBe("⬜️⬜️⬜️⬜️⬜️");
    });

    it("should generate correct emojis for mixed feedback types", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["A", "P", "P", "L", "E"],
          feedback: ["green", "yellow", "red", "green", "yellow"],
        },
      ];

      const result = generateFeedbackEmojiGrid(guesses);
      expect(result).toBe("🟩🟨⬜️🟩🟨");
    });

    it("should handle multiple guesses with newlines between them", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["A", "P", "P", "L", "E"],
          feedback: ["green", "yellow", "red", "green", "yellow"],
        },
        {
          guess: ["B", "R", "E", "A", "D"],
          feedback: ["red", "green", "green", "yellow", "red"],
        },
      ];

      const result = generateFeedbackEmojiGrid(guesses);
      expect(result).toBe("🟩🟨⬜️🟩🟨\n⬜️🟩🟩🟨⬜️");
    });

    it("should handle three guesses correctly", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["A", "P", "P", "L", "E"],
          feedback: ["green", "red", "red", "red", "red"],
        },
        {
          guess: ["B", "R", "E", "A", "D"],
          feedback: ["yellow", "green", "red", "red", "red"],
        },
        {
          guess: ["C", "H", "A", "I", "R"],
          feedback: ["green", "green", "green", "green", "green"],
        },
      ];

      const result = generateFeedbackEmojiGrid(guesses);
      expect(result).toBe("🟩⬜️⬜️⬜️⬜️\n🟨🟩⬜️⬜️⬜️\n🟩🟩🟩🟩🟩");
    });

    it("should handle unknown feedback types as default white squares", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["A", "P", "P", "L", "E"],
          feedback: [
            "green",
            "unknown" as any,
            "invalid" as any,
            "yellow",
            "red",
          ],
        },
      ];

      const result = generateFeedbackEmojiGrid(guesses);
      expect(result).toBe("🟩⬜️⬜️🟨⬜️");
    });

    it("should handle different word lengths", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["C", "A", "T"],
          feedback: ["green", "yellow", "red"],
        },
        {
          guess: ["E", "L", "E", "P", "H", "A", "N", "T"],
          feedback: [
            "green",
            "green",
            "yellow",
            "yellow",
            "red",
            "red",
            "green",
            "yellow",
          ],
        },
      ];

      const result = generateFeedbackEmojiGrid(guesses);
      expect(result).toBe("🟩🟨⬜️\n🟩🟩🟨🟨⬜️⬜️🟩🟨");
    });

    it("should handle edge case with single letter word", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["A"],
          feedback: ["green"],
        },
      ];

      const result = generateFeedbackEmojiGrid(guesses);
      expect(result).toBe("🟩");
    });

    it("should handle empty feedback array", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: [],
          feedback: [],
        },
      ];

      const result = generateFeedbackEmojiGrid(guesses);
      expect(result).toBe("");
    });

    it("should handle multiple empty feedback arrays", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: [],
          feedback: [],
        },
        {
          guess: [],
          feedback: [],
        },
      ];

      const result = generateFeedbackEmojiGrid(guesses);
      expect(result).toBe("\n");
    });

    it("should handle mix of empty and non-empty feedback", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: [],
          feedback: [],
        },
        {
          guess: ["A", "P", "P", "L", "E"],
          feedback: ["green", "yellow", "red", "green", "yellow"],
        },
        {
          guess: [],
          feedback: [],
        },
      ];

      const result = generateFeedbackEmojiGrid(guesses);
      expect(result).toBe("\n🟩🟨⬜️🟩🟨\n");
    });

    it("should test all feedback switch cases", () => {
      // Test each feedback type individually to ensure all switch cases are covered
      const testCases = [
        { feedback: "green", expected: "🟩" },
        { feedback: "yellow", expected: "🟨" },
        { feedback: "red", expected: "⬜️" },
        { feedback: null, expected: "⬜️" },
        { feedback: undefined, expected: "⬜️" },
        { feedback: "", expected: "⬜️" },
        { feedback: "blue", expected: "⬜️" },
        { feedback: 123, expected: "⬜️" },
      ];

      testCases.forEach(({ feedback, expected }) => {
        const guesses: SubmittedGuess[] = [
          {
            guess: ["A"],
            feedback: [feedback as any],
          },
        ];

        const result = generateFeedbackEmojiGrid(guesses);
        expect(result).toBe(expected);
      });
    });

    it("should maintain emoji order correctly", () => {
      const guesses: SubmittedGuess[] = [
        {
          guess: ["T", "E", "S", "T", "S"],
          feedback: ["red", "yellow", "green", "yellow", "red"],
        },
      ];

      const result = generateFeedbackEmojiGrid(guesses);
      // Verify the order is maintained exactly as in feedback array
      expect(result).toBe("⬜️🟨🟩🟨⬜️");
      // Verify the pattern is correct (red, yellow, green, yellow, red)
      expect(result).toContain("⬜️"); // Contains white squares
      expect(result).toContain("🟨"); // Contains yellow squares
      expect(result).toContain("🟩"); // Contains green squares
    });
  });
});

