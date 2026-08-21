import {createHash, randomBytes} from "node:crypto";
import type {Firestore} from "firebase-admin/firestore";
import {admin} from "../shared/firebaseAdmin";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {isRedditFirebaseUid} from "./redditSecurity";
import {isRedditFeatureEnabled} from "./redditFeatureFlags";
import {SUPPORTED_LOCALES, type SupportedLocale} from "@qwordly/core/validation";

/** Defines the reddit referral reward coins value. */
export const REDDIT_REFERRAL_REWARD_COINS = 100;
/** Defines the reddit referral token ttl ms value. */
export const REDDIT_REFERRAL_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
/** Defines the reddit referrer daily reward cap value. */
export const REDDIT_REFERRER_DAILY_REWARD_CAP = 5;
/** Defines the reddit referral token bytes value. */
const REDDIT_REFERRAL_TOKEN_BYTES = 32;
/** Defines the max date ms value. */
const MAX_DATE_MS = 8_640_000_000_000_000;

/** Provides hash behavior. */
const hash = (domain: string, value: string) =>
  createHash("sha256").update(`riddle-quest\0reddit-referral\0${domain}\0${value}`).digest("hex");

/** Describes reddit referral provenance. */
export type RedditReferralProvenance = Readonly<{
  locale: SupportedLocale;
  postId: string;
  environment: "sandbox" | "production";
}>;
/** Provides require provenance behavior. */
const requireProvenance = (value: RedditReferralProvenance): {
  locale: SupportedLocale;
  postIdHash: string;
  environment: "sandbox" | "production";
} => {
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(value.locale) ||
    !/^t3_[A-Za-z0-9_-]{1,100}$/.test(value.postId) ||
    (value.environment !== "sandbox" && value.environment !== "production")) {
    throw new Error("invalid-reddit-referral-provenance");
  }
  return {locale: value.locale, postIdHash: hash("post", value.postId), environment: value.environment};
};

/** Provides token id behavior. */
const tokenId = (token: string): string => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("invalid-reddit-referral-token");
  return hash("token", token);
};

/** Provides require non negative integer behavior. */
const requireNonNegativeInteger = (name: string, value: unknown): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`invalid-reddit-referral-${name}`);
  }
  return value;
};

/** Provides require stat behavior. */
const requireStat = (value: unknown, field: string): number => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("invalid-reddit-referral-stats");
  }
  return requireNonNegativeInteger(`stats-${field}`, (value as Record<string, unknown>)[field]);
};

/** Provides safe add behavior. */
const safeAdd = (name: string, left: number, right: number): number => {
  const value = left + right;
  if (!Number.isSafeInteger(value)) throw new Error(`invalid-reddit-referral-${name}`);
  return value;
};

/** Provides require clock behavior. */
const requireClock = (now: number): void => {
  if (!Number.isSafeInteger(now) || now < 0 || now > MAX_DATE_MS - REDDIT_REFERRAL_TOKEN_TTL_MS) {
    throw new Error("invalid-reddit-referral-time");
  }
};

/** Provides require stored clock behavior. */
const requireStoredClock = (name: string, value: unknown): number => {
  const parsed = requireNonNegativeInteger(name, value);
  if (parsed > MAX_DATE_MS) throw new Error(`invalid-reddit-referral-${name}`);
  return parsed;
};

