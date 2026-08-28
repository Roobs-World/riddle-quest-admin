/** Provides mock claim behavior. */
const mockClaim = jest.fn();
/** Provides mock accept behavior. */
const mockAccept = jest.fn();
/** Provides mock feature enabled behavior. */
const mockFeatureEnabled = jest.fn(() => true);
/** Provides mock on call behavior. */
const mockOnCall = jest.fn((_name: string, _options: unknown, handler: unknown) => handler);

jest.mock("../shared/sentryHandlers", () => ({onCallWithSentry: (...args: unknown[]) => mockOnCall(...args)}));
jest.mock("../facebook/facebookNotificationPrompts", () => ({
  claimFacebookNotificationPrompt: (...args: unknown[]) => mockClaim(...args),
  acceptFacebookNotificationPrompt: (...args: unknown[]) => mockAccept(...args),
}));
jest.mock("../facebook/facebookFeatureFlags", () => ({
  isFacebookFeatureEnabled: (...args: unknown[]) => mockFeatureEnabled(...args),
}));

import type {CallableRequest} from "firebase-functions/v2/https";
import {
  acceptFacebookNotificationPermissionPrompt,
  claimFacebookNotificationPermissionPrompt,
} from "../facebook/facebookNotificationPromptCallables";

/** Provides registered boundaries behavior. */
const registeredBoundaries = mockOnCall.mock.calls.map(([name, options]) => [name, options]);

/** Provides uid behavior. */
const uid = `facebook_${"c".repeat(40)}`;
/** Provides auth behavior. */
const auth = {uid, token: {provider: "facebook"}};
/** Provides call behavior. */
const call = (handler: unknown, data: unknown, requestAuth?: typeof auth) =>
  (handler as (request: CallableRequest<unknown>) => Promise<unknown>)({
    data,
    auth: requestAuth,
  } as CallableRequest<unknown>);

describe("Facebook notification prompt callables", () => {
  beforeEach(() => {
    mockClaim.mockReset();
    mockAccept.mockReset();
    mockFeatureEnabled.mockReset();
    mockFeatureEnabled.mockReturnValue(true);
    mockClaim.mockResolvedValue({granted: true, claimedAtMs: 123});
    mockAccept.mockResolvedValue(undefined);
  });

  it("uses the shared App Check browser boundary for both exported mutations", () => {
    expect(registeredBoundaries).toEqual([
      ["claimFacebookNotificationPermissionPrompt", expect.objectContaining({enforceAppCheck: true})],
      ["acceptFacebookNotificationPermissionPrompt", expect.objectContaining({enforceAppCheck: true})],
    ]);
  });

  it("requires exact Facebook claims and honors the notifications kill switch", async () => {
    await expect(call(claimFacebookNotificationPermissionPrompt, {}, undefined)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    await expect(
      call(claimFacebookNotificationPermissionPrompt, {}, {uid, token: {provider: "jest"}}),
    ).rejects.toMatchObject({code: "unauthenticated"});
    await expect(
      call(
        claimFacebookNotificationPermissionPrompt,
        {},
        {
          uid: "facebook_bad",
          token: {provider: "facebook"},
        },
      ),
    ).rejects.toMatchObject({code: "unauthenticated"});
    mockFeatureEnabled.mockReturnValue(false);
    await expect(call(claimFacebookNotificationPermissionPrompt, {}, auth)).rejects.toMatchObject({
      code: "unavailable",
    });
  });

  it("accepts only empty requests and projects exact bounded responses", async () => {
    await expect(call(claimFacebookNotificationPermissionPrompt, {}, auth)).resolves.toEqual({
      granted: true,
      claimedAtMs: 123,
    });
    expect(mockClaim).toHaveBeenCalledWith(uid);
    await expect(call(acceptFacebookNotificationPermissionPrompt, {}, auth)).resolves.toEqual({accepted: true});
    expect(mockAccept).toHaveBeenCalledWith(uid);
    await expect(call(claimFacebookNotificationPermissionPrompt, {uid}, auth)).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });
});
