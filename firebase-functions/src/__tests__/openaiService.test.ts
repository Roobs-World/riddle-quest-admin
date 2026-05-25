/* eslint-disable @typescript-eslint/no-explicit-any */
import {describe, expect, test, beforeEach, afterEach, jest} from "@jest/globals";

// 1. Mock logger and firebase-functions
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
jest.mock("firebase-functions", () => ({logger: mockLogger}));

// 2. Mock OpenAI
const mockCreate = jest.fn();
const mockOpenAI = jest.fn().mockImplementation(() => ({
  chat: {
    completions: {
      create: mockCreate,
    },
  },
}));

jest.mock("openai", () => ({
  __esModule: true,
  default: mockOpenAI,
}));

// 3. Import the module after mocking
import {generateUniqueRiddle, resetOpenAIClient} from "../openaiService";
import {MAX_RIDDLE_ANSWER_CHARACTERS} from "../constants";

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

  describe("generateUniqueRiddle", () => {
    test("should generate a valid riddle successfully", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What flies without wings?\nAnswer: time",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["What flies without wings?", "time"]);
      expect(mockOpenAI).toHaveBeenCalledWith({apiKey: "test-api-key"});
      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-5.5",
        messages: expect.arrayContaining([
          expect.objectContaining({role: "system"}),
          expect.objectContaining({role: "user"}),
        ]),
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Generated valid riddle: "What flies without wings?" → "time" (4 chars)',
      );
    });

    test("should include riddle rules and broad pub quiz guidance in the OpenAI prompt", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What flies without wings?\nAnswer: time",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      await generateUniqueRiddle();

      const request = mockCreate.mock.calls[0][0] as {
        messages: {role: string; content: string}[];
      };
      const userPrompt = request.messages.find((message) => message.role === "user")?.content;
      const systemPrompt = request.messages.find((message) => message.role === "system")?.content;

      expect(userPrompt).toContain(`Answer: MAXIMUM ${MAX_RIDDLE_ANSWER_CHARACTERS} characters`);
      expect(userPrompt).toContain(`must never exceed ${MAX_RIDDLE_ANSWER_CHARACTERS} characters`);
      expect(userPrompt).toContain("must contain only lowercase letters");
      expect(userPrompt).toContain("must not include the answer word anywhere");
      expect(userPrompt).toContain("wide audience");
      expect(userPrompt).toContain("music, history, general knowledge, film and TV, sport, geography, science");
      expect(userPrompt).toContain("food and drink");
      expect(userPrompt).toContain("one clear answer");
      expect(userPrompt).toContain("vague clues");
      expect(userPrompt).toContain("obscure proper nouns");
      expect(systemPrompt).toContain("pub quizzes");
      expect(systemPrompt).toContain("Rotate subjects over time");
      expect(systemPrompt).toContain("avoid obscure specialist trivia");
    });

    test("should handle riddle with maximum answer length (7 characters)", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What has seven letters?\nAnswer: rainbow",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["What has seven letters?", "rainbow"]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Generated valid riddle: "What has seven letters?" → "rainbow" (7 chars)',
      );
    });

    test("should use OPENAI_MODEL override when provided", async () => {
      process.env.OPENAI_MODEL = "gpt-4.1-mini";
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What runs but never walks?\nAnswer: river",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      await generateUniqueRiddle();

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4.1-mini",
        }),
      );
    });

    test("should reject answer that is too long", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What is very long?\nAnswer: verylongword",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Answer too long: "verylongword" (12 characters). Must be 7 or fewer.',
      );
    });

    test("should reject answer with invalid characters (uppercase)", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What is uppercase?\nAnswer: WORD",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Answer contains invalid characters: "WORD". Must be only lowercase letters.',
      );
    });

    test("should reject answer with numbers", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What has numbers?\nAnswer: word123",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Answer contains invalid characters: "word123". Must be only lowercase letters.',
      );
    });

    test("should reject answer with special characters", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What has punctuation?\nAnswer: word!",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Answer contains invalid characters: "word!". Must be only lowercase letters.',
      );
    });

    test("should handle OpenAI response with bold formatting", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "**Question:** Which word describes heavy type?\n**Answer:** bold",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["Which word describes heavy type?", "bold"]);
    });

    test("should reject a question that reveals the literal answer", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: A joke makes people laugh.\nAnswer: joke",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Question reveals the literal answer: "A joke makes people laugh." -> "joke".',
      );
    });

    test("should return null when OpenAI returns empty content", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith("OpenAI returned empty content.");
    });

    test("should return null when question format is invalid", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Invalid format without proper question and answer",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Could not parse question or answer from OpenAI output using standard format.",
      );
    });

    test("should return null when question is empty", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: \nAnswer: word",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith("Question or answer is empty after parsing.");
    });

    test("should return null when answer is empty", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What is empty?\nAnswer: ",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith("Question or answer is empty after parsing.");
    });

    test("should handle OpenAI API errors gracefully", async () => {
      const apiError = new Error("OpenAI API rate limit exceeded");
      (mockCreate as jest.MockedFunction<any>).mockRejectedValue(apiError);

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith("Error generating riddle with OpenAI (model: gpt-5.5):", apiError);
    });

    test("should throw error when OPENAI_API_KEY is missing", async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(generateUniqueRiddle()).rejects.toThrow("Missing required environment variable: OPENAI_API_KEY");
    });

    test("should reuse OpenAI client on subsequent calls", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What is reused?\nAnswer: client",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      // First call
      await generateUniqueRiddle();

      // Second call
      await generateUniqueRiddle();

      // OpenAI constructor should only be called once
      expect(mockOpenAI).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    test("should handle question with valid special characters", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What's the answer, isn't it?\nAnswer: yes",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["What's the answer, isn't it?", "yes"]);
    });

    test("should reject question with invalid characters", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What has @#$%^&*()?\nAnswer: symbols",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Question contains invalid characters: "What has @#$%^&*()?". Must contain only letters, numbers, spaces, and basic punctuation.',
      );
    });

    test("should handle multiline OpenAI response", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What spans\nmultiple lines?\nAnswer: text",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["What spans\nmultiple lines?", "text"]);
    });

    test("should handle edge case with exactly 7 character answer", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: Which seven-letter word means exact?\nAnswer: precise",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["Which seven-letter word means exact?", "precise"]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Generated valid riddle: "Which seven-letter word means exact?" → "precise" (7 chars)',
      );
    });
  });

  describe("resetOpenAIClient", () => {
    test("should reset the OpenAI client cache", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What is reset?\nAnswer: cache",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      // First call to initialize client
      await generateUniqueRiddle();
      expect(mockOpenAI).toHaveBeenCalledTimes(1);

      // Reset client
      resetOpenAIClient();

      // Second call should create new client
      await generateUniqueRiddle();
      expect(mockOpenAI).toHaveBeenCalledTimes(2);
    });
  });
});
