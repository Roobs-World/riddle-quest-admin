import {beforeEach, expect, it, jest} from "@jest/globals";
import type {AuthSnapshot, CompletionResult} from "../../../hosted/hostTypes";

/** Minimal SDK user fields consumed by the production bridge projection. */
const sdkUser = (uid: string) => ({uid, displayName: uid, email: null, photoURL: null, isAnonymous: false,
  metadata: {creationTime: "2026-01-01T00:00:00.000Z"}});
/** Mutable provider identity observed by the real adapter. */
const mockAuth: {
  /** Current SDK account. */
  currentUser: ReturnType<typeof sdkUser> | null;
} = {currentUser: sdkUser("Alice")};
/** Native subscriptions retained so retired callbacks can be deliberately replayed. */
const mockObservers: Array<(user: typeof mockAuth.currentUser) => void> = [];
/** Records native subscription teardown. */
const mockUnsubscribe = jest.fn();
/** Separately controlled profile read following authoritative mutations. */
const mockLoadProfile = jest.fn<(uid: string) => Promise<Record<string, unknown> | null>>();
/** Committed completion receipt does not depend on a later profile read. */
const receipt: CompletionResult = {attempts: 1, isCorrect: true, coinsEarned: 50,
  newlyUnlockedAchievementIds: [], rewardBreakdown: {newBalance: 350, totalAwarded: 50}};
/** Authority calls are independent of the profile transport. */
const mockComplete = jest.fn<() => Promise<{
  /** Server receipt. */
  data: CompletionResult;
}>>();
/** Server-confirmed spend receipt. */
const mockSpend = jest.fn<() => Promise<{
  /** Server balance. */
  data: {
    /** Remaining coins. */
    newCoins: number;
  };
}>>();
jest.mock("../../firebase", () => ({auth: mockAuth, loadUserDocument: mockLoadProfile,
  completeGame: mockComplete, spendCoins: mockSpend}));
jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, listener: (user: typeof mockAuth.currentUser) => void) => {
    mockObservers.push(listener);return mockUnsubscribe;
  }, signOut: jest.fn(),
}));
import {createFirebaseHostServices} from "../firebaseServices";

/** Resolves a profile only after newer identity or economy state has been admitted. */
const deferred = <T>() => {
  /** Settles the retained read at the chosen point in the test. */
  let resolve!: (value: T) => void;
  /** Pending authority profile read. */
  const promise = new Promise<T>(done => {resolve = done;});
  return {promise, resolve};
};
/** Allows promise continuations to finish without imposing production network delays. */
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
/** Selects the SDK account before emitting its native auth event. */
const changeAccount = (uid: string | null, observer = mockObservers.at(-1)!) => {
  mockAuth.currentUser = uid === null ? null : sdkUser(uid);
  observer(mockAuth.currentUser);
};

beforeEach(() => {
  jest.clearAllMocks();mockObservers.length = 0;mockAuth.currentUser = sdkUser("Alice");
  mockLoadProfile.mockReset().mockResolvedValue({coins: 300});
  mockComplete.mockReset().mockResolvedValue({data: receipt});
  mockSpend.mockReset().mockResolvedValue({data: {newCoins: 275}});
});

it("rejects a delayed auth profile after another account becomes current", async () => {
  /** Alice's profile response remains pending while Bob is selected. */
  const alice = deferred<Record<string, unknown>>();
  mockLoadProfile.mockImplementation(uid => uid === "Alice" ? alice.promise : Promise.resolve({coins: 800}));
  /** The actual adapter publishes only snapshots owned by its current native account. */
  const services = createFirebaseHostServices();
  /** Observed snapshots must never return to the retired account. */
  const listener = jest.fn<(snapshot: AuthSnapshot) => void>();
  services.auth.subscribe(listener);
  changeAccount("Alice");changeAccount("Bob");await flush();
  alice.resolve({coins: 10});await flush();
  expect(listener.mock.calls.at(-1)?.[0]).toMatchObject({user: {uid: "Bob"}, profile: {coins: 800}});
});

it("ignores a retired auth subscription's response after a new subscription mounts", async () => {
  /** Profile from the old mounted host remains pending. */
  const oldProfile = deferred<Record<string, unknown>>();
  mockLoadProfile.mockReturnValueOnce(oldProfile.promise).mockResolvedValue({coins: 350});
  /** The same adapter is reused after its first subscriber is retired. */
  const services = createFirebaseHostServices();
  /** Cleanup must retire both the SDK callback and its pending read. */
  const stop = services.auth.subscribe(jest.fn());
  changeAccount("Alice");stop();
  /** Newly mounted host must not receive the obsolete read. */
  const listener = jest.fn<(snapshot: AuthSnapshot) => void>();
  services.auth.subscribe(listener);changeAccount("Alice");await flush();
  oldProfile.resolve({coins: 10});await flush();
  expect(listener.mock.calls.at(-1)?.[0].profile?.coins).toBe(350);
});

