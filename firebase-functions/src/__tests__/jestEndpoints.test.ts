import {
  applyJestCors,
  resolveConflictingSubscriptionSkus,
  resolveSignedPurchase,
  resolveSignedSubscriptions,
  selectReferralConversions,
} from "../jest/jestEndpoints";

describe("Jest endpoint CORS", () => {
  it("allows JSON POST preflights only from the configured Jest origin", () => {
    const previousOrigin = process.env.JEST_GAME_ORIGIN;
    process.env.JEST_GAME_ORIGIN = "https://jest.com";
    const headers = new Map<string, string>();
    applyJestCors({set: (name, value) => headers.set(name, value)}, "https://jest.com");
    if (previousOrigin === undefined) delete process.env.JEST_GAME_ORIGIN;
    else process.env.JEST_GAME_ORIGIN = previousOrigin;

    expect(Object.fromEntries(headers)).toMatchObject({
      "Access-Control-Allow-Origin": "https://jest.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
  });

  it("allows the exact Jest build host derived from the configured game ID", () => {
    const previousGameId = process.env.JEST_GAME_ID;
    process.env.JEST_GAME_ID = "019faa68-f3ec-755d-9ab5-c887fb426801";
    const headers = new Map<string, string>();
    applyJestCors(
      {set: (name, value) => headers.set(name, value)},
      "https://019faa68-f3ec-755d-9ab5-c887fb426801.builds.jest.com",
    );
    if (previousGameId === undefined) delete process.env.JEST_GAME_ID;
    else process.env.JEST_GAME_ID = previousGameId;

    expect(headers.get("Access-Control-Allow-Origin")).toBe(
      "https://019faa68-f3ec-755d-9ab5-c887fb426801.builds.jest.com",
    );
  });
});

describe("signed Jest purchase selection", () => {
  const sku = "com.roobsworld.riddlequest.coinpack1";
  it("selects a requested token from a signed recovery array", () => expect(resolveSignedPurchase({purchases: [{purchaseToken: "one", productSku: sku}, {purchaseToken: "two", productSku: sku}]}, "two")).toEqual({purchaseToken: "two", productSku: sku, coins: 250}));
  it("rejects unsigned selectors and disallowed SKUs", () => {
    expect(() => resolveSignedPurchase({purchases: []}, "missing")).toThrow("purchase-not-signed");
    expect(() => resolveSignedPurchase({purchase: {purchaseToken: "one", productSku: sku}}, "one", new Set(["different"]))).toThrow("invalid-sku");
  });
});

describe("signed Jest subscription selection", () => {
  const sku = "com.roobsworld.riddlequest.premium.monthly";

  it("accepts configured active and inactive subscription entitlements", () => {
    expect(resolveSignedSubscriptions({
      subscriptions: [
        {sku, status: "active"},
        {sku, status: "inactive"},
      ],
    }, new Set([sku]))).toEqual([
      {sku, status: "active"},
      {sku, status: "inactive"},
    ]);
  });

  it("rejects malformed and unconfigured subscription entitlements", () => {
    expect(() => resolveSignedSubscriptions({
      subscriptions: [{sku, status: "unknown"}],
    }, new Set([sku]))).toThrow("invalid-subscription");
    expect(() => resolveSignedSubscriptions({
      subscription: {sku: "different", status: "active"},
    }, new Set([sku]))).toThrow("invalid-subscription");
  });

  it("blocks other billing cadences that grant the active entitlement", () => {
    const monthly = "premium-monthly";
    const yearly = "premium-yearly";
    const supporter = "supporter-monthly";
    expect(resolveConflictingSubscriptionSkus(
      [monthly],
      new Set([monthly, yearly, supporter]),
      {[monthly]: "premium", [yearly]: "premium", [supporter]: "supporter"},
    )).toEqual([yearly]);
  });
});

describe("signed Jest friend-challenge conversion selection", () => {
  const joinedAt = "2026-07-28T12:00:00.000Z";

  it("accepts only the stable campaign, excludes self-referrals, and deduplicates recipients", () => {
    expect(selectReferralConversions({
      referrals: {
        riddle_quest_friend_challenge_v2: [
          {playerId: "friend", joinedAt},
          {playerId: "friend", joinedAt: "2026-07-28T13:00:00.000Z"},
          {playerId: "inviter", joinedAt},
          {playerId: "invalid-date", joinedAt: "not-a-date"},
        ],
        unrelated_reference: [{playerId: "other", joinedAt}],
      },
    }, "inviter")).toEqual([{playerId: "friend", joinedAt: "2026-07-28T13:00:00.000Z"}]);
  });

  it("caps a signed batch at twenty distinct recipients", () => {
    const conversions = Array.from({length: 25}, (_, index) => ({
      playerId: `friend-${index}`,
      joinedAt,
    }));
    expect(selectReferralConversions({
      referrals: {riddle_quest_friend_challenge_v2: conversions},
    }, "inviter")).toHaveLength(20);
  });
});
