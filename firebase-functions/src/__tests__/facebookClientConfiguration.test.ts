/** Provides mock get behavior. */
const mockGet = jest.fn();
/** Provides mock set feature gate behavior. */
const mockSetFeatureGate = jest.fn(async () => undefined);

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: () => ({doc: () => ({get: mockGet})}),
  }),
}));
jest.mock("firebase-admin/database", () => ({
  getDatabase: () => ({ref: () => ({set: mockSetFeatureGate})}),
}));
jest.mock("../shared/sentryHandlers", () => ({
  onCallWithSentry: jest.fn((_name: string, _options: unknown, handler: unknown) => handler),
}));

import type {CallableRequest} from "firebase-functions/v2/https";
import {
  getFacebookClientConfiguration,
  resolveFacebookClientConfiguration,
} from "../facebook/facebookClientConfigurationCallable";

/** Provides uid behavior. */
const uid = `facebook_${"a".repeat(40)}`;
/** Provides call behavior. */
const call = (
  data: unknown,
  auth?: {
    /** Stores uid. */
    uid: string; /** Stores token. */
    /** Stores token. */
    token: Record<string, unknown>;
  },
) =>
  (getFacebookClientConfiguration as unknown as (request: CallableRequest<unknown>) => Promise<unknown>)({
    data,
    auth,
  } as CallableRequest<unknown>);

describe("Facebook client configuration", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([null, undefined, [], {unexpected: true}])(
    "rejects malformed configuration requests before accessing account state: %p",
    async (data) => {
      await expect(call(data, {uid, token: {provider: "facebook"}})).rejects.toMatchObject({
        code: "invalid-argument",
      });
      expect(mockSetFeatureGate).not.toHaveBeenCalled();
      expect(mockGet).not.toHaveBeenCalled();
    },
  );

  it("exposes only enabled booleans and the durable ad-free entitlement", () => {
    expect(
      resolveFacebookClientConfiguration({
        coinDebt: 9_999,
        removeInterstitialAds: true,
        internalReceipt: "must-not-leak",
      }),
    ).toEqual({
      interstitialsEnabled: true,
      notificationsEnabled: true,
      commerceEnabled: true,
      rewardedAdsEnabled: true,
      referralsEnabled: true,
      matchmakingEnabled: true,
      tournamentsEnabled: true,
      presenceEnabled: true,
      removeInterstitialAds: true,
    });
  });

  it("applies independent emergency switches and fails on unknown switch names", () => {
    expect(resolveFacebookClientConfiguration(undefined, "commerce,interstitials")).toEqual({
      interstitialsEnabled: false,
      notificationsEnabled: true,
      commerceEnabled: false,
      rewardedAdsEnabled: true,
      referralsEnabled: true,
      matchmakingEnabled: true,
      tournamentsEnabled: true,
      presenceEnabled: true,
      removeInterstitialAds: false,
    });
    expect(() => resolveFacebookClientConfiguration(undefined, "mystery")).toThrow("unknown-facebook-feature:mystery");
  });

  it.each([null, "true", 1, {}, []])(
    "fails closed instead of showing ads for a malformed durable entitlement: %p",
    (removeInterstitialAds) => {
      expect(() => resolveFacebookClientConfiguration({removeInterstitialAds})).toThrow(
        "invalid-facebook-commerce-entitlement",
      );
    },
  );

  it.each([
    ["commerce", "commerceEnabled"],
    ["rewarded_ads", "rewardedAdsEnabled"],
    ["interstitials", "interstitialsEnabled"],
    ["referrals", "referralsEnabled"],
    ["notifications", "notificationsEnabled"],
    ["matchmaking", "matchmakingEnabled"],
    ["tournaments", "tournamentsEnabled"],
    ["presence", "presenceEnabled"],
  ] as const)("projects %s independently through %s", (feature, field) => {
    /** Provides configuration behavior. */
    const configuration = resolveFacebookClientConfiguration(undefined, feature);
    expect(configuration[field]).toBe(false);
    expect(Object.entries(configuration).filter(([key, value]) => key.endsWith("Enabled") && value === false)).toEqual([
      [field, false],
    ]);
  });

  it("requires exact Facebook authentication and returns no hidden commerce fields", async () => {
    await expect(call({}, undefined)).rejects.toMatchObject({code: "unauthenticated"});
    await expect(call({}, {uid, token: {provider: "jest"}})).rejects.toMatchObject({code: "unauthenticated"});
    await expect(call({}, {uid: "facebook_bad", token: {provider: "facebook"}})).rejects.toMatchObject({
      code: "unauthenticated",
    });
    mockGet.mockResolvedValueOnce({
      data: () => ({
        coinDebt: 5_000,
        receipt: "secret",
        removeInterstitialAds: true,
      }),
    });
    await expect(call({}, {uid, token: {provider: "facebook"}})).resolves.toEqual({
      interstitialsEnabled: true,
      notificationsEnabled: true,
      commerceEnabled: true,
      rewardedAdsEnabled: true,
      referralsEnabled: true,
      matchmakingEnabled: true,
      tournamentsEnabled: true,
      presenceEnabled: true,
      removeInterstitialAds: true,
    });
    expect(mockSetFeatureGate).toHaveBeenLastCalledWith(true);
    await expect(call({unexpected: true}, {uid, token: {provider: "facebook"}})).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("synchronizes the presence rules gate before reading optional commerce state", async () => {
    mockGet.mockRejectedValueOnce(new Error("firestore-unavailable"));
    await expect(call({}, {uid, token: {provider: "facebook"}})).rejects.toThrow("firestore-unavailable");
    expect(mockSetFeatureGate).toHaveBeenCalledWith(true);
    expect(mockSetFeatureGate.mock.invocationCallOrder[0]).toBeLessThan(mockGet.mock.invocationCallOrder[0]);
  });

  it("propagates the deployed disabled value to both configuration and RTDB rules", async () => {
    /** Provides previous behavior. */
    const previous = process.env.FACEBOOK_DISABLED_FEATURES;
    process.env.FACEBOOK_DISABLED_FEATURES = "presence";
    mockGet.mockResolvedValueOnce({data: () => ({removeInterstitialAds: false})});
    try {
      await expect(call({}, {uid, token: {provider: "facebook"}})).resolves.toMatchObject({
        presenceEnabled: false,
        matchmakingEnabled: true,
        removeInterstitialAds: false,
      });
      expect(mockSetFeatureGate).toHaveBeenCalledWith(false);
      expect(mockSetFeatureGate.mock.invocationCallOrder[0]).toBeLessThan(mockGet.mock.invocationCallOrder[0]);
    } finally {
      if (previous === undefined) delete process.env.FACEBOOK_DISABLED_FEATURES;
      else process.env.FACEBOOK_DISABLED_FEATURES = previous;
    }
  });
});
