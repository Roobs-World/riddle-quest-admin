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

// 3. Import the module under test.
import {generateUniqueRiddle, resetOpenAIClient} from "../openaiService";

describe("generateUniqueRiddles", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    // Set up environment variable for tests
    process.env = {...originalEnv, OPENAI_API_KEY: "test-openai-key"};
    resetOpenAIClient();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
    resetOpenAIClient();
  });

  test("should return a parsed riddle on successful API response", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [{message: {content: "Question: why did the chicken cross the road?\nAnswer: escape"}}],
    });
    const result = await generateUniqueRiddle();
    expect(result).toEqual(["why did the chicken cross the road?", "escape"]);
    expect(mockCreateCompletions).toHaveBeenCalledTimes(1);
    expect(mockCreateCompletions).toHaveBeenCalledWith({
      model: "gpt-3.5-turbo",
      messages: expect.any(Array),
    });
  });

  test("should handle alternative answer format \nAnswer:", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [{message: {content: "Question: what is always in front of you but cannot be seen?\nAnswer: future"}}],
    });
    const result = await generateUniqueRiddle();
    expect(result).toEqual(["what is always in front of you but cannot be seen?", "future"]);
  });

  test("should remove asterisks from question and answer", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [{message: {content: "**Question: i speak without a mouth, who am i?\n\n**Answer: echo"}}],
    });
    const result = await generateUniqueRiddle();
    expect(result).toEqual(["i speak without a mouth, who am i?", "echo"]);
  });

  test("should return null if API response content is null", async () => {
    mockCreateCompletions.mockResolvedValue({choices: [{message: {content: null}}]});
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith("OpenAI returned empty content.");
  });

  test("should return null if output format is missing Answer: separator", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [{message: {content: "Question: no separator nope"}}],
    });
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      "Could not parse question or answer from OpenAI output using standard format.",
    );
  });

  test("should return null if answer format is missing the colon", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [{message: {content: "Question: test\nAnswer nope"}}],
    });
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      "Could not parse question or answer from OpenAI output using standard format.",
    );
  });

  test("should return null if question or answer is empty after parsing", async () => {
    mockCreateCompletions.mockResolvedValue({choices: [{message: {content: "Question: \nAnswer: "}}]});
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith("Question or answer is empty after parsing.");
  });

  test("should return null and log error on API call failure", async () => {
    mockCreateCompletions.mockRejectedValue(new Error("API Error"));
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith("Error generating riddle with OpenAI:", expect.any(Error));
  });

  test("should return null if answer is too long", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [{message: {content: "Question: test?\nAnswer: toolonganswerhere"}}],
    });
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      'Answer too long: "toolonganswerhere" (17 characters). Must be 7 or fewer.',
    );
  });

  test("should return null if answer contains invalid characters", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [{message: {content: "Question: test?\nAnswer: test123"}}],
    });
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      'Answer contains invalid characters: "test123". Must be only lowercase letters.',
    );
  });

  test("should return null if answer contains punctuation", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [{message: {content: "Question: test?\nAnswer: test!"}}],
    });
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      'Answer contains invalid characters: "test!". Must be only lowercase letters.',
    );
  });

  test("should return null if answer contains apostrophes", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [{message: {content: "Question: test?\nAnswer: don't"}}],
    });
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      'Answer contains invalid characters: "don\'t". Must be only lowercase letters.',
    );
  });

  test("should return null if question contains invalid characters", async () => {
    mockCreateCompletions.mockResolvedValue({
      choices: [{message: {content: "Question: Test With CAPS!\nAnswer: test"}}],
    });
    const result = await generateUniqueRiddle();
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      'Question contains invalid characters: "Test With CAPS!". Must be only lowercase letters, commas, and question marks.',
    );
  });
});

describe("OpenAI Service - Environment Variable Check", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    resetOpenAIClient();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
    resetOpenAIClient();
  });

  test("should throw error if OPENAI_API_KEY is missing", async () => {
    // Remove the environment variable
    process.env = {...originalEnv};
    delete process.env.OPENAI_API_KEY;

    await expect(generateUniqueRiddle()).rejects.toThrow("Missing required environment variable: OPENAI_API_KEY");
  });

  test("should not throw if OPENAI_API_KEY is present", async () => {
    // Set the environment variable
    process.env = {...originalEnv, OPENAI_API_KEY: "a-real-key"};

    // Mock the OpenAI call to avoid actual API call
    mockCreateCompletions.mockResolvedValue({
      choices: [{message: {content: "Question: test?\nAnswer: test"}}],
    });

    await expect(generateUniqueRiddle()).resolves.not.toThrow();
    const result = await generateUniqueRiddle();
    expect(result).toEqual(["test?", "test"]);
  });
});
