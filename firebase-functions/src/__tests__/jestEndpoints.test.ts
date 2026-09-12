import {
  applyJestCors,
  acceptJestRequest,
  allowJestRequest,
  isAllowedJestOrigin,
  JEST_HTTP_INPUT_LIMITS,
  MAX_JEST_HTTP_BODY_BYTES,
  parseJestStringBody,
  resolveConflictingSubscriptionSkus,
  resolveSignedPurchase,
  resolveSignedSubscriptions,
  selectReferralConversions,
  selectUngrantedReferralConversions,
} from "../jest/jestEndpoints";
import type {Request} from "firebase-functions/v2/https";
import {
  createJestPurchaseGrantId,
  currentJestCoinBalance,
  isSafeLegacyJestPurchaseGrantId,
} from "../jest/jestPurchaseReceipts";
import {createJestReferralRewardId, createJestReferralVerificationId} from "../jest/jestReferralReceipts";
import {JEST_COIN_PRODUCTS} from "../jest/jestProductCatalog";
import {DEFAULT_PRODUCT_PRICING} from "@qwordly/core/pricing/catalog";

/** Provides request behavior. */
const request = (input: {
  /** Stores origin. */
  origin?: string;
  /** Stores method. */
  method?: string;
  /** Stores json. */
  json?: boolean;
  /** Stores ip. */
  ip?: string;
  /** Stores raw body bytes. */
  rawBodyBytes?: number;
}): Request =>
  ({
    get: (name: string) => (name.toLowerCase() === "origin" ? input.origin : undefined),
    method: input.method ?? "POST",
    is: (type: string) => input.json !== false && type === "application/json",
    ip: input.ip ?? "endpoint-test",
    rawBody: input.rawBodyBytes === undefined ? undefined : Buffer.alloc(input.rawBodyBytes),
  }) as Request;

/** Provides response behavior. */
const response = () => {
  /** Provides result behavior. */
  const result = {
    headers: new Map<string, string>(),
    statusCode: 200,
    body: undefined as unknown,
    /** Provides set behavior. */
    set(name: string, value: string) {
      result.headers.set(name, value);
      return result;
    },
    /** Provides status behavior. */
    status(code: number) {
      result.statusCode = code;
      return result;
    },
    /** Provides json behavior. */
    json(body: unknown) {
      result.body = body;
      return result;
    },
    /** Provides send behavior. */
    send(body: string) {
      result.body = body;
      return result;
    },
  };
  return result;
};

describe("Jest endpoint CORS", () => {
  it("allows JSON POST preflights only from the configured Jest origin", () => {
    /** Provides previous origin behavior. */
    const previousOrigin = process.env.JEST_GAME_ORIGIN;
    process.env.JEST_GAME_ORIGIN = "https://jest.com";
    /** Provides headers behavior. */
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
    /** Provides previous origin behavior. */
    const previousOrigin = process.env.JEST_GAME_ORIGIN;
    process.env.JEST_GAME_ORIGIN = "https://jest.com";
    expect(isAllowedJestOrigin("https://attacker.example")).toBe(false);
    expect(isAllowedJestOrigin(undefined)).toBe(false);
    if (previousOrigin === undefined) delete process.env.JEST_GAME_ORIGIN;
    else process.env.JEST_GAME_ORIGIN = previousOrigin;
  });

  it("allows the exact Jest build host derived from the configured game ID", () => {
    /** Provides previous game id behavior. */
    const previousGameId = process.env.JEST_GAME_ID;
    process.env.JEST_GAME_ID = "019faa68-f3ec-755d-9ab5-c887fb426801";
    /** Provides headers behavior. */
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
  /** Provides previous origin behavior. */
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
    [
      "oversized body",
      request({origin: "https://jest.com", rawBodyBytes: MAX_JEST_HTTP_BODY_BYTES + 1}),
      413,
      {error: "payload-too-large"},
    ],
  ])("rejects %s", (_name, candidate, status, body) => {
    /** Provides output behavior. */
    const output = response();
    expect(acceptJestRequest(candidate, output)).toBe(false);
    expect(output).toMatchObject({statusCode: status, body});
  });

  it("handles a trusted preflight without entering endpoint logic", () => {
    /** Provides output behavior. */
    const output = response();
    expect(acceptJestRequest(request({origin: "https://jest.com", method: "OPTIONS"}), output)).toBe(false);
    expect(output).toMatchObject({statusCode: 204, body: ""});
  });

  it("accepts trusted JSON POST requests", () => {
    expect(acceptJestRequest(request({origin: "https://jest.com", ip: "valid-post"}), response())).toBe(true);
  });

  it("rate-limits repeated requests from one address", () => {
    /** Provides candidate behavior. */
    const candidate = request({origin: "https://jest.com", ip: "rate-limit-test"});
    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect(acceptJestRequest(candidate, response())).toBe(true);
    }
    /** Provides output behavior. */
    const output = response();
    expect(acceptJestRequest(candidate, output)).toBe(false);
    expect(output).toMatchObject({statusCode: 429, body: {error: "rate-limited"}});
  });

  it("rejects unseen addresses once the bounded rate-limit map remains full", () => {
    expect(allowJestRequest("capacity-0")).toBe(true);
    /** Provides rejected behavior. */
    let rejected = false;
    for (let index = 1; index <= 10_000; index += 1) {
      if (!allowJestRequest(`capacity-${index}`)) {
        rejected = true;
        break;
      }
    }

    expect(rejected).toBe(true);
    expect(allowJestRequest("capacity-overflow")).toBe(false);
    expect(allowJestRequest("capacity-0")).toBe(true);
  });

  it("does not retain an unbounded address key", () => {
    expect(allowJestRequest("x".repeat(257))).toBe(false);
  });
});

