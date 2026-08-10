import {admin} from "../shared/firebaseAdmin";
import {defineSecret} from "firebase-functions/params";
import {type Request} from "firebase-functions/v2/https";
import {logger} from "firebase-functions";
import {jestFirebaseUid, verifyJestSigned} from "./jestSecurity";
import {JEST_COIN_PRODUCTS, JEST_SUBSCRIPTIONS} from "./jestProductCatalog";
import {createHash} from "node:crypto";
import {ACHIEVEMENT_UNLOCK_COIN_REWARD} from "../shared/constants";
import {
  JEST_REFERRAL_REWARD_COINS,
  JEST_REFERRAL_REFERENCES,
  JEST_REWARDED_REFERRAL_REFERENCES,
  type JestReferralReference,
} from "@qwordly/core/referrals";
import {captureException, flushSentry} from "../shared/sentry";
import {onRequestWithSentry} from "../shared/sentryHandlers";

/** Provides jest shared secret behavior. */
const jestSharedSecret = defineSecret("JEST_SHARED_SECRET");
/** Defines the jest game id value. */
const JEST_GAME_ID = process.env.JEST_GAME_ID ?? "riddle-quest";
/** Provides configured skus behavior. */
const configuredSkus = new Set((process.env.JEST_PRODUCT_SKUS ?? "").split(",").filter(Boolean));
/** Provides configured subscription skus behavior. */
const configuredSubscriptionSkus = new Set(
  (process.env.JEST_SUBSCRIPTION_SKUS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
);
/** Provides coin grants behavior. */
const coinGrants = new Map(Object.entries(JEST_COIN_PRODUCTS));
/** Provides trusted subscription skus behavior. */
const trustedSubscriptionSkus = new Set(Object.keys(JEST_SUBSCRIPTIONS));
/** Provides subscription skus behavior. */
const subscriptionSkus = configuredSubscriptionSkus.size > 0
  ? new Set([...configuredSubscriptionSkus].filter((sku) => trustedSubscriptionSkus.has(sku)))
  : trustedSubscriptionSkus;
/** Provides attempts behavior. */
const attempts = new Map<string, {count: number; resetAt: number}>();
/** Defines the max rate limit keys value. */
const MAX_RATE_LIMIT_KEYS = 10_000;

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
function allowRequest(ip: string): boolean {
  const now = Date.now();
  if (attempts.size >= MAX_RATE_LIMIT_KEYS) {
    for (const [key, value] of attempts) {
      if (value.resetAt <= now) attempts.delete(key);
    }
  }
  const current = attempts.get(ip);
  if (!current || current.resetAt <= now) { attempts.set(ip, {count: 1, resetAt: now + 60_000}); return true; }
  current.count += 1;
  return current.count <= 30;
}

/** Provides allowed jest origins behavior. */
function allowedJestOrigins(): Set<string> {
  const origins = new Set(
    (process.env.JEST_GAME_ORIGIN ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  );
  const gameId = process.env.JEST_GAME_ID ?? JEST_GAME_ID;
  if (gameId) origins.add(`https://${gameId}.builds.jest.com`);
  return origins;
}

/** Returns whether a browser origin is explicitly trusted for Jest backend calls. */
export function isAllowedJestOrigin(origin: string | undefined): boolean {
  return typeof origin === "string" && allowedJestOrigins().has(origin);
}

/** Applies jest cors. */
export function applyJestCors(response: {set(name: string, value: string): unknown}, origin?: string) {
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
  if (!allowRequest(request.ip ?? "unknown")) {
    response.status(429).json({error: "rate-limited"});
    return false;
  }
  return true;
}

/** Provides exchange jest identity behavior. */
export const exchangeJestIdentity = onRequestWithSentry("exchangeJestIdentity", {secrets: [jestSharedSecret]}, async (request, response) => {
  if (!acceptJestRequest(request, response)) return;
  try {
    const {playerSigned} = request.body as {playerSigned?: unknown};
    if (typeof playerSigned !== "string") throw new Error("missing-player-signed");
    const payload = verifyJestSigned(playerSigned, jestSharedSecret.value(), JEST_GAME_ID, undefined, undefined, 15 * 60);
    if (!payload.player || payload.player.playerId !== payload.sub) throw new Error("invalid-player");
    const player = payload.player;
    const uid = jestFirebaseUid(player.playerId);
    const userRef = admin.firestore().collection("users").doc(uid);
    await admin.firestore().runTransaction(async (transaction) => {
      if ((await transaction.get(userRef)).exists) return;
      transaction.create(userRef, createJestUser(uid, player.playerId));
    });
    const customToken = await admin.auth().createCustomToken(uid, {jestPlayerId: player.playerId, jestRegistered: player.registered});
    response.json({customToken, uid});
  } catch (error) {
    captureException(error, {firebaseFunction: "exchangeJestIdentity"});
    await flushSentry();
    response.status(401).json({error: rejection(error)});
  }
});

/** Provides grant jest purchase behavior. */
export const grantJestPurchase = onRequestWithSentry("grantJestPurchase", {secrets: [jestSharedSecret]}, async (request, response) => {
  if (!acceptJestRequest(request, response)) return;
  try {
    const {purchaseSigned, playerId, purchaseToken: requestedToken} = request.body as {purchaseSigned?: unknown; playerId?: unknown; purchaseToken?: unknown};
    if (typeof purchaseSigned !== "string" || typeof playerId !== "string" || typeof requestedToken !== "string") throw new Error("invalid-request");
    const payload = verifyJestSigned(purchaseSigned, jestSharedSecret.value(), JEST_GAME_ID, playerId);
    const {purchaseToken, productSku, coins} = resolveSignedPurchase(payload, requestedToken, configuredSkus);
    const uid = jestFirebaseUid(playerId);
    const ref = admin.firestore().collection("jestPurchaseGrants").doc(purchaseToken);
    const userRef = admin.firestore().collection("users").doc(uid);
    let alreadyProcessed = false;
    let newCoins = 0;
    let newlyUnlockedAchievementIds: string[] = [];
    await admin.firestore().runTransaction(async (transaction) => {
      const [grantSnapshot, userSnapshot] = await Promise.all([transaction.get(ref), transaction.get(userRef)]);
      if (grantSnapshot.exists) {
        alreadyProcessed = true;
        newCoins = typeof grantSnapshot.data()?.newCoins === "number" ? grantSnapshot.data()!.newCoins : 0;
        return;
      }
      const user = userSnapshot.exists ? userSnapshot.data()! : createJestUser(uid, playerId);
      const currentCoins = typeof user.coins === "number" ? user.coins : 0;
      const unlockedAchievements = Array.isArray(user.unlockedAchievements) ? user.unlockedAchievements : [];
      const firstPurchaseUnlocked = unlockedAchievements.some(
        (achievement) =>
          typeof achievement === "object" &&
          achievement !== null &&
          achievement.achievementId === "first_purchase",
      );
      newlyUnlockedAchievementIds = firstPurchaseUnlocked ? [] : ["first_purchase"];
      const achievementBonus = newlyUnlockedAchievementIds.length * ACHIEVEMENT_UNLOCK_COIN_REWARD;
      newCoins = currentCoins + coins + achievementBonus;
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
        playerId,
        uid,
        productSku,
        coins,
        achievementBonus,
        newCoins,
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
    captureException(error, {firebaseFunction: "grantJestPurchase"});
    await flushSentry();
    response.status(400).json({error: rejection(error)});
  }
});

/** Provides sync jest subscriptions behavior. */
export const syncJestSubscriptions = onRequestWithSentry("syncJestSubscriptions", {secrets: [jestSharedSecret]}, async (request, response) => {
  if (!acceptJestRequest(request, response)) return;
  try {
    const {subscriptionsSigned, playerId} = request.body as {
      subscriptionsSigned?: unknown;
      playerId?: unknown;
    };
    if (typeof subscriptionsSigned !== "string" || typeof playerId !== "string") {
      throw new Error("invalid-request");
    }
    const payload = verifyJestSigned(
      subscriptionsSigned,
      jestSharedSecret.value(),
      JEST_GAME_ID,
      playerId,
    );
    const subscriptions = resolveSignedSubscriptions(payload, subscriptionSkus);
    const activeSkus = subscriptions
      .filter((subscription) => subscription.status === "active")
      .map((subscription) => subscription.sku);
    const blockedSkus = resolveConflictingSubscriptionSkus(activeSkus, subscriptionSkus);
    const uid = jestFirebaseUid(playerId);
    await admin.firestore().collection("users").doc(uid).set({
      hasActiveSubscription: activeSkus.length > 0,
      jestSubscriptions: {
        activeSkus,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      lastLogin: Date.now(),
    }, {merge: true});
    response.json({verified: true, activeSkus, blockedSkus});
  } catch (error) {
    captureException(error, {firebaseFunction: "syncJestSubscriptions"});
    await flushSentry();
    response.status(400).json({error: rejection(error)});
  }
});

/** Provides verify jest referrals behavior. */
export const verifyJestReferrals = onRequestWithSentry("verifyJestReferrals", {secrets: [jestSharedSecret]}, async (request, response) => {
  if (!acceptJestRequest(request, response)) return;
  try {
    const {referralsSigned, playerId} = request.body as {referralsSigned?: unknown; playerId?: unknown};
    if (typeof referralsSigned !== "string" || typeof playerId !== "string") throw new Error("invalid-request");
    const payload = verifyJestSigned(referralsSigned, jestSharedSecret.value(), JEST_GAME_ID, playerId);
    const uniqueConversions = selectReferralConversions(payload, playerId);
    const digest = createReferralKey(referralsSigned);
    const ref = admin.firestore().collection("jestReferralVerifications").doc(digest);
    const uid = jestFirebaseUid(playerId);
    const userRef = admin.firestore().collection("users").doc(uid);
    const referredUserRefs = uniqueConversions.map((conversion) =>
      admin.firestore().collection("users").doc(jestFirebaseUid(conversion.playerId)));
    const rewardRefs = uniqueConversions.map((conversion) =>
      admin.firestore().collection("jestReferralRewards").doc(
        // Preserve the original campaign-independent key shape so one friend can
        // never be rewarded twice after appearing under multiple share references.
        createReferralKey(`${playerId}:${JEST_REFERRAL_REFERENCES.friendChallenge}:${conversion.playerId}`),
      ));
    let rewardsGranted = 0;
    let newCoins = 0;
    await admin.firestore().runTransaction(async (transaction) => {
      const [verificationSnapshot, userSnapshot, rewardSnapshots, referredUserSnapshots] = await Promise.all([
        transaction.get(ref),
        transaction.get(userRef),
        Promise.all(rewardRefs.map((rewardRef) => transaction.get(rewardRef))),
        Promise.all(referredUserRefs.map((referredUserRef) => transaction.get(referredUserRef))),
      ]);
      const ungranted = uniqueConversions.filter((_conversion, index) => !rewardSnapshots[index].exists);
      rewardsGranted = ungranted.length;
      const user = userSnapshot.exists ? userSnapshot.data()! : createJestUser(uid, playerId);
      const currentCoins = typeof user.coins === "number" ? user.coins : 0;
      newCoins = currentCoins + rewardsGranted * JEST_REFERRAL_REWARD_COINS;
      if (rewardsGranted > 0) {
        if (userSnapshot.exists) transaction.update(userRef, {coins: newCoins, lastLogin: Date.now()});
        else transaction.create(userRef, {...user, coins: newCoins});
        ungranted.forEach((conversion) => {
          const index = uniqueConversions.findIndex((entry) => entry.playerId === conversion.playerId);
          const referredUserRef = referredUserRefs[index];
          const referredSnapshot = referredUserSnapshots[index];
          const referredUid = jestFirebaseUid(conversion.playerId);
          const referredUser = referredSnapshot.exists
            ? referredSnapshot.data()!
            : createJestUser(referredUid, conversion.playerId);
          const referredCoins = typeof referredUser.coins === "number" ? referredUser.coins : 0;
          if (referredSnapshot.exists) {
            transaction.update(referredUserRef, {
              coins: referredCoins + JEST_REFERRAL_REWARD_COINS,
              lastLogin: Date.now(),
            });
          } else {
            transaction.create(referredUserRef, {
              ...referredUser,
              coins: referredCoins + JEST_REFERRAL_REWARD_COINS,
            });
          }
          transaction.create(rewardRefs[index], {
            playerId,
            referredPlayerId: conversion.playerId,
            reference: conversion.reference,
            inviterCoins: JEST_REFERRAL_REWARD_COINS,
            referredCoins: JEST_REFERRAL_REWARD_COINS,
            joinedAt: conversion.joinedAt,
            grantedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
      }
      if (!verificationSnapshot.exists) {
        transaction.create(ref, {
          playerId,
          references: [...new Set(uniqueConversions.map((conversion) => conversion.reference))],
          conversionCount: uniqueConversions.length,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });
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
    captureException(error, {firebaseFunction: "verifyJestReferrals"});
    await flushSentry();
    response.status(400).json({error: rejection(error)});
  }
});

/** Creates referral key. */
function createReferralKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Indicates whether is record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Indicates whether is referral conversion. */
function isReferralConversion(value: unknown): value is {playerId: string; joinedAt: string} {
  return isRecord(value) && typeof value.playerId === "string" && value.playerId.length > 0 && typeof value.joinedAt === "string" && !Number.isNaN(Date.parse(value.joinedAt));
}

/** Provides select referral conversions behavior. */
export function selectReferralConversions(
  payload: Record<string, unknown>,
  inviterPlayerId: string,
): Array<{playerId: string; joinedAt: string; reference: JestReferralReference}> {
  const referrals = isRecord(payload.referrals) ? payload.referrals : {};
  const conversions = JEST_REWARDED_REFERRAL_REFERENCES.flatMap((reference) =>
    Array.isArray(referrals[reference])
      ? referrals[reference].filter(isReferralConversion).map((entry) => ({...entry, reference}))
      : [],
  );
  return [...new Map(
    conversions
      .filter((entry) => entry.playerId !== inviterPlayerId)
      .map((entry) => [entry.playerId, entry]),
  ).values()].slice(0, 20);
}

/** Resolves signed purchase. */
export function resolveSignedPurchase(payload: Record<string, unknown>, requestedToken: string, allowedSkus: ReadonlySet<string> = configuredSkus) {
  const candidates = Array.isArray(payload.purchases) ? payload.purchases : payload.purchase ? [payload.purchase] : [];
  const purchase = candidates.find((entry) => isRecord(entry) && entry.purchaseToken === requestedToken);
  if (!isRecord(purchase)) throw new Error("purchase-not-signed");
  const purchaseToken = purchase.purchaseToken;
  const productSku = purchase.productSku;
  if (typeof purchaseToken !== "string" || typeof productSku !== "string") throw new Error("invalid-purchase");
  if (allowedSkus.size > 0 && !allowedSkus.has(productSku)) throw new Error("invalid-sku");
  const coins = coinGrants.get(productSku);
  if (!coins) throw new Error("invalid-sku");
  return {purchaseToken, productSku, coins};
}

/** Describes verified subscription. */
type VerifiedSubscription = {
  /** Stores sku. */
  sku: string;
  /** Stores status. */
  status: "active" | "inactive";
};

/** Resolves signed subscriptions. */
export function resolveSignedSubscriptions(
  payload: Record<string, unknown>,
  allowedSkus: ReadonlySet<string> = subscriptionSkus,
): VerifiedSubscription[] {
  const candidates = Array.isArray(payload.subscriptions)
    ? payload.subscriptions
    : payload.subscription
      ? [payload.subscription]
      : [];
  return candidates.map((candidate) => {
    if (!isRecord(candidate)) throw new Error("invalid-subscription");
    const {sku, status} = candidate;
    if (
      typeof sku !== "string" ||
      (status !== "active" && status !== "inactive") ||
      !allowedSkus.has(sku)
    ) {
      throw new Error("invalid-subscription");
    }
    return {sku, status};
  });
}

/** Resolves conflicting subscription skus. */
export function resolveConflictingSubscriptionSkus(
  activeSkus: readonly string[],
  allowedSkus: ReadonlySet<string> = subscriptionSkus,
  entitlementCatalog: Readonly<Record<string, string>> = JEST_SUBSCRIPTIONS,
): string[] {
  const activeEntitlements = new Set(
    activeSkus.map((sku) => entitlementCatalog[sku]).filter((value): value is string => typeof value === "string"),
  );
  return [...allowedSkus].filter((sku) =>
    !activeSkus.includes(sku) && activeEntitlements.has(entitlementCatalog[sku]),
  );
}

/** Creates jest user. */
function createJestUser(uid: string, playerId: string): Record<string, unknown> {
  const now = Date.now();
  return {
    userId: uid,
    email: `${uid}@players.jest.invalid`,
    username: `Jest Player ${playerId.slice(-6)}`,
    coins: 300,
    hasPurchasedApp: false,
    hasActiveSubscription: false,
    createdAt: now,
    registeredAt: now,
    lastLogin: now,
    preferredLanguage: "en",
    stats: {xp: 0, level: 1, dailyPuzzlesCompleted: 0, bestStreak: 0, totalWordsGuessed: 0, winRate: 0, averageGuesses: 0, totalScore: 0, highestLevelClassic: 0, gamesPlayed: 0, wins: 0, challengeWins: 0, winStreak: 0, totalWins: 0, totalGuessesInWins: 0, totalHintsUsed: 0, multiplayerGamesPlayed: 0, multiplayerWins: 0, multiplayerChallengesCreated: 0},
    progress: {classicIndex: 1, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
    unlockedAchievements: [],
  };
}