/** Provides require binding behavior. */
const requireBinding = (
  value: FirebaseFirestore.DocumentData | undefined,
  input: {inviteeUid: string; inviterUid?: string; tokenId?: string; issuedAtMs?: number; expiresAtMs?: number;
    locale?: SupportedLocale; postIdHash?: string; environment?: "sandbox" | "production"},
): {inviterUid: string; boundAtMs: number; settledAtMs: number | null} => {
  const inviterUid = typeof value?.inviterUid === "string" ? value.inviterUid : "";
  const token = typeof value?.tokenId === "string" ? value.tokenId : "";
  const boundAtMs = requireStoredClock("binding-bound-at", value?.boundAtMs);
  const settledAtMs = value?.settledAtMs === null
    ? null
    : requireStoredClock("binding-settled-at", value?.settledAtMs);
  if (
    value?.provider !== "reddit" ||
    value.inviteeUid !== input.inviteeUid ||
    !isRedditFirebaseUid(inviterUid) ||
    inviterUid === input.inviteeUid ||
    !/^[0-9a-f]{64}$/.test(token) ||
    (input.inviterUid !== undefined && inviterUid !== input.inviterUid) ||
    (input.tokenId !== undefined && token !== input.tokenId) ||
    (input.issuedAtMs !== undefined && boundAtMs < input.issuedAtMs) ||
    (input.expiresAtMs !== undefined && boundAtMs >= input.expiresAtMs) ||
    (input.locale !== undefined && value.locale !== input.locale) ||
    (input.postIdHash !== undefined && value.postIdHash !== input.postIdHash) ||
    (input.environment !== undefined && value.environment !== input.environment) ||
    (settledAtMs !== null && settledAtMs < boundAtMs)
  ) throw new Error("reddit-referral-binding-conflict");
  return {inviterUid, boundAtMs, settledAtMs};
};

/** Provides utc day behavior. */
const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Describes reddit referral binding result. */
export type RedditReferralBindingResult = {
  /** Stores already bound. */
  alreadyBound: boolean;
  /** Stores expires at ms. */
  expiresAtMs: number;
};

/** Describes reddit referral settlement. */
export type RedditReferralSettlement = {
  /** Stores already settled. */
  alreadySettled: boolean;
  /** Stores invitee coins. */
  inviteeCoins: number;
  /** Stores inviter coins. */
  inviterCoins: number;
};

/** Creates an opaque seven-day inviter token; only its hash is persisted. */
export async function issueRedditReferralToken(
  inviterUid: string,
  now = Date.now(),
  randomToken = () => randomBytes(REDDIT_REFERRAL_TOKEN_BYTES).toString("base64url"),
  db: Firestore = admin.firestore(),
  provenance?: RedditReferralProvenance,
): Promise<{token: string; expiresAtMs: number}> {
  if (!isRedditFirebaseUid(inviterUid)) throw new Error("invalid-reddit-referrer");
  requireClock(now);
  const token = randomToken();
  const id = tokenId(token);
  const expiresAtMs = now + REDDIT_REFERRAL_TOKEN_TTL_MS;
  const tokenRef = db.collection("redditReferralTokens").doc(id);
  const trusted = provenance ? requireProvenance(provenance) : undefined;
  const userRef = db.collection("users").doc(inviterUid);
  const deletionRef = getJestAccountDeletionRef(db, inviterUid);
  await db.runTransaction(async (transaction) => {
    const [user, deletion] = await Promise.all([transaction.get(userRef), transaction.get(deletionRef)]);
    assertJestAccountActive(deletion);
    if (!user.exists) throw new Error("reddit-referrer-not-found");
    transaction.create(tokenRef, {
      provider: "reddit",
      inviterUid,
      issuedAtMs: now,
      expiresAtMs,
      ...(trusted ?? {}),
    });
  });
  return {token, expiresAtMs};
}

