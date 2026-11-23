import {afterEach, beforeEach, expect, it, jest} from "@jest/globals";

/** Minimal dated Daily content used by the publication fixture. */
type DailyData = {
/** Date identifying the fixture publication. */
challengeKey: string; 
/** Clue text returned by the fixture. */
text: string; 
/** Answer stored in the fixture Daily content. */
answer: string};
/** Document existence and content returned by the fixture. */
type Snapshot = {
/** Whether the fixture document has been published. */
exists: boolean; 
/** Returns the fixture document content when present. */
data: () => DailyData | undefined};
/** Absent dated publication before the first author attempt. */
const emptySnapshot: Snapshot = {exists: false, data: () => undefined};
/** Initial publication read controlled by the test. */
const mockGet = jest.fn(async (): Promise<Snapshot> => emptySnapshot);
/** Publication read repeated inside the transaction. */
const mockTransactionGet = jest.fn(async (): Promise<Snapshot> => emptySnapshot);
/** Records attempted fixture publication writes. */
const mockSet = jest.fn();
/** Runs the publication callback against controlled transaction reads and writes. */
const mockRunTransaction = jest.fn(async (callback: (transaction: {
  /** Reads the current document inside the transaction fixture. */
  get: typeof mockTransactionGet;
  /** Records a publication write requested by the transaction fixture. */
  set: typeof mockSet;
}) => Promise<boolean>) => callback({get: mockTransactionGet, set: mockSet}));
/** Captured author prompts used to verify retry feedback isolation. */
const mockAuthorRequests: {
/** User input sent through the real OpenAI SDK request. */
input: string; 
/** Author instructions captured from the real SDK request. */
instructions: string}[] = [];
/** Number of author attempts served by the fixture. */
let mockAuthorCount = 0;
/** Keeps every fixture review below the requested medium band. */
let mockAlwaysEasy = false;
/** First candidate deliberately rejected by its independent review. */
const firstQuestion = "What has hands but cannot clap?";
/** Replacement candidate used by the next bounded author attempt. */
const secondQuestion = "I hide below a tree, drink from soil and hold it upright. What am I?";

jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore: {FieldValue: {serverTimestamp: () => "fixture-time"}}}}));
jest.mock("../shared/sentry", () => ({captureException: jest.fn(), withSentrySpan: (_name: string, _op: string, callback: () => unknown) => callback()}));
jest.mock("firebase-functions", () => ({logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()}}));
jest.mock("firebase-functions/v2", () => ({logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()}}));
jest.mock("../riddles/riddleGenerationRepository", () => ({
  getLocalizedCanonicalKey: () => "daily:fixture:vi",
  getLocalizedDailyDocRef: () => ({get: mockGet, set: mockSet, firestore: {runTransaction: mockRunTransaction}}),
  getLocalizedExistingRiddlesFromFirestoreForLocale: async () => ({questions: [], answers: []}),
  riddleExists: () => false,
  riddleHasPlayableClue: () => true,
}));
jest.mock("openai", () => {
  /** Real OpenAI SDK constructor used with a local response transport. */
  const ActualOpenAI = jest.requireActual<typeof import("openai")>("openai").default;
  return {__esModule: true, default: class extends ActualOpenAI {
    /** OpenAI fixture routing author and review requests to deterministic responses. */
    constructor(options: ConstructorParameters<typeof ActualOpenAI>[0]) {
      super({...options, fetch: async (_url, init) => {
        /** Structured request sent by the real SDK to the fixture transport. */
        const body = JSON.parse(String(init?.body));
        /** Requested response schema distinguishing authoring and review calls. */
        const format = body.text.format.name;
        if (format === "generated_riddle") {
          mockAuthorCount += 1;
          mockAuthorRequests.push({input: body.input, instructions: body.instructions});
        }
        /** Candidate answer returned by the author or reviewer fixture. */
        const answer = mockAuthorCount === 1 ? "clock" : "root";
        /** Deterministic structured payload returned for the selected response schema. */
        const parsed = format === "generated_riddle"
          ? {question: mockAuthorCount === 1 ? firstQuestion : secondQuestion, answer}
          : format === "riddle_blind_solve"
            ? {answer, confidence: "high", alternativeAnswers: []}
            : {clueSupportsAnswer: true, singleBestAnswer: true, factuallySound: true, naturalLanguage: true,
              fairForCasualPlayers: true, noAnswerSpoiler: true, difficulty: mockAlwaysEasy || mockAuthorCount === 1 ? "easy" : "medium", categoryMatch: true, issues: []};
        return new Response(JSON.stringify({id: "fixture", object: "response", status: "completed",
          output: [{type: "message", id: "m", role: "assistant", status: "completed", content: [{type: "output_text", text: JSON.stringify(parsed), annotations: []}]}],
        }), {headers: {"Content-Type": "application/json"}});
      }});
    }
  }};
});

import {generateLocalizedDailyChallengeForDate} from "../daily/dailyRiddleGeneration";
import {resetOpenAIClient} from "../riddles/openaiService";

beforeEach(() => {
  process.env.OPENAI_API_KEY = "fixture-only";
  resetOpenAIClient();
  mockGet.mockResolvedValue(emptySnapshot);
  mockTransactionGet.mockResolvedValue(emptySnapshot);
  mockSet.mockClear();
  mockRunTransaction.mockClear();
  mockAuthorCount = 0;
  mockAlwaysEasy = false;
  mockAuthorRequests.length = 0;
});

it("keeps the medium requirement and three-attempt budget when every review rejects the difficulty", async () => {
  mockAlwaysEasy = true;
  await expect(generateLocalizedDailyChallengeForDate("2026-10-26", false, ["vi"])).rejects.toMatchObject({failedLocales: ["vi"], attemptCount: 3});
  expect(mockAuthorRequests).toHaveLength(3);
  expect(mockSet).not.toHaveBeenCalled();
});
afterEach(() => {resetOpenAIClient();});

it("uses rejected review feedback and excludes the easy candidate when retrying a medium Daily", async () => {
  await generateLocalizedDailyChallengeForDate("2026-10-26", false, ["vi"]);
  expect(mockAuthorRequests).toHaveLength(2);
  expect(mockAuthorRequests[1].input).toContain(firstQuestion);
  expect(mockAuthorRequests[1].input).toContain("clock");
  expect(mockAuthorRequests[1].input).toContain('"difficulty":"easy"');
  expect(mockAuthorRequests[1].input).toContain('"difficultyMatch":true');
  expect(mockSet).toHaveBeenCalledTimes(1);
  expect(mockSet.mock.calls[0].at(-1)).toMatchObject({locale: "vi", challengeKey: "2026-10-26", text: secondQuestion, answer: "root", difficultyBand: "medium"});
});

it("preserves playable Daily content another invocation published while this one was authoring", async () => {
  mockTransactionGet.mockResolvedValue({exists: true, data: () => ({challengeKey: "2026-10-26", text: "Existing immutable clue", answer: "garden"})});
  await generateLocalizedDailyChallengeForDate("2026-10-26", false, ["vi"]);
  expect(mockAuthorRequests).toHaveLength(2);
  expect(mockRunTransaction).toHaveBeenCalledTimes(1);
  expect(mockTransactionGet).toHaveBeenCalledTimes(1);
  expect(mockSet).not.toHaveBeenCalled();
});
