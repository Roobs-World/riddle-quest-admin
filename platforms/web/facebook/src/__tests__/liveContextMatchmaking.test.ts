import {createFacebookContextMatchmaking} from "../liveContextMatchmaking";
import type {JoinLiveRace, RaceLocale} from "../../../../../src/races/contracts/index";
import type {MatchmakingCapability} from "../../../../../src/platform/contracts/capabilities";

/** Real target wrapper exercises immutable preparation independently of transport delivery. */
function fixture() {
  /** Current SDK context can change while a stable join is retried. */
  let contextId = "original-thread";
  /** Current content language must survive asynchronous synchronization. */
  let locale: RaceLocale = "en";
  /** Actual transport inputs establish what the server would receive. */
  const join = jest.fn(async (_input: JoinLiveRace) => ({}));
  /** Rematch uses the same owning join preparation, with its own source. */
  const rematch = jest.fn(async (_input: JoinLiveRace) => ({}));
  /** Only context synchronization is substituted; production capture logic is retained. */
  const ensureCurrent = jest.fn(async () => ({status: "success" as const, value: {contextId, contextType: "THREAD" as const}}));
  /** Minimal authoritative transport is sufficient to verify the wrapper boundary. */
  const base = {live: {join, rematch, update: jest.fn()}, find: jest.fn()} as unknown as MatchmakingCapability;
  return {wrapped: createFacebookContextMatchmaking(base, {ensureCurrent}, () => locale), base, join, rematch, ensureCurrent,
    changeContext: (value: string) => {contextId = value;}, changeLocale: (value: RaceLocale) => {locale = value;}};
}
/** Portable join inputs have no SDK metadata. */
const input: JoinLiveRace = {locale: "en", categoryId: "history", requestId: "context-request-001"};

it("captures once across concurrent requests and retries after the SDK selects a different context", async () => {
  /** Concurrent deliveries share one synchronization result, not a mutable SDK lookup per retry. */
  const f = fixture();
  await Promise.all([f.wrapped.live!.join(input), f.wrapped.live!.join(input)]);
  f.changeContext("later-group");
  await f.wrapped.live!.join(input);
  expect(f.ensureCurrent).toHaveBeenCalledTimes(1);
  for (const [sent] of f.join.mock.calls) expect(sent).toEqual({...input, facebookContextId: "original-thread"});
  await f.wrapped.live!.join({...input, requestId: "context-request-002"});
  expect(f.join.mock.calls.at(-1)![0].facebookContextId).toBe("later-group");
  expect(f.base.live!.join).toBe(f.join);
});

it("prepares rematches and explicit acceptance without accepting a caller-supplied SDK ID", async () => {
  /** Shared-game input cannot overwrite the synchronized native destination. */
  const f = fixture();
  await f.wrapped.live!.join({...input, challengeId: `live_${"a".repeat(64)}`, facebookContextId: "forged-thread"});
  await f.wrapped.live!.rematch!({...input, requestId: "context-rematch-001", rematchOfTicketId: "b".repeat(64)});
  expect(f.join.mock.calls[0][0].facebookContextId).toBe("original-thread");
  expect(f.rematch.mock.calls[0][0]).toMatchObject({rematchOfTicketId: "b".repeat(64), facebookContextId: "original-thread"});
});

it("rejects input or locale changes without starting another server seat", async () => {
  /** Original request semantics cannot be rewritten by a retry. */
  const f = fixture();
  await f.wrapped.live!.join(input);
  await expect(f.wrapped.live!.join({...input, categoryId: "science"})).rejects.toThrow("selection changed");
  f.changeLocale("fr");
  await expect(f.wrapped.live!.join({...input, requestId: "stale-locale-002"})).rejects.toThrow("locale changed");
  expect(f.join).toHaveBeenCalledTimes(1);
});

it("keeps unavailable solo contexts outside the payload and retries failed synchronization", async () => {
  /** Absence of a native group is supported; an actual backend sync failure remains retryable. */
  const join = jest.fn(async (_input: JoinLiveRace) => ({}));
  /** Context failure must not become a permanently cached failed promise. */
  const ensureCurrent = jest.fn().mockResolvedValueOnce({status: "retryable-failure"}).mockResolvedValue({status: "unavailable"});
  /** Existing non-context transport remains unchanged beneath the Facebook wrapper. */
  const base = {live: {join, update: jest.fn()}, find: jest.fn()} as unknown as MatchmakingCapability;
  /** Locale remains owned by the provider's game entry. */
  const live = createFacebookContextMatchmaking(base, {ensureCurrent}, () => "en").live!;
  await expect(live.join(input)).rejects.toThrow("synchronization unavailable");
  expect(join).not.toHaveBeenCalled();
  await live.join(input);
  expect(join).toHaveBeenCalledWith(input);
  expect(live.rematch).toBeUndefined();
});
