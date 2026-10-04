import {afterEach, expect, it, jest} from "@jest/globals";
import {createRedditHostServices} from "../RedditHostServices";
import {REDDIT_GATEWAY_REQUEST_TIMEOUT_MS, withRedditGatewayDeadline} from "../redditGatewayDeadline";

/** Profile receipt can arrive after delivery has already expired. */
const profile = {username: "Solver", coins: 300, level: 1, xp: 0, winStreak: 0,
  gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 17};
/** Canonical gateway envelope retained through a controlled decoding stall. */
const reply = (result: unknown) => ({ok: true, json: async () => ({ok: true, result})}) as Response;

// Fake timers model delivery expiration without sleeping through a production deadline.
afterEach(() => {jest.useRealTimers();jest.restoreAllMocks();});

it.each(["profile", "completion", "spend", "deletion"])("expires stalled %s traffic without inventing an accepted result", async kind => {
  jest.useFakeTimers();
  global.fetch = jest.fn(() => new Promise<Response>(() => undefined)) as typeof fetch;
  /** Actual public adapter supplies each deadline-owning transport. */
  const services = createRedditHostServices();
  /** Expired mutations remain rejected, so their existing request IDs can recover server receipts. */
  const pending = kind === "profile" ? services.loadProfile("reddit-account")
    : kind === "completion" ? services.completeGame({riddleId: "classic-17", gameMode: "classic", sessionToken: "issued-session"})
    : kind === "spend" ? services.spendCoins({reason: "continue", amount: 25, requestId: "same-retry-request", riddleId: "classic-17", gameMode: "classic", sessionToken: "issued-session"})
    : services.deleteAccount("reddit-account");
  /** Immediately handled rejection observes exact expiry classification. */
  const rejected = expect(pending).rejects.toMatchObject({code: "deadline-exceeded", message: "reddit-gateway-request-timed-out"});
  await jest.advanceTimersByTimeAsync(REDDIT_GATEWAY_REQUEST_TIMEOUT_MS);
  await rejected;
  expect((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

it("bounds response body decoding and does not publish a late profile", async () => {
  jest.useFakeTimers();
  /** Late body decoding is intentionally independent of browser abort behavior. */
  let resolveBody!: (value: unknown) => void;
  /** Held response body consumes the same deadline as its headers. */
  const body = new Promise(done => {resolveBody = done;});
  global.fetch = jest.fn(async () => ({ok: true, json: () => body}) as Response) as typeof fetch;
  /** Real subscription would expose any stale post-expiry profile publication. */
  const services = createRedditHostServices(), listener = jest.fn();
  services.auth.subscribe(listener);
  await jest.advanceTimersByTimeAsync(REDDIT_GATEWAY_REQUEST_TIMEOUT_MS);
  resolveBody({ok: true, result: profile});await jest.advanceTimersByTimeAsync(0);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({profile: null}));
  (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(reply(profile));
  await expect(services.loadProfile("reddit-account")).resolves.toMatchObject({coins: 300});
  expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({profile: expect.objectContaining({coins: 300})}));
  expect(jest.getTimerCount()).toBe(0);
});

it("clears successful transport deadlines and consumes a later rejection after timeout", async () => {
  jest.useFakeTimers();
  await expect(withRedditGatewayDeadline(async () => "confirmed")).resolves.toBe("confirmed");
  expect(jest.getTimerCount()).toBe(0);
  /** Transport may reject later even after it ignores the browser's cancellation signal. */
  let rejectLate!: (error: Error) => void;
  /** Expiration and a subsequent transport failure are independently controlled. */
  const request = new Promise<never>((_resolve, reject) => {rejectLate = reject;});
  /** Exact rejected result proves no late failure can turn expiry into success. */
  const expired = expect(withRedditGatewayDeadline(() => request)).rejects.toMatchObject({code: "deadline-exceeded"});
  await jest.advanceTimersByTimeAsync(REDDIT_GATEWAY_REQUEST_TIMEOUT_MS);await expired;
  rejectLate(new Error("Late network failure"));await jest.advanceTimersByTimeAsync(0);
  expect(jest.getTimerCount()).toBe(0);
});
