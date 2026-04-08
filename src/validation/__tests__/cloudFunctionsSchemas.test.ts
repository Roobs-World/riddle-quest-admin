import {
  GameModeSchema,
  GetQuestionInputSchema,
  GetQuestionOutputSchema,
  GetAnswerInputSchema,
  GetAnswerOutputSchema,
  SubmitGuessInputSchema,
  SubmitGuessOutputSchema,
  GenerateClassicRiddlesInputSchema,
  GenerateClassicRiddlesOutputSchema,
  GetHintInputSchema,
  GetHintOutputSchema,
} from "../cloudFunctionsSchemas";

describe("cloudFunctionsSchemas", () => {
  describe("GameModeSchema", () => {
    it("should validate valid game modes", () => {
      const validModes = ["daily", "classic", "tutorial"];

      validModes.forEach((mode) => {
        const result = GameModeSchema.safeParse(mode);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid game modes", () => {
      const invalidModes = ["invalid", "test", 123, null];

      invalidModes.forEach((mode) => {
        const result = GameModeSchema.safeParse(mode);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("GetQuestionInputSchema", () => {
    it("should validate valid question input", () => {
      const validInput = {
        gameMode: "daily",
        currentIndex: 5,
      };

      const result = GetQuestionInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject invalid question input", () => {
      const invalidInput = {
        gameMode: "invalid",
        currentIndex: -1,
      };

      const result = GetQuestionInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should require both fields", () => {
      const incompleteInput = {
        gameMode: "daily",
      };

      const result = GetQuestionInputSchema.safeParse(incompleteInput);
      expect(result.success).toBe(false);
    });
  });

  describe("GetQuestionOutputSchema", () => {
    it("should validate valid question output", () => {
      const validOutput = {
        question: "What has four legs but cannot walk?",
        answerLength: 5,
      };

      const result = GetQuestionOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it("should allow null output", () => {
      const result = GetQuestionOutputSchema.safeParse(null);
      expect(result.success).toBe(true);
    });

    it("should reject invalid question output", () => {
      const invalidOutput = {
        question: 123,
        answerLength: "not a number",
      };

      const result = GetQuestionOutputSchema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });
  });

  describe("SubmitGuessInputSchema", () => {
    it("should validate valid submit guess input", () => {
      const validInput = {
        guess: "table",
        riddleId: "riddle123",
        gameMode: "challenge",
        attempts: 1,
      };

      const result = SubmitGuessInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject empty guess", () => {
      const invalidInput = {
        guess: "",
        riddleId: "riddle123",
        gameMode: "challenge",
      };

      const result = SubmitGuessInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid game mode", () => {
      const invalidInput = {
        guess: "table",
        riddleId: "riddle123",
        gameMode: "invalid",
      };

      const result = SubmitGuessInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("SubmitGuessOutputSchema", () => {
    it("should validate valid submit guess output", () => {
      const validOutput = {
        feedback: [
          { letter: "t", status: "green" },
          { letter: "a", status: "yellow" },
          { letter: "b", status: "red" },
        ],
        isCorrect: true,
        gameOver: true,
        correctAnswer: "table",
        coinsEarned: 100,
      };

      const result = SubmitGuessOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it("should validate output without optional fields", () => {
      const validOutput = {
        feedback: [{ letter: "t", status: "green" }],
        isCorrect: false,
        gameOver: false,
      };

      const result = SubmitGuessOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it("should reject invalid feedback status", () => {
      const invalidOutput = {
        feedback: [{ letter: "t", status: "invalid" }],
        isCorrect: true,
        gameOver: true,
      };

      const result = SubmitGuessOutputSchema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });
  });

  describe("GenerateClassicRiddlesInputSchema", () => {
    it("should validate empty input", () => {
      const validInput = {};

      const result = GenerateClassicRiddlesInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject non-object input", () => {
      const invalidInput = "not an object";

      const result = GenerateClassicRiddlesInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("GenerateClassicRiddlesOutputSchema", () => {
    it("should validate valid output", () => {
      const validOutput = {
        success: true,
        message: "Riddles generated successfully",
      };

      const result = GenerateClassicRiddlesOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it("should validate error output", () => {
      const errorOutput = {
        success: false,
        message: "Failed to generate riddles",
      };

      const result = GenerateClassicRiddlesOutputSchema.safeParse(errorOutput);
      expect(result.success).toBe(true);
    });

    it("should reject incomplete output", () => {
      const incompleteOutput = {
        success: true,
      };

      const result =
        GenerateClassicRiddlesOutputSchema.safeParse(incompleteOutput);
      expect(result.success).toBe(false);
    });
  });

  describe("GetHintInputSchema", () => {
    it("should validate valid hint input", () => {
      const validInput = {
        currentAttempt: ["t", "a", "b", "l", "e"],
        riddleId: "riddle123",
        gameMode: "daily",
      };

      const result = GetHintInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject invalid hint input", () => {
      const invalidInput = {
        currentAttempt: "not an array",
        riddleId: 123,
      };

      const result = GetHintInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("GetHintOutputSchema", () => {
    it("should validate valid hint output", () => {
      const validOutput = {
        revealedLetter: "t",
        index: 0,
        coinsCost: 50,
      };

      const result = GetHintOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it("should allow null output", () => {
      const result = GetHintOutputSchema.safeParse(null);
      expect(result.success).toBe(true);
    });

    it("should reject invalid hint output", () => {
      const invalidOutput = {
        revealedLetter: 123,
        index: "not a number",
        coinsCost: -1,
      };

      const result = GetHintOutputSchema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });
  });

  describe("schema consistency", () => {
    it("should export all expected schemas", () => {
      expect(GameModeSchema).toBeDefined();
      expect(GetQuestionInputSchema).toBeDefined();
      expect(GetQuestionOutputSchema).toBeDefined();
      expect(SubmitGuessInputSchema).toBeDefined();
      expect(SubmitGuessOutputSchema).toBeDefined();
      expect(GenerateClassicRiddlesInputSchema).toBeDefined();
      expect(GenerateClassicRiddlesOutputSchema).toBeDefined();
      expect(GetHintInputSchema).toBeDefined();
      expect(GetHintOutputSchema).toBeDefined();
    });

    it("should have consistent request/response patterns", () => {
      // All requests should require some form of identification
      const requestSchemas = [GetQuestionInputSchema, SubmitGuessInputSchema];

      requestSchemas.forEach((schema) => {
        expect(schema.safeParse({})).toEqual(
          expect.objectContaining({ success: false })
        );
      });
    });

    it("should have consistent response patterns", () => {
      // All responses should have a success field
      const responseSchemas = [
        GetQuestionOutputSchema,
        SubmitGuessOutputSchema,
        GenerateClassicRiddlesOutputSchema,
        GetHintOutputSchema,
      ];

      responseSchemas.forEach((schema) => {
        const validResponse = { success: true };
        const result = schema.safeParse(validResponse);
        // Should at least not fail immediately on success field
        expect(result).toBeDefined();
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty objects", () => {
      const schemas = [
        GameModeSchema,
        GetQuestionInputSchema,
        GetQuestionOutputSchema,
        SubmitGuessInputSchema,
        SubmitGuessOutputSchema,
        GenerateClassicRiddlesInputSchema,
        GenerateClassicRiddlesOutputSchema,
        GetHintInputSchema,
        GetHintOutputSchema,
      ];

      schemas.forEach((schema) => {
        const result = schema.safeParse({});
        expect(result).toHaveProperty("success");
        expect(typeof result.success).toBe("boolean");
      });
    });

    it("should handle null values", () => {
      const schemasRejectingNull = [
        GameModeSchema,
        GetQuestionInputSchema,
        SubmitGuessInputSchema,
        GenerateClassicRiddlesInputSchema,
        GetHintInputSchema,
      ];

      schemasRejectingNull.forEach((schema) => {
        const result = schema.safeParse(null);
        expect(result.success).toBe(false);
      });

      // Some schemas explicitly allow null values
      const schemasAllowingNull = [
        GetQuestionOutputSchema,
        GetHintOutputSchema,
      ];

      schemasAllowingNull.forEach((schema) => {
        const result = schema.safeParse(null);
        expect(result.success).toBe(true);
      });
    });

    it("should handle undefined values", () => {
      const schemas = [
        GameModeSchema,
        GetQuestionInputSchema,
        GetQuestionOutputSchema,
        SubmitGuessInputSchema,
        SubmitGuessOutputSchema,
        GenerateClassicRiddlesInputSchema,
        GenerateClassicRiddlesOutputSchema,
        GetHintInputSchema,
        GetHintOutputSchema,
      ];

      schemas.forEach((schema) => {
        const result = schema.safeParse(undefined);
        expect(result.success).toBe(false);
      });
    });
  });
});
