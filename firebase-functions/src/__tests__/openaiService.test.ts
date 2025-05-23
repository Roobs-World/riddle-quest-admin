// 1. Declare and initialize the mock function variable
const mockCreateCompletions = jest.fn();

// 2. Mock "openai" and use the initialized mockCreateCompletions
jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreateCompletions,
      },
    },
  }));
});

// 3. Mock firebase-functions
// This mock will be used by default. Tests for env variables will override it.
jest.mock("firebase-functions", () => ({
  config: () => ({
    openai: {
      api_key: "test-openai-key",
    },
  }),
}));

// 4. Finally, import the module under test.
import {generateUniqueRiddle} from "../openaiService.js";

describe("generateUniqueRiddles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should return a parsed riddle on successful API response", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [
        {message: {content: "Question: Why did the chicken cross the road?\n\nAnswer: to get to the other side"}},
      ],
    });
    const result = await generateUniqueRiddle();
    expect(result).toEqual(["Why did the chicken cross the road?", "to get to the other side"]);
    expect(mockCreateCompletions).toHaveBeenCalledTimes(1);
    expect(mockCreateCompletions).toHaveBeenCalledWith({
      model: "gpt-3.5-turbo",
      messages: expect.any(Array),
    });
  });

  test("should handle alternative answer format \nAnswer:", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [
        {message: {content: "Question: What is always in front of you but can't be seen?\nAnswer: the future"}},
      ],
    });
    const result = await generateUniqueRiddle();
    expect(result).toEqual(["What is always in front of you but can't be seen?", "the future"]);
  });

  test("should remove asterisks from question and answer", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [{message: {content: "**Question:** I speak without a mouth. Who am I?\n\n**Answer:** an echo"}}],
    });
    const result = await generateUniqueRiddle();
    expect(result).toEqual(["I speak without a mouth. Who am I?", "an echo"]);
  });

  test("should return null if API response content is null", async () => {
    mockCreateCompletions.mockResolvedValue({choices: [{message: {content: null}}]});
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith("OpenAI returned empty content.");
  });

  test("should return null if output format is missing \n\n separator", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [{message: {content: "Question: No separator Answer: nope"}}],
    });
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith("Could not find separator in OpenAI output.");
  });

  test("should return null if answer format is missing the colon", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [{message: {content: "Question: Test\n\nAnswer nope"}}],
    });
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith("Could not find answer separator in OpenAI output.");
  });

  test("should return null if question or answer is empty after parsing", async () => {
    mockCreateCompletions.mockResolvedValue({choices: [{message: {content: "Question: \n\nAnswer: "}}]});
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith("Could not parse question or answer from OpenAI output.");
  });

  test("should return null and log error on API call failure", async () => {
    mockCreateCompletions.mockRejectedValue(new Error("API Error"));
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith("Error generating riddle with OpenAI:", expect.any(Error));
  });
});

describe("OpenAI Service - Environment Variable Check", () => {
  let openAIServiceModule: {generateUniqueRiddle: () => Promise<[string, string] | null>} | undefined;

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const loadModuleWithMockConfig = async (mockConfigData: Record<string, unknown>) => {
    jest.doMock("firebase-functions", () => ({
      config: () => mockConfigData,
    }));
    openAIServiceModule = await import("../openaiService.js");
  };

  test("should throw error if OPENAI_API_KEY is missing", async () => {
    await expect(loadModuleWithMockConfig({openai: {}})).rejects.toThrow(
      "Missing required environment variable: OPENAI_API_KEY from Firebase config (openai.api_key)",
    );
  });

  test("should throw error if openai config section is missing", async () => {
    await expect(loadModuleWithMockConfig({})).rejects.toThrow(
      "Missing required environment variable: OPENAI_API_KEY from Firebase config (openai.api_key)",
    );
  });

  test("should not throw if OPENAI_API_KEY is present", async () => {
    await expect(
      loadModuleWithMockConfig({
        openai: {api_key: "a-real-key"},
      }),
    ).resolves.not.toThrow();
    expect(openAIServiceModule).toBeDefined();
    expect(typeof openAIServiceModule?.generateUniqueRiddle).toBe("function");
  });
});
