import {beforeEach, expect, it, jest} from "@jest/globals";
import type {CompletionResult} from "@qwordly/hosted/hostTypes";

/** Provider identity consumed by the real adapter. */
const mockAuth = {currentUser: {uid: "alice", metadata: {creationTime: "2026-01-01T00:00:00Z"}}};
/** Native observer drives account changes without bypassing the adapter. */
let mockObserver: (user: typeof mockAuth.currentUser) => void;
/** Authority and profile requests remain independently controlled. */
const mockComplete = jest.fn<(input: unknown) => Promise<{
  /** Canonical mutation response. */ data: CompletionResult;
}>>();
/** Authoritative profile transport. */
const mockProfile = jest.fn<() => Promise<Record<string, unknown>>>().mockResolvedValue({coins: 350});
jest.mock("../../firebase", () => ({auth: mockAuth, completeGame: mockComplete, loadUserDocument: mockProfile}));
jest.mock("firebase/auth", () => ({onAuthStateChanged: (_auth: unknown, observer: typeof mockObserver) => {
  mockObserver = observer; return jest.fn();
}, signOut: jest.fn()}));
import {createFirebaseHostServices} from "../firebaseServices";

/** The same issued question is retried while its completion response is pending. */
const input = {gameMode: "classic" as const, riddleId: "classic-18", sessionToken: "00000000-0000-4000-8000-000000000018"};
/** Server-confirmed completion independent of transport duration. */
const receipt: CompletionResult = {attempts: 6, isCorrect: true, coinsEarned: 25,
  newlyUnlockedAchievementIds: [], rewardBreakdown: {newBalance: 350, totalAwarded: 25}};
/** Settles one transport at a precise point in the regression. */
const deferred = <T>() => {
  /** Exposes the deferred response. */
  let resolve!: (value: T) => void;
  /** Pending transport. */
  const promise = new Promise<T>(done => {resolve = done;});
  return {promise, resolve};
};

beforeEach(() => {
  mockComplete.mockReset();mockProfile.mockClear();
  mockAuth.currentUser = {uid: "alice", metadata: {creationTime: "2026-01-01T00:00:00Z"}};
});

it("shares one pending completion across the renderer's overlapping retries", async () => {
  /** The backend stays pending longer than the renderer's retry delays. */
  const pending = deferred<{
    /** Canonical response delivered after overlapping retries. */ data: CompletionResult;
  }>();
  mockComplete.mockReturnValue(pending.promise);
  /** Exercise the production adapter, not an isolated cache helper. */
  const services = createFirebaseHostServices();
  /** First caller admits the authority request. */
  const first = services.completeGame(input);
  /** Overlapping retry shares that pending request. */
  const second = services.completeGame({...input});
  /** Further retry retains the same authority owner. */
  const third = services.completeGame({...input});
  expect(mockComplete).toHaveBeenCalledTimes(1);
  pending.resolve({data: receipt});
  expect(await Promise.all([first, second, third])).toEqual([receipt, receipt, receipt]);
  expect(mockProfile).toHaveBeenCalledTimes(1);
});

it("allows another authority attempt after the shared transport fails", async () => {
  mockComplete.mockRejectedValueOnce(new Error("network unavailable")).mockResolvedValue({data: receipt});
  /** Actual adapter permits a fresh authority attempt after rejection. */
  const services = createFirebaseHostServices();
  await expect(services.completeGame(input)).rejects.toThrow("network unavailable");
  await expect(services.completeGame(input)).resolves.toEqual(receipt);
  expect(mockComplete).toHaveBeenCalledTimes(2);
});

it("does not share an issued-question response between different accounts", async () => {
  /** Hold both account-specific authority requests across the observer change. */
  const pending = deferred<{
    /** Each caller receives its own account-scoped transport response. */ data: CompletionResult;
  }>();
  mockComplete.mockReturnValue(pending.promise);
  /** Real adapter captures account ownership at admission. */
  const services = createFirebaseHostServices();
  services.auth.subscribe(jest.fn());
  /** Original owner starts its completion before account replacement. */
  const alice = services.completeGame(input);
  mockAuth.currentUser = {...mockAuth.currentUser, uid: "bob"};mockObserver(mockAuth.currentUser);
  await Promise.resolve();await Promise.resolve();
  /** Replacement owner cannot reuse the original pending response. */
  const bob = services.completeGame(input);
  expect(mockComplete).toHaveBeenCalledTimes(2);
  pending.resolve({data: receipt});await Promise.all([alice, bob]);
});
