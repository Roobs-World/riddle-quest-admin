import {afterEach, beforeEach, expect, it, jest} from "@jest/globals";
import type {HostServices} from "@riddle-quest/hosted/hostTypes";

/** SDK account shared by the actual adapter and native identity observer. */
const sdkUser = (uid: string) => ({uid, isAnonymous: false, metadata: {creationTime: "2026-01-01T00:00:00Z"}});
/** Mutable authenticated account controls identity-scoped deduplication. */
const mockAuth = {currentUser: sdkUser("Alice")};
/** Actual adapter observes account replacement through the native callback. */
let mockObserver: (user: typeof mockAuth.currentUser) => void;
/** Each authority call is independently observed without replacing adapter logic. */
const mockAuthority = jest.fn<(kind: string, input: unknown) => Promise<{
  /** Server response validated by the callable boundary. */
  data: unknown;
}>>();
/** Optional profile publication must not run for an expired transport. */
const mockProfile = jest.fn<() => Promise<Record<string, unknown>>>().mockResolvedValue({coins: 350});
jest.mock("../../firebase", () => ({auth: mockAuth, loadUserDocument: mockProfile,
  completeGame: (input: unknown) => mockAuthority("complete", input),
  submitSinglePlayerGuess: (input: unknown) => mockAuthority("guess", input),
  getHint: (input: unknown) => mockAuthority("hint", input),
  spendCoins: (input: unknown) => mockAuthority("spend", input),
  skipRiddle: (input: unknown) => mockAuthority("skip", input),
}));
jest.mock("firebase/auth", () => ({onAuthStateChanged: (_auth: unknown, observer: typeof mockObserver) => {
  mockObserver = observer;return jest.fn();
}, signOut: jest.fn()}));
import {createFirebaseHostServices} from "../firebaseServices";

/** Each operation supplies its distinct accepted receipt. */
const receipts = {
  complete: {attempts: 1, isCorrect: true, coinsEarned: 50, newlyUnlockedAchievementIds: [], rewardBreakdown: {newBalance: 350, totalAwarded: 50}},
  guess: {attempts: 1, isCorrect: false, gameOver: false, feedback: [{letter: "p", status: "green"}]},
  hint: {revealedLetter: "p", index: 0, coinsCost: 25, newCoins: 275},
  spend: {newCoins: 275},
  skip: {success: true, newProgress: {classicIndex: 18}, message: "Skipped", costDeducted: 100, newCoins: 200},
};
/** Authoritative operation identifiers define the public seams exercised by the tests. */
type Kind = keyof typeof receipts;
/** Typed caller keeps the original paid request ID and question identity through retries. */
const call = (services: HostServices, kind: Kind, requestId = "same-paid-request") => {
  /** Every request retains its server-issued single-player entitlement. */
  const input = {gameMode: "classic" as const, riddleId: "classic-17", sessionToken: "00000000-0000-4000-8000-000000000017"};
  if (kind === "complete") return services.completeGame(input);
  if (kind === "guess") return services.submitGuess({...input, requestId, guess: "piano"});
  if (kind === "hint") return services.requestHint({...input, requestId, currentAttempt: ["", "", "", "", ""]});
  if (kind === "spend") return services.spendCoins({...input, requestId, reason: "continue", amount: 25});
  return services.skipRiddle({...input, requestId});
};
/** Holds a provider response beyond expiry or overlapping renderer retries. */
const deferred = <T>() => {
  /** Completes the held authority response at the selected test event. */
  let resolve!: (value: T) => void;
  /** In-flight response controlled independently of the adapter's local wait. */
  const promise = new Promise<T>(done => {resolve = done;});
  return {promise, resolve};
};

beforeEach(() => {jest.useFakeTimers();mockAuthority.mockReset();mockProfile.mockClear();mockAuth.currentUser = sdkUser("Alice");});
afterEach(() => jest.useRealTimers());

it.each(Object.keys(receipts) as Kind[])("coalesces overlapping %s retries and optional follow-up work", async kind => {
  /** One server operation remains pending across repeated renderer delivery. */
  const held = deferred<{
    /** Accepted authority response. */
    data: unknown;
  }>();
  mockAuthority.mockReturnValue(held.promise);
  /** Actual adapter owns both pending transport and optional profile publication. */
  const services = createFirebaseHostServices();
  /** Repeated identical requests must share one authority call. */
  const callers = [call(services, kind), call(services, kind), call(services, kind)];
  try {expect(mockAuthority).toHaveBeenCalledTimes(1);} finally {held.resolve({data: receipts[kind]});await Promise.all(callers);}
  expect(mockProfile).toHaveBeenCalledTimes(kind === "guess" ? 0 : 1);
  expect(jest.getTimerCount()).toBe(0);
});

