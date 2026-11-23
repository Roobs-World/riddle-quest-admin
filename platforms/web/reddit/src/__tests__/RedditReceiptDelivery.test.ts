import {beforeEach, expect, it, jest} from "@jest/globals";
jest.mock("../RedditHostServices", () => jest.requireActual(process.env.REDDIT_DELIVERY_BASELINE_SOURCE || "../RedditHostServices"));
import {createRedditHostServices} from "../RedditHostServices";

/** Canonical public profile used to expose stale delivery and read outages. */
const profile = {username: "Solver", coins: 300, level: 1, xp: 0, winStreak: 0,
  gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 17};
/** Server-confirmed game receipt must survive an optional projection outage. */
const receipt = {attempts: 1, isCorrect: true, coinsEarned: 50, scoreEarned: 100, xpEarned: 10, newXp: 10, newLevel: 1, leveledUp: false, newlyUnlockedAchievementIds: [],
  rewardBreakdown: {baseWinCoins: 50, levelUpBonus: 0, dailyStreakBonus: 0, achievementBonus: 0, newBalance: 350, totalAwarded: 50}};
/** Same-origin typed gateway envelope. */
const response = (result: unknown) => ({ok: true, json: async () => ({ok: true, result})}) as Response;
/** Controlled transport ordering avoids dependence on real network timing. */
const deferred = <T>() => {
  /** Completes the retained gateway response. */
  let resolve!: (value: T) => void;
  /** Pending gateway response owned by this test. */
  const promise = new Promise<T>(done => {resolve = done;});
  return {promise, resolve};
};
/** Completes promise continuations after the controlled authority response. */
const flush = () => new Promise<void>(done => setImmediate(done));
/** Exercises both authority paths that previously blocked on optional profile delivery. */
const call = (services: ReturnType<typeof createRedditHostServices>, kind: string) => kind === "completion"
  ? services.completeGame({riddleId: "classic-17", gameMode: "classic", sessionToken: "issued-session"})
  : services.spendCoins({reason: "continue", amount: 25, requestId: "spend-request", riddleId: "classic-17", gameMode: "classic", sessionToken: "issued-session"});
/** Server-issued question carries its Classic position in the enclosing buffer. */
const question = (index: number) => ({riddleId: `classic-${index}`, text: `Puzzle ${index}`, answerLength: 5,
  sessionToken: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, questionNumber: 1,
  attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false});
/** Canonical contiguous buffer response. */
const buffer = (index: number) => response({confirmedClassicIndex: index,
  riddles: [{classicIndex: index, expiresAtMs: Date.now() + 60000, question: question(index)}]});

beforeEach(() => jest.restoreAllMocks());

it.each(["completion", "spend"])("delivers confirmed %s before a held profile read", async kind => {
  /** Profile projection deliberately remains pending after authority commits. */
  const held = deferred<Response>();
  global.fetch = jest.fn(async input => String(input).endsWith("profile.load") ? held.promise
    : response(kind === "completion" ? receipt : {newCoins: 275})) as typeof fetch;
  /** Receipt delivery is observable without releasing the optional transport. */
  let delivered = false;
  /** Observes the existing account-owned delivery or subscription without changing its authority. */
  /** Test-owned transport or adapter is retained through controlled delivery. */
  const pending = call(createRedditHostServices(), kind).then(value => {delivered = true;return value;});
  await flush();
  try {expect(delivered).toBe(true);} finally {held.resolve(response(profile));await pending;}
});

it.each(["completion", "spend"])("preserves confirmed %s through a profile outage", async kind => {
  global.fetch = jest.fn(async input => {
    if (String(input).endsWith("profile.load")) throw new Error("Injected optional read outage");
    return response(kind === "completion" ? receipt : {newCoins: 275});
  }) as typeof fetch;
  await expect(call(createRedditHostServices(), kind)).resolves.toEqual(kind === "completion" ? receipt : {newCoins: 275});
  await flush();
});