describe("Jest HTTP input bounds", () => {
  it("accepts only the exact expected string fields within their UTF-8 byte limits", () => {
    expect(
      parseJestStringBody(
        {playerId: "player-1", purchaseToken: "token"},
        {playerId: JEST_HTTP_INPUT_LIMITS.playerId, purchaseToken: JEST_HTTP_INPUT_LIMITS.purchaseToken},
      ),
    ).toEqual({playerId: "player-1", purchaseToken: "token"});
  });

  it.each([
    [null],
    [[]],
    [{playerId: "player-1"}],
    [{playerId: "player-1", purchaseToken: "token", unexpected: true}],
    [{playerId: 123, purchaseToken: "token"}],
    [{playerId: "", purchaseToken: "token"}],
    [{playerId: "éé", purchaseToken: "token"}],
  ])("rejects malformed, unknown, empty, or oversized request body %p", (body) => {
    expect(() => parseJestStringBody(body, {playerId: 3, purchaseToken: 10})).toThrow("invalid-request");
  });
});

describe("signed Jest purchase selection", () => {
  /** Provides sku behavior. */
  const sku = "com.roobsworld.riddlequest.coinpack1";
  it("keeps every client coin pack aligned with the authoritative backend grant", () => {
    /** Maps every shop SKU to its client-visible coin amount. */
    const clientGrants = Object.fromEntries(
      DEFAULT_PRODUCT_PRICING.map((product) => [product.productId, product.coins]),
    );

    expect(clientGrants).toEqual(JEST_COIN_PRODUCTS);
    for (const [productSku, coins] of Object.entries(JEST_COIN_PRODUCTS)) {
      /** Uses a distinct opaque token for this product contract check. */
      const purchaseToken = `token-${productSku}`;
      expect(
        resolveSignedPurchase(
          {purchase: {purchaseToken, productSku}},
          purchaseToken,
          new Set(Object.keys(JEST_COIN_PRODUCTS)),
        ),
      ).toEqual({purchaseToken, productSku, coins});
    }
  });
  it("selects a requested token from a signed recovery array", () =>
    expect(
      resolveSignedPurchase(
        {
          purchases: [
            {purchaseToken: "one", productSku: sku},
            {purchaseToken: "two", productSku: sku},
          ],
        },
        "two",
        new Set([sku]),
      ),
    ).toEqual({purchaseToken: "two", productSku: sku, coins: 250}));
  it("rejects unsigned selectors and disallowed SKUs", () => {
    expect(() => resolveSignedPurchase({purchases: []}, "missing")).toThrow("purchase-not-signed");
    expect(() =>
      resolveSignedPurchase({purchase: {purchaseToken: "one", productSku: sku}}, "one", new Set(["different"])),
    ).toThrow("invalid-sku");
  });
  it("fails closed when no product SKU configuration is present", () => {
    expect(() => resolveSignedPurchase({purchase: {purchaseToken: "one", productSku: sku}}, "one", new Set())).toThrow(
      "invalid-sku",
    );
  });
});

