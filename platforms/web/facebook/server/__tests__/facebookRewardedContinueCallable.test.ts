/** Controlled authority grant records identity, session and funding arguments. */
const mockGrant = jest.fn();
/** Controlled server feature flag verifies continuation fails closed when disabled. */
const mockEnabled = jest.fn(() => true);
/** Captures callable configuration so tests assert the App Check boundary. */
const mockOnCall = jest.fn((_name: string, _options: unknown, handler: unknown) => handler);
jest.mock("../../../../../firebase-functions/src/shared/sentryHandlers", () => ({onCallWithSentry: (...args: unknown[]) => mockOnCall(...args)}));
jest.mock("../../../../../firebase-functions/src/gameplay/sessions/singlePlayerSession", () => ({grantAuthoritativeContinue: (...args: unknown[]) => mockGrant(...args)}));
jest.mock("../facebookFeatureFlags", () => ({isFacebookFeatureEnabled: (...args: unknown[]) => mockEnabled(...args)}));
import {grantFacebookRewardedContinue} from "../facebookRewardedContinueCallable";
import type {CallableRequest} from "firebase-functions/v2/https";

/** Canonical Facebook account identity used by the callable contract test. */
const uid = `facebook_${"c".repeat(40)}`;
/** Authenticated Facebook provider claims accepted by the continuation endpoint. */
const auth = {uid, token: {provider: "facebook"}};
/** Canonical continuation payload contains only session identity and idempotency receipt. */
const data = {gameMode: "classic", riddleId: "classic-1", sessionToken: "session-token-00000001", requestId: "continue-request-00001"};
/** Invokes the captured callable with controlled payload and authentication claims. */
const call = (body: unknown, requestAuth: unknown = auth) =>
  (grantFacebookRewardedContinue as unknown as (request: CallableRequest<unknown>) => Promise<unknown>)({data: body, auth: requestAuth} as CallableRequest<unknown>);
/** Captured callable registration proves the enforced App Check configuration. */
const boundaries = [...mockOnCall.mock.calls];
beforeEach(() => {mockGrant.mockReset().mockResolvedValue(0); mockEnabled.mockReturnValue(true);});

it("enforces the shared App Check boundary", () => {
  expect(boundaries).toEqual([["grantFacebookRewardedContinue", expect.objectContaining({enforceAppCheck: true}), expect.any(Function)]]);
});
it.each([null, {uid, token: {provider: "reddit"}}, {uid: "facebook_bad", token: {provider: "facebook"}}])("rejects non-Facebook identity %p", async value => {
  await expect(call(data, value)).rejects.toMatchObject({code: "unauthenticated"});
  expect(mockGrant).not.toHaveBeenCalled();
});
it("honours the server kill switch", async () => {
  mockEnabled.mockReturnValue(false);
  await expect(call(data)).rejects.toMatchObject({code: "unavailable"});
  expect(mockGrant).not.toHaveBeenCalled();
});
it.each([{...data, amount: 0}, {...data, userId: "victim"}, {...data, sessionToken: "short"}, {...data, gameMode: "race"}])("rejects invalid or arbitrary grant payload %p", async value => {
  await expect(call(value)).rejects.toMatchObject({code: "invalid-argument"});
  expect(mockGrant).not.toHaveBeenCalled();
});
it("uses the authenticated user and server-only funding path", async () => {
  await expect(call(data)).resolves.toEqual({newCoins: 0});
  expect(mockGrant).toHaveBeenCalledWith(uid, "classic", "classic-1", data.requestId, data.sessionToken, "facebook-rewarded");
});