it("rejects invalid authority receipts without starting a profile read", async () => {
  global.fetch = jest.fn(async () => response({coinsEarned: 50})) as typeof fetch;
  await expect(call(createRedditHostServices(), "completion")).rejects.toThrow();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it("does not publish an older profile after a newer requested profile completes", async () => {
  /** Out-of-order profile responses retain their exact request order. */
  const older = deferred<Response>(), newer = deferred<Response>();
  global.fetch = jest.fn< typeof fetch >().mockResolvedValueOnce(response(profile))
    .mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
  /** Real subscription observes each accepted projection. */
  /** Test-owned transport or adapter is retained through controlled delivery. */
  const services = createRedditHostServices(), listener = jest.fn();
  services.auth.subscribe(listener);await flush();
  /** Observes the existing account-owned delivery or subscription without changing its authority. */
  /** Test-owned transport or adapter is retained through controlled delivery. */
  const first = services.loadProfile("reddit-account"), second = services.loadProfile("reddit-account");
  newer.resolve(response({...profile, coins: 500}));await second;
  older.resolve(response({...profile, coins: 100}));
  expect(await first).toBeNull();
  expect(listener.mock.calls.at(-1)?.[0]).toMatchObject({profile: {coins: 500}});
});

it("does not restore a deleted account from a pending profile or later subscription", async () => {
  /** Initial subscription's read finishes after canonical deletion is confirmed. */
  const held = deferred<Response>();
  global.fetch = jest.fn(async input => String(input) === "/api/account/delete" ? response({}) : held.promise) as typeof fetch;
  /** Deleted account stays retired for this adapter lifetime. */
  /** Test-owned transport or adapter is retained through controlled delivery. */
  const services = createRedditHostServices(), listener = jest.fn();
  services.auth.subscribe(listener);
  await services.deleteAccount("reddit-account");
  held.resolve(response(profile));await flush();
  expect(listener.mock.calls.at(-1)?.[0]).toEqual({user: null, profile: null});
  /** Observes the existing account-owned delivery or subscription without changing its authority. */
  /** Test-owned transport or adapter is retained through controlled delivery. */
  const later = jest.fn();services.auth.subscribe(later);
  expect(later).toHaveBeenCalledWith({user: null, profile: null});
  await expect(services.loadProfile("reddit-account")).resolves.toBeNull();
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

it("does not start a profile refresh when a pending mutation returns after deletion", async () => {
  /** The server committed receipt is held while the account deletion completes. */
  const held = deferred<Response>();
  global.fetch = jest.fn(async input => String(input).endsWith("game.complete") ? held.promise : response(profile)) as typeof fetch;
  /** Observes the existing account-owned delivery or subscription without changing its authority. */
  /** Test-owned transport or adapter is retained through controlled delivery. */
  const services = createRedditHostServices();
  /** Observes the existing account-owned delivery or subscription without changing its authority. */
  /** Test-owned transport or adapter is retained through controlled delivery. */
  const pending = call(services, "completion");
  await services.deleteAccount("reddit-account");
  held.resolve(response(receipt));
  await expect(pending).resolves.toEqual(receipt);
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

it("issues a fresh authoritative buffer read alongside an older preload", async () => {
  /** Preload predates the terminal progression that requires reconciliation. */
  const older = deferred<Response>();
  global.fetch = jest.fn(async input => String(input).endsWith("riddle.daily") ? response({}) : buffer(18)) as typeof fetch;
  (global.fetch as jest.MockedFunction<typeof fetch>).mockReturnValueOnce(older.promise);
  /** Observes the existing account-owned delivery or subscription without changing its authority. */
  /** Test-owned transport or adapter is retained through controlled delivery. */
  const services = createRedditHostServices();services.preloadInitialRiddles?.("en");
  /** Observes the existing account-owned delivery or subscription without changing its authority. */
  /** Test-owned transport or adapter is retained through controlled delivery. */
  const pending = services.loadRiddle({gameMode: "classic", locale: "en", authoritative: true});
  expect((global.fetch as jest.Mock).mock.calls.filter(([path]) => String(path).endsWith("classic-buffer"))).toHaveLength(2);
  await expect(pending).resolves.toMatchObject({index: 18, riddleId: "classic-18"});
  older.resolve(buffer(17));await flush();
});

it("uses newer confirmed progress when an older authoritative response arrives last", async () => {
  /** Earlier current-progress response is delivered after its confirmed successor. */
  const older = deferred<Response>();
  global.fetch = jest.fn< typeof fetch >().mockReturnValueOnce(older.promise).mockResolvedValue(buffer(18));
  /** Observes the existing account-owned delivery or subscription without changing its authority. */
  /** Test-owned transport or adapter is retained through controlled delivery. */
  const services = createRedditHostServices();
  /** Observes the existing account-owned delivery or subscription without changing its authority. */
  /** Test-owned transport or adapter is retained through controlled delivery. */
  const pending = services.loadRiddle({gameMode: "classic", locale: "en", authoritative: true});
  await expect(services.loadRiddle({gameMode: "classic", locale: "en", authoritative: true})).resolves.toMatchObject({index: 18});
  older.resolve(buffer(17));await expect(pending).resolves.toMatchObject({index: 18});
});

it("retries unavailable cached Daily content instead of replaying its error", async () => {
  global.fetch = jest.fn(async input => String(input).endsWith("classic-buffer") ? buffer(17)
    : response({challenge: {totalQuestions: 1, questions: [question(1)]}})) as typeof fetch;
  (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(buffer(17))
    .mockResolvedValueOnce(response({error: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"}));
  /** Observes the existing account-owned delivery or subscription without changing its authority. */
  /** Test-owned transport or adapter is retained through controlled delivery. */
  const services = createRedditHostServices();services.preloadInitialRiddles?.("en");await flush();
  await expect(services.loadRiddle({gameMode: "challenge", locale: "en"})).resolves.toMatchObject({riddleId: "classic-1"});
  expect((global.fetch as jest.Mock).mock.calls.filter(([path]) => String(path).endsWith("riddle.daily"))).toHaveLength(2);
});

it("retains server-confirmed Daily completion and routes it with a typed outcome", async () => {
  global.fetch = jest.fn(async () => response({hasCompletedToday: true, error: "Daily complete"})) as typeof fetch;
  /** Terminal Daily authority remains reusable for this UTC day. */
  const services = createRedditHostServices();
  for (let attempt = 0; attempt < 2; attempt++)
    await expect(services.loadRiddle({gameMode: "challenge", locale: "en"})).rejects.toMatchObject({code: "daily-completed"});
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it("requests authoritative hint and accepted-guess recovery on every content seam", async () => {
  global.fetch = jest.fn(async input => String(input).endsWith("classic-buffer") ? buffer(17)
    : response({challenge: {totalQuestions: 1, questions: [question(1)]}})) as typeof fetch;
  /** Preload and explicit resume negotiate the same reload recovery contract. */
  const services = createRedditHostServices();
  services.preloadInitialRiddles?.("en");await flush();
  await services.loadRiddle({gameMode: "classic", locale: "en", sessionToken: question(17).sessionToken, riddleId: "classic-17"});
  for (const [, init] of (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls)
    expect(JSON.parse(String(init?.body))).toMatchObject({includeHintRecovery: true, includeGuessRecovery: true});
});

it.each(["challenge", "classic", "authoritative"])("retires held %s content after confirmed deletion", async mode => {
  /** Content authority completes after this account generation is retired. */
  const held = deferred<Response>();
  global.fetch = jest.fn(async input => String(input) === "/api/account/delete" ? response({}) : held.promise) as typeof fetch;
  /** Actual adapter retains the admitting lifetime through each asynchronous read. */
  const services = createRedditHostServices();
  /** Every cancellation is handled while the held content remains pending. */
  const pending = services.loadRiddle({gameMode: mode === "challenge" ? "challenge" : "classic", locale: "en",
    ...(mode === "authoritative" ? {authoritative: true} : mode === "classic" ? {sessionToken: question(17).sessionToken, riddleId: "classic-17"} : {})})
    .catch(error => error);
  await services.deleteAccount("reddit-account");
  held.resolve(mode === "authoritative" ? buffer(17) : response({challenge: {totalQuestions: 1, questions: [question(17)]}}));
  expect(await pending).toMatchObject({code: "cancelled"});
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
