import {beforeEach, expect, it, jest} from "@jest/globals";
import type {ClassicRiddleBufferResponse} from "@qwordly/core/validation";
import type {CurrentRiddleResponse} from "../../firebase";

/** Minimal SDK identity supporting same-UID account visit transitions. */
const sdkUser = (uid: string) => ({uid, isAnonymous: false, metadata: {creationTime: "2026-01-01T00:00:00Z"}});
/** Current SDK identity is nullable while a player signs out. */
const mockAuth: {
  /** Selected SDK account. */
  currentUser: ReturnType<typeof sdkUser> | null;
} = {currentUser: sdkUser("Alice")};
/** Callable current-question transport envelope. */
type RiddleReceipt = {
  /** Validated question response. */
  data: CurrentRiddleResponse;
};
/** Callable issued-buffer transport envelope. */
type BufferReceipt = {
  /** Validated contiguous queue. */
  data: ClassicRiddleBufferResponse;
};
/** Native SDK observer drives the actual adapter's identity boundary. */
let mockObserver: (user: typeof mockAuth.currentUser) => void;
/** Profile progress may change while content transport remains pending. */
const mockProfile = jest.fn<() => Promise<Record<string, unknown>>>();
/** Current Classic transport records the immutable requested progression position. */
const mockClassic = jest.fn<(input: unknown) => Promise<RiddleReceipt>>();
/** Daily authority is independently delayed through account transitions. */
const mockDaily = jest.fn<() => Promise<RiddleReceipt>>();
/** Issued buffer can overlap a required current-progress reconciliation. */
const mockBuffer = jest.fn<() => Promise<BufferReceipt>>();
jest.mock("../../firebase", () => ({auth: mockAuth, loadUserDocument: mockProfile,
  getCurrentClassicRiddle: mockClassic, getCurrentDailyChallenge: mockDaily, getClassicRiddleBuffer: mockBuffer}));
jest.mock("firebase/auth", () => ({onAuthStateChanged: (_auth: unknown, observer: typeof mockObserver) => {
  mockObserver = observer;return jest.fn();
}, signOut: jest.fn()}));
import {createFirebaseHostServices} from "../firebaseServices";

/** Controlled server response permits exact ordering of identity and content events. */
const deferred = <T>() => {
  /** Resolves the held transport after the selected state transition. */
  let resolve!: (value: T) => void;
  /** Authority request deliberately retained across profile or account changes. */
  const promise = new Promise<T>(done => {resolve = done;});
  return {promise, resolve};
};
/** Flushes adapter continuations without a production network wait. */
const flush = () => new Promise<void>(done => setImmediate(done));
/** Selects the provider's current account before publishing its native notification. */
const select = (uid: string | null) => {
  mockAuth.currentUser = uid ? sdkUser(uid) : null;
  mockObserver(mockAuth.currentUser);
};
/** Legacy responses use questionNumber 1 and omit the canonical Classic position. */
const question = {riddleId: "classic-17", text: "An issued riddle", answerLength: 5,
  questionNumber: 1, sessionToken: "00000000-0000-4000-8000-000000000017",
  attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false};
/** Confirmed position with no successors forces the ordinary current-question fallback. */
const emptyBuffer = {data: {confirmedClassicIndex: 1, riddles: []}};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.currentUser = sdkUser("Alice");
  mockProfile.mockReset().mockResolvedValue({coins: 300, progress: {classicIndex: 17}});
  mockClassic.mockReset().mockResolvedValue({data: {challenge: {questions: [question], totalQuestions: 1}}});
  mockDaily.mockReset().mockResolvedValue({data: {challenge: {questions: [question], totalQuestions: 1}}});
  mockBuffer.mockReset().mockResolvedValue(emptyBuffer);
});

it("keeps the admitted Classic index when a newer profile arrives during transport", async () => {
  /** Session recovery bypasses the buffer but retains its original requested index. */
  const held = deferred<RiddleReceipt>();
  mockClassic.mockReturnValue(held.promise);
  /** Real adapter observes profile 17 before admitting the load. */
  const services = createFirebaseHostServices();
  services.auth.subscribe(jest.fn());select("Alice");await flush();
  /** Issued content must not inherit an unrelated later progression number. */
  const loading = services.loadRiddle({gameMode: "classic", locale: "en", sessionToken: question.sessionToken});
  mockProfile.mockResolvedValue({coins: 350, progress: {classicIndex: 18}});select("Alice");await flush();
  held.resolve({data: {challenge: {questions: [question], totalQuestions: 1}}});
  expect((await loading).index).toBe(17);
  expect(mockClassic).toHaveBeenCalledWith(expect.objectContaining({classicIndex: 17, includeClassicIndex: true}));
});

