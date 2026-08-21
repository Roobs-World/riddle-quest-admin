const mockIssue = jest.fn();
const mockBind = jest.fn();
const mockFeatureEnabled = jest.fn(() => true);

jest.mock("../shared/sentryHandlers", () => ({
  onCallWithSentry: jest.fn((_name: string, _options: unknown, handler: unknown) => handler),
}));
jest.mock("../facebook/facebookReferrals", () => ({
  issueFacebookReferralToken: (...args: unknown[]) => mockIssue(...args),
  bindFacebookReferralToken: (...args: unknown[]) => mockBind(...args),
}));
jest.mock("../facebook/facebookFeatureFlags", () => ({
  isFacebookFeatureEnabled: (...args: unknown[]) => mockFeatureEnabled(...args),
}));

import type {CallableRequest} from "firebase-functions/v2/https";
import {bindFacebookReferral, createFacebookReferral} from "../facebook/facebookReferralCallables";

const uid = `facebook_${"a".repeat(40)}`;
const call = (handler: unknown, data: unknown, auth?: {uid: string; token: Record<string, unknown>}) =>
  (handler as (request: CallableRequest<unknown>) => Promise<unknown>)({data, auth} as CallableRequest<unknown>);

describe("Facebook referral callables", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureEnabled.mockReturnValue(true);
    mockIssue.mockResolvedValue({token: "T".repeat(43), expiresAtMs: 10});
    mockBind.mockResolvedValue({alreadyBound: false, expiresAtMs: 10});
  });

  it("requires exact Facebook provider claims and honors the referral kill switch", async () => {
    await expect(call(createFacebookReferral, {}, undefined)).rejects.toMatchObject({code: "unauthenticated"});
    await expect(call(createFacebookReferral, {}, {uid, token: {provider: "jest"}}))
      .rejects.toMatchObject({code: "unauthenticated"});
    await expect(call(createFacebookReferral, {}, {uid: "facebook_bad", token: {provider: "facebook"}}))
      .rejects.toMatchObject({code: "unauthenticated"});
    mockFeatureEnabled.mockReturnValue(false);
    await expect(call(createFacebookReferral, {}, {uid, token: {provider: "facebook"}}))
      .rejects.toMatchObject({code: "unavailable"});
  });

  it("issues only for an empty request and binds only one exact opaque token", async () => {
    const auth = {uid, token: {provider: "facebook"}};
    await expect(call(createFacebookReferral, {}, auth)).resolves.toEqual({token: "T".repeat(43), expiresAtMs: 10});
    expect(mockIssue).toHaveBeenCalledWith(uid);
    await expect(call(createFacebookReferral, {inviterUid: uid}, auth)).rejects.toMatchObject({
      code: "invalid-argument",
    });
    await expect(call(bindFacebookReferral, {token: "A".repeat(43)}, auth)).resolves.toEqual({
      alreadyBound: false, expiresAtMs: 10,
    });
    expect(mockBind).toHaveBeenCalledWith(uid, "A".repeat(43));
    await expect(call(bindFacebookReferral, {token: "short", inviterUid: uid}, auth)).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });
});
