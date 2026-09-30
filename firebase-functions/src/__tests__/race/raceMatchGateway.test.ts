import {HttpsError} from "firebase-functions/v2/https";
import {raceMatchFailure} from "@qwordly/core/race";

/** Authenticated gateway verification is controlled without contacting providers. */
const verify = jest.fn();
/** Matching is observed at the provider-neutral backend seam. */
const find = jest.fn();
/** Quota failures remain distinct from bounded search exhaustion. */
const quota = jest.fn();
/** Rollout authorization remains independent of transport and selection. */
const access = jest.fn();
jest.mock("../../shared/sentryHandlers", () => ({
  onRequestWithSentry: (_name: string, _options: unknown, handler: unknown) => handler,
  onCallWithSentry: (_name: string, _options: unknown, handler: unknown) => handler,
}));
jest.mock("../../shared/firebaseAdmin", () => ({admin: {firestore: () => ({collection: () => ({doc: () => ({get: async () => ({data: () => ({})})})})})}}));
jest.mock("firebase-functions/params", () => ({...jest.requireActual("firebase-functions/params"), defineSecret: () => ({value: () => "hermetic-gateway-secret"})}));
jest.mock("../../reddit/redditFeatureFlags", () => ({isRedditFeatureEnabled: () => true, isRedditCommerceEnabled: () => true}));
jest.mock("../../reddit/redditSecurity", () => ({verifyRedditGatewayAssertion: (...args: unknown[]) => verify(...args)}));
jest.mock("../../reddit/redditMatchmaking", () => ({findRedditRaceMatch: (...args: unknown[]) => find(...args)}));
jest.mock("../../race/raceRollout", () => ({...jest.requireActual("../../race/raceRollout"), assertRaceAccess: (...args: unknown[]) => access(...args)}));
jest.mock("../../reddit/redditEndpoints", () => ({REDDIT_APP_NAME: "riddle-quest", consumeRedditGatewayNonce: jest.fn(),
  consumeRedditRequestQuota: (...args: unknown[]) => quota(...args), parseRedditGatewayEnvelope: (body: unknown) => body,
  redditProviderIdentityId: () => "opaque-provider-identity", resolveRedditProviderIdentity: () => ({uid: "authenticated-owner", needsUidRepair: false})}));
import {redditGameplay} from "../../reddit/redditGameplayEndpoint";

/** Minimal HTTP response captures only the public gateway result. */
const response = () => {
  /** HTTP response observer used by the gateway. */
  const value = {set: jest.fn(), status: jest.fn(), json: jest.fn()};
  value.status.mockReturnValue(value);
  return value;
};
/** Signed-operation parsing is exercised while signature verification uses its test adapter. */
const request = () => ({method: "POST", body: {assertion: {operation: "gameplay.race.match"}, payload: {locale: "en", requestId: "stable-intent"}}, get: () => "test-signature"});
beforeEach(() => {jest.clearAllMocks(); access.mockResolvedValue(undefined); verify.mockResolvedValue({appName: "riddle-quest", userId: "t2_owner", operation: "gameplay.race.match"}); quota.mockResolvedValue(true);});

it("returns terminal guidance when authenticated rollout access is denied", async () => {
  access.mockRejectedValueOnce(new HttpsError("permission-denied", "private rollout diagnostics"));
  /** Captured public HTTP response. */
  const result = response();
  await (redditGameplay as unknown as (req: unknown, res: unknown) => Promise<void>)(request(), result);
  expect(result.status).toHaveBeenCalledWith(403);
  expect(result.json).toHaveBeenCalledWith({error: "race-matchmaking-failed", matchmaking: raceMatchFailure("access-denied")});
  expect(find).not.toHaveBeenCalled();
});

it.each([
  ["intent-expired", "failed-precondition", 409],
  ["search-budget-exceeded", "resource-exhausted", 429],
  ["access-denied", "permission-denied", 403],
  ["invalid-request", "invalid-argument", 400],
] as const)("preserves authenticated %s failure without exposing diagnostics", async (reason, code, status) => {
  /** Validated recovery instructions supplied by the backend. */
  const failure = raceMatchFailure(reason);
  find.mockRejectedValueOnce(new HttpsError(code, "private source diagnostics", {matchmaking: failure}));
  /** Captured public HTTP response. */
  const result = response();
  await (redditGameplay as unknown as (req: unknown, res: unknown) => Promise<void>)(request(), result);
  expect(result.status).toHaveBeenCalledWith(status);
  expect(result.json).toHaveBeenCalledWith({error: "race-matchmaking-failed", matchmaking: failure});
  expect(find).toHaveBeenCalledWith("authenticated-owner", {locale: "en", requestId: "stable-intent"});
  expect(JSON.stringify(result.json.mock.calls)).not.toContain("private source diagnostics");
});

it("keeps infrastructure failure retryable rather than returning an empty pool", async () => {
  find.mockRejectedValueOnce(new Error("storage unavailable"));
  /** Captured public HTTP response. */
  const result = response();
  await (redditGameplay as unknown as (req: unknown, res: unknown) => Promise<void>)(request(), result);
  expect(result.status).toHaveBeenCalledWith(503);
  expect(result.json).toHaveBeenCalledWith({error: "race-matchmaking-failed", matchmaking: raceMatchFailure("temporarily-unavailable", 1000)});
});

it("does not expose matchmaking details before signature verification succeeds", async () => {
  verify.mockRejectedValueOnce(new HttpsError("permission-denied", "invalid signature", {matchmaking: raceMatchFailure("access-denied")}));
  /** Captured public HTTP response. */
  const result = response();
  await (redditGameplay as unknown as (req: unknown, res: unknown) => Promise<void>)(request(), result);
  expect(result.status).toHaveBeenCalledWith(401);
  expect(result.json).toHaveBeenCalledWith({error: "invalid-request"});
  expect(find).not.toHaveBeenCalled();
});

it("retains the generic quota response before starting the match lookup", async () => {
  quota.mockResolvedValueOnce(false);
  /** Captured public HTTP response. */
  const result = response();
  await (redditGameplay as unknown as (req: unknown, res: unknown) => Promise<void>)(request(), result);
  expect(result.status).toHaveBeenCalledWith(429);
  expect(result.json).toHaveBeenCalledWith({error: "rate-limited"});
  expect(find).not.toHaveBeenCalled();
});
