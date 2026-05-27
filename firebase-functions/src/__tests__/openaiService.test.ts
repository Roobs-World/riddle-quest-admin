/* eslint-disable @typescript-eslint/no-explicit-any */
import {describe, expect, test, beforeEach, afterEach, jest} from "@jest/globals";

const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
jest.mock("firebase-functions", () => ({logger: mockLogger}));

const mockParse = jest.fn();
const mockOpenAI = jest.fn().mockImplementation(() => ({
  chat: {
    completions: {
      parse: mockParse,
    },
  },
}));

jest.mock("openai", () => ({
  __esModule: true,
  default: mockOpenAI,
}));

import {GeneratedRiddleSchema, generateUniqueRiddle, resetOpenAIClient} from "../openaiService";
import {MAX_RIDDLE_ANSWER_CHARACTERS} from "../constants";

function parsedRiddleResponse(question: string, answer: string) {
  return {
    choices: [
      {
        message: {
          parsed: {question, answer},
        },
      },
    ],
  };
}

describe("OpenAI Service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    resetOpenAIClient();
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: "test-api-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe("GeneratedRiddleSchema", () => {
    test("accepts the structured riddle shape", () => {
      expect(
        GeneratedRiddleSchema.parse({
          question: "What flies without wings?",
          answer: "time",
        }),
      ).toEqual({
        question: "What flies without wings?",
        answer: "time",
      });
    });

    test("rejects answers that violate length or character rules", () => {
      expect(() =>
        GeneratedRiddleSchema.parse({
          question: "What answer is much too long?",
          answer: "verylongword",
        }),
      ).toThrow();
      expect(() =>
        GeneratedRiddleSchema.parse({
          question: "What answer uses uppercase letters?",
          answer: "WORD",
        }),
      ).toThrow();
    });
  });

  describe("generateUniqueRiddle", () => {
    test("generates a valid riddle from structured OpenAI output", async () => {
      mockParse.mockResolvedValue(parsedRiddleResponse("What flies without wings?", "time"));

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["What flies without wings?", "time"]);
      expect(mockOpenAI).toHaveBeenCalledWith({apiKey: "test-api-key"});
      expect(mockParse).toHaveBeenCalledWith({
        model: "gpt-5.5",
        messages: expect.arrayContaining([
          expect.objectContaining({role: "system"}),
          expect.objectContaining({role: "user"}),
        ]),
        response_format: expect.objectContaining({
          type: "json_schema",
        }),
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Generated valid riddle: "What flies without wings?" -> "time" (4 chars)',
      );
    });

    test("includes riddle rules, broad pub quiz guidance, and structured output in the prompt", async () => {
      mockParse.mockResolvedValue(parsedRiddleResponse("What flies without wings?", "time"));

      await generateUniqueRiddle();

      const request = mockParse.mock.calls[0][0] as {
        messages: {role: string; content: string}[];
        response_format: unknown;
      };
      const userPrompt = request.messages.find((message) => message.role === "user")?.content;
      const systemPrompt = request.messages.find((message) => message.role === "system")?.content;

      expect(userPrompt).toContain("JSON object");
      expect(userPrompt).toContain(`Answer: MAXIMUM ${MAX_RIDDLE_ANSWER_CHARACTERS} characters`);
      expect(userPrompt).toContain(`must never exceed ${MAX_RIDDLE_ANSWER_CHARACTERS} characters`);
      expect(userPrompt).toContain("must contain only lowercase letters");
      expect(userPrompt).toContain("must not include the answer word anywhere");
      expect(userPrompt).toContain("music, history, general knowledge, film and TV, sport, geography, science");
      expect(userPrompt).toContain("one clear answer");
      expect(userPrompt).toContain("obscure proper nouns");
      expect(systemPrompt).toContain("pub quizzes");
      expect(systemPrompt).toContain("Rotate subjects over time");
      expect(systemPrompt).toContain("avoid obscure specialist trivia");
      expect(request.response_format).toEqual(
        expect.objectContaining({
          type: "json_schema",
        }),
      );
    });

    test("uses OPENAI_MODEL override when provided", async () => {
      process.env.OPENAI_MODEL = "gpt-4.1-mini";
      mockParse.mockResolvedValue(parsedRiddleResponse("What runs but never walks?", "river"));

      await generateUniqueRiddle();

      expect(mockParse).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4.1-mini",
        }),
      );
    });

    test("rejects an answer that is too long", async () => {
      mockParse.mockResolvedValue(parsedRiddleResponse("What is very long?", "verylongword"));

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Answer too long: "verylongword" (12 characters). Must be 7 or fewer.',
      );
    });

    test("rejects an answer with invalid characters", async () => {
      mockParse.mockResolvedValue(parsedRiddleResponse("What has punctuation?", "word!"));

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Answer contains invalid characters: "word!". Must be only lowercase letters.',
      );
    });

    test("rejects a question that reveals the literal answer", async () => {
      mockParse.mockResolvedValue(parsedRiddleResponse("A joke makes people laugh.", "joke"));

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Question reveals the literal answer: "A joke makes people laugh." -> "joke".',
      );
    });

    test("returns null when OpenAI returns empty structured content", async () => {
      mockParse.mockResolvedValue({
        choices: [
          {
            message: {
              parsed: null,
            },
          },
        ],
      });

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith("OpenAI returned empty structured riddle content.");
    });

    test("handles OpenAI API errors gracefully", async () => {
      const apiError = new Error("OpenAI API rate limit exceeded");
      mockParse.mockRejectedValue(apiError);

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith("Error generating riddle with OpenAI (model: gpt-5.5):", apiError);
    });

    test("throws error when OPENAI_API_KEY is missing", async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(generateUniqueRiddle()).rejects.toThrow("Missing required environment variable: OPENAI_API_KEY");
    });

    test("reuses OpenAI client on subsequent calls", async () => {
      mockParse.mockResolvedValue(parsedRiddleResponse("What is reused?", "client"));

      await generateUniqueRiddle();
      await generateUniqueRiddle();

      expect(mockOpenAI).toHaveBeenCalledTimes(1);
      expect(mockParse).toHaveBeenCalledTimes(2);
    });
  });
});