it.each(["completion", "spend"])("returns a committed %s receipt while profile transport remains pending", async kind => {
  /** Optional follow-up is slower than the accepted gameplay mutation. */
  const held = deferred<Record<string, unknown>>();
  mockLoadProfile.mockReturnValue(held.promise);
  /** Adapter starts from an already authenticated current account. */
  const services = createFirebaseHostServices();
  /** Receipt settlement is observed independently of the held profile read. */
  const resolved = jest.fn();
  /** Player action whose server result is immediately available. */
  const action = kind === "completion"
    ? services.completeGame({riddleId: "riddle-1", gameMode: "classic", sessionToken: "owned-session"})
    : services.spendCoins({reason: "continue", requestId: "owned-request", amount: 25, riddleId: "riddle-1", gameMode: "classic", sessionToken: "owned-session"});
  void action.then(resolved);
  await flush();
  expect(resolved).toHaveBeenCalledWith(kind === "completion" ? receipt : {newCoins: 275});
  held.resolve({coins: 275});await action;
});

it.each(["completion", "spend"])("preserves successful %s despite a failed optional profile read", async kind => {
  mockLoadProfile.mockRejectedValue(new Error("Profile transport unavailable"));
  /** Server mutation succeeds even though its subsequent profile read fails. */
  const services = createFirebaseHostServices();
  /** Authoritative response must retain success through the optional failure. */
  const action = kind === "completion"
    ? services.completeGame({riddleId: "riddle-1", gameMode: "classic", sessionToken: "owned-session"})
    : services.spendCoins({reason: "continue", requestId: "owned-request", amount: 25, riddleId: "riddle-1", gameMode: "classic", sessionToken: "owned-session"});
  await expect(action).resolves.toEqual(kind === "completion" ? receipt : {newCoins: 275});
  await flush();
});

it("does not rewind a newer profile when concurrent refreshes finish out of order", async () => {
  /** Earlier completion's profile is older than the later spending state. */
  const earlier = deferred<Record<string, unknown>>();
  /** Later spend's profile resolves before the older completion profile. */
  const later = deferred<Record<string, unknown>>();
  mockLoadProfile.mockReturnValueOnce(earlier.promise).mockReturnValueOnce(later.promise);
  /** Profile publication is observed through the real adapter's identity boundary. */
  const services = createFirebaseHostServices();
  /** Captures profile notifications without mounting an SDK auth event. */
  const listener = jest.fn<(snapshot: AuthSnapshot) => void>();
  services.auth.subscribe(listener);
  /** Mutations start in order, but their optional follow-up reads finish in reverse order. */
  const completion = services.completeGame({riddleId: "riddle-1", gameMode: "classic", sessionToken: "owned-session"});
  await flush();
  /** Second receipt changes the canonical balance. */
  const spend = services.spendCoins({reason: "continue", requestId: "owned-request", amount: 25, riddleId: "riddle-1", gameMode: "classic", sessionToken: "owned-session"});
  await flush();later.resolve({coins: 275});await flush();earlier.resolve({coins: 350});
  await Promise.all([completion, spend]);await flush();
  expect(listener.mock.calls.at(-1)?.[0].profile?.coins).toBe(275);
});

it("shares one native observer until the last host subscriber leaves", () => {
  /** Multiple state consumers use one adapter-owned SDK subscription. */
  const services = createFirebaseHostServices();
  /** First host lifetime. */
  const stopFirst = services.auth.subscribe(jest.fn());
  /** Second consumer retains the observer after the first retires. */
  const stopSecond = services.auth.subscribe(jest.fn());
  expect(mockObservers).toHaveLength(1);
  stopFirst();expect(mockUnsubscribe).not.toHaveBeenCalled();
  stopSecond();expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});

it("rejects old profile responses when the same UID signs out and re-enters", async () => {
  /** Earlier visit's response must not qualify only because its UID is reused. */
  const previousVisit = deferred<Record<string, unknown>>();
  mockLoadProfile.mockReturnValueOnce(previousVisit.promise).mockResolvedValue({coins: 500});
  /** Subscription remains mounted through sign-out and re-entry. */
  const services = createFirebaseHostServices();
  /** Captures the second visit's accepted profile. */
  const listener = jest.fn<(snapshot: AuthSnapshot) => void>();
  services.auth.subscribe(listener);changeAccount("Alice");changeAccount(null);changeAccount("Alice");
  await flush();previousVisit.resolve({coins: 10});await flush();
  expect(listener.mock.calls.at(-1)?.[0].profile?.coins).toBe(500);
});