it("does not start an old account's fallback when its held buffer finishes after replacement", async () => {
  /** A speculative successor waits for the originally selected player's buffer. */
  const held = deferred<BufferReceipt>();
  mockBuffer.mockReturnValue(held.promise);
  mockProfile.mockResolvedValue({coins: 300, progress: {classicIndex: 1}});
  /** Mounted SDK observer retires Alice before the buffer returns. */
  const services = createFirebaseHostServices();
  services.auth.subscribe(jest.fn());select("Alice");await flush();
  /** Observe cancellation while keeping any rejection handled immediately. */
  const loading = services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 2}).catch(error => error);
  select("Bob");await flush();held.resolve(emptyBuffer);
  expect(await loading).toMatchObject({code: "cancelled"});
  expect(mockClassic).not.toHaveBeenCalled();
});

it.each(["replacement", "same-uid-reentry"])("retires Classic receipts and refills on %s", async transition => {
  /** Canonical current-question receipt finishes after its owner visit retires. */
  const held = deferred<RiddleReceipt>();
  mockClassic.mockReturnValue(held.promise);
  /** Real adapter receives native identity replacement signals. */
  const services = createFirebaseHostServices();
  services.auth.subscribe(jest.fn());
  /** Recovery read has no predecessor buffer request. */
  const loading = services.loadRiddle({gameMode: "classic", locale: "en", sessionToken: question.sessionToken}).catch(error => error);
  if (transition === "replacement") select("Bob");
  else {select(null);select("Alice");}
  await flush();held.resolve({data: {challenge: {questions: [question], totalQuestions: 1}}});
  expect(await loading).toMatchObject({code: "cancelled"});
  expect(mockBuffer).not.toHaveBeenCalled();
});

it("retires a cached Daily request's receipt when its account changes", async () => {
  /** Daily preload promise belongs to Alice even though Bob may now be subscribed. */
  const held = deferred<RiddleReceipt>();
  mockDaily.mockReturnValue(held.promise);
  /** Actual adapter admits the load under one account visit. */
  const services = createFirebaseHostServices();
  services.auth.subscribe(jest.fn());
  /** Late content must become cancellation rather than replacement account gameplay. */
  const loading = services.loadRiddle({gameMode: "challenge", locale: "en"}).catch(error => error);
  select("Bob");await flush();held.resolve({data: {challenge: {questions: [question], totalQuestions: 1}}});
  expect(await loading).toMatchObject({code: "cancelled"});
});

it("starts a fresh authoritative reconciliation instead of reusing an older preload", async () => {
  /** Preload began before the newly accepted progression became authoritative. */
  const preload = deferred<BufferReceipt>();
  mockBuffer.mockReturnValueOnce(preload.promise).mockResolvedValue({data: {confirmedClassicIndex: 18,
    riddles: [{classicIndex: 18, expiresAtMs: Date.now() + 60000, question: {...question, riddleId: "classic-18"}}]}});
  /** Same-account reconciliation must issue its own current-progress read. */
  const services = createFirebaseHostServices();
  services.preloadInitialRiddles?.("en");
  /** Recovery explicitly asks for current authority rather than a speculative position. */
  const loading = services.loadRiddle({gameMode: "classic", locale: "en", authoritative: true});
  expect(mockBuffer).toHaveBeenCalledTimes(2);
  expect((await loading).index).toBe(18);
  preload.resolve(emptyBuffer);await flush();
});

it("uses the server's reconciled Classic index ahead of the admitted request position", async () => {
  mockClassic.mockResolvedValue({data: {classicIndex: 18,
    challenge: {questions: [{...question, riddleId: "classic-18"}], totalQuestions: 1}}});
  /** Terminal recovery may advance position while serving the next issued question. */
  const services = createFirebaseHostServices();
  services.auth.subscribe(jest.fn());select("Alice");await flush();
  await expect(services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 17,
    sessionToken: question.sessionToken, riddleId: question.riddleId})).resolves.toMatchObject({riddleId: "classic-18", index: 18});
});

it("does not rewind authority when an older reconciliation finishes last", async () => {
  /** An earlier authoritative request is deliberately released last. */
  const older = deferred<BufferReceipt>();
  mockBuffer.mockReturnValueOnce(older.promise).mockResolvedValue({data: {confirmedClassicIndex: 18,
    riddles: [{classicIndex: 18, expiresAtMs: Date.now() + 60000, question: {...question, riddleId: "classic-18"}}]}});
  /** Both reads belong to the same account, with newer confirmed progress winning. */
  const services = createFirebaseHostServices();
  /** The older authoritative load stays pending while the successor read completes. */
  const loading = services.loadRiddle({gameMode: "classic", locale: "en", authoritative: true});
  await expect(services.loadRiddle({gameMode: "classic", locale: "en", authoritative: true})).resolves.toMatchObject({index: 18});
  older.resolve({data: {confirmedClassicIndex: 17,
    riddles: [{classicIndex: 17, expiresAtMs: Date.now() + 60000, question}]}});
  await expect(loading).resolves.toMatchObject({riddleId: "classic-18", index: 18});
});