describe("Jest purchase receipt storage", () => {
  it("uses a bounded opaque key even when the signed token is not a safe Firestore path", () => {
    /** Provides token behavior. */
    const token = `purchase/with/path/${"x".repeat(2_000)}`;
    /** Provides receipt id behavior. */
    const receiptId = createJestPurchaseGrantId(token);

    expect(receiptId).toMatch(/^[0-9a-f]{64}$/);
    expect(receiptId).toBe(createJestPurchaseGrantId(token));
    expect(receiptId).not.toContain(token);
  });

  it.each(["", ".", "..", "token/segment", "x".repeat(1_501)])(
    "never sends unsafe legacy token %p to Firestore doc lookup",
    (token) => expect(isSafeLegacyJestPurchaseGrantId(token)).toBe(false),
  );

  it("permits one-document legacy receipt IDs within Firestore's byte limit", () => {
    expect(isSafeLegacyJestPurchaseGrantId("legacy-token_123")).toBe(true);
    expect(isSafeLegacyJestPurchaseGrantId("é".repeat(751))).toBe(false);
  });

  it("returns the user's current balance for replay instead of a historical receipt balance", () => {
    expect(currentJestCoinBalance({coins: 73, newCoins: 550})).toBe(73);
    expect(currentJestCoinBalance({coins: Number.NaN})).toBe(0);
    expect(currentJestCoinBalance(undefined)).toBe(0);
  });
});

describe("signed Jest subscription selection", () => {
  /** Provides sku behavior. */
  const sku = "com.roobsworld.riddlequest.premium.monthly";

  it("accepts configured active and inactive subscription entitlements", () => {
    expect(
      resolveSignedSubscriptions(
        {
          subscriptions: [
            {sku, status: "active"},
            {sku, status: "inactive"},
          ],
        },
        new Set([sku]),
      ),
    ).toEqual([
      {sku, status: "active"},
      {sku, status: "inactive"},
    ]);
  });

  it("rejects malformed and unconfigured subscription entitlements", () => {
    expect(() =>
      resolveSignedSubscriptions(
        {
          subscriptions: [{sku, status: "unknown"}],
        },
        new Set([sku]),
      ),
    ).toThrow("invalid-subscription");
    expect(() =>
      resolveSignedSubscriptions(
        {
          subscription: {sku: "different", status: "active"},
        },
        new Set([sku]),
      ),
    ).toThrow("invalid-subscription");
  });

  it("blocks other billing cadences that grant the active entitlement", () => {
    /** Provides monthly behavior. */
    const monthly = "premium-monthly";
    /** Provides yearly behavior. */
    const yearly = "premium-yearly";
    /** Provides supporter behavior. */
    const supporter = "supporter-monthly";
    expect(
      resolveConflictingSubscriptionSkus([monthly], new Set([monthly, yearly, supporter]), {
        [monthly]: "premium",
        [yearly]: "premium",
        [supporter]: "supporter",
      }),
    ).toEqual([yearly]);
  });
});