/** Permanently binds one brand-new Reddit player to the token's inviter. */
export async function bindRedditReferralToken(
  inviteeUid: string,
  token: string,
  now = Date.now(),
  db: Firestore = admin.firestore(),
  provenance?: RedditReferralProvenance,
): Promise<RedditReferralBindingResult> {
  if (!isRedditFirebaseUid(inviteeUid)) throw new Error("invalid-reddit-invitee");
  requireClock(now);
  const id = tokenId(token);
  const tokenRef = db.collection("redditReferralTokens").doc(id);
  const bindingRef = db.collection("redditReferralBindings").doc(inviteeUid);
  const inviteeRef = db.collection("users").doc(inviteeUid);
  const deletionRef = getJestAccountDeletionRef(db, inviteeUid);
  const trusted = provenance ? requireProvenance(provenance) : undefined;
  return db.runTransaction(async (transaction) => {
    const [tokenSnapshot, binding, invitee, deletion] = await Promise.all([
      transaction.get(tokenRef),
      transaction.get(bindingRef),
      transaction.get(inviteeRef),
      transaction.get(deletionRef),
    ]);
    assertJestAccountActive(deletion);
    if (!tokenSnapshot.exists) throw new Error("reddit-referral-token-not-found");
    const tokenData = tokenSnapshot.data()!;
    const inviterUid = typeof tokenData.inviterUid === "string" ? tokenData.inviterUid : "";
    if (tokenData.provider !== "reddit" || !isRedditFirebaseUid(inviterUid) || inviterUid === inviteeUid) {
      throw new Error("invalid-reddit-referrer");
    }
    const issuedAtMs = requireStoredClock("token-issued-at", tokenData.issuedAtMs);
    const expiresAtMs = requireStoredClock("token-expires-at", tokenData.expiresAtMs);
    if (trusted && (tokenData.locale !== trusted.locale || tokenData.postIdHash !== trusted.postIdHash ||
      tokenData.environment !== trusted.environment)) {
      throw new Error("reddit-referral-provenance-mismatch");
    }
    if (expiresAtMs !== issuedAtMs + REDDIT_REFERRAL_TOKEN_TTL_MS) {
      throw new Error("invalid-reddit-referral-token-window");
    }
    if (binding.exists) {
      try {
        requireBinding(binding.data(), {inviteeUid, inviterUid, tokenId: id, issuedAtMs, expiresAtMs, ...trusted});
      } catch {
        throw new Error("reddit-referrer-already-bound");
      }
      return {alreadyBound: true, expiresAtMs};
    }
    if (expiresAtMs <= now || issuedAtMs > now) {
      throw new Error("reddit-referral-token-expired");
    }
    const [inviter, inviterDeletion] = await Promise.all([
      transaction.get(db.collection("users").doc(inviterUid)),
      transaction.get(getJestAccountDeletionRef(db, inviterUid)),
    ]);
    assertJestAccountActive(inviterDeletion);
    if (!inviter.exists) throw new Error("reddit-referrer-not-found");
    if (!invitee.exists) throw new Error("reddit-invitee-not-found");
    const user = invitee.data()!;
    const gamesPlayed = requireStat(user.stats, "gamesPlayed");
    const wins = requireStat(user.stats, "wins");
    if (typeof user.hasPurchasedApp !== "boolean") throw new Error("invalid-reddit-referral-purchase-state");
    if (gamesPlayed > 0 || wins > 0 || user.hasPurchasedApp) {
      throw new Error("reddit-invitee-already-established");
    }
    transaction.create(bindingRef, {
      provider: "reddit",
      inviteeUid,
      inviterUid,
      tokenId: id,
      boundAtMs: now,
      settledAtMs: null,
      ...(trusted ?? {}),
    });
    transaction.set(db.doc(`users/${inviteeUid}/knownRivals/${inviterUid}`), {
      targetUserId: inviterUid,
      source: "reddit_invite",
      referralTokenId: id,
      establishedAtMs: now,
    }, {merge: true});
    transaction.set(db.doc(`users/${inviterUid}/knownRivals/${inviteeUid}`), {
      targetUserId: inviteeUid,
      source: "reddit_invite",
      referralTokenId: id,
      establishedAtMs: now,
    }, {merge: true});
    return {alreadyBound: false, expiresAtMs};
  });
}

