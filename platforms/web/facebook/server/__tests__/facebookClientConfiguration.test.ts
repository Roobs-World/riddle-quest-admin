/** Provides mock get behavior. */
const mockGet = jest.fn();
/** Returns the server-owned provider identity rows used for checkout readiness. */
const mockProviderGet = jest.fn();
/** Captures the identity query without sharing its results with account state. */
const mockIdentityWhere = jest.fn(() => ({limit: () => ({get: mockProviderGet})}));
/** Provides mock set feature gate behavior. */
const mockSetFeatureGate = jest.fn(async () => undefined);

jest.mock("firebase-admin/firestore", () => ({
  Timestamp: jest.requireActual<typeof import("firebase-admin/firestore")>("firebase-admin/firestore").Timestamp,
  getFirestore: () => ({
    collection: (name: string) => name === "providerIdentities"
      ? {where: mockIdentityWhere}
      : {doc: () => ({get: mockGet})},
  }),
}));
jest.mock("firebase-admin/database", () => ({
  getDatabase: () => ({ref: () => ({set: mockSetFeatureGate})}),
}));
jest.mock("../../../../../firebase-functions/src/shared/sentryHandlers", () => ({
  onCallWithSentry: jest.fn((_name: string, _options: unknown, handler: unknown) => handler),
}));

import {Timestamp} from "firebase-admin/firestore";
import type {CallableRequest} from "firebase-functions/v2/https";
import {
  getFacebookClientConfiguration,
  resolveFacebookClientConfiguration,
} from "../facebookClientConfigurationCallable";

/** Provides uid behavior. */
const uid = `facebook_${"a".repeat(40)}`;
/** The test suite restores the caller's configured readiness flag. */
const originalWebhookEnabled = process.env.FACEBOOK_PAYMENTS_WEBHOOK_ENABLED;
/** The test suite restores the caller's emergency switches. */
const originalDisabledFeatures = process.env.FACEBOOK_DISABLED_FEATURES;
/** Produces raw Firestore identity data for valid and rejected readiness cases. */
const identity = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  provider: "facebook",
  uid,
  status: "active",
  accountGeneration: 1,
  createdAt: Timestamp.fromMillis(1_700_000_000_000),
  ...overrides,
});
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReset();
    mockProviderGet.mockReset();
    mockProviderGet.mockResolvedValue({size: 1, docs: [{data: () => identity()}]});
    process.env.FACEBOOK_PAYMENTS_WEBHOOK_ENABLED = "1";
    delete process.env.FACEBOOK_DISABLED_FEATURES;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalWebhookEnabled === undefined) delete process.env.FACEBOOK_PAYMENTS_WEBHOOK_ENABLED;
    else process.env.FACEBOOK_PAYMENTS_WEBHOOK_ENABLED = originalWebhookEnabled;
    if (originalDisabledFeatures === undefined) delete process.env.FACEBOOK_DISABLED_FEATURES;
    else process.env.FACEBOOK_DISABLED_FEATURES = originalDisabledFeatures;
  });

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

  it.each([undefined, "0", "", "true"])("keeps checkout disabled without explicit webhook readiness: %p", (readiness) => {
    if (readiness === undefined) delete process.env.FACEBOOK_PAYMENTS_WEBHOOK_ENABLED;
    else process.env.FACEBOOK_PAYMENTS_WEBHOOK_ENABLED = readiness;
    expect(resolveFacebookClientConfiguration({removeInterstitialAds: true})).toEqual({
      interstitialsEnabled: true,
      notificationsEnabled: true,
      commerceEnabled: false,
      rewardedAdsEnabled: true,
      referralsEnabled: true,
      matchmakingEnabled: true,
      tournamentsEnabled: true,
      presenceEnabled: true,
      removeInterstitialAds: true,
    });
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
    await expect(call({}, {uid, token: {provider: "facebook", accountGeneration: 1}})).resolves.toEqual({
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
    expect(mockIdentityWhere).toHaveBeenCalledWith("uid", "==", uid);
    expect(mockSetFeatureGate).toHaveBeenLastCalledWith(true);
    await expect(call({unexpected: true}, {uid, token: {provider: "facebook"}})).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("preserves a paid entitlement and skips identity readiness reads when checkout is disabled", async () => {
    process.env.FACEBOOK_PAYMENTS_WEBHOOK_ENABLED = "0";
    mockGet.mockResolvedValueOnce({data: () => ({removeInterstitialAds: true})});
    await expect(call({}, {uid, token: {provider: "facebook"}})).resolves.toMatchObject({
      commerceEnabled: false,
      removeInterstitialAds: true,
      rewardedAdsEnabled: true,
    });
    expect(mockProviderGet).not.toHaveBeenCalled();
  });

  it.each([
    {label: "missing", rows: []},
    {label: "ambiguous", rows: [identity(), identity()]},
    {label: "another provider", rows: [identity({provider: "jest"})]},
    {label: "deleted", rows: [identity({status: "deleted"})]},
    {label: "another generation", rows: [identity({accountGeneration: 2})]},
    {label: "missing creation time", rows: [identity({createdAt: undefined})]},
  ])("keeps checkout disabled for $label provider identity", async ({rows}) => {
    mockGet.mockResolvedValueOnce({data: () => ({removeInterstitialAds: false})});
    mockProviderGet.mockResolvedValueOnce({size: rows.length, docs: rows.map((row) => ({data: () => row}))});
    await expect(call({}, {uid, token: {provider: "facebook", accountGeneration: 1}})).resolves.toMatchObject({
      commerceEnabled: false,
      removeInterstitialAds: false,
    });
  });

  it.each([undefined, 0, -1, 1.5, "1"])("keeps checkout disabled for an invalid account generation: %p", async (accountGeneration) => {
    mockGet.mockResolvedValueOnce({data: () => ({removeInterstitialAds: false})});
    await expect(call({}, {uid, token: {provider: "facebook", accountGeneration}})).resolves.toMatchObject({
      commerceEnabled: false,
    });
  });

  it.each([
    {now: 1_700_000_000_125, enabled: false},
    {now: 1_700_000_000_999, enabled: false},
    {now: 1_700_000_001_000, enabled: true},
  ])("waits out the recreated account's ambiguous deletion second at $now", async ({now, enabled}) => {
    jest.spyOn(Date, "now").mockReturnValue(now);
    mockGet.mockResolvedValueOnce({data: () => ({removeInterstitialAds: false})});
    mockProviderGet.mockResolvedValueOnce({
      size: 1,
      docs: [{data: () => identity({accountGeneration: 2, lastDeletedAt: Timestamp.fromMillis(1_700_000_000_125)})}],
    });
    await expect(call({}, {uid, token: {provider: "facebook", accountGeneration: 2}})).resolves.toMatchObject({
      commerceEnabled: enabled,
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
