import {
  applyJestCors,
  acceptJestRequest,
  isAllowedJestOrigin,
  resolveConflictingSubscriptionSkus,
  resolveSignedPurchase,
  resolveSignedSubscriptions,
  selectReferralConversions,
} from "../jest/jestEndpoints";
import type {Request} from "firebase-functions/v2/https";

const request = (input: {
  origin?: string;
  method?: string;
  json?: boolean;
  ip?: string;
}): Request => ({
  get: (name: string) => name.toLowerCase() === "origin" ? input.origin : undefined,
  method: input.method ?? "POST",
  is: (type: string) => input.json !== false && type === "application/json",
  ip: input.ip ?? "endpoint-test",
} as Request);

const response = () => {
  const result = {
    headers: new Map<string, string>(),
    statusCode: 200,
    body: undefined as unknown,
    set(name: string, value: string) {
      result.headers.set(name, value);
      return result;
    },
    status(code: number) {
      result.statusCode = code;
      return result;
    },
    json(body: unknown) {
      result.body = body;
      return result;
    },
    send(body: string) {
      result.body = body;
      return result;
    },
  };
  return result;
};

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

  it("rejects unconfigured browser origins", () => {
    const previousOrigin = process.env.JEST_GAME_ORIGIN;
    process.env.JEST_GAME_ORIGIN = "https://jest.com";
    expect(isAllowedJestOrigin("https://attacker.example")).toBe(false);
    expect(isAllowedJestOrigin(undefined)).toBe(false);
    if (previousOrigin === undefined) delete process.env.JEST_GAME_ORIGIN;
    else process.env.JEST_GAME_ORIGIN = previousOrigin;
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

describe("Jest endpoint HTTP boundary", () => {
  const previousOrigin = process.env.JEST_GAME_ORIGIN;

  beforeAll(() => {
    process.env.JEST_GAME_ORIGIN = "https://jest.com";
  });

  afterAll(() => {
    if (previousOrigin === undefined) delete process.env.JEST_GAME_ORIGIN;
    else process.env.JEST_GAME_ORIGIN = previousOrigin;
  });

  it.each([
    ["missing origin", request({}), 403, {error: "forbidden-origin"}],
    ["untrusted origin", request({origin: "https://attacker.example"}), 403, {error: "forbidden-origin"}],
    ["wrong method", request({origin: "https://jest.com", method: "GET"}), 405, {error: "method-not-allowed"}],
    ["wrong media type", request({origin: "https://jest.com", json: false}), 415, {error: "unsupported-media-type"}],
  ])("rejects %s", (_name, candidate, status, body) => {
    const output = response();
    expect(acceptJestRequest(candidate, output)).toBe(false);
    expect(output).toMatchObject({statusCode: status, body});
  });

  it("handles a trusted preflight without entering endpoint logic", () => {
    const output = response();
    expect(acceptJestRequest(request({origin: "https://jest.com", method: "OPTIONS"}), output)).toBe(false);
    expect(output).toMatchObject({statusCode: 204, body: ""});
  });

  it("accepts trusted JSON POST requests", () => {
    expect(acceptJestRequest(
      request({origin: "https://jest.com", ip: "valid-post"}),
      response(),
    )).toBe(true);
  });

  it("rate-limits repeated requests from one address", () => {
    const candidate = request({origin: "https://jest.com", ip: "rate-limit-test"});
    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect(acceptJestRequest(candidate, response())).toBe(true);
    }
    const output = response();
    expect(acceptJestRequest(candidate, output)).toBe(false);
    expect(output).toMatchObject({statusCode: 429, body: {error: "rate-limited"}});
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

describe("signed Jest referral conversion selection", () => {
  const joinedAt = "2026-07-28T12:00:00.000Z";

  it("accepts rewarded campaigns, excludes self-referrals, and deduplicates recipients", () => {
    expect(selectReferralConversions({
      referrals: {
        riddle_quest_friend_challenge_v2: [
          {playerId: "friend", joinedAt},
          {playerId: "friend", joinedAt: "2026-07-28T13:00:00.000Z"},
          {playerId: "inviter", joinedAt},
          {playerId: "invalid-date", joinedAt: "not-a-date"},
        ],
        riddle_quest_race_to_10_v1: [
          {playerId: "racer", joinedAt},
          {playerId: "friend", joinedAt},
        ],
        unrelated_reference: [{playerId: "other", joinedAt}],
      },
    }, "inviter")).toEqual([
      {
        playerId: "friend",
        joinedAt,
        reference: "riddle_quest_race_to_10_v1",
      },
      {
        playerId: "racer",
        joinedAt,
        reference: "riddle_quest_race_to_10_v1",
      },
    ]);
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
