import {createHash} from "node:crypto";
import {jest, it, expect} from "@jest/globals";

/** Actual issuance and buffer projection share this deterministic persistence transport. */
const mockDocuments = new Map<string, Record<string, any>>();
/** Every entry identifies one direct or transactional document read. */
const mockReads: string[] = [];
/** Each read stage costs 200 ms; transaction commit latency is outside this fixture. */
const mockDelay = () => new Promise(resolve => setTimeout(resolve, 200));
/** Firestore-like trusted expiry keeps its conversions when snapshots are copied. */
const mockTimestamp = (millis: number) => ({toDate: () => new Date(millis), toMillis: () => millis});
/** Snapshot data is copied while preserving the trusted expiry conversion object. */
const mockSnapshot = (path: string) => ({exists: mockDocuments.has(path), data: () => {
  /** Stored state is independent of writes queued after the read. */
  const value = mockDocuments.get(path);
  return value ? {...structuredClone({...value, expiresAt: undefined}), expiresAt: value.expiresAt} : undefined;
}});
/** Nested references preserve the production token and content-key hashes. */
const mockRef = (path: string): any => ({path,
  get: async () => {mockReads.push(`direct:${path}`); await mockDelay(); return mockSnapshot(path);},
  collection: (name: string) => ({doc: (id: string) => mockRef(`${path}/${name}/${id}`)}),
});
/** The real issuance callback performs its own binding/session reads and creates. */
const mockTransaction = {
  get: async (ref: any) => {mockReads.push(`transaction:${ref.path}`); await mockDelay(); return mockSnapshot(ref.path);},
  set: (ref: any, value: Record<string, any>) => mockDocuments.set(ref.path, value),
  create: (ref: any, value: Record<string, any>) => mockDocuments.set(ref.path, value),
};
/** Real issuance, expiry and response projection remain unchanged beneath transport simulation. */
const mockFirestore = Object.assign(() => ({collection: (name: string) => ({doc: (id: string) => mockRef(`${name}/${id}`)}),
  runTransaction: async (operation: (transaction: typeof mockTransaction) => unknown) => operation(mockTransaction)}),
  {FieldValue: {serverTimestamp: () => "server-time"}, Timestamp: {fromMillis: mockTimestamp}});
jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore: mockFirestore}}));
// Current entitlement reconciliation, HTTP transport and account leases are outside this issuance-stage fixture.
jest.mock("../shared/sentryHandlers", () => ({onCallWithSentry: (_name: string, _options: unknown, handler: unknown) => ({run: handler})}));
jest.mock("../daily/dailyChallenge", () => ({getCurrentClassicRiddle: {run: async () => ({classicIndex: 1, challenge: {questions: [{
  riddleId: "classic-1", text: "What has keys?", answerLength: 5, sessionToken: "current-session-token-classic-1", questionNumber: 1,
  attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false}], totalQuestions: 1}})}}));
jest.mock("../gameplay/firestoreService", () => ({getUser: async () => ({progress: {classicIndex: 1}, preferredLanguage: "en"})}));
jest.mock("../gameplay/classicRiddleFallback", () => ({getPlayableClassicRiddle: async (index: number) => {
  await mockDelay(); return {contentLocale: "en", riddle: {riddleId: `classic-${index}`, text: "What has keys?", answer: "piano"}};
}}));
import {getClassicRiddleBuffer} from "../daily/classicRiddleBuffer";
import {getSinglePlayerContentKey} from "../gameplay/singlePlayerAnswerPolicy";

/** Fixture references use the same opaque identity as the production document resolver. */
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
/** Complete recoverable issued state supplies current and resumed future sessions. */
const state = (index: number) => ({gameMode: "classic", riddleId: `classic-${index}`, locale: "en", answer: "piano",
  contentKey: getSinglePlayerContentKey({riddleId: `classic-${index}`, answer: "piano"}, "classic", "en"), completionKey: `classic:${index}`,
  classicIndex: index, attempts: 0, hasUsedContinue: false, awaitingContinue: false, terminal: false, isCorrect: false,
  guessReceipts: {}, expiresAt: mockTimestamp(1_900_000_000_000)});

it.each([false, true])("projects resumed future sessions %s without post-issuance document fetches", async resumed => {
  jest.useFakeTimers().setSystemTime(1_800_000_000_000);
  try {
    mockDocuments.clear(); mockReads.length = 0;
    mockDocuments.set(`users/player/singlePlayerSessions/${hash("current-session-token-classic-1")}`, state(1));
    if (resumed) for (const index of [2, 3, 4]) {
      /** Existing opaque token and current state are read within the real issuance callback. */
      const token = `future-session-token-classic-${index}`, existing = state(index);
      mockDocuments.set(`users/player/singlePlayerSessionBindings/${hash(existing.contentKey)}`, {sessionToken: token});
      mockDocuments.set(`users/player/singlePlayerSessions/${hash(token)}`, existing);
    }
    /** Real handler preserves current-first ordering, three parallel catalog lookups and independent issuance. */
    const start = Date.now();
    /** Starts the actual buffer handler before draining its simulated transport stages. */
    const pending = getClassicRiddleBuffer.run({auth: {uid: "player"}, data: {locale: "en"}} as never);
    await jest.runAllTimersAsync();
    /** Actual response schema validates all projected session tokens, expiries and status fields. */
    const result = await pending;
    if (process.env.CLASSIC_BUFFER_ISSUANCE_TRACE) console.info(JSON.stringify({resumed, elapsedMs: Date.now() - start, reads: mockReads}));
    expect(result.riddles.map(riddle => riddle.classicIndex)).toEqual([1, 2, 3, 4]);
    expect(result.riddles.every(riddle => riddle.question.attemptsUsed === 0 && riddle.expiresAtMs > start)).toBe(true);
    expect(Date.now() - start).toBe(resumed ? 800 : 600);
    expect(mockReads.filter(read => read.startsWith("direct:"))).toHaveLength(1);
    expect(mockReads.filter(read => read.startsWith("transaction:"))).toHaveLength(resumed ? 6 : 3);
  } finally {jest.useRealTimers();}
});
