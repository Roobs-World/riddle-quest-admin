import {beforeEach, describe, expect, it, jest} from "@jest/globals";

/** Provides mock get behavior. */
const mockGet = jest.fn();
/** Provides mock set behavior. */
const mockSet = jest.fn();
/** Provides mock get localized daily doc ref behavior. */
const mockGetLocalizedDailyDocRef = jest.fn(() => ({get: mockGet, set: mockSet}));
/** Provides mock generate unique riddle behavior. */
const mockGenerateUniqueRiddle = jest.fn();

jest.mock("@qwordly/core/validation", () => ({SUPPORTED_LOCALES: ["en"]}));
jest.mock("../shared/firebaseAdmin", () => ({
  admin: {firestore: {FieldValue: {serverTimestamp: () => "server-time"}}},
}));
jest.mock("../riddles/openaiService", () => ({
  generateUniqueRiddle: (...args: unknown[]) => mockGenerateUniqueRiddle(...args),
}));
jest.mock("../riddles/riddleGenerationRepository", () => ({
  getExistingRiddlesFromFirestore: jest.fn(),
  getLocalizedCanonicalKey: (category: string, index: number, locale: string) => `${category}:${index}:${locale}`,
  getLocalizedDailyDocRef: (...args: unknown[]) => mockGetLocalizedDailyDocRef(...args),
  getLocalizedExistingRiddlesFromFirestoreForLocale: jest.fn().mockResolvedValue({questions: [], answers: []}),
  getNextDailyIndex: jest.fn().mockResolvedValue(42),
  riddleExists: jest.fn().mockReturnValue(false),
  riddleHasPlayableClue: jest.fn().mockReturnValue(true),
}));
jest.mock("firebase-functions/v2", () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
}));

import {generateLocalizedDailyChallengeForDate} from "../daily/dailyRiddleGeneration";

describe("immutable localized Daily generation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    mockGet.mockResolvedValue({exists: false, data: () => undefined});
    mockSet.mockResolvedValue(undefined);
    mockGenerateUniqueRiddle.mockResolvedValue(["What has hands but cannot clap?", "clock"]);
  });

  it("writes a playable dated document and never overwrites legacy current", async () => {
    await generateLocalizedDailyChallengeForDate("2026-08-12");

    expect(mockGenerateUniqueRiddle).toHaveBeenCalledWith("en", [], {mode: "daily", excludedQuestions: []});
    expect(mockGetLocalizedDailyDocRef).toHaveBeenCalledWith("en", "2026-08-12");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        riddleId: "daily-2026-08-12",
        challengeKey: "2026-08-12",
        answer: "clock",
        locale: "en",
      }),
    );
  });

  it("regenerates an existing document whose answer is not keyboard-playable", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({challengeKey: "2026-08-12", text: "Legacy clue", answer: "deux mots"}),
    });

    await generateLocalizedDailyChallengeForDate("2026-08-12");

    expect(mockGenerateUniqueRiddle).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalled();
  });

  it("reuses an existing playable dated document without a model call", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        challengeKey: "2026-08-12",
        text: "What has hands but cannot clap?",
        answer: "clock",
      }),
    });

    await generateLocalizedDailyChallengeForDate("2026-08-12");

    expect(mockGenerateUniqueRiddle).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("keeps the dated slot untouched when the bounded model budget is exhausted", async () => {
    mockGenerateUniqueRiddle.mockResolvedValue(null);

    await expect(generateLocalizedDailyChallengeForDate("2026-08-12")).rejects.toThrow(
      "Daily generation incomplete for 1 locale(s).",
    );
    expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(3);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("preserves bounded failure diagnostics for scheduled error reporting", async () => {
    mockGenerateUniqueRiddle.mockResolvedValue(null);

    await expect(generateLocalizedDailyChallengeForDate("2026-08-12")).rejects.toMatchObject({
      failedLocales: ["en"],
      attemptCount: 3,
    });
  });

  it("recovers within the bounded budget after a transient generation failure", async () => {
    mockGenerateUniqueRiddle.mockResolvedValueOnce(null);

    await generateLocalizedDailyChallengeForDate("2026-08-12");

    expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(2);
    expect(mockSet).toHaveBeenCalledTimes(1);
  });
});
