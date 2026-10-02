const mockGrant = jest.fn();
const mockEnabled = jest.fn(() => true);
const mockOnCall = jest.fn((_name: string, _options: unknown, handler: unknown) => handler);
jest.mock("../shared/sentryHandlers", () => ({onCallWithSentry: (...args: unknown[]) => mockOnCall(...args)}));
jest.mock("../gameplay/singlePlayerSession", () => ({grantAuthoritativeContinue: (...args: unknown[]) => mockGrant(...args)}));
jest.mock("../facebook/facebookFeatureFlags", () => ({isFacebookFeatureEnabled: (...args: unknown[]) => mockEnabled(...args)}));
import {grantFacebookRewardedContinue} from "../facebook/facebookRewardedContinueCallable";
import type {CallableRequest} from "firebase-functions/v2/https";

const uid = `facebook_${"c".repeat(40)}`;
const auth = {uid, token: {provider: "facebook"}};
const data = {gameMode: "classic", riddleId: "classic-1", sessionToken: "session-token-00000001", requestId: "continue-request-00001"};
const call = (body: unknown, requestAuth: unknown = auth) =>
  (grantFacebookRewardedContinue as unknown as (request: CallableRequest<unknown>) => Promise<unknown>)({data: body, auth: requestAuth} as CallableRequest<unknown>);
const boundaries = [...mockOnCall.mock.calls];
beforeEach(() => {mockGrant.mockReset().mockResolvedValue(0); mockEnabled.mockReturnValue(true);});

it("enforces the shared App Check boundary", () => {
  expect(boundaries).toEqual([["grantFacebookRewardedContinue", expect.objectContaining({enforceAppCheck: true}), expect.any(Function)]]);
});
it.each([null, {uid, token: {provider: "jest"}}, {uid: "facebook_bad", token: {provider: "facebook"}}])("rejects non-Facebook identity %p", async value => {
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
