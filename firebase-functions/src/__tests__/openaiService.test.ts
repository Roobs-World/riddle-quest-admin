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
      choices: [{message: {content: "Question: Test?\n\nAnswer: test"}}],
    });

    await expect(generateUniqueRiddle()).resolves.not.toThrow();
    const result = await generateUniqueRiddle();
    expect(result).toEqual(["Test?", "test"]);
  });
});