/** Settles the two-sided reward once, after the invitee has a server-recorded first win. */
export async function settleRedditReferralAfterAuthoritativeWin(
  inviteeUid: string,
  now = Date.now(),
  db: Firestore = admin.firestore(),
): Promise<RedditReferralSettlement> {
  if (!isRedditFeatureEnabled("referrals") || !isRedditFirebaseUid(inviteeUid)) {
    return {alreadySettled: false, inviteeCoins: 0, inviterCoins: 0};
  }
  requireClock(now);
  const bindingRef = db.collection("redditReferralBindings").doc(inviteeUid);
  const settlementRef = db.collection("redditReferralSettlements").doc(hash("settlement", inviteeUid));
  const inviteeDeletionRef = getJestAccountDeletionRef(db, inviteeUid);
  return db.runTransaction(async (transaction) => {
    const [binding, settlement, inviteeDeletion] = await Promise.all([
      transaction.get(bindingRef),
      transaction.get(settlementRef),
      transaction.get(inviteeDeletionRef),
    ]);
    if (settlement.exists) {
      const data = settlement.data()!;
      const replayTombstone = data.provider === "reddit" && data.replayProtection === true;
      const activeReceipt = data.provider === "reddit" &&
        data.replayProtection !== true &&
        data.inviteeUid === inviteeUid &&
        typeof data.inviterUid === "string" &&
        isRedditFirebaseUid(data.inviterUid) &&
        data.inviterUid !== inviteeUid;
      if (!replayTombstone && !activeReceipt) throw new Error("reddit-referral-settlement-conflict");
      const inviteeCoins = requireNonNegativeInteger("settlement-invitee-coins", data.inviteeCoins);
      const inviterCoins = requireNonNegativeInteger("settlement-inviter-coins", data.inviterCoins);
      requireStoredClock("settlement-settled-at", data.settledAtMs);
      if (
        inviteeCoins !== REDDIT_REFERRAL_REWARD_COINS ||
        (inviterCoins !== 0 && inviterCoins !== REDDIT_REFERRAL_REWARD_COINS)
      ) {
        throw new Error("reddit-referral-settlement-conflict");
      }
      return {
        alreadySettled: true,
        inviteeCoins,
        inviterCoins,
      };
    }
    assertJestAccountActive(inviteeDeletion);
    if (!binding.exists) return {alreadySettled: false, inviteeCoins: 0, inviterCoins: 0};
    const bindingData = binding.data()!;
    const parsedBinding = requireBinding(bindingData, {inviteeUid});
    if (parsedBinding.settledAtMs !== null) {
      throw new Error("reddit-referral-settlement-missing");
    }
    const inviterUid = parsedBinding.inviterUid;
    const inviteeRef = db.collection("users").doc(inviteeUid);
    const inviterRef = db.collection("users").doc(inviterUid);
    const capRef = db.collection("redditReferralDailyCaps").doc(hash("cap", `${inviterUid}\0${utcDay(now)}`));
    const inviterDeletionRef = getJestAccountDeletionRef(db, inviterUid);
    const [invitee, inviter, cap, inviterDeletion] = await Promise.all([
      transaction.get(inviteeRef),
      transaction.get(inviterRef),
      transaction.get(capRef),
      transaction.get(inviterDeletionRef),
    ]);
    if (!invitee.exists || requireStat(invitee.data()?.stats, "wins") < 1) {
      throw new Error("reddit-referral-win-not-established");
    }
    const capCount = cap.exists ? requireNonNegativeInteger("daily-cap", cap.data()?.count) : 0;
    if (capCount > REDDIT_REFERRER_DAILY_REWARD_CAP) throw new Error("reddit-referral-cap-conflict");
    if (cap.exists && (cap.data()?.inviterUid !== inviterUid || cap.data()?.utcDay !== utcDay(now))) {
      throw new Error("reddit-referral-cap-conflict");
    }
    const inviterEligible = inviter.exists && !inviterDeletion.exists && capCount < REDDIT_REFERRER_DAILY_REWARD_CAP;
    const inviterCoins = inviterEligible ? REDDIT_REFERRAL_REWARD_COINS : 0;
    const inviteeBalance = requireNonNegativeInteger("invitee-balance", invitee.data()?.coins);
    transaction.update(inviteeRef, {
      coins: safeAdd("invitee-balance", inviteeBalance, REDDIT_REFERRAL_REWARD_COINS),
      lastLogin: now,
    });
    if (inviterEligible) {
      const inviterBalance = requireNonNegativeInteger("inviter-balance", inviter.data()?.coins);
      transaction.update(inviterRef, {
        coins: safeAdd("inviter-balance", inviterBalance, inviterCoins),
        lastLogin: now,
      });
      transaction.set(capRef, {inviterUid, utcDay: utcDay(now), count: capCount + 1});
    }
    transaction.update(bindingRef, {settledAtMs: now});
    transaction.create(settlementRef, {
      provider: "reddit",
      inviteeUid,
      inviterUid,
      inviteeCoins: REDDIT_REFERRAL_REWARD_COINS,
      inviterCoins,
      settledAtMs: now,
    });
    return {alreadySettled: false, inviteeCoins: REDDIT_REFERRAL_REWARD_COINS, inviterCoins};
  });
}
