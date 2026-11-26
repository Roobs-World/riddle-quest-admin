import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {defineSecret} from "firebase-functions/params";
import {type Request} from "firebase-functions/v2/https";
import {logger} from "firebase-functions";
import {jestFirebaseUid, verifyJestSigned} from "./jestSecurity";
import {resolveJestConflictingSubscriptionSkus, resolveJestSignedPurchase, resolveJestSignedSubscriptions, type VerifiedJestSubscription} from "./jestProductCatalog";
import {JEST_SUBSCRIPTIONS, resolvePremiumCoinGrant} from "../../../../firebase-functions/src/shared/productCatalog";
import {ACHIEVEMENT_UNLOCK_COIN_REWARD} from "../../../../firebase-functions/src/shared/constants";
import {JEST_REFERRAL_REWARD_COINS} from "../src/referrals/referralCampaigns.js";
import {captureException, flushSentry} from "../../../../firebase-functions/src/shared/sentry";
import {onRequestWithSentry} from "../../../../firebase-functions/src/shared/sentryHandlers";
import {
  createJestPurchaseGrantId,
  currentJestCoinBalance,
  isSafeLegacyJestPurchaseGrantId,
} from "./jestPurchaseReceipts";
import {
  createJestReferralRewardId,
  selectReferralConversions,
  selectUngrantedReferralConversions,
} from "./jestReferralReceipts";
import {createReservedJestUser} from "./jestUser";
import {assertJestAccountActive, getJestAccountDeletionRef, isJestAccountDeletionBusyError, respondToDeletedJestAccount} from "../../../../firebase-functions/src/shared/accountDeletion";
import {grantJestReferralRewards} from "./jestReferralGrant";
import {deleteAccountForUser} from "../../../../firebase-functions/src/profile/accountDeletion/deleteAccountData";
export {selectReferralConversions, selectUngrantedReferralConversions} from "./jestReferralReceipts";
/** Provides jest shared secret behavior. */
const jestSharedSecret = defineSecret("JEST_SHARED_SECRET");
/** Deterministic deployment policy for browser-reachable, signed Jest HTTP boundaries. */
const jestHttpOptions = {secrets: [jestSharedSecret], invoker: "public" as const};
/** Defines the jest game id value. */
const JEST_GAME_ID = process.env.JEST_GAME_ID ?? "riddle-quest";
/** Provides configured skus behavior. */
const configuredSkus = new Set(
  (process.env.JEST_PRODUCT_SKUS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
/** Provides configured subscription skus behavior. */
const configuredSubscriptionSkus = new Set(
  (process.env.JEST_SUBSCRIPTION_SKUS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
/** Provides trusted subscription skus behavior. */
const trustedSubscriptionSkus = new Set(Object.keys(JEST_SUBSCRIPTIONS));
/** Provides subscription skus behavior. */
const subscriptionSkus = new Set([...configuredSubscriptionSkus].filter((sku) => trustedSubscriptionSkus.has(sku)));
/** Provides attempts behavior. */
const attempts = new Map<
  string,
  {
    /** Stores count. */
    count: number; /** Stores reset at. */
    /** Stores reset at. */
    resetAt: number;
  }
>();
/** Defines the max rate limit keys value. */
const MAX_RATE_LIMIT_KEYS = 10_000;
/** Maximum UTF-8 byte lengths accepted before any signed payload verification. */
export const JEST_HTTP_INPUT_LIMITS = {
  playerSigned: 16 * 1_024,
  purchaseSigned: 64 * 1_024,
  subscriptionsSigned: 64 * 1_024,
  referralsSigned: 256_000,
  playerId: 512,
  purchaseToken: 4 * 1_024,
} as const;
/** Maximum raw JSON body size accepted by any Jest HTTP endpoint. */
export const MAX_JEST_HTTP_BODY_BYTES = 600 * 1_024;
/** Describes jest http response. */
type JestHttpResponse = {
  /** Provides set behavior. */
  set(name: string, value: string): unknown;
  /** Provides status behavior. */
  status(code: number): JestHttpResponse;
  /** Provides json behavior. */
  json(body: unknown): unknown;
  /** Provides send behavior. */
  send(body: string): unknown;
};
/** Provides allow request behavior. */
export function allowJestRequest(ip: string): boolean {
  if (!isBoundedString(ip, 256)) return false;
  /** Provides now behavior. */
  const now = Date.now();
  /** Provides current behavior. */
  const current = attempts.get(ip);
  if (current && current.resetAt > now) {
    current.count += 1;
    return current.count <= 30;
  }
  if (current) attempts.delete(ip);
  if (attempts.size >= MAX_RATE_LIMIT_KEYS) {
    for (const [key, value] of attempts) {
      if (value.resetAt > now) break;
      attempts.delete(key);
    }
  }
  if (attempts.size >= MAX_RATE_LIMIT_KEYS) return false;
  attempts.set(ip, {count: 1, resetAt: now + 60_000});
  return true;
}
/** Validates one exact, bounded string-only JSON request shape. */
export function parseJestStringBody<Field extends string>(
  body: unknown,
  limits: Readonly<Record<Field, number>>,
): Record<Field, string> {
  if (!isRecord(body)) throw new Error("invalid-request");
  /** Provides expected fields behavior. */
  const expectedFields = Object.keys(limits) as Field[];
  /** Provides actual fields behavior. */
  const actualFields = Object.keys(body);
  if (
    actualFields.length !== expectedFields.length ||
    actualFields.some((field) => !Object.prototype.hasOwnProperty.call(limits, field))
  ) {
    throw new Error("invalid-request");
  }
  /** Parses d. */
  const parsed = {} as Record<Field, string>;
  expectedFields.forEach((field) => {
    /** Provides value behavior. */
    const value = body[field];
    if (typeof value !== "string" || value.length === 0 || Buffer.byteLength(value, "utf8") > limits[field]) {
      throw new Error("invalid-request");
    }
    parsed[field] = value;
  });
  return parsed;
}
/** Returns whether an unknown value is a non-empty UTF-8 string within a fixed byte bound. */
function isBoundedString(value: unknown, maxBytes: number): value is string {
  return typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= maxBytes;
}
/** Provides allowed jest origins behavior. */
function allowedJestOrigins(): Set<string> {
  /** Provides origins behavior. */
  const origins = new Set(
    (process.env.JEST_GAME_ORIGIN ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  /** Provides game id behavior. */
  const gameId = process.env.JEST_GAME_ID ?? JEST_GAME_ID;
  if (gameId) origins.add(`https://${gameId}.builds.jest.com`);
  return origins;
}
/** Returns whether a browser origin is explicitly trusted for Jest backend calls. */
export function isAllowedJestOrigin(origin: string | undefined): boolean {
  return typeof origin === "string" && allowedJestOrigins().has(origin);
}
/** Applies jest cors. */
export function applyJestCors(
  response: {
    /** Provides set behavior. */
    set(name: string, value: string): unknown;
  },
  origin?: string,
) {
  if (isAllowedJestOrigin(origin)) response.set("Access-Control-Allow-Origin", origin!);
  response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.set("Access-Control-Allow-Headers", "Content-Type");
  response.set("Access-Control-Max-Age", "3600");
  response.set("Vary", "Origin");
  response.set("Cache-Control", "no-store");
  response.set("Referrer-Policy", "no-referrer");
  response.set("X-Content-Type-Options", "nosniff");
}

/** Provides rejection behavior. */
function rejection(error: unknown) {
  /** Provides reason behavior. */
  const reason = error instanceof Error ? error.message : "invalid-request";
  logger.warn("Rejected Jest platform request", {reason});
  return "invalid-request";
}

/**
 * Applies the HTTP boundary policy shared by all signed Jest endpoints.
 *
 * @param request Incoming Firebase HTTP request.
 * @param response Response adapter used to emit boundary failures.
 * @returns `true` only for trusted, rate-limited JSON POST requests.
 */
export function acceptJestRequest(request: Request, response: JestHttpResponse): boolean {
  /** Provides origin behavior. */
  const origin = request.get("origin");
  applyJestCors(response, origin);
  if (!isAllowedJestOrigin(origin)) {
    response.status(403).json({error: "forbidden-origin"});
    return false;
  }
  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return false;
  }
  if (request.method !== "POST") {
    response.status(405).json({error: "method-not-allowed"});
    return false;
  }
  if (!request.is("application/json")) {
    response.status(415).json({error: "unsupported-media-type"});
    return false;
  }
  /** Provides raw body behavior. */
  const rawBody = request.rawBody;
  if (rawBody && rawBody.byteLength > MAX_JEST_HTTP_BODY_BYTES) {
    response.status(413).json({error: "payload-too-large"});
    return false;
  }
  if (!allowJestRequest(request.ip ?? "unknown")) {
    response.status(429).json({error: "rate-limited"});
    return false;
  }
  return true;
}

/** Verifies and returns the bounded player identity carried by a fresh signed assertion. */
const resolveSignedJestPlayer = (playerSigned: string) => {
  /** Provides payload behavior. */
  const payload = verifyJestSigned(playerSigned, jestSharedSecret.value(), JEST_GAME_ID, undefined, undefined, 15 * 60);
  if (
    !payload.player ||
    !isBoundedString(payload.sub, JEST_HTTP_INPUT_LIMITS.playerId) ||
    !isBoundedString(payload.player.playerId, JEST_HTTP_INPUT_LIMITS.playerId) ||
    payload.player.playerId !== payload.sub ||
    typeof payload.player.registered !== "boolean"
  )
    throw new Error("invalid-player");
  return payload.player;
};

/** Provides exchange jest identity behavior. */
export const exchangeJestIdentity = onRequestWithSentry(
  "exchangeJestIdentity",
  {...jestHttpOptions, minInstances: 0},
  async (request, response) => {
    if (!acceptJestRequest(request, response)) return;
    try {
      /** Provides {player signed} behavior. */
      const {playerSigned} = parseJestStringBody(request.body, {playerSigned: JEST_HTTP_INPUT_LIMITS.playerSigned});
      /** Provides player behavior. */
      const player = resolveSignedJestPlayer(playerSigned);
      /** Provides uid behavior. */
      const uid = jestFirebaseUid(player.playerId);
      /** Provides firestore behavior. */
      const firestore = admin.firestore();
      /** Provides r ref. */
      const userRef = firestore.collection("users").doc(uid);
      await firestore.runTransaction(async (transaction) => {
        /** Provides [user snapshot, deletion snapshot] behavior. */
        const [userSnapshot, deletionSnapshot] = await Promise.all([
          transaction.get(userRef),
          transaction.get(getJestAccountDeletionRef(firestore, uid)),
        ]);
        assertJestAccountActive(deletionSnapshot);
        if (userSnapshot.exists) {
          if (player.registered && userSnapshot.get("notificationsEnabled") === undefined) {
            transaction.update(userRef, {notificationsEnabled: true});
          }
        } else {
          const user = createReservedJestUser(transaction, firestore, uid, player.playerId);
          if (player.registered) user.notificationsEnabled = true;
          transaction.create(userRef, user);
        }
      });
      /** Provides custom token behavior. */
      const customToken = await admin
        .auth()
        .createCustomToken(uid, {jestPlayerId: player.playerId, jestRegistered: player.registered});
      // Token creation is outside Firestore. Recheck the permanent guard before
      // returning it; the retained disabled Auth sentinel covers the remaining
      // response/redemption race after this read.
      assertJestAccountActive(await getJestAccountDeletionRef(firestore, uid).get());
      response.json({customToken, uid});
    } catch (error) {
      if (respondToDeletedJestAccount(error, response)) return;
      captureException(error, {firebaseFunction: "exchangeJestIdentity"});
      await flushSentry();
      response.status(401).json({error: rejection(error)});
    }
  },
);

/** Retries authoritative deletion from a fresh signed platform assertion without minting Firebase credentials. */
export const retryJestAccountDeletion = onRequestWithSentry(
  "retryJestAccountDeletion",
  {...jestHttpOptions, timeoutSeconds: 540},
  async (request, response) => {
    if (!acceptJestRequest(request, response)) return;
    try {
      /** Provides {player signed} behavior. */
      const {playerSigned} = parseJestStringBody(request.body, {playerSigned: JEST_HTTP_INPUT_LIMITS.playerSigned});
      /** Provides player behavior. */
      const player = resolveSignedJestPlayer(playerSigned);
      await deleteAccountForUser(jestFirebaseUid(player.playerId), player.playerId);
      response.json({accountDeleted: true});
    } catch (error) {
      if (isJestAccountDeletionBusyError(error)) {
        response.status(409).json({error: "account-deletion-in-progress"});
        return;
      }
      captureException(error, {firebaseFunction: "retryJestAccountDeletion"});
      await flushSentry();
      response.status(400).json({error: rejection(error)});
    }
  },
);

/** Provides grant jest purchase behavior. */
export const grantJestPurchase = onRequestWithSentry(
  "grantJestPurchase",
  jestHttpOptions,
  async (request, response) => {
    if (!acceptJestRequest(request, response)) return;
    try {
      /** Provides {purchase signed, player id, purchase token: requested token} behavior. */
      const {
        purchaseSigned,
        playerId,
        purchaseToken: requestedToken,
      } = parseJestStringBody(request.body, {
        purchaseSigned: JEST_HTTP_INPUT_LIMITS.purchaseSigned,
        playerId: JEST_HTTP_INPUT_LIMITS.playerId,
        purchaseToken: JEST_HTTP_INPUT_LIMITS.purchaseToken,
      });
      /** Provides payload behavior. */
      const payload = verifyJestSigned(purchaseSigned, jestSharedSecret.value(), JEST_GAME_ID, playerId);
      /** Provides {purchase token, product sku, coins} behavior. */
      const {purchaseToken, productSku, coins} = resolveSignedPurchase(payload, requestedToken, configuredSkus);
      /** Provides uid behavior. */
      const uid = jestFirebaseUid(playerId);
      /** Provides firestore behavior. */
      const firestore = admin.firestore();
      /** Provides grant collection behavior. */
      const grantCollection = firestore.collection("jestPurchaseGrants");
      /** Provides purchase token hash behavior. */
      const purchaseTokenHash = createJestPurchaseGrantId(purchaseToken);
      /** Provides ref behavior. */
      const ref = grantCollection.doc(purchaseTokenHash);
      /** Provides legacy ref behavior. */
      const legacyRef =
        isSafeLegacyJestPurchaseGrantId(purchaseToken) && purchaseToken !== purchaseTokenHash
          ? grantCollection.doc(purchaseToken)
          : undefined;
      /** Provides r ref. */
      const userRef = firestore.collection("users").doc(uid);
      /** Provides deletion ref behavior. */
      const deletionRef = getJestAccountDeletionRef(firestore, uid);
      /** Provides already processed behavior. */
      let alreadyProcessed = false;
      /** Provides new coins behavior. */
      let newCoins = 0;
      /** Provides newly unlocked achievement ids behavior. */
      let newlyUnlockedAchievementIds: string[] = [];
      await firestore.runTransaction(async (transaction) => {
        /** Provides [grant snapshot, legacy grant snapshot, user snapshot, deletion snapshot] behavior. */
        const [grantSnapshot, legacyGrantSnapshot, userSnapshot, deletionSnapshot] = await Promise.all([
          transaction.get(ref),
          legacyRef ? transaction.get(legacyRef) : Promise.resolve(undefined),
          transaction.get(userRef),
          transaction.get(deletionRef),
        ]);
        assertJestAccountActive(deletionSnapshot);
        if (grantSnapshot.exists || legacyGrantSnapshot?.exists) {
          alreadyProcessed = true;
          newCoins = currentJestCoinBalance(userSnapshot.exists ? userSnapshot.data() : undefined);
          if (!grantSnapshot.exists && legacyGrantSnapshot?.exists && legacyRef) {
            /** Provides legacy grant behavior. */
            const legacyGrant = legacyGrantSnapshot.data();
            transaction.create(ref, {
              purchaseTokenHash,
              replayProtection: true,
              productSku: typeof legacyGrant?.productSku === "string" ? legacyGrant.productSku : productSku,
              coins: typeof legacyGrant?.coins === "number" ? legacyGrant.coins : coins,
              grantedAt: legacyGrant?.grantedAt ?? admin.firestore.FieldValue.serverTimestamp(),
            });
            transaction.delete(legacyRef);
          }
          return;
        }
        /** Provides r. */
        const user = userSnapshot.exists
          ? userSnapshot.data()!
          : createReservedJestUser(transaction, firestore, uid, playerId);
        /** Provides current coins behavior. */
        const currentCoins = typeof user.coins === "number" ? user.coins : 0;
        /** Provides unlocked achievements behavior. */
        const unlockedAchievements = Array.isArray(user.unlockedAchievements) ? user.unlockedAchievements : [];
        /** Provides first purchase unlocked behavior. */
        const firstPurchaseUnlocked = unlockedAchievements.some(
          (achievement) =>
            typeof achievement === "object" && achievement !== null && achievement.achievementId === "first_purchase",
        );
        newlyUnlockedAchievementIds = firstPurchaseUnlocked ? [] : ["first_purchase"];
        /** Provides achievement bonus behavior. */
        const achievementBonus = newlyUnlockedAchievementIds.length * ACHIEVEMENT_UNLOCK_COIN_REWARD;
        newCoins = currentCoins + coins + achievementBonus;
        /** Updates s. */
        const updates = {
          coins: newCoins,
          hasPurchasedApp: true,
          lastLogin: Date.now(),
          unlockedAchievements: firstPurchaseUnlocked
            ? unlockedAchievements
            : [...unlockedAchievements, {achievementId: "first_purchase", unlockedAt: Date.now()}],
        };
        if (userSnapshot.exists) transaction.update(userRef, updates);
        else transaction.create(userRef, {...user, ...updates});
        transaction.create(ref, {
          purchaseTokenHash,
          replayProtection: true,
          productSku,
          coins,
          grantedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      response.json({
        granted: true,
        alreadyProcessed,
        purchaseToken,
        coinsAwarded: coins,
        newCoins,
        newlyUnlockedAchievementIds,
      });
    } catch (error) {
      if (respondToDeletedJestAccount(error, response)) return;
      captureException(error, {firebaseFunction: "grantJestPurchase"});
      await flushSentry();
      response.status(400).json({error: rejection(error)});
    }
  },
);

/** Provides sync jest subscriptions behavior. */
export const syncJestSubscriptions = onRequestWithSentry(
  "syncJestSubscriptions",
  jestHttpOptions,
  async (request, response) => {
    if (!acceptJestRequest(request, response)) return;
    try {
      /** Provides {subscriptions signed, player id} behavior. */
      const {subscriptionsSigned, playerId} = parseJestStringBody(request.body, {
        subscriptionsSigned: JEST_HTTP_INPUT_LIMITS.subscriptionsSigned,
        playerId: JEST_HTTP_INPUT_LIMITS.playerId,
      });
      /** Provides payload behavior. */
      const payload = verifyJestSigned(subscriptionsSigned, jestSharedSecret.value(), JEST_GAME_ID, playerId);
      /** Provides subscriptions behavior. */
      const subscriptions = resolveSignedSubscriptions(payload, subscriptionSkus);
      /** Provides active skus behavior. */
      const activeSkus = subscriptions
        .filter((subscription) => subscription.status === "active")
        .map((subscription) => subscription.sku);
      /** Provides blocked skus behavior. */
      const blockedSkus = resolveConflictingSubscriptionSkus(activeSkus, subscriptionSkus);
      /** Provides uid behavior. */
      const uid = jestFirebaseUid(playerId);
      /** Provides firestore behavior. */
      const firestore = admin.firestore();
      /** Provides r ref. */
      const userRef = firestore.collection("users").doc(uid);
      /** Provides deletion ref behavior. */
      const deletionRef = getJestAccountDeletionRef(firestore, uid);
      /** Coins granted by this sync for an active Premium subscription. */
      let premiumCoinsAwarded = 0;
      /** Coin balance after this sync, when the user record is known. */
      let newCoins = 0;
      await firestore.runTransaction(async (transaction) => {
        /** Provides [user snapshot, deletion snapshot] behavior. */
        const [userSnapshot, deletionSnapshot] = await Promise.all([
          transaction.get(userRef),
          transaction.get(deletionRef),
        ]);
        assertJestAccountActive(deletionSnapshot);
        /** Existing or newly reserved user record. */
        const user = userSnapshot.exists
          ? userSnapshot.data()!
          : createReservedJestUser(transaction, firestore, uid, playerId);
        /** Server clock for this grant decision. */
        const now = Date.now();
        premiumCoinsAwarded = resolvePremiumCoinGrant(activeSkus.length > 0, user.premiumCoinsGrantedAt, now);
        /** Current coin balance before any Premium grant. */
        const currentCoins = typeof user.coins === "number" ? user.coins : 0;
        newCoins = currentCoins + premiumCoinsAwarded;
        /** Updates s. */
        const updates = {
          hasActiveSubscription: activeSkus.length > 0,
          jestSubscriptions: {
            activeSkus,
            verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          lastLogin: now,
          ...(premiumCoinsAwarded > 0 ? {coins: newCoins, premiumCoinsGrantedAt: now} : {}),
        };
        if (userSnapshot.exists) transaction.update(userRef, updates);
        else transaction.create(userRef, {...user, ...updates});
      });
      response.json({verified: true, activeSkus, blockedSkus, premiumCoinsAwarded, newCoins});
    } catch (error) {
      if (respondToDeletedJestAccount(error, response)) return;
      captureException(error, {firebaseFunction: "syncJestSubscriptions"});
      await flushSentry();
      response.status(400).json({error: rejection(error)});
    }
  },
);

/** Provides verify jest referrals behavior. */
export const verifyJestReferrals = onRequestWithSentry(
  "verifyJestReferrals",
  jestHttpOptions,
  async (request, response) => {
    if (!acceptJestRequest(request, response)) return;
    try {
      /** Provides {referrals signed, player id} behavior. */
      const {referralsSigned, playerId} = parseJestStringBody(request.body, {
        referralsSigned: JEST_HTTP_INPUT_LIMITS.referralsSigned,
        playerId: JEST_HTTP_INPUT_LIMITS.playerId,
      });
      /** Provides payload behavior. */
      const payload = verifyJestSigned(referralsSigned, jestSharedSecret.value(), JEST_GAME_ID, playerId);
      /** Provides unique conversions behavior. */
      const uniqueConversions = selectReferralConversions(payload, playerId);
      /** Provides firestore behavior. */
      const firestore = admin.firestore();
      /** Provides ungranted candidates behavior. */
      const ungrantedCandidates = await selectUngrantedReferralConversions(uniqueConversions, async (batch) =>
        (
          await firestore.getAll(
            ...batch.map((conversion) =>
              firestore.collection("jestReferralRewards").doc(
                // Preserve the campaign-independent receipt identity.
                createJestReferralRewardId(playerId, conversion.playerId),
              ),
            ),
          )
        ).map((snapshot) => snapshot.exists),
      );
      /** Provides {rewards granted, new coins} behavior. */
      const {rewardsGranted, newCoins} = await grantJestReferralRewards(
        firestore,
        playerId,
        uniqueConversions,
        ungrantedCandidates,
      );
      response.json({
        verified: true,
        references: [...new Set(uniqueConversions.map((conversion) => conversion.reference))],
        conversionCount: uniqueConversions.length,
        rewardsGranted,
        referredRewardsGranted: rewardsGranted,
        coinsPerPlayer: JEST_REFERRAL_REWARD_COINS,
        newCoins,
      });
    } catch (error) {
      if (respondToDeletedJestAccount(error, response)) return;
      captureException(error, {firebaseFunction: "verifyJestReferrals"});
      await flushSentry();
      response.status(400).json({error: rejection(error)});
    }
  },
);

/** Indicates whether is record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Resolves signed purchase. */
export function resolveSignedPurchase(
  payload: Record<string, unknown>,
  requestedToken: string,
  allowedSkus: ReadonlySet<string> = configuredSkus,
) {
  return resolveJestSignedPurchase(payload, requestedToken, allowedSkus);
}

/** Resolves signed subscriptions. */
export function resolveSignedSubscriptions(
  payload: Record<string, unknown>,
  allowedSkus: ReadonlySet<string> = subscriptionSkus,
): VerifiedJestSubscription[] {
  return resolveJestSignedSubscriptions(payload, allowedSkus);
}

/** Resolves conflicting subscription skus. */
export function resolveConflictingSubscriptionSkus(
  activeSkus: readonly string[],
  allowedSkus: ReadonlySet<string> = subscriptionSkus,
  entitlementCatalog: Readonly<Record<string, string>> = JEST_SUBSCRIPTIONS,
): string[] {
  return resolveJestConflictingSubscriptionSkus(activeSkus, allowedSkus, entitlementCatalog);
}
