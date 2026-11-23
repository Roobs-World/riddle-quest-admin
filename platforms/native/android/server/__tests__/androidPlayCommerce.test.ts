import {describe, expect, it, jest} from "@jest/globals";
import type {Firestore} from "firebase-admin/firestore";
import {androidPlayAccountId, androidPurchaseGrantId} from "../androidPlayCatalog";
import {
  entitledSubscriptionSkus,
  grantAndroidPlayPurchase,
  parseGrantAndroidPurchaseInput,
  parseSyncAndroidSubscriptionsInput,
  syncAndroidPlaySubscriptions,
} from "../androidPlayCommerce";
import {
  createPlayDeveloperApi,
  PlayPurchaseNotFoundError,
  type PlayDeveloperApi,
  type PlayProductPurchase,
  type PlaySubscriptionPurchase,
} from "../playDeveloperApi";
import {ACHIEVEMENT_UNLOCK_COIN_REWARD} from "../../../../../firebase-functions/src/shared/constants";
import {PREMIUM_SUBSCRIPTION_GRANT_INTERVAL_MS, PREMIUM_SUBSCRIPTION_MONTHLY_COINS} from "../../../../../src/commerce/pricing/catalog.js";

/** Player owning the fixtures. */
const UID = "android-player";
/** A coin pack from the shared catalog. */
const PACK = "com.roobsworld.riddlequest.coinpack2";
/** Premium monthly subscription. */
const MONTHLY = "com.roobsworld.riddlequest.premium.monthly";
/** Fixed server clock. */
const NOW = Date.parse("2026-11-02T12:00:00Z");

/** Minimal transactional Firestore over a path map; enough for the commerce handlers. */
function createMemoryFirestore(seed: Record<string, Record<string, unknown>> = {}) {
  /** Stored documents by path. */
  const docs = new Map<string, Record<string, unknown>>(Object.entries(seed));
  /** Document reference. */
  const ref = (path: string) => ({path});
  /** Snapshot of one path. */
  const snapshot = (path: string) => {
    /** Stored data. */
    const data = docs.get(path);
    return {exists: data !== undefined, data: () => data, get: (field: string) => data?.[field]};
  };
  /** Firestore subset. */
  const firestore = {
    collection: (name: string) => ({doc: (id: string) => ref(`${name}/${id}`)}),
    runTransaction: async <T>(callback: (transaction: unknown) => Promise<T>): Promise<T> => {
      /** Buffered writes applied on commit. */
      const writes: Array<() => void> = [];
      /** Transaction subset. */
      const transaction = {
        set: ({path}: {
        /** Stores path. */
        path: string}, data: Record<string, unknown>) => writes.push(() => docs.set(path, data)),
        get: async ({path}: {
        /** Stores path. */
        path: string}) => snapshot(path),
        update: ({path}: {
        /** Stores path. */
        path: string}, data: Record<string, unknown>) => writes.push(() => docs.set(path, {...docs.get(path), ...data})),
        create: ({path}: {
        /** Stores path. */
        path: string}, data: Record<string, unknown>) => writes.push(() => {
          if (docs.has(path)) throw new Error(`already exists: ${path}`);
          docs.set(path, data);
        }),
      };
      /** Callback result. */
      const result = await callback(transaction);
      writes.forEach((write) => write());
      return result;
    },
  };
  return {firestore: firestore as unknown as Firestore, docs};
}

