import {createHash} from "node:crypto";
import {jest, it, expect} from "@jest/globals";

/** Actual issuance and current-question projection share this deterministic persistence transport. */
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
jest.mock("../gameplay/firestoreService", () => ({getUser: async () => ({progress: {classicIndex: 1}, preferredLanguage: "en"})}));
jest.mock("../gameplay/content/classicRiddleFallback", () => ({...jest.requireActual<any>("../gameplay/content/classicRiddleFallback"), getPlayableClassicRiddle: async () => {
  await mockDelay(); return {contentLocale: "en", riddle: {riddleId: "classic-1", text: "What has keys?", answer: "piano"}};
}}));
jest.mock("../gameplay/sessions/singlePlayerTerminalRecovery", () => ({recoverPendingAuthoritativeCompletion: async () => false}));
jest.mock("../daily/dailyRolloverRecovery", () => ({reconcilePreviousDailyBinding: async (_uid: string, user: unknown) => user}));
jest.mock("../riddles/riddleSupply", () => ({triggerClassicRiddleGenerationIfNeeded: async () => undefined}));
import {getCurrentClassicRiddle, getCurrentDailyChallenge} from "../daily/dailyChallenge";
import {ensureAuthoritativeSession} from "../gameplay/sessions/singlePlayerSession";
import {getSinglePlayerCompletionKey, getSinglePlayerContentKey} from "../gameplay/sessions/singlePlayerAnswerPolicy";
import {getDailyDate} from "../../../src/gameplay/daily/dailyCalendar.js";

it.each((["classic", "challenge"] as const).flatMap(mode => [false, true].map(resumed => ({mode, resumed}))))(
  "projects $mode resumed $resumed from committed issuance without a follow-up read", async ({mode, resumed}) => {
  jest.useFakeTimers().setSystemTime(1_800_000_000_000);
  try {
    mockDocuments.clear(); mockReads.length = 0;
    /** Daily content is fetched through the real handler's dated-document lookup. */
    const day = getDailyDate("en"), riddle = {riddleId: mode === "classic" ? "classic-1" : `daily-${day}`, text: "What has keys?", answer: "piano"};
    mockDocuments.set(`localizedRiddles/en/riddles/daily-${day}`, {...riddle, challengeKey: day});
    if (resumed) {
      /** Real issuance establishes the canonical binding before the timed load begins. */
      const seed = ensureAuthoritativeSession("player", mode, riddle.riddleId, "en", getSinglePlayerContentKey(mode === "challenge" ? {...riddle, challengeKey: day} : riddle, mode, "en"),
        getSinglePlayerCompletionKey(mode, mode === "classic" ? 1 : day), "piano", mode === "classic" ? {classicIndex: 1} : {challengeDate: day});
      await jest.runAllTimersAsync(); await seed; mockReads.length = 0;
    }
    /** Profile/recovery, account lease, HTTP and transaction commit latency are outside this fixture. */
    const start = Date.now(), callable = mode === "classic" ? getCurrentClassicRiddle : getCurrentDailyChallenge;
    /** The actual current loader and issuance transaction perform all observed persistence reads. */
    const pending = callable.run({auth: {uid: "player", token: {}}, data: {locale: "en", includeEvaluation: true}} as never);
    await jest.runAllTimersAsync();
    /** Public response validation and status projection stay real. */
    const result = await pending;
    if (process.env.SINGLE_PLAYER_LOAD_ISSUANCE_TRACE) console.info(JSON.stringify({mode, resumed, elapsedMs: Date.now() - start, reads: mockReads}));
    expect(result.challenge?.questions[0]).toMatchObject({riddleId: riddle.riddleId, attemptsUsed: 0, awaitingContinue: false});
    expect(Date.now() - start).toBe(resumed ? 600 : 400);
    expect(mockReads.filter(read => read.startsWith("direct:users/"))).toHaveLength(0);
    expect(mockReads.filter(read => read.startsWith("transaction:"))).toHaveLength(resumed ? 2 : 1);
  } finally {jest.useRealTimers();}
});
