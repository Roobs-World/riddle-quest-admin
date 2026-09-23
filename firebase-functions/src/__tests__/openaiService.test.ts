import {describe, expect, test, beforeEach, afterEach, jest} from "@jest/globals";

/** Provides mock logger behavior. */
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
jest.mock("firebase-functions", () => ({logger: mockLogger}));

/** Records explicit diagnostic fields at the telemetry boundary. */
const mockCaptureException = jest.fn();
jest.mock("../shared/sentry", () => ({
  ...jest.requireActual<typeof import("../shared/sentry")>("../shared/sentry"),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

/** Provides mock parse behavior. */
const mockParse = jest.fn();
/** Provides mock open ai behavior. */
const mockOpenAI = jest.fn().mockImplementation(() => ({
  responses: {parse: mockParse},
}));

jest.mock("openai", () => ({
  __esModule: true,
  default: mockOpenAI,
}));

import {GeneratedRiddleSchema, generateUniqueRiddle, resetOpenAIClient} from "../riddles/openaiService";
import {MAX_RIDDLE_ANSWER_CHARACTERS} from "../shared/constants";

/** Parses d riddle response. */
function parsedRiddleResponse(question: string, answer: string) {
  return {
    output_parsed: {question, answer},
  };
}

/** Provides approved review response behavior. */
function approvedReviewResponse() {
  return {
    output_parsed: {
      clueSupportsAnswer: true,
      singleBestAnswer: true,
      factuallySound: true,
      naturalLanguage: true,
      fairForCasualPlayers: true,
      noAnswerSpoiler: true,
      issues: [],
    },
  };
}

/** Provides an unambiguous blind solve response behavior. */
function approvedBlindSolveResponse(answer: string) {
  return {output_parsed: {answer, confidence: "high", alternativeAnswers: []}};
}

/** Provides rejected review response behavior. */
function rejectedReviewResponse(issues: string[]) {
  return {
    output_parsed: {
      clueSupportsAnswer: false,
      singleBestAnswer: false,
      factuallySound: true,
      naturalLanguage: true,
      fairForCasualPlayers: true,
      noAnswerSpoiler: true,
      issues,
    },
  };
}

/** Provides mock approved riddle behavior. */
function mockApprovedRiddle(question: string, answer: string) {
  mockParse
    .mockResolvedValueOnce(parsedRiddleResponse(question, answer))
    .mockResolvedValueOnce(approvedBlindSolveResponse(answer))
    .mockResolvedValueOnce(approvedReviewResponse());
}

describe("OpenAI Service", () => {
  /** Provides original env behavior. */
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
      expect(() =>
        GeneratedRiddleSchema.parse({
          question: "Which mountain is Japan's tallest?",
          answer: "ふじさん",
        }),
      ).toThrow();
    });
  });

  describe("generateUniqueRiddle", () => {
    test("generates a valid riddle from structured OpenAI output", async () => {
      mockApprovedRiddle("What flies without wings?", "time");

      /** Provides result behavior. */
      const result = await generateUniqueRiddle();

      expect(result).toEqual(["What flies without wings?", "time"]);
      expect(mockOpenAI).toHaveBeenCalledWith({apiKey: "test-api-key", timeout: 15_000, maxRetries: 0});
      expect(mockParse).toHaveBeenCalledWith({
        model: "gpt-5.6-sol",
        reasoning: {effort: "medium"},
        instructions: expect.any(String),
        input: expect.any(String),
        prompt_cache_key: "riddlequest-riddle-generation-v1",
        store: false,
        text: {
          format: expect.objectContaining({type: "json_schema"}),
          verbosity: "low",
        },
      });
      expect(mockLogger.info).toHaveBeenCalledWith("Generated and quality-approved a riddle.", {answerLength: 4});
    });

    test("requires an independent structured quality review before accepting a riddle", async () => {
      mockApprovedRiddle("I reflect your face but keep no memory; find me on walls and in bathrooms.", "mirror");

      await generateUniqueRiddle();

      /** Provides review request behavior. */
      const reviewRequest = mockParse.mock.calls[2][0] as {
        /** Stores model. */
        model: string;
        /** Stores reasoning. */
        reasoning?: {
          /** Stores effort. */
          effort?: string;
        };
        /** Stores instructions. */
        instructions: string;
        /** Stores input. */
        input: string;
        /** Stores store. */
        store: boolean;
        /** Stores text. */
        text: {
          /** Stores format. */
          format: {
            /** Stores name. */
            name?: string;
          };
        };
      };

      expect(reviewRequest.model).toBe("gpt-5.6-sol");
      expect(reviewRequest.reasoning?.effort).toBe("medium");
      expect(reviewRequest.text.format.name).toBe("riddle_review");
      expect(reviewRequest.instructions).toContain("logically and factually support");
      expect(reviewRequest.instructions).toContain("clearly better than other plausible answers");
      expect(reviewRequest.instructions).toContain("translation-like wording");
      expect(reviewRequest.input).toContain('"answer":"mirror"');
      expect(reviewRequest.store).toBe(false);
    });

    test("blind-solves the clue without leaking the proposed answer", async () => {
      mockApprovedRiddle("Seen after rain, I bend sunlight into a coloured arc.", "rainbow");

      await generateUniqueRiddle();

      /** Captures the second model request for blind-solve assertions. */
      const request = mockParse.mock.calls[1][0] as {
        /** Stores the blind-solve request input. */
        input: string;
        /** Stores the blind-solve system instructions. */
        instructions: string;
      };
      expect(request.input).toContain('"question"');
      expect(request.input).not.toContain("rainbow");
      expect(request.instructions).toContain("not been given the author's answer");
    });

    test("rejects a clue when a blind solver finds another answer", async () => {
      mockParse
        .mockResolvedValueOnce(parsedRiddleResponse("I have keys but open no locks.", "piano"))
        .mockResolvedValueOnce({
          output_parsed: {answer: "keyboard", confidence: "medium", alternativeAnswers: ["piano"]},
        });

      await expect(generateUniqueRiddle()).resolves.toBeNull();
      expect(mockParse).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith("Generated riddle failed the blind-solve check.", {
        answerMatched: false,
        confidence: "medium",
        alternativeCount: 1,
      });
    });

    test("includes riddle rules, broad pub quiz guidance, and structured output in the prompt", async () => {
      mockApprovedRiddle("What flies without wings?", "time");

      await generateUniqueRiddle();

      /** Provides request behavior. */
      const request = mockParse.mock.calls[0][0] as {
        /** Stores instructions. */
        instructions: string;
        /** Stores input. */
        input: string;
        /** Stores text. */
        text: {
          /** Stores format. */
          format: unknown;
        };
      };

      expect(request.input).toContain(`Answer: 1-${MAX_RIDDLE_ANSWER_CHARACTERS} lowercase characters using only a-z`);
      expect(request.input).toContain("two or more compatible clue details");
      expect(request.input).toContain("plural, close variant, or obvious word stem");
      expect(request.input).toContain("strained interpretation");
      expect(request.input).toContain("another common answer");
      expect(request.instructions).toContain("exactly one natural answer");
      expect(request.instructions).toContain("factually correct");
      expect(request.instructions).toContain("mutually reinforcing details");
      expect(request.instructions).toContain("typical player would give");
      expect(request.text.format).toEqual(
        expect.objectContaining({
          type: "json_schema",
        }),
      );
    });

    test("uses OPENAI_MODEL override when provided", async () => {
      process.env.OPENAI_MODEL = "gpt-4.1-mini";
      mockApprovedRiddle("What runs but never walks?", "river");

      await generateUniqueRiddle();

      expect(mockParse).toHaveBeenCalledTimes(3);
      for (const [request] of mockParse.mock.calls) {
        expect(request).toEqual(
          expect.objectContaining({
            model: "gpt-4.1-mini",
          }),
        );
        expect(request).not.toHaveProperty("reasoning");
      }
    });

    test("rejects an answer that is too long", async () => {
      mockParse.mockResolvedValue(parsedRiddleResponse("What is very long?", "verylongword"));

      /** Provides result behavior. */
      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Generated answer exceeded the maximum playable length and was rejected.",
        {answerLength: 12, maximumLength: 7},
      );
    });

    test("rejects an answer with invalid characters", async () => {
      mockParse.mockResolvedValue(parsedRiddleResponse("What has punctuation?", "word!"));

      /** Provides result behavior. */
      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Generated answer was not compatible with the in-game keyboard and was rejected.",
      );
    });

    test("rejects a question that reveals the literal answer", async () => {
      mockParse.mockResolvedValue(parsedRiddleResponse("A joke makes people laugh.", "joke"));

      /** Provides result behavior. */
      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith("Generated question revealed its answer and was rejected.");
    });

    test("normalizes smart punctuation before validation", async () => {
      mockApprovedRiddle("I\u2019m Earth\u2019s bright neighbor after sunset.", "venus");

      /** Provides result behavior. */
      const result = await generateUniqueRiddle();

      expect(result).toEqual(["I'm Earth's bright neighbor after sunset.", "venus"]);
      expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Question contains invalid characters"));
    });

    test("accepts native-script punctuation with a keyboard-compatible localized answer", async () => {
      mockApprovedRiddle("銭湯の壁でよく主役、標高3776メートルの日本一といえば？", "fujisan");

      /** Provides result behavior. */
      const result = await generateUniqueRiddle("ja");

      expect(result).toEqual(["銭湯の壁でよく主役、標高3776メートルの日本一といえば？", "fujisan"]);
      expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Question contains invalid characters"));
    });

    test("rejects native-script answers that the current keyboard cannot enter", async () => {
      mockParse.mockResolvedValue(parsedRiddleResponse("日本一高い山は？", "ふじ"));

      await expect(generateUniqueRiddle("ja")).resolves.toBeNull();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Generated answer was not compatible with the in-game keyboard and was rejected.",
      );
      expect(mockParse).toHaveBeenCalledTimes(1);
    });

    test("rejects a semantically weak or ambiguous riddle after independent review", async () => {
      mockParse
        .mockResolvedValueOnce(parsedRiddleResponse("I can be bright and fill a room. What am I?", "light"))
        .mockResolvedValueOnce(approvedBlindSolveResponse("light"))
        .mockResolvedValueOnce(rejectedReviewResponse(["The clue also fits colour, music, or laughter."]));

      /** Provides result behavior. */
      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockParse).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledWith("Generated riddle was rejected by quality review.", {
        issueCount: 1,
        failedChecks: {
          clueSupportsAnswer: true,
          singleBestAnswer: true,
          factuallySound: false,
          naturalLanguage: false,
          fairForCasualPlayers: false,
          noAnswerSpoiler: false,
        },
      });
    });

    test("rejects a riddle when OpenAI returns an empty quality review", async () => {
      mockParse
        .mockResolvedValueOnce(
          parsedRiddleResponse("Seen after rain when sunlight returns, I arc in many colours.", "rainbow"),
        )
        .mockResolvedValueOnce(approvedBlindSolveResponse("rainbow"))
        .mockResolvedValueOnce({output_parsed: null});

      /** Provides result behavior. */
      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith("OpenAI returned empty riddle review content.");
    });

    test("returns null when OpenAI returns empty structured content", async () => {
      mockParse.mockResolvedValue({
        output_parsed: null,
      });

      /** Provides result behavior. */
      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith("OpenAI returned empty structured riddle content.");
    });

    test("handles OpenAI API errors gracefully", async () => {
      /** Provides api error behavior. */
      const apiError = new Error("OpenAI API rate limit exceeded");
      mockParse.mockRejectedValue(apiError);

      /** Provides result behavior. */
      const result = await generateUniqueRiddle();

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith("OpenAI riddle generation failed.", {
        model: "gpt-5.6-sol",
        errorClass: "Error",
      });
      expect(mockLogger.error).not.toHaveBeenCalledWith(expect.anything(), apiError);
    });

    test("reports bounded upstream classifications without copying request or player fields into extras", async () => {
      /** Includes private fields to prove only the safe classification allowlist is copied. */
      const apiError = Object.assign(new Error("private provider response"), {
        name: "APIError",
        status: 503,
        code: "server_error",
        request: {authorization: "private credential"},
        userId: "private player",
      });
      mockParse.mockRejectedValue(apiError);

      await expect(generateUniqueRiddle()).resolves.toBeNull();
      expect(mockCaptureException).toHaveBeenCalledWith(apiError, {
        phase: "generation",
        locale: "en",
        errorClass: "APIError",
        status: 503,
        code: "server_error",
      });
    });

    test.each(["generation", "blind_solve", "review"] as const)(
      "identifies %s timeouts and rejects incomplete candidates without further API calls",
      async (phase) => {
        mockParse.mockReset();
        if (phase !== "generation") {
          mockParse.mockResolvedValueOnce(parsedRiddleResponse("What flies without wings?", "time"));
        }
        if (phase === "review") {
          mockParse.mockResolvedValueOnce(approvedBlindSolveResponse("time"));
        }
        /** Simulates an upstream timeout containing private request material. */
        const error = Object.assign(new Error("private provider response"), {
          name: "APIConnectionTimeoutError",
          request: {input: "private riddle", authorization: "private credential"},
        });
        mockParse.mockRejectedValueOnce(error);

        await expect(generateUniqueRiddle("fr", ["secret"])).resolves.toBeNull();

        expect(mockParse).toHaveBeenCalledTimes({generation: 1, blind_solve: 2, review: 3}[phase]);
        expect(mockCaptureException).toHaveBeenCalledTimes(1);
        expect(mockCaptureException).toHaveBeenCalledWith(error, {
          phase,
          locale: "fr",
          errorClass: "APIConnectionTimeoutError",
        });
      },
    );

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
      expect(mockParse).toHaveBeenCalledTimes(6);
    });
  });
});
