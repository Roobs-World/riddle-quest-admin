/** Issued tokens and content reads expose the real callable's ordering and latency. */
const mockPlayable = jest.fn();
/** Independent successor bindings must never be issued beyond a catalog gap. */
const mockEnsureSession = jest.fn(async (_user: string, _mode: string, id: string) => `issued-token-for-${id}`);
/** Current load has already reconciled any pending terminal completion. */
const mockCurrent = jest.fn();
jest.mock("../shared/sentryHandlers", () => ({onCallWithSentry: (_name: string, _options: unknown, handler: unknown) => ({run: handler})}));
jest.mock("../daily/dailyChallenge", () => ({getCurrentClassicRiddle: {run: (...args: unknown[]) => mockCurrent(...args)}}));
jest.mock("../gameplay/firestoreService", () => ({getUser: async () => ({progress: {classicIndex: 1}, preferredLanguage: "en"})}));
jest.mock("../gameplay/classicRiddleFallback", () => ({getPlayableClassicRiddle: (...args: unknown[]) => mockPlayable(...args)}));
jest.mock("../gameplay/singlePlayerSession", () => ({
  ensureAuthoritativeSession: (...args: [string, string, string]) => mockEnsureSession(...args),
  getIssuedAuthoritativeSession: async () => ({gameMode: "classic", answer: "piano", locale: "en", attempts: 0,
    hasUsedContinue: false, awaitingContinue: false, terminal: false, guessReceipts: {}, expiresAt: {toMillis: () => 1_900_000_000_000}}),
}));
import {getClassicRiddleBuffer} from "../daily/classicRiddleBuffer";

/** Bounded future content takes one deterministic 200ms catalog RPC per position. */
const playable = (index: number) => ({contentLocale: "en", riddle: {riddleId: `classic-${index}`, text: "What has keys but cannot open doors?", answer: "piano"}});
/** Real response validation still runs at the callable boundary. */
const load = () => getClassicRiddleBuffer.run({auth: {uid: "player"}, data: {locale: "en"}} as never);
beforeEach(() => {
  jest.clearAllMocks();
  mockPlayable.mockReset();
  mockCurrent.mockResolvedValue({challenge: {questions: [{riddleId: "classic-1", text: "What has keys but cannot open doors?",
    answerLength: 5, sessionToken: "current-token-for-classic-1", questionNumber: 1,
    attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false}], totalQuestions: 1}});
});

it("loads three successors in one catalog round trip while preserving entitlement order", async () => {
  jest.useFakeTimers().setSystemTime(1_800_000_000_000);
  try {
    mockPlayable.mockImplementation(async (index: number) => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return playable(index);
    });
    const result = load();
    await jest.runAllTimersAsync();
    expect((await result).riddles.map(item => item.classicIndex)).toEqual([1, 2, 3, 4]);
    expect(mockEnsureSession.mock.calls.map(call => call[2])).toEqual(["classic-2", "classic-3", "classic-4"]);
    expect(Date.now() - 1_800_000_000_000).toBe(200);
  } finally {jest.useRealTimers();}
});

it("issues no successor beyond the first gap, even when a later lookup fails", async () => {
  mockPlayable.mockImplementation(async (index: number) => {
    if (index === 2) return playable(index);
    if (index === 3) return undefined;
    throw new Error("unavailable later position");
  });
  expect((await load()).riddles.map(item => item.classicIndex)).toEqual([1, 2]);
  expect(mockEnsureSession.mock.calls.map(call => call[2])).toEqual(["classic-2"]);
});

it("fails a required catalog lookup before issuing any future session", async () => {
  mockPlayable.mockImplementation(async (index: number) => {
    if (index === 2) throw new Error("required catalog unavailable");
    return playable(index);
  });
  await expect(load()).rejects.toThrow("required catalog unavailable");
  expect(mockEnsureSession).not.toHaveBeenCalled();
});

it("does not prefetch when the current question is unavailable", async () => {
  mockCurrent.mockResolvedValue({error: "content unavailable"});
  expect((await load()).riddles).toEqual([]);
  expect(mockPlayable).not.toHaveBeenCalled();
  expect(mockEnsureSession).not.toHaveBeenCalled();
});
