import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {defineSecret} from "firebase-functions/params";
import {type Request} from "firebase-functions/v2/https";
import {logger} from "firebase-functions";
import {jestFirebaseUid, verifyJestSigned} from "./jestSecurity";
import {resolveJestConflictingSubscriptionSkus, resolveJestSignedPurchase, resolveJestSignedSubscriptions, type VerifiedJestSubscription} from "./jestProductCatalog";
import {JEST_SUBSCRIPTIONS, resolvePremiumCoinGrant} from "../../../../firebase-functions/src/shared/productCatalog";
import {ACHIEVEMENT_UNLOCK_COIN_REWARD} from "../../../../firebase-functions/src/shared/constants";
import {JEST_REFERRAL_REWARD_COINS} from "./referrals/referralCampaigns.js";
import {captureException, flushSentry} from "../../../../firebase-functions/src/shared/sentry";
import {onProtectedJsonRequestWithSentry} from "../../../../firebase-functions/src/shared/protectedJsonHttp";
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
import {assertJestAccountActive, getJestAccountDeletionRef, isJestAccountDeletionBusyError, respondToDeletedJestAccount as respondToDeletedAccount} from "../../../../firebase-functions/src/shared/accountDeletion";
import {grantJestReferralRewards} from "./jestReferralGrant";
import {deleteJestAccountGeneration} from "./jestAccountLifecycle";
import {JestIdentityDeletedError, jestIdentityRef, readJestIdentity, readActiveJestIdentity} from "./jestIdentity";
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
const jestProtectedJsonBoundary = {
  maxDecodedBodyBytes: MAX_JEST_HTTP_BODY_BYTES,
  acceptRequest: acceptJestRequest,
} satisfies Parameters<typeof onProtectedJsonRequestWithSentry>[3];
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
export function acceptJestRequest(request: Request, response: JestHttpResponse, maxRawBodyBytes = MAX_JEST_HTTP_BODY_BYTES): boolean {
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
  if (rawBody && rawBody.byteLength > maxRawBodyBytes) {
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
export const exchangeJestIdentity = onProtectedJsonRequestWithSentry(
  "exchangeJestIdentity",
  {...jestHttpOptions, minInstances: 0},
  async (request, response) => {
    try {
      const body = request.body;
      if (!isRecord(body) || (body.freshStart !== undefined && body.freshStart !== true)) throw new Error("invalid-request");
      const {freshStart, deletedUid, ...identityBody} = body;
      if (deletedUid !== undefined && !isBoundedString(deletedUid, 128)) throw new Error("invalid-request");
      if (freshStart === true && !deletedUid) throw new Error("invalid-request");
      if (freshStart !== true && deletedUid !== undefined) throw new Error("invalid-request");
      const {playerSigned} = parseJestStringBody(identityBody, {playerSigned: JEST_HTTP_INPUT_LIMITS.playerSigned});
      const player = resolveSignedJestPlayer(playerSigned);
      const firestore = admin.firestore();
      const providerRef = jestIdentityRef(firestore, player.playerId);
      const account = await firestore.runTransaction(async (transaction) => {
        const identity = readJestIdentity(await transaction.get(providerRef), player.playerId);
        const deletion = await transaction.get(getJestAccountDeletionRef(firestore, identity.uid));
        const restarting = identity.status !== "active" || deletion.exists;
        if (restarting && (freshStart !== true || deletedUid !== identity.uid ||
            deletion.get("cleanupComplete") !== true || deletion.get("cleanupLeaseId"))) {
          throw new JestIdentityDeletedError(identity.uid);
        }
        const accountGeneration = restarting ? identity.accountGeneration + 1 : identity.accountGeneration;
        const uid = jestFirebaseUid(player.playerId, accountGeneration);
        const userRef = firestore.collection("users").doc(uid);
        const userSnapshot = await transaction.get(userRef);
        if (restarting) {
          const newDeletion = await transaction.get(getJestAccountDeletionRef(firestore, uid));
          if (newDeletion.exists) throw new JestIdentityDeletedError(uid);
        }
        if (userSnapshot.exists) {
          if (player.registered && userSnapshot.get("notificationsEnabled") === undefined) {
            transaction.update(userRef, {notificationsEnabled: true});
          }
        } else {
          const user = createReservedJestUser(transaction, firestore, uid, player.playerId);
          if (player.registered) user.notificationsEnabled = true;
          transaction.create(userRef, user);
        }
        transaction.set(providerRef, {
          provider: "jest", uid, accountGeneration, status: "active",
          ...(restarting ? {lastDeletedUid: identity.uid} : identity.lastDeletedUid ? {lastDeletedUid: identity.lastDeletedUid} : {}),
          ...(identity.premiumCoinsGrantedAt === undefined ? {} : {premiumCoinsGrantedAt: identity.premiumCoinsGrantedAt}),
        });
        return {uid, accountGeneration, freshAccount: !userSnapshot.exists};
      });
      const customToken = await admin.auth().createCustomToken(account.uid, {
        jestPlayerId: player.playerId, jestRegistered: player.registered,
        jestAccountGeneration: account.accountGeneration,
      });
      if ((await getJestAccountDeletionRef(firestore, account.uid).get()).exists) {
        throw new JestIdentityDeletedError(account.uid);
      }
      response.json({customToken, ...account});
    } catch (error) {
      if (respondToDeletedJestAccount(error, response)) return;
      captureException(error, {firebaseFunction: "exchangeJestIdentity"});
      await flushSentry();
      response.status(401).json({error: rejection(error)});
    }
  },
  jestProtectedJsonBoundary,
);

/** Retries authoritative deletion from a fresh signed platform assertion without minting Firebase credentials. */
export const retryJestAccountDeletion = onProtectedJsonRequestWithSentry(
  "retryJestAccountDeletion",
  {...jestHttpOptions, timeoutSeconds: 540},
  async (request, response) => {
    try {
      const body = request.body;
      if (!isRecord(body)) throw new Error("invalid-request");
      const {deletedUid, ...deletionBody} = body;
      if (deletedUid !== undefined && !isBoundedString(deletedUid, 128)) throw new Error("invalid-request");
      const {playerSigned} = parseJestStringBody(deletionBody, {playerSigned: JEST_HTTP_INPUT_LIMITS.playerSigned});
      const player = resolveSignedJestPlayer(playerSigned);
      const result = await deleteJestAccountGeneration(player.playerId, deletedUid as string | undefined);
      response.json({accountDeleted: true, ...result});
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
  jestProtectedJsonBoundary,
);

/** Provides grant jest purchase behavior. */
export const grantJestPurchase = onProtectedJsonRequestWithSentry(
  "grantJestPurchase",
  jestHttpOptions,
  async (request, response) => {
    try {
      /** Provides {purchase signed, player id, purchase token: requested token} behavior. */
      const {
        purchaseSigned,
        playerId,
        purchaseToken: requestedToken,
        accountUid,
      } = parseJestAccountBody(request.body, {
        purchaseSigned: JEST_HTTP_INPUT_LIMITS.purchaseSigned,
        playerId: JEST_HTTP_INPUT_LIMITS.playerId,
        purchaseToken: JEST_HTTP_INPUT_LIMITS.purchaseToken,
      });
      /** Provides payload behavior. */
      const payload = verifyJestSigned(purchaseSigned, jestSharedSecret.value(), JEST_GAME_ID, playerId);
      /** Provides {purchase token, product sku, coins} behavior. */
      const {purchaseToken, productSku, coins} = resolveSignedPurchase(payload, requestedToken, configuredSkus);
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
      /** Provides already processed behavior. */
      let alreadyProcessed = false;
      /** Provides new coins behavior. */
      let newCoins = 0;
      /** Provides newly unlocked achievement ids behavior. */
      let newlyUnlockedAchievementIds: string[] = [];
      await firestore.runTransaction(async (transaction) => {
        const {uid} = await readActiveJestIdentity(firestore, transaction, playerId, accountUid);
        const userRef = firestore.collection("users").doc(uid);
        const deletionRef = getJestAccountDeletionRef(firestore, uid);
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
  jestProtectedJsonBoundary,
);

/** Provides sync jest subscriptions behavior. */
export const syncJestSubscriptions = onProtectedJsonRequestWithSentry(
  "syncJestSubscriptions",
  jestHttpOptions,
  async (request, response) => {
    try {
      /** Provides {subscriptions signed, player id} behavior. */
      const {subscriptionsSigned, playerId, accountUid} = parseJestAccountBody(request.body, {
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
      /** Provides firestore behavior. */
      const firestore = admin.firestore();
      /** Coins granted by this sync for an active Premium subscription. */
      let premiumCoinsAwarded = 0;
      /** Coin balance after this sync, when the user record is known. */
      let newCoins = 0;
      await firestore.runTransaction(async (transaction) => {
        const identity = await readActiveJestIdentity(firestore, transaction, playerId, accountUid);
        const {uid} = identity;
        const userRef = firestore.collection("users").doc(uid);
        const deletionRef = getJestAccountDeletionRef(firestore, uid);
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
        const lastGrant = Math.max(identity.premiumCoinsGrantedAt ?? 0,
          typeof user.premiumCoinsGrantedAt === "number" && Number.isFinite(user.premiumCoinsGrantedAt) ? user.premiumCoinsGrantedAt : 0);
        premiumCoinsAwarded = resolvePremiumCoinGrant(activeSkus.length > 0, lastGrant || undefined, now);
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
        if (premiumCoinsAwarded > 0 || lastGrant > 0) {
          transaction.set(jestIdentityRef(firestore, playerId), {
            provider: "jest", ...identity,
            premiumCoinsGrantedAt: premiumCoinsAwarded > 0 ? now : lastGrant,
          });
        }
      });
      response.json({verified: true, activeSkus, blockedSkus, premiumCoinsAwarded, newCoins});
    } catch (error) {
      if (respondToDeletedJestAccount(error, response)) return;
      captureException(error, {firebaseFunction: "syncJestSubscriptions"});
      await flushSentry();
      response.status(400).json({error: rejection(error)});
    }
  },
  jestProtectedJsonBoundary,
);

/** Provides verify jest referrals behavior. */
export const verifyJestReferrals = onProtectedJsonRequestWithSentry(
  "verifyJestReferrals",
  jestHttpOptions,
  async (request, response) => {
    try {
      /** Provides {referrals signed, player id} behavior. */
      const {referralsSigned, playerId, accountUid} = parseJestAccountBody(request.body, {
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
        accountUid,
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
  jestProtectedJsonBoundary,
);

function parseJestAccountBody<Field extends string>(body: unknown, limits: Readonly<Record<Field, number>>) {
  if (!isRecord(body)) throw new Error("invalid-request");
  const {accountUid, ...payload} = body;
  if (accountUid !== undefined && !isBoundedString(accountUid, 128)) throw new Error("invalid-request");
  return {...parseJestStringBody(payload, limits), accountUid: accountUid as string | undefined};
}

function respondToDeletedJestAccount(error: unknown, response: JestHttpResponse): boolean {
  if (error instanceof JestIdentityDeletedError) {
    response.status(409).json({error: "account-deleted", deletedUid: error.deletedUid});
    return true;
  }
  return respondToDeletedAccount(error, response);
}

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
