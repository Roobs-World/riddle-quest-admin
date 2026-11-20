import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {androidPlayAccountId} from "../android/androidPlayCatalog";
import {syncAndroidPlaySubscriptions, MAX_ANDROID_SUBSCRIPTION_TOKENS} from "../android/androidSubscriptionRegistry";
import {
  PlayPurchaseNotFoundError,
  type PlayDeveloperApi,
  type PlaySubscriptionPurchase,
} from "../android/playDeveloperApi";
import {PREMIUM_SUBSCRIPTION_MONTHLY_COINS} from "@riddle-quest/core/pricing/catalog";

/** One synthetic native account in an exclusively owned demo project. */
const UID = "a".repeat(28),
  NOW = Date.parse("2026-11-20T12:00:00Z"),
  MONTHLY = "com.roobsworld.riddlequest.premium.monthly";
/** Real Firestore owns receipt registration and concurrent projection commits. */
let db: FirebaseFirestore.Firestore;
/** Canonical Play response; only the provider transport is replaced. */
const purchase = (state = "SUBSCRIPTION_STATE_ACTIVE"): PlaySubscriptionPurchase => ({
  subscriptionState: state,
  acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
  externalAccountIdentifiers: {obfuscatedExternalAccountId: androidPlayAccountId(UID)},
  lineItems: [{productId: MONTHLY, expiryTime: new Date(NOW + 86_400_000).toISOString()}],
});
/** Mutable external provider lets tests move a known receipt through real lifecycle decisions. */
function provider(rows: Map<string, PlaySubscriptionPurchase>) {
  /** Observed provider lookups and acknowledgements for the receipt fixture. */
  const reads: string[] = [],
    acknowledgements: string[] = [];
  /** External Play transport; authoritative registration and rewards still use real Firestore. */
  const play: PlayDeveloperApi = {
    getProductPurchase: async () => {
      throw new PlayPurchaseNotFoundError();
    },
    consumeProductPurchase: async () => undefined,
    getSubscriptionPurchase: async (token) => {
      reads.push(token);
      /** Authoritative operation result retained after its transaction commits. */
      const result = rows.get(token);
      if (!result) throw new PlayPurchaseNotFoundError();
      return result;
    },
    acknowledgeSubscription: async (sku, token) => {
      acknowledgements.push(`${sku}:${token}`);
    },
  };
  return {play, reads, acknowledgements};
}
/** Every test cleans only this dedicated project. */
async function clear() {
  for (const name of ["users", "androidCommerceAccounts"]) await db.recursiveDelete(db.collection(name));
}
beforeAll(() => {
  if (
    !/^demo-/.test(process.env.GCLOUD_PROJECT ?? "") ||
    !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")
  )
    throw new Error("Dedicated Android subscription emulator required.");
  /** This suite owns a separate demo namespace even under the standard shared coverage runner. */
  const app = getApps().find(candidate => candidate.name === "[DEFAULT]") ?? initializeApp({projectId: "demo-android-subscriptions"});
  if (app.options.projectId !== "demo-android-subscriptions") throw new Error("Dedicated Android subscription emulator required.");
  db = getFirestore(app);
});
beforeEach(async () => {
  await clear();
  await db.doc(`users/${UID}`).set({androidProvider: "google.com", coins: 300, hasActiveSubscription: false});
});
afterAll(clear);

