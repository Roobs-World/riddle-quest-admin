import {admin} from "./firebaseAdmin";
import {defineSecret} from "firebase-functions/params";
import {onRequest} from "firebase-functions/v2/https";
import {logger} from "firebase-functions";
import {jestFirebaseUid, verifyJestSigned} from "./jestSecurity";
import {JEST_COIN_PRODUCTS, JEST_SUBSCRIPTIONS} from "./jestProductCatalog";
import {createHash} from "node:crypto";
import {ACHIEVEMENT_UNLOCK_COIN_REWARD} from "./constants";

const jestSharedSecret = defineSecret("JEST_SHARED_SECRET");
const JEST_GAME_ID = process.env.JEST_GAME_ID ?? "riddle-quest";
const configuredSkus = new Set((process.env.JEST_PRODUCT_SKUS ?? "").split(",").filter(Boolean));
const configuredSubscriptionSkus = new Set(
  (process.env.JEST_SUBSCRIPTION_SKUS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
);
const coinGrants = new Map(Object.entries(JEST_COIN_PRODUCTS));
const trustedSubscriptionSkus = new Set(Object.keys(JEST_SUBSCRIPTIONS));
const subscriptionSkus = configuredSubscriptionSkus.size > 0
  ? new Set([...configuredSubscriptionSkus].filter((sku) => trustedSubscriptionSkus.has(sku)))
  : trustedSubscriptionSkus;
const REFERRAL_REFERENCE = "riddle_quest_friend_challenge_v2";
const REFERRAL_REWARD_COINS = 100;
const attempts = new Map<string, {count: number; resetAt: number}>();

function allowRequest(ip: string): boolean {
  const now = Date.now();
  const current = attempts.get(ip);
  if (!current || current.resetAt <= now) { attempts.set(ip, {count: 1, resetAt: now + 60_000}); return true; }
  current.count += 1;
  return current.count <= 30;
}

export function applyJestCors(response: {set(name: string, value: string): unknown}, origin?: string) {
  const allowedOrigins = new Set((process.env.JEST_GAME_ORIGIN ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  const corsGameId = process.env.JEST_GAME_ID ?? JEST_GAME_ID;
  if (corsGameId) allowedOrigins.add(`https://${corsGameId}.builds.jest.com`);
  if (origin && allowedOrigins.has(origin)) response.set("Access-Control-Allow-Origin", origin);
  response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.set("Access-Control-Allow-Headers", "Content-Type");
  response.set("Access-Control-Max-Age", "3600");
  response.set("Vary", "Origin");
  response.set("Cache-Control", "no-store");
}

function rejection(error: unknown) {
  const reason = error instanceof Error ? error.message : "invalid-request";
  logger.warn("Rejected Jest platform request", {reason});
  return reason;
}

export const exchangeJestIdentity = onRequest({secrets: [jestSharedSecret]}, async (request, response) => {
  applyJestCors(response, request.get("origin"));
  if (request.method === "OPTIONS") { response.status(204).send(""); return; }
  if (request.method !== "POST" || !allowRequest(request.ip ?? "unknown")) { response.status(429).json({error: "rate-limited"}); return; }
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
  } catch (error) { response.status(401).json({error: rejection(error)}); }
});

export const grantJestPurchase = onRequest({secrets: [jestSharedSecret]}, async (request, response) => {
  applyJestCors(response, request.get("origin"));
  if (request.method === "OPTIONS") { response.status(204).send(""); return; }
  if (request.method !== "POST" || !allowRequest(request.ip ?? "unknown")) { response.status(429).json({error: "rate-limited"}); return; }
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
  } catch (error) { response.status(400).json({error: rejection(error)}); }
});

export const syncJestSubscriptions = onRequest({secrets: [jestSharedSecret]}, async (request, response) => {
  applyJestCors(response, request.get("origin"));
  if (request.method === "OPTIONS") { response.status(204).send(""); return; }
  if (request.method !== "POST" || !allowRequest(request.ip ?? "unknown")) {
    response.status(429).json({error: "rate-limited"});
    return;
  }
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
    response.status(400).json({error: rejection(error)});
  }
});

export const verifyJestReferrals = onRequest({secrets: [jestSharedSecret]}, async (request, response) => {
  applyJestCors(response, request.get("origin"));
  if (request.method === "OPTIONS") { response.status(204).send(""); return; }
  if (request.method !== "POST" || !allowRequest(request.ip ?? "unknown")) { response.status(429).json({error: "rate-limited"}); return; }
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
        createReferralKey(`${playerId}:${REFERRAL_REFERENCE}:${conversion.playerId}`),
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
      newCoins = currentCoins + rewardsGranted * REFERRAL_REWARD_COINS;
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
              coins: referredCoins + REFERRAL_REWARD_COINS,
              lastLogin: Date.now(),
            });
          } else {
            transaction.create(referredUserRef, {
              ...referredUser,
              coins: referredCoins + REFERRAL_REWARD_COINS,
            });
          }
          transaction.create(rewardRefs[index], {
            playerId,
            referredPlayerId: conversion.playerId,
            reference: REFERRAL_REFERENCE,
            inviterCoins: REFERRAL_REWARD_COINS,
            referredCoins: REFERRAL_REWARD_COINS,
            joinedAt: conversion.joinedAt,
            grantedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
      }
      if (!verificationSnapshot.exists) transaction.create(ref, {playerId, reference: REFERRAL_REFERENCE, conversionCount: uniqueConversions.length, verifiedAt: admin.firestore.FieldValue.serverTimestamp()});
    });
    response.json({
      verified: true,
      reference: REFERRAL_REFERENCE,
      conversionCount: uniqueConversions.length,
      rewardsGranted,
      referredRewardsGranted: rewardsGranted,
      coinsPerPlayer: REFERRAL_REWARD_COINS,
      newCoins,
    });
  } catch (error) { response.status(400).json({error: rejection(error)}); }
});

function createReferralKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReferralConversion(value: unknown): value is {playerId: string; joinedAt: string} {
  return isRecord(value) && typeof value.playerId === "string" && value.playerId.length > 0 && typeof value.joinedAt === "string" && !Number.isNaN(Date.parse(value.joinedAt));
}

export function selectReferralConversions(
  payload: Record<string, unknown>,
  inviterPlayerId: string,
): Array<{playerId: string; joinedAt: string}> {
  const referrals = isRecord(payload.referrals) ? payload.referrals : {};
  const conversions = Array.isArray(referrals[REFERRAL_REFERENCE])
    ? referrals[REFERRAL_REFERENCE].filter(isReferralConversion)
    : [];
  return [...new Map(
    conversions
      .filter((entry) => entry.playerId !== inviterPlayerId)
      .map((entry) => [entry.playerId, entry]),
  ).values()].slice(0, 20);
}

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

type VerifiedSubscription = {
  sku: string;
  status: "active" | "inactive";
};

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
    stats: {xp: 0, level: 1, dailyPuzzlesCompleted: 0, bestStreak: 0, totalWordsGuessed: 0, winRate: 0, averageGuesses: 0, totalScore: 0, highestLevelClassic: 0, gamesPlayed: 0, wins: 0, challengeWins: 0, winStreak: 0, totalWins: 0, totalGuessesInWins: 0, totalHintsUsed: 0},
    progress: {classicIndex: 1, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
    unlockedAchievements: [],
  };
}