/** Play fake whose purchases are set per test. */
function createFakePlay(products: Record<string, PlayProductPurchase> = {}, subscriptions: Record<string, PlaySubscriptionPurchase> = {}) {
  /** Recorded consumption calls. */
  const consumed: string[] = [];
  /** Recorded acknowledgements. */
  const acknowledged: string[] = [];
  /** Whether consumption fails. */
  let failConsume = false;
  /** Play subset. */
  const play: PlayDeveloperApi = {
    getProductPurchase: async (_productId, token) => {
      if (!products[token]) throw new PlayPurchaseNotFoundError();
      return products[token];
    },
    consumeProductPurchase: async (_productId, token) => {
      if (failConsume) throw new Error("play-api-unavailable");
      consumed.push(token);
      products[token] = {...products[token], consumptionState: 1};
    },
    getSubscriptionPurchase: async (token) => {
      if (!subscriptions[token]) throw new PlayPurchaseNotFoundError();
      return subscriptions[token];
    },
    acknowledgeSubscription: async (sku, token) => {
      acknowledged.push(`${sku}:${token}`);
    },
  };
  return {play, consumed, acknowledged, setFailConsume: (value: boolean) => (failConsume = value)};
}

/** Completed purchase bound to the fixture account. */
const purchased = (overrides: Partial<PlayProductPurchase> = {}): PlayProductPurchase => ({
  productId: PACK,
  purchaseState: 0,
  consumptionState: 0,
  obfuscatedExternalAccountId: androidPlayAccountId(UID),
  orderId: "GPA.1234",
  ...overrides,
});

/** Active subscription bound to the fixture account. */
const subscribed = (overrides: Partial<PlaySubscriptionPurchase> = {}): PlaySubscriptionPurchase => ({
  subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
  acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
  externalAccountIdentifiers: {obfuscatedExternalAccountId: androidPlayAccountId(UID)},
  lineItems: [{productId: MONTHLY, expiryTime: "2026-12-02T12:00:00Z"}],
  ...overrides,
});

/** Provisioned account fixture. */
const account = (fields: Record<string, unknown> = {}) => ({[`users/${UID}`]: {coins: 300, androidProvider: "anonymous", unlockedAchievements: [], ...fields}});

