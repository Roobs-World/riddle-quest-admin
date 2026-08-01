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

function approvedReviewResponse() {
  return {
    choices: [
      {
        message: {
          parsed: {
            clueSupportsAnswer: true,
            singleBestAnswer: true,
            factuallySound: true,
            naturalLanguage: true,
            fairForCasualPlayers: true,
            noAnswerSpoiler: true,
            issues: [],
          },
        },
      },
    ],
  };
}

function rejectedReviewResponse(issues: string[]) {
  return {
    choices: [
      {
        message: {
          parsed: {
            clueSupportsAnswer: false,
            singleBestAnswer: false,
            factuallySound: true,
            naturalLanguage: true,
            fairForCasualPlayers: true,
            noAnswerSpoiler: true,
            issues,
          },
        },
      },
    ],
  };
}

function mockApprovedRiddle(question: string, answer: string) {
  mockParse
    .mockResolvedValueOnce(parsedRiddleResponse(question, answer))
    .mockResolvedValueOnce(approvedReviewResponse());
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
          question: "What answer uses punctuation?",
          answer: "word!",
        }),
      ).toThrow();
    });
  });

  describe("generateUniqueRiddle", () => {
    test("generates a valid riddle from structured OpenAI output", async () => {
      mockApprovedRiddle("What flies without wings?", "time");

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["What flies without wings?", "time"]);
      expect(mockOpenAI).toHaveBeenCalledWith({apiKey: "test-api-key"});
      expect(mockParse).toHaveBeenCalledWith({
        model: "gpt-5.6-sol",
        reasoning_effort: "medium",
        messages: expect.arrayContaining([
          expect.objectContaining({role: "system"}),
          expect.objectContaining({role: "user"}),
        ]),
        response_format: expect.objectContaining({
          type: "json_schema",
        }),
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Generated and quality-approved riddle: "What flies without wings?" -> "time" (4 chars)',
      );
    });

    test("requires an independent structured quality review before accepting a riddle", async () => {
      mockApprovedRiddle(
        "I reflect your face but keep no memory; find me on walls and in bathrooms.",
        "mirror",
      );

      await generateUniqueRiddle();

      const reviewRequest = mockParse.mock.calls[1][0] as {
        model: string;
        reasoning_effort?: string;
        messages: {role: string; content: string}[];
        response_format: {json_schema?: {name?: string}};
      };
      const reviewSystemPrompt = reviewRequest.messages.find((message) => message.role === "system")?.content;
      const reviewInput = reviewRequest.messages.find((message) => message.role === "user")?.content;

      expect(reviewRequest.model).toBe("gpt-5.6-sol");
      expect(reviewRequest.reasoning_effort).toBe("medium");
      expect(reviewRequest.response_format.json_schema?.name).toBe("riddle_review");
      expect(reviewSystemPrompt).toContain("logically and factually support");
      expect(reviewSystemPrompt).toContain("clearly better than other plausible answers");
      expect(reviewSystemPrompt).toContain("translation-like wording");
      expect(reviewInput).toContain('"answer":"mirror"');
    });

    test("includes riddle rules, broad pub quiz guidance, and structured output in the prompt", async () => {
      mockApprovedRiddle("What flies without wings?", "time");

      await generateUniqueRiddle();

      const request = mockParse.mock.calls[0][0] as {
        messages: {role: string; content: string}[];
        response_format: unknown;
      };
      const userPrompt = request.messages.find((message) => message.role === "user")?.content;
      const systemPrompt = request.messages.find((message) => message.role === "system")?.content;

      expect(userPrompt).toContain(`Answer: 1-${MAX_RIDDLE_ANSWER_CHARACTERS} characters`);
      expect(userPrompt).toContain("two or more compatible clue details");
      expect(userPrompt).toContain("plural, close variant, or obvious word stem");
      expect(userPrompt).toContain("strained interpretation");
      expect(userPrompt).toContain("another common answer");
      expect(systemPrompt).toContain("exactly one natural answer");
      expect(systemPrompt).toContain("factually correct");
      expect(systemPrompt).toContain("mutually reinforcing details");
      expect(systemPrompt).toContain("typical player would give");
      expect(request.response_format).toEqual(
        expect.objectContaining({
          type: "json_schema",
        }),
      );
    });

    test("uses OPENAI_MODEL override when provided", async () => {
      process.env.OPENAI_MODEL = "gpt-4.1-mini";
      mockApprovedRiddle("What runs but never walks?", "river");

      await generateUniqueRiddle();

      expect(mockParse).toHaveBeenCalledTimes(2);
      for (const [request] of mockParse.mock.calls) {
        expect(request).toEqual(
          expect.objectContaining({
            model: "gpt-4.1-mini",
          }),
        );
        expect(request).not.toHaveProperty("reasoning_effort");
      }
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

    test("normalizes smart punctuation before validation", async () => {
      mockApprovedRiddle("I\u2019m Earth\u2019s bright neighbor after sunset.", "venus");

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["I'm Earth's bright neighbor after sunset.", "venus"]);
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining("Question contains invalid characters"),
      );
    });

    test("accepts native-script punctuation in localized questions", async () => {
      mockApprovedRiddle("銭湯の壁でよく主役、標高3776メートルの日本一といえば？", "ふじさん");

      const result = await generateUniqueRiddle("ja");

      expect(result).toEqual(["銭湯の壁でよく主役、標高3776メートルの日本一といえば？", "ふじさん"]);
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining("Question contains invalid characters"),
      );
    });

    test("rejects a semantically weak or ambiguous riddle after independent review", async () => {
      mockParse
        .mockResolvedValueOnce(parsedRiddleResponse("I can be bright and fill a room. What am I?", "light"))
        .mockResolvedValueOnce(rejectedReviewResponse(["The clue also fits colour, music, or laughter."]));

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockParse).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Riddle rejected by quality review: "I can be bright and fill a room. What am I?" -> "light": ' +
          "The clue also fits colour, music, or laughter.",
      );
    });

    test("rejects a riddle when OpenAI returns an empty quality review", async () => {
      mockParse
        .mockResolvedValueOnce(parsedRiddleResponse("Seen after rain when sunlight returns, I arc in many colours.", "rainbow"))
        .mockResolvedValueOnce({choices: [{message: {parsed: null}}]});

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith("OpenAI returned empty riddle review content.");
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
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error generating riddle with OpenAI (model: gpt-5.6-sol):",
        apiError,
      );
    });

    test("throws error when OPENAI_API_KEY is missing", async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(generateUniqueRiddle()).rejects.toThrow("Missing required environment variable: OPENAI_API_KEY");
    });

    test("reuses OpenAI client on subsequent calls", async () => {
      mockApprovedRiddle("What is reused?", "client");
      mockApprovedRiddle("What is reused?", "client");

      await generateUniqueRiddle();
      await generateUniqueRiddle();

      expect(mockOpenAI).toHaveBeenCalledTimes(1);
      expect(mockParse).toHaveBeenCalledTimes(4);
    });
  });
});
