import {createFirebaseRaceMatchmaking} from "../firebaseRaceMatchmaking";

it("exposes retained live history through the explicitly enabled Facebook live surface", () => {
  /** The owning target opts into live social features; the default adapter stays unchanged. */
  const options = {liveSafety: true, liveHistory: true};
  /** Target-owned capability surface under inspection. */
  const target = createFirebaseRaceMatchmaking(undefined, options);
  expect(typeof Reflect.get(target.live!, "history")).toBe("function");
  expect(Reflect.get(createFirebaseRaceMatchmaking().live!, "history")).toBeUndefined();
});
import {raceMatchFailure} from "@qwordly/core/race";

it.each(["permission-denied", "unauthenticated", "invalid-argument"])("retains terminal recovery for %s", async code => {
  /** Callable transport adapter under test. */
  const adapter = createFirebaseRaceMatchmaking(async () => {throw Object.assign(new Error("raw-provider-message"), {code: `functions/${code}`});});
  /** Public recovery result returned by the adapter. */
  const result = await adapter.find("en");
  expect(result).toMatchObject({status: "terminal-failure", failure: {recovery: "none"}});
  expect(JSON.stringify(result)).not.toContain("raw-provider-message");
});

it("preserves expired-intent guidance independently of the broad callable code", async () => {
  /** Callable transport adapter under test. */
  const adapter = createFirebaseRaceMatchmaking(async () => {throw Object.assign(new Error("opaque"), {
    code: "functions/failed-precondition", details: {matchmaking: raceMatchFailure("intent-expired")},
  });});
  await expect(adapter.find("en")).resolves.toMatchObject({status: "retryable-failure", failure: raceMatchFailure("intent-expired")});
});

it("passes only locale/category/request preferences through the authenticated adapter", async () => {
  /** Provides lookup behavior. */
  const lookup = jest.fn().mockResolvedValue({status: "empty", locale: "en"});
  /** Provides adapter behavior. */
  const adapter = createFirebaseRaceMatchmaking(lookup);
  /** Provides request behavior. */
  const request = {locale: "en" as const, categoryId: "history" as const, requestId: "stable-request"};
  await expect(adapter.find(request)).resolves.toEqual({status: "success", value: {status: "empty", locale: "en"}});
  expect(lookup).toHaveBeenCalledWith(request);
  await adapter.find("en");
  expect(lookup).toHaveBeenLastCalledWith({locale: "en"});
});

it("keeps backend failure distinct from an empty pool", async () => {
  /** Provides adapter behavior. */
  const adapter = createFirebaseRaceMatchmaking(async () => {throw new Error("unavailable");});
  await expect(adapter.find("en")).resolves.toMatchObject({status: "retryable-failure",
    message: "race-matchmaking-temporarily-unavailable",
    failure: {reason: "temporarily-unavailable", recovery: "same-intent", retryAfterMs: 1000}});
});

it("rejects malformed successful payloads at the shared contract seam", async () => {
  /** Provides adapter behavior. */
  const adapter = createFirebaseRaceMatchmaking(async () => ({status: "matched"}) as never);
  await expect(adapter.find("en")).resolves.toMatchObject({status: "retryable-failure",
    failure: {reason: "invalid-response", recovery: "same-intent", retryAfterMs: 1000}});
});

it("preserves default platform behavior while explicitly enabling live safety on the owning target", () => {
  /** Jest's existing adapter remains unchanged by default. */
  const ordinary = createFirebaseRaceMatchmaking();
  expect(ordinary.live?.blockOpponent).toBeUndefined();
  expect(ordinary.live?.reportOpponent).toBeUndefined();
  /** Facebook explicitly opts into the server-resolved live safety capability. */
  const enabled = createFirebaseRaceMatchmaking(undefined, {liveSafety: true});
  expect(typeof enabled.live?.blockOpponent).toBe("function");
  expect(typeof enabled.live?.reportOpponent).toBe("function");
});