it("keeps verified Premium and its once-per-period coins when a second device supplies an empty Play account", async () => {
  /** Controlled external Play transport over a real subscription ledger. */
  const fake = provider(new Map([["paid-first-device", purchase()]]));
  /** Initial server verification that registers the paid receipt. */
  const first = await syncAndroidPlaySubscriptions({firestore: db, play: fake.play, now: () => NOW}, UID, {
    purchaseTokens: ["paid-first-device"],
  });
  /** Another device response with no owned Play receipts of its own. */
  const second = await syncAndroidPlaySubscriptions({firestore: db, play: fake.play, now: () => NOW + 1000}, UID, {
    purchaseTokens: [],
  });
  expect(second).toMatchObject({activeSkus: [MONTHLY], premiumCoinsAwarded: 0, newCoins: first.newCoins});
  expect(fake.reads).toEqual(["paid-first-device", "paid-first-device"]);
  expect((await db.doc(`users/${UID}`).get()).get("hasActiveSubscription")).toBe(true);
  expect((await db.doc(`androidCommerceAccounts/${UID}`).get()).get("purchaseTokens")).toEqual(["paid-first-device"]);
});
it("revokes only after Play verifies terminal expiry and retains held receipts that can later recover", async () => {
  /** Provider receipt states used to verify retention and lifecycle changes. */
  const rows = new Map([["receipt", purchase()]]),
    fake = provider(rows),
    sync = () =>
      syncAndroidPlaySubscriptions({firestore: db, play: fake.play, now: () => NOW}, UID, {purchaseTokens: []});
  await syncAndroidPlaySubscriptions({firestore: db, play: fake.play, now: () => NOW}, UID, {
    purchaseTokens: ["receipt"],
  });
  rows.set("receipt", purchase("SUBSCRIPTION_STATE_ON_HOLD"));
  expect((await sync()).activeSkus).toEqual([]);
  expect((await db.doc(`androidCommerceAccounts/${UID}`).get()).get("purchaseTokens")).toEqual(["receipt"]);
  rows.set("receipt", purchase());
  expect((await sync()).activeSkus).toEqual([MONTHLY]);
  rows.set("receipt", purchase("SUBSCRIPTION_STATE_EXPIRED"));
  expect((await sync()).activeSkus).toEqual([]);
  expect((await db.doc(`androidCommerceAccounts/${UID}`).get()).get("purchaseTokens")).toEqual([]);
  expect((await db.doc(`users/${UID}`).get()).get("hasActiveSubscription")).toBe(false);
});
it("re-verifies a stale empty sync when a concurrent device registers a newly purchased token", async () => {
  await db.doc(`androidCommerceAccounts/${UID}`).set({version: 1, purchaseTokens: ["old-expired"]});
  /** Provider receipt states used to verify retention and lifecycle changes. */
  const rows = new Map([
      ["old-expired", purchase("SUBSCRIPTION_STATE_EXPIRED")],
      ["new-paid", purchase()],
    ]),
    fake = provider(rows);
  /** Completes the deliberately delayed provider request. */
  let release: (() => void) | undefined,
    entered: (() => void) | undefined,
    first = true;
  /** Signals that the stale provider read has captured its original registry revision. */
  const started = new Promise<void>((resolve) => {
      entered = resolve;
    }),
    blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
  /** External Play transport; authoritative registration and rewards still use real Firestore. */
  const play: PlayDeveloperApi = {
    ...fake.play,
    /** Reads the scripted Play receipt while exposing controlled response ordering. */
    async getSubscriptionPurchase(token) {
      if (token === "old-expired" && first) {
        first = false;
        entered?.();
        await blocked;
        return purchase("SUBSCRIPTION_STATE_EXPIRED");
      }
      return fake.play.getSubscriptionPurchase(token);
    },
  };
  /** Older empty-device observation whose projection must not overwrite newer Premium. */
  const stale = syncAndroidPlaySubscriptions({firestore: db, play, now: () => NOW}, UID, {purchaseTokens: []});
  await started;
  /** Concurrent receipt registration that establishes the newer entitlement. */
  const fresh = await syncAndroidPlaySubscriptions({firestore: db, play, now: () => NOW + 1000}, UID, {
    purchaseTokens: ["new-paid"],
  });
  release?.();
  /** Stale invocation after it re-verifies the current server-owned receipt registry. */
  const recovered = await stale;
  expect(fresh.activeSkus).toEqual([MONTHLY]);
  expect(recovered.activeSkus).toEqual([MONTHLY]);
  expect((await db.doc(`users/${UID}`).get()).get("hasActiveSubscription")).toBe(true);
  expect((await db.doc(`users/${UID}`).get()).get("coins")).toBe(300 + PREMIUM_SUBSCRIPTION_MONTHLY_COINS);
  expect((await db.doc(`androidCommerceAccounts/${UID}`).get()).get("purchaseTokens")).toEqual(["new-paid"]);
});
it("serializes concurrent registration and the Premium coin cadence through the real ledger", async () => {
  /** Controlled external Play transport over a real subscription ledger. */
  const fake = provider(new Map([["receipt", purchase()]]));
  /** Concurrent authoritative outcomes checked for one durable grant. */
  const results = await Promise.all(
    [1, 2].map(() =>
      syncAndroidPlaySubscriptions({firestore: db, play: fake.play, now: () => NOW}, UID, {
        purchaseTokens: ["receipt"],
      }),
    ),
  );
  expect(results.reduce((sum, result) => sum + result.premiumCoinsAwarded, 0)).toBe(PREMIUM_SUBSCRIPTION_MONTHLY_COINS);
  expect((await db.doc(`users/${UID}`).get()).get("coins")).toBe(300 + PREMIUM_SUBSCRIPTION_MONTHLY_COINS);
});
it("preserves state on Play outages and refuses mutations of another provider's Premium", async () => {
  /** Controlled external Play transport over a real subscription ledger. */
  const fake = provider(new Map([["receipt", purchase()]]));
  await syncAndroidPlaySubscriptions({firestore: db, play: fake.play, now: () => NOW}, UID, {
    purchaseTokens: ["receipt"],
  });
  /** Persisted subscription authority before the injected provider outage. */
  const before = (await db.doc(`androidCommerceAccounts/${UID}`).get()).data();
  /** Unavailable Play transport used to prove the last confirmed state is retained. */
  const down: PlayDeveloperApi = {
    ...fake.play,
    getSubscriptionPurchase: async () => {
      throw new Error("provider-down");
    },
  };
  await expect(
    syncAndroidPlaySubscriptions({firestore: db, play: down, now: () => NOW}, UID, {purchaseTokens: []}),
  ).rejects.toMatchObject({code: "unavailable"});
  expect((await db.doc(`androidCommerceAccounts/${UID}`).get()).data()).toEqual(before);
  await db.doc(`users/${UID}`).update({androidProvider: "jest"});
  await expect(
    syncAndroidPlaySubscriptions({firestore: db, play: fake.play, now: () => NOW}, UID, {purchaseTokens: []}),
  ).rejects.toMatchObject({code: "permission-denied"});
  expect((await db.doc(`users/${UID}`).get()).get("hasActiveSubscription")).toBe(true);
});
it("bounds private raw-token retention and does not register foreign receipts", async () => {
  /** Provider receipt states used to verify retention and lifecycle changes. */
  const rows = new Map(
      Array.from({length: MAX_ANDROID_SUBSCRIPTION_TOKENS + 1}, (_, i) => [`receipt-${i}`, purchase()]),
    ),
    fake = provider(rows);
  await db
    .doc(`androidCommerceAccounts/${UID}`)
    .set({version: 1, purchaseTokens: [...rows.keys()].slice(0, MAX_ANDROID_SUBSCRIPTION_TOKENS)});
  await expect(
    syncAndroidPlaySubscriptions({firestore: db, play: fake.play, now: () => NOW}, UID, {
      purchaseTokens: [`receipt-${MAX_ANDROID_SUBSCRIPTION_TOKENS}`],
    }),
  ).rejects.toMatchObject({code: "resource-exhausted"});
  expect((await db.doc(`androidCommerceAccounts/${UID}`).get()).get("version")).toBe(1);
  await db.doc(`androidCommerceAccounts/${UID}`).delete();
  rows.set("foreign", {...purchase(), externalAccountIdentifiers: {obfuscatedExternalAccountId: "different-account"}});
  expect(
    (
      await syncAndroidPlaySubscriptions({firestore: db, play: fake.play, now: () => NOW}, UID, {
        purchaseTokens: ["foreign"],
      })
    ).activeSkus,
  ).toEqual([]);
  expect((await db.doc(`androidCommerceAccounts/${UID}`).get()).get("purchaseTokens")).toEqual([]);
});
it("does not revoke a legacy confirmed flag solely from an empty second-device snapshot", async () => {
  await db.doc(`users/${UID}`).update({hasActiveSubscription: true, androidSubscriptions: {activeSkus: [MONTHLY]}});
  /** Controlled external Play transport over a real subscription ledger. */
  const fake = provider(new Map());
  expect(
    await syncAndroidPlaySubscriptions({firestore: db, play: fake.play, now: () => NOW}, UID, {purchaseTokens: []}),
  ).toMatchObject({activeSkus: [MONTHLY], premiumCoinsAwarded: 0});
  expect((await db.doc(`users/${UID}`).get()).get("hasActiveSubscription")).toBe(true);
});