describe("grantAndroidPlayPurchase", () => {
  it("grants the catalog coins once, unlocks first purchase and consumes the token", async () => {
    /** Retains {firestore, docs} for this operation. */
    const {firestore, docs} = createMemoryFirestore(account());
    /** Retains fake for this operation. */
    const fake = createFakePlay({tok: purchased()});
    /** Retains result for this operation. */
    const result = await grantAndroidPlayPurchase({firestore, play: fake.play, now: () => NOW}, UID, {productId: PACK, purchaseToken: "tok"});
    expect(result).toEqual({
      granted: true,
      alreadyProcessed: false,
      productId: PACK,
      coinsAwarded: 550,
      newCoins: 300 + 550 + ACHIEVEMENT_UNLOCK_COIN_REWARD,
      newlyUnlockedAchievementIds: ["first_purchase"],
      consumed: true,
    });
    expect(docs.get(`users/${UID}`)).toMatchObject({coins: result.newCoins, hasPurchasedApp: true});
    expect(docs.get(`androidPurchaseGrants/${androidPurchaseGrantId("tok")}`)).toMatchObject({uid: UID, productId: PACK, coins: 550, orderId: "GPA.1234"});
    expect(fake.consumed).toEqual(["tok"]);
  });

  it("replays an already granted token without granting again", async () => {
    /** Retains {firestore, docs} for this operation. */
    const {firestore, docs} = createMemoryFirestore(account());
    /** Retains fake for this operation. */
    const fake = createFakePlay({tok: purchased()});
    /** Retains deps for this operation. */
    const deps = {firestore, play: fake.play, now: () => NOW};
    /** Retains first for this operation. */
    const first = await grantAndroidPlayPurchase(deps, UID, {productId: PACK, purchaseToken: "tok"});
    /** Retains second for this operation. */
    const second = await grantAndroidPlayPurchase(deps, UID, {productId: PACK, purchaseToken: "tok"});
    expect(second).toMatchObject({alreadyProcessed: true, newCoins: first.newCoins, newlyUnlockedAchievementIds: [], consumed: true});
    expect(docs.get(`users/${UID}`)?.coins).toBe(first.newCoins);
  });

  it("skips the achievement bonus after the first purchase", async () => {
    /** Retains {firestore} for this operation. */
    const {firestore} = createMemoryFirestore(account({unlockedAchievements: [{achievementId: "first_purchase", unlockedAt: 1}]}));
    /** Retains fake for this operation. */
    const fake = createFakePlay({tok: purchased()});
    /** Retains result for this operation. */
    const result = await grantAndroidPlayPurchase({firestore, play: fake.play, now: () => NOW}, UID, {productId: PACK, purchaseToken: "tok"});
    expect(result).toMatchObject({newCoins: 850, newlyUnlockedAchievementIds: []});
  });

  it("retries consumption on a later call when Play was unavailable", async () => {
    /** Retains {firestore} for this operation. */
    const {firestore} = createMemoryFirestore(account());
    /** Retains fake for this operation. */
    const fake = createFakePlay({tok: purchased()});
    fake.setFailConsume(true);
    /** Retains deps for this operation. */
    const deps = {firestore, play: fake.play, now: () => NOW};
    expect(await grantAndroidPlayPurchase(deps, UID, {productId: PACK, purchaseToken: "tok"})).toMatchObject({consumed: false});
    fake.setFailConsume(false);
    expect(await grantAndroidPlayPurchase(deps, UID, {productId: PACK, purchaseToken: "tok"})).toMatchObject({alreadyProcessed: true, consumed: true});
  });

  it.each([
    ["another account's token", purchased({obfuscatedExternalAccountId: androidPlayAccountId("someone-else")}), "purchase-account-mismatch"],
    ["a token with no account binding", purchased({obfuscatedExternalAccountId: undefined}), "purchase-account-mismatch"],
    ["a pending purchase", purchased({purchaseState: 2}), "purchase-pending"],
    ["a cancelled purchase", purchased({purchaseState: 1}), "purchase-not-completed"],
    ["a token consumed outside the ledger", purchased({consumptionState: 1}), "purchase-already-consumed"],
    ["a token for a different product", purchased({productId: "com.roobsworld.riddlequest.coinpack6"}), "purchase-product-mismatch"],
  ])("rejects %s", async (_name, purchase, message) => {
    /** Retains {firestore, docs} for this operation. */
    const {firestore, docs} = createMemoryFirestore(account());
    /** Retains fake for this operation. */
    const fake = createFakePlay({tok: purchase});
    await expect(grantAndroidPlayPurchase({firestore, play: fake.play}, UID, {productId: PACK, purchaseToken: "tok"})).rejects.toThrow(message);
    expect(docs.get(`users/${UID}`)?.coins).toBe(300);
  });

  it("rejects a token Play does not know and a token granted to another account", async () => {
    /** Retains {firestore} for this operation. */
    const {firestore} = createMemoryFirestore({
      ...account(),
      [`androidPurchaseGrants/${androidPurchaseGrantId("tok")}`]: {uid: "someone-else"},
    });
    /** Retains fake for this operation. */
    const fake = createFakePlay({tok: purchased()});
    await expect(grantAndroidPlayPurchase({firestore, play: fake.play}, UID, {productId: PACK, purchaseToken: "missing"})).rejects.toThrow("purchase-not-found");
    await expect(grantAndroidPlayPurchase({firestore, play: fake.play}, UID, {productId: PACK, purchaseToken: "tok"})).rejects.toThrow("purchase-account-mismatch");
  });

  it("requires a provisioned account and reports Play outages as unavailable", async () => {
    /** Retains {firestore} for this operation. */
    const {firestore} = createMemoryFirestore();
    /** Retains fake for this operation. */
    const fake = createFakePlay({tok: purchased()});
    await expect(grantAndroidPlayPurchase({firestore, play: fake.play}, UID, {productId: PACK, purchaseToken: "tok"})).rejects.toThrow("account-missing");
    /** Retains down for this operation. */
    const down: PlayDeveloperApi = {...fake.play, getProductPurchase: async () => {throw new Error("boom");}};
    await expect(grantAndroidPlayPurchase({firestore, play: down}, UID, {productId: PACK, purchaseToken: "tok"})).rejects.toMatchObject({code: "unavailable"});
  });
});

