/* eslint-disable @typescript-eslint/no-explicit-any */
import {describe, expect, test, beforeEach, afterEach, jest} from "@jest/globals";

// Mock OpenAI
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

// Import the module after mocking
import {generateUniqueRiddle, resetOpenAIClient} from "../openaiService";

describe("OpenAI Service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Reset the OpenAI client cache
    resetOpenAIClient();

    // Set up environment variables
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: "test-api-key",
    };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Reset console spies
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

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["What flies without wings?", "time"]);
      expect(mockOpenAI).toHaveBeenCalledWith({apiKey: "test-api-key"});
      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-3.5-turbo",
        messages: expect.arrayContaining([
          expect.objectContaining({role: "system"}),
          expect.objectContaining({role: "user"}),
        ]),
      });
      expect(consoleSpy).toHaveBeenCalledWith('Generated valid riddle: "What flies without wings?" → "time" (4 chars)');

      consoleSpy.mockRestore();
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

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["What has seven letters?", "rainbow"]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Generated valid riddle: "What has seven letters?" → "rainbow" (7 chars)',
      );

      consoleSpy.mockRestore();
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

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Answer too long: "verylongword" (12 characters). Must be 7 or fewer.');

      consoleSpy.mockRestore();
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

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Answer contains invalid characters: "WORD". Must be only lowercase letters.',
      );

      consoleSpy.mockRestore();
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

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Answer contains invalid characters: "word123". Must be only lowercase letters.',
      );

      consoleSpy.mockRestore();
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

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Answer contains invalid characters: "word!". Must be only lowercase letters.',
      );

      consoleSpy.mockRestore();
    });

    test("should handle OpenAI response with bold formatting", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "**Question:** What is bold?\n**Answer:** bold",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["What is bold?", "bold"]);

      consoleSpy.mockRestore();
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

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith("OpenAI returned empty content.");

      consoleSpy.mockRestore();
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

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Could not parse question or answer from OpenAI output using standard format.",
      );

      consoleSpy.mockRestore();
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

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith("Question or answer is empty after parsing.");

      consoleSpy.mockRestore();
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

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith("Question or answer is empty after parsing.");

      consoleSpy.mockRestore();
    });

    test("should handle OpenAI API errors gracefully", async () => {
      const apiError = new Error("OpenAI API rate limit exceeded");
      (mockCreate as jest.MockedFunction<any>).mockRejectedValue(apiError);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith("Error generating riddle with OpenAI:", apiError);

      consoleSpy.mockRestore();
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

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      // First call
      await generateUniqueRiddle();

      // Second call
      await generateUniqueRiddle();

      // OpenAI constructor should only be called once
      expect(mockOpenAI).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
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

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["What's the answer, isn't it?", "yes"]);

      consoleSpy.mockRestore();
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

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Question contains invalid characters: "What has @#$%^&*()?". Must contain only letters, numbers, spaces, and basic punctuation.',
      );

      consoleSpy.mockRestore();
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

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["What spans\nmultiple lines?", "text"]);

      consoleSpy.mockRestore();
    });

    test("should handle edge case with exactly 7 character answer", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Question: What has exactly seven letters?\nAnswer: exactly",
            },
          },
        ],
      };

      (mockCreate as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      const result = await generateUniqueRiddle();

      expect(result).toEqual(["What has exactly seven letters?", "exactly"]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Generated valid riddle: "What has exactly seven letters?" → "exactly" (7 chars)',
      );

      consoleSpy.mockRestore();
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

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      // First call to initialize client
      await generateUniqueRiddle();
      expect(mockOpenAI).toHaveBeenCalledTimes(1);

      // Reset client
      resetOpenAIClient();

      // Second call should create new client
      await generateUniqueRiddle();
      expect(mockOpenAI).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });
});