describe("signed Jest referral conversion selection", () => {
  /** Provides joined at behavior. */
  const joinedAt = "2026-07-28T12:00:00.000Z";

  it("uses one opaque latest-verification key per player instead of one key per signed snapshot", () => {
    /** Provides verification id behavior. */
    const verificationId = createJestReferralVerificationId("player-1");
    expect(verificationId).toMatch(/^[0-9a-f]{64}$/);
    expect(createJestReferralVerificationId("player-1")).toBe(verificationId);
    expect(createJestReferralVerificationId("player-2")).not.toBe(verificationId);
  });

  it("preserves the legacy campaign-independent reward receipt key", () => {
    expect(createJestReferralRewardId("inviter", "friend")).toBe(
      "cd83785a457bda7bd4121686bcc7638f721b67632c687d49e7e09501de5cca7b",
    );
    expect(createJestReferralRewardId("inviter", "other-friend")).not.toBe(
      createJestReferralRewardId("inviter", "friend"),
    );
  });

  it("accepts rewarded campaigns, excludes self-referrals, and deduplicates recipients", () => {
    expect(
      selectReferralConversions(
        {
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
        },
        "inviter",
      ),
    ).toEqual([
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

  it("accepts strict personalized share references and ignores malformed lookalikes", () => {
    expect(
      selectReferralConversions(
        {
          referrals: {
            riddle_quest_friend_challenge_v2_result_0123456789abcdef: [{playerId: "result-friend", joinedAt}],
            riddle_quest_race_to_10_v1_share_fedcba9876543210: [{playerId: "race-friend", joinedAt}],
            riddle_quest_race_to_10_v1_share_not_hex: [{playerId: "invalid-friend", joinedAt}],
            riddle_quest_friend_challenge_v2: [{playerId: "x".repeat(513), joinedAt}],
          },
        },
        "inviter",
      ),
    ).toEqual([
      expect.objectContaining({playerId: "result-friend"}),
      expect.objectContaining({playerId: "race-friend"}),
    ]);
  });

  it("retains every signed distinct recipient so existing receipts can be skipped", () => {
    /** Provides conversions behavior. */
    const conversions = Array.from({length: 25}, (_, index) => ({
      playerId: `friend-${index}`,
      joinedAt,
    }));
    expect(
      selectReferralConversions(
        {
          referrals: {riddle_quest_friend_challenge_v2: conversions},
        },
        "inviter",
      ),
    ).toHaveLength(25);
  });

  it("caps one grant batch at twenty ungranted recipients", async () => {
    /** Provides conversions behavior. */
    const conversions = selectReferralConversions(
      {
        referrals: {
          riddle_quest_friend_challenge_v2: Array.from({length: 25}, (_, index) => ({
            playerId: `friend-${index}`,
            joinedAt,
          })),
        },
      },
      "inviter",
    );
    await expect(
      selectUngrantedReferralConversions(conversions, async (batch) => batch.map(() => false)),
    ).resolves.toHaveLength(20);
  });

  it("selects conversion twenty-one when the first twenty receipts already exist", async () => {
    /** Provides conversions behavior. */
    const conversions = selectReferralConversions(
      {
        referrals: {
          riddle_quest_friend_challenge_v2: Array.from({length: 21}, (_, index) => ({
            playerId: `friend-${index}`,
            joinedAt,
          })),
        },
      },
      "inviter",
    );
    /** Provides granted player ids behavior. */
    const grantedPlayerIds = new Set(conversions.slice(0, 20).map(({playerId}) => playerId));
    await expect(
      selectUngrantedReferralConversions(conversions, async (batch) =>
        batch.map(({playerId}) => grantedPlayerIds.has(playerId)),
      ),
    ).resolves.toEqual([expect.objectContaining({playerId: "friend-20"})]);
  });

  it("pages beyond five hundred existing receipts without enlarging the grant transaction", async () => {
    /** Provides conversions behavior. */
    const conversions = selectReferralConversions(
      {
        referrals: {
          riddle_quest_friend_challenge_v2: Array.from({length: 522}, (_, index) => ({
            playerId: `friend-${index}`,
            joinedAt,
          })),
        },
      },
      "inviter",
    );
    /** Provides granted player ids behavior. */
    const grantedPlayerIds = new Set(conversions.slice(0, 521).map(({playerId}) => playerId));
    /** Reads receipt states. */
    const readReceiptStates = jest.fn(async (batch: ReadonlyArray<(typeof conversions)[number]>) =>
      batch.map(({playerId}) => grantedPlayerIds.has(playerId)),
    );

    await expect(selectUngrantedReferralConversions(conversions, readReceiptStates)).resolves.toEqual([
      expect.objectContaining({playerId: "friend-521"}),
    ]);
    expect(readReceiptStates).toHaveBeenCalledTimes(6);
    expect(readReceiptStates.mock.calls.every(([batch]) => batch.length <= 100)).toBe(true);
  });
});
