import {beforeEach, afterEach, expect, it, jest} from "@jest/globals";

const mockSet = jest.fn().mockResolvedValue(undefined);
jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore: {FieldValue: {serverTimestamp: () => "fixture-time"}}}}));
jest.mock("../shared/sentry", () => ({captureException: jest.fn(), withSentrySpan: (_name: string, _op: string, callback: () => unknown) => callback()}));
jest.mock("firebase-functions", () => ({logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()}}));
jest.mock("firebase-functions/v2", () => ({logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()}}));
jest.mock("../riddles/riddleGenerationRepository", () => ({
  getLocalizedCanonicalKey: () => "daily:fixture:ko",
  getLocalizedDailyDocRef: () => ({get: async () => ({exists: false, data: () => undefined}), set: mockSet}),
  getLocalizedExistingRiddlesFromFirestoreForLocale: async () => ({questions: [], answers: []}),
  riddleExists: () => false,
  riddleHasPlayableClue: () => true,
}));
jest.mock("openai", () => {
  const ActualOpenAI = jest.requireActual("openai").default;
  return {__esModule: true, default: class extends ActualOpenAI {
    constructor(options: Record<string, unknown>) {
      super({...options, fetch: (_url: unknown, init: RequestInit) => new Promise((resolve, reject) => {
        const body = JSON.parse(String(init.body));
        const format = body.text.format.name;
        const parsed = format === "generated_riddle"
          ? {question: "Which vegetable has a long white root and is grated beside grilled fish?", answer: "daikon"}
          : format === "riddle_blind_solve"
            ? {answer: "daikon", confidence: "high", alternativeAnswers: []}
            : {clueSupportsAnswer: true, singleBestAnswer: true, factuallySound: true, naturalLanguage: true,
              fairForCasualPlayers: true, noAnswerSpoiler: true, difficulty: "easy", categoryMatch: true, issues: []};
        const timer = setTimeout(() => resolve(new Response(JSON.stringify({id: "fixture", object: "response", status: "completed",
          output: [{type: "message", id: "m", role: "assistant", status: "completed", content: [{type: "output_text", text: JSON.stringify(parsed), annotations: []}]}],
        }), {headers: {"Content-Type": "application/json"}})), 16_000);
        init.signal?.addEventListener("abort", () => {clearTimeout(timer); reject(init.signal?.reason);}, {once: true});
      })});
    }
  }};
});

import {generateLocalizedDailyChallengeForDate} from "../daily/dailyRiddleGeneration";
import {resetOpenAIClient} from "../riddles/openaiService";

beforeEach(() => {jest.useFakeTimers(); process.env.OPENAI_API_KEY = "fixture-only"; resetOpenAIClient(); mockSet.mockClear();});
afterEach(() => {jest.useRealTimers(); resetOpenAIClient();});

it("stores scheduled Daily content when each genuine SDK response needs more than fifteen seconds", async () => {
  const completion = generateLocalizedDailyChallengeForDate("2026-10-03", false, ["ko"]).then(() => true, () => false);
  await jest.runAllTimersAsync();
  expect(await completion).toBe(true);
  expect(mockSet).toHaveBeenCalledTimes(1);
  expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({locale: "ko", challengeKey: "2026-10-03", answer: "daikon"}));
});