describe("syncAndroidPlaySubscriptions", () => {
  it("activates Premium, grants its coins once per period and acknowledges pending tokens", async () => {
    /** Retains {firestore, docs} for this operation. */
    const {firestore, docs} = createMemoryFirestore(account());
    /** Retains fake for this operation. */
    const fake = createFakePlay({}, {sub: subscribed({acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING"})});
    /** Retains first for this operation. */
    const first = await syncAndroidPlaySubscriptions({firestore, play: fake.play, now: () => NOW}, UID, {purchaseTokens: ["sub"]});
    expect(first).toEqual({verified: true, activeSkus: [MONTHLY], premiumCoinsAwarded: PREMIUM_SUBSCRIPTION_MONTHLY_COINS, newCoins: 300 + PREMIUM_SUBSCRIPTION_MONTHLY_COINS});
    expect(docs.get(`users/${UID}`)).toMatchObject({hasActiveSubscription: true, androidSubscriptions: {activeSkus: [MONTHLY]}, premiumCoinsGrantedAt: NOW});
    expect(fake.acknowledged).toEqual([`${MONTHLY}:sub`]);
    /** Retains again for this operation. */
    const again = await syncAndroidPlaySubscriptions({firestore, play: fake.play, now: () => NOW + 1_000}, UID, {purchaseTokens: ["sub"]});
    expect(again).toMatchObject({premiumCoinsAwarded: 0, newCoins: first.newCoins});
    /** Retains next period for this operation. */
    const nextPeriod = NOW + PREMIUM_SUBSCRIPTION_GRANT_INTERVAL_MS;
    /** Retains renewed for this operation. */
    const renewed = createFakePlay({}, {sub: subscribed({lineItems: [{productId: MONTHLY, expiryTime: new Date(nextPeriod + 86_400_000).toISOString()}]})});
    expect(await syncAndroidPlaySubscriptions({firestore, play: renewed.play, now: () => nextPeriod}, UID, {purchaseTokens: ["sub"]}))
      .toMatchObject({premiumCoinsAwarded: PREMIUM_SUBSCRIPTION_MONTHLY_COINS});
  });

  it("clears Premium when no verified token entitles the account", async () => {
    /** Retains {firestore, docs} for this operation. */
    const {firestore, docs} = createMemoryFirestore(account({hasActiveSubscription: true}));
    /** Retains fake for this operation. */
    const fake = createFakePlay({}, {foreign: subscribed({externalAccountIdentifiers: {obfuscatedExternalAccountId: "x"}})});
    /** Retains result for this operation. */
    const result = await syncAndroidPlaySubscriptions({firestore, play: fake.play, now: () => NOW}, UID, {purchaseTokens: ["foreign", "unknown"]});
    expect(result).toEqual({verified: true, activeSkus: [], premiumCoinsAwarded: 0, newCoins: 300});
    expect(docs.get(`users/${UID}`)).toMatchObject({hasActiveSubscription: false, androidSubscriptions: {activeSkus: []}});
  });

  it("keeps a cancelled subscription until it expires and drops paused, held or expired ones", () => {
    expect(entitledSubscriptionSkus(subscribed({subscriptionState: "SUBSCRIPTION_STATE_CANCELED"}), UID, NOW)).toEqual([MONTHLY]);
    expect(entitledSubscriptionSkus(subscribed({subscriptionState: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"}), UID, NOW)).toEqual([MONTHLY]);
    for (const state of ["SUBSCRIPTION_STATE_ON_HOLD", "SUBSCRIPTION_STATE_PAUSED", "SUBSCRIPTION_STATE_EXPIRED", "SUBSCRIPTION_STATE_PENDING"]) {
      expect(entitledSubscriptionSkus(subscribed({subscriptionState: state}), UID, NOW)).toEqual([]);
    }
    expect(entitledSubscriptionSkus(subscribed({lineItems: [{productId: MONTHLY, expiryTime: "2026-11-01T00:00:00Z"}]}), UID, NOW)).toEqual([]);
    expect(entitledSubscriptionSkus(subscribed({lineItems: [{productId: "other.sub", expiryTime: "2027-01-01T00:00:00Z"}]}), UID, NOW)).toEqual([]);
  });
});

describe("request parsing", () => {
  it("accepts catalog products and rejects unknown or oversized input", () => {
    expect(parseGrantAndroidPurchaseInput({productId: PACK, purchaseToken: "t"})).toEqual({productId: PACK, purchaseToken: "t"});
    expect(() => parseGrantAndroidPurchaseInput({productId: "free.coins", purchaseToken: "t"})).toThrow("Unknown product");
    expect(() => parseGrantAndroidPurchaseInput({productId: PACK, purchaseToken: "x".repeat(4_097)})).toThrow();
    expect(() => parseGrantAndroidPurchaseInput({productId: "toString", purchaseToken: "t"})).toThrow("Unknown product");
    expect(parseSyncAndroidSubscriptionsInput({purchaseTokens: ["a", "a", "b"]})).toEqual({purchaseTokens: ["a", "b"]});
    expect(() => parseSyncAndroidSubscriptionsInput({purchaseTokens: Array(9).fill("a")})).toThrow();
    expect(() => parseSyncAndroidSubscriptionsInput({purchaseTokens: [""]})).toThrow();
  });
});

describe("createPlayDeveloperApi", () => {
  it("calls the Play endpoints with the scoped token and maps missing tokens", async () => {
    /** Retains calls for this operation. */
    const calls: Array<{
    /** Stores url. */
    url: string;
    /** Stores method. */
    method: string;
    /** Stores auth. */
    auth: string}> = [];
    /** Fetches mock. */
    const fetchMock = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      /** Retains headers for this operation. */
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({url: String(url), method: init?.method ?? "GET", auth: headers.Authorization});
      if (String(url).includes("/missing")) return new Response("{}", {status: 410});
      return new Response(JSON.stringify({purchaseState: 0}), {status: 200});
    });
    /** Retains api for this operation. */
    const api = createPlayDeveloperApi({fetch: fetchMock as unknown as typeof fetch, getAccessToken: async () => "token"});
    expect(await api.getProductPurchase(PACK, "a/b")).toEqual({purchaseState: 0});
    await api.consumeProductPurchase(PACK, "t");
    await api.acknowledgeSubscription(MONTHLY, "t");
    await expect(api.getSubscriptionPurchase("missing")).rejects.toBeInstanceOf(PlayPurchaseNotFoundError);
    /** Retains root for this operation. */
    const root = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.roobsworld.riddlequest/purchases";
    expect(calls).toEqual([
      {url: `${root}/products/${PACK}/tokens/a%2Fb`, method: "GET", auth: "Bearer token"},
      {url: `${root}/products/${PACK}/tokens/t:consume`, method: "POST", auth: "Bearer token"},
      {url: `${root}/subscriptions/${MONTHLY}/tokens/t:acknowledge`, method: "POST", auth: "Bearer token"},
      {url: `${root}/subscriptionsv2/tokens/missing`, method: "GET", auth: "Bearer token"},
    ]);
  });

  it("requests an androidpublisher-scoped token from the metadata server and caches it", async () => {
    /** Retains urls for this operation. */
    const urls: string[] = [];
    /** Fetches mock. */
    const fetchMock = jest.fn(async (url: string | URL | Request) => {
      urls.push(String(url));
      if (String(url).startsWith("http://metadata")) return new Response(JSON.stringify({access_token: "meta", expires_in: 3600}), {status: 200});
      return new Response("{}", {status: 200});
    });
    /** Retains api for this operation. */
    const api = createPlayDeveloperApi({fetch: fetchMock as unknown as typeof fetch});
    await api.getProductPurchase(PACK, "t");
    await api.getProductPurchase(PACK, "t");
    expect(urls.filter((url) => url.startsWith("http://metadata"))).toEqual([
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token?scopes=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fandroidpublisher",
    ]);
  });
});
