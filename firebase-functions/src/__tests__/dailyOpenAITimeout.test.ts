import {beforeEach, afterEach, expect, it, jest} from "@jest/globals";

/** Provides mock set behavior. */
const mockSet = jest.fn().mockResolvedValue(undefined);
/** Absent dated document returned by the publication fixture. */
const mockSnapshot = async () => ({exists: false, data: () => undefined});
/** Runs the publication callback against controlled transaction reads and writes. */
const mockRunTransaction = async (callback: (transaction: {
  /** Reads the current document inside the transaction fixture. */
  get: typeof mockSnapshot;
  /** Records a publication write requested by the transaction fixture. */
  set: (reference: unknown, data: unknown) => unknown;
}) => Promise<boolean>) => callback({get: mockSnapshot, set: (_reference, data) => mockSet(data)});
jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore: {FieldValue: {serverTimestamp: () => "fixture-time"}}}}));
jest.mock("../shared/sentry", () => ({captureException: jest.fn(), withSentrySpan: (_name: string, _op: string, callback: () => unknown) => callback()}));
jest.mock("firebase-functions", () => ({logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()}}));
jest.mock("firebase-functions/v2", () => ({logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()}}));
jest.mock("../riddles/riddleGenerationRepository", () => ({
  getLocalizedCanonicalKey: () => "daily:fixture:ko",
  getLocalizedDailyDocRef: () => ({get: mockSnapshot, set: mockSet, firestore: {runTransaction: mockRunTransaction}}),
  getLocalizedExistingRiddlesFromFirestoreForLocale: async () => ({questions: [], answers: []}),
  riddleExists: () => false,
  riddleHasPlayableClue: () => true,
}));
jest.mock("openai", () => {
  /** Renders the actual open ai interface. */
  const ActualOpenAI = jest.requireActual("openai").default;
  return {__esModule: true, default: class extends ActualOpenAI {
    /** Creates a class instance. */
    constructor(options: Record<string, unknown>) {
      super({...options, fetch: (_url: unknown, init: RequestInit) => new Promise((resolve, reject) => {
        /** Provides body behavior. */
        const body = JSON.parse(String(init.body));
        /** Provides format behavior. */
        const format = body.text.format.name;
        /** Provides parsed behavior. */
        const parsed = format === "generated_riddle"
          ? {question: "Which vegetable has a long white root and is grated beside grilled fish?", answer: "daikon"}
          : format === "riddle_blind_solve"
            ? {answer: "daikon", confidence: "high", alternativeAnswers: []}
            : {clueSupportsAnswer: true, singleBestAnswer: true, factuallySound: true, naturalLanguage: true,
              fairForCasualPlayers: true, noAnswerSpoiler: true, difficulty: "medium", categoryMatch: true, issues: []};
        /** Provides timer behavior. */
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
  /** Provides completion behavior. */
  const completion = generateLocalizedDailyChallengeForDate("2026-10-03", false, ["ko"]).then(() => true, () => false);
  await jest.runAllTimersAsync();
  expect(await completion).toBe(true);
  expect(mockSet).toHaveBeenCalledTimes(1);
  expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({locale: "ko", challengeKey: "2026-10-03", answer: "daikon"}));
});