it.each(Object.keys(receipts) as Kind[])("expires stalled %s delivery and retries with its original identity", async kind => {
  /** Provider ignores the local delivery deadline and answers later. */
  const held = deferred<{
    /** Accepted authority response. */
    data: unknown;
  }>();
  mockAuthority.mockReturnValueOnce(held.promise).mockResolvedValue({data: receipts[kind]});
  /** The adapter retains the original paid request identifiers while recovering delivery. */
  const services = createFirebaseHostServices();
  /** Immediately handled error keeps a stalled request from becoming an unhandled rejection. */
  const expired = call(services, kind).catch(error => error);
  await jest.advanceTimersByTimeAsync(15000);
  // Observe expiry before waiting: the baseline must fail without leaving the test hanging.
  /** Settlement remains observable independently of the unresolved provider request. */
  let settled = false;
  void expired.then(() => {settled = true;});await jest.advanceTimersByTimeAsync(0);
  expect(settled).toBe(true);
  expect(await expired).toMatchObject({code: "deadline-exceeded"});
  await expect(call(services, kind)).resolves.toEqual(receipts[kind]);
  expect(mockAuthority).toHaveBeenCalledTimes(2);
  expect(mockAuthority.mock.calls[1]?.[1]).toEqual(mockAuthority.mock.calls[0]?.[1]);
  /** Only the timely recovery may trigger profile follow-up. */
  const followUps = mockProfile.mock.calls.length;
  held.resolve({data: receipts[kind]});await jest.advanceTimersByTimeAsync(0);
  expect(mockProfile).toHaveBeenCalledTimes(followUps);
  expect(jest.getTimerCount()).toBe(0);
});

it.each(["guess", "hint", "spend", "skip"] as Kind[])("does not merge distinct %s request IDs", async kind => {
  mockAuthority.mockImplementation(async () => ({data: receipts[kind]}));
  /** Independent paid requests remain independent server authority calls. */
  const services = createFirebaseHostServices();
  await Promise.all([call(services, kind, "first-request"), call(services, kind, "second-request")]);
  expect(mockAuthority).toHaveBeenCalledTimes(2);
});

it.each(Object.keys(receipts) as Kind[])("does not share pending %s delivery across accounts", async kind => {
  /** Two different authenticated callers own their separate authority requests. */
  const held = deferred<{
    /** Accepted authority response. */
    data: unknown;
  }>();
  mockAuthority.mockReturnValue(held.promise);
  /** Native observer keeps deduplication bound to actual account visits. */
  const services = createFirebaseHostServices();services.auth.subscribe(jest.fn());
  /** Original account owns this request until its transport settles. */
  const alice = call(services, kind);
  mockAuth.currentUser = sdkUser("Bob");mockObserver(mockAuth.currentUser);
  /** Replacement account cannot reuse the earlier caller's receipt. */
  const bob = call(services, kind);
  expect(mockAuthority).toHaveBeenCalledTimes(2);
  held.resolve({data: receipts[kind]});await Promise.all([alice, bob]);
});

it("coalesces equivalent paid payloads independently of property insertion order", async () => {
  /** Pending transport has one canonical payload despite different object construction. */
  const held = deferred<{
    /** Validated provider receipt. */
    data: unknown;
  }>();
  mockAuthority.mockReturnValue(held.promise);
  /** Both callers refer to the same issued Continue request. */
  const services = createFirebaseHostServices();
  /** Pending caller retains its account-scoped issued request. */
  const first = call(services, "spend");
  /** Pending caller retains its account-scoped issued request. */
  const second = services.spendCoins({amount: 25, reason: "continue", requestId: "same-paid-request",
    sessionToken: "00000000-0000-4000-8000-000000000017", gameMode: "classic", riddleId: "classic-17"});
  expect(mockAuthority).toHaveBeenCalledTimes(1);
  held.resolve({data: receipts.spend});await Promise.all([first, second]);
});

it("does not reuse a pending completion across a later visit of the same UID", async () => {
  /** First visit's transport remains pending through an intervening account visit. */
  const held = deferred<{
    /** Validated provider receipt. */
    data: unknown;
  }>();
  mockAuthority.mockReturnValue(held.promise);
  /** Native identity boundaries retire the first visit's deduplication key. */
  const services = createFirebaseHostServices();services.auth.subscribe(jest.fn());
  /** Pending caller retains its account-scoped issued request. */
  const first = call(services, "complete");
  mockAuth.currentUser = sdkUser("Bob");mockObserver(mockAuth.currentUser);
  mockAuth.currentUser = sdkUser("Alice");mockObserver(mockAuth.currentUser);
  /** Pending caller retains its account-scoped issued request. */
  const second = call(services, "complete");
  expect(mockAuthority).toHaveBeenCalledTimes(2);
  held.resolve({data: receipts.complete});await Promise.all([first, second]);
});