it("ignores obsolete native auth callbacks after observer replacement", async () => {
  /** First callback belongs to a retired host lifetime. */
  const services = createFirebaseHostServices();
  /** Subscription cleanup retires its native callback as well as profile reads. */
  const stop = services.auth.subscribe(jest.fn());
  /** Imperfect transport deliberately replays the removed callback. */
  const retiredObserver = mockObservers[0];
  stop();mockAuth.currentUser = sdkUser("Bob");
  /** Current host owns Bob independently of the obsolete observer. */
  const listener = jest.fn<(snapshot: AuthSnapshot) => void>();
  services.auth.subscribe(listener);changeAccount("Bob");await flush();
  retiredObserver(sdkUser("Alice"));await flush();
  expect(listener.mock.calls.at(-1)?.[0].user?.uid).toBe("Bob");
  expect(mockLoadProfile).toHaveBeenCalledTimes(1);
});

it("does not refresh a replacement account after a previous player's delayed mutation", async () => {
  /** Mutation receipt remains delayed through an account replacement. */
  const held = deferred<{
    /** Canonical mutation result. */
    data: CompletionResult;
  }>();
  mockComplete.mockReturnValue(held.promise);
  /** Real adapter admits this completion while Alice owns the account. */
  const services = createFirebaseHostServices();
  services.auth.subscribe(jest.fn());
  /** Old server operation completes only after Bob's profile has been loaded. */
  const completion = services.completeGame({riddleId: "riddle-1", gameMode: "classic", sessionToken: "owned-session"});
  changeAccount("Bob");await flush();held.resolve({data: receipt});await completion;await flush();
  expect(mockLoadProfile.mock.calls.map(([uid]) => uid)).toEqual(["Bob"]);
});

it("retires an explicit profile read when a newer mutation refresh has published", async () => {
  /** Earlier caller's snapshot is older than a concurrently accepted spend. */
  const older = deferred<Record<string, unknown>>();
  mockLoadProfile.mockReturnValueOnce(older.promise).mockResolvedValue({coins: 275});
  /** Explicit callers and mutation follow-up share the same real provider instance. */
  const services = createFirebaseHostServices();
  /** Canonical newer publication is already accepted by the host subscription. */
  const listener = jest.fn<(snapshot: AuthSnapshot) => void>();
  services.auth.subscribe(listener);
  /** Race coordination reads through this explicit identity method. */
  const raceProfile = services.loadProfile("Alice");
  await services.spendCoins({reason: "continue", requestId: "newer-spend", amount: 25,
    riddleId: "riddle-1", gameMode: "classic", sessionToken: "owned-session"});
  await flush();
  expect(listener.mock.calls.at(-1)?.[0].profile?.coins).toBe(275);
  older.resolve({coins: 300});
  expect(await raceProfile).toBeNull();
  expect(listener.mock.calls.at(-1)?.[0].profile?.coins).toBe(275);
});

it("publishes a current explicit profile read through the canonical subscription", async () => {
  mockLoadProfile.mockResolvedValue({coins: 450});
  /** Explicit readers share the same published snapshot as mutation follow-ups. */
  const services = createFirebaseHostServices();
  /** Subscription receives the exact accepted latest read. */
  const listener = jest.fn<(snapshot: AuthSnapshot) => void>();
  services.auth.subscribe(listener);
  expect(await services.loadProfile("Alice")).toMatchObject({coins: 450});
  expect(listener.mock.calls.at(-1)?.[0].profile?.coins).toBe(450);
});

it.each(["replacement", "same-uid-return", "dispose"])("retires an explicit profile read after %s", async transition => {
  /** Raw transport is still pending when its admitting identity visit retires. */
  const held = deferred<Record<string, unknown>>();
  mockLoadProfile.mockReturnValueOnce(held.promise).mockResolvedValue({coins: 800});
  /** Account visits are owned by the real Firebase adapter, including same-UID re-entry. */
  const services = createFirebaseHostServices();
  /** Native observer cleanup must retire explicit profile requests too. */
  const stop = services.auth.subscribe(jest.fn());
  /** Explicit optional read captured before account replacement or subscription disposal. */
  const pending = services.loadProfile("Alice");
  if (transition === "replacement") changeAccount("Bob");
  else if (transition === "same-uid-return") {changeAccount(null);changeAccount("Alice");}
  else stop();
  await flush();held.resolve({coins: 10});
  expect(await pending).toBeNull();
});

it("does not start a profile transport for a different account identifier", async () => {
  /** The currently selected SDK identity is Alice, not the requested Bob. */
  const services = createFirebaseHostServices();
  expect(await services.loadProfile("Bob")).toBeNull();
  expect(mockLoadProfile).not.toHaveBeenCalled();
});
