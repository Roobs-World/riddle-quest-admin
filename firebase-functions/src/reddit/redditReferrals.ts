import {createHash, randomBytes} from "node:crypto";
import type {Firestore} from "firebase-admin/firestore";
import {admin} from "../shared/firebaseAdmin";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {isRedditFirebaseUid} from "./redditSecurity";
import {isRedditFeatureEnabled} from "./redditFeatureFlags";
import {SUPPORTED_LOCALES, type SupportedLocale} from "@riddle-quest/core/validation";

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
  /** Stores locale. */
  locale: SupportedLocale;
  /** Stores post id. */
  postId: string;
  /** Stores environment. */
  environment: "sandbox" | "production";
}>;
/** Provides require provenance behavior. */
const requireProvenance = (
  value: RedditReferralProvenance,
): {
  /** Stores locale. */
  locale: SupportedLocale;
  /** Stores post id hash. */
  postIdHash: string;
  /** Stores environment. */
  environment: "sandbox" | "production";
} => {
  if (
    !(SUPPORTED_LOCALES as readonly string[]).includes(value.locale) ||
    !/^t3_[A-Za-z0-9_-]{1,100}$/.test(value.postId) ||
    (value.environment !== "sandbox" && value.environment !== "production")
  ) {
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
const requireStat = (value: unknown, field: string, missingValue?: number): number => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("invalid-reddit-referral-stats");
  }
  /** Older profiles may omit multiplayer counters; malformed present values remain invalid. */
  const counter = (value as Record<string, unknown>)[field];
  return requireNonNegativeInteger(`stats-${field}`, counter === undefined ? missingValue : counter);
};

/** Provides safe add behavior. */
const safeAdd = (name: string, left: number, right: number): number => {
  /** Provides value behavior. */
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
  /** Parses d. */
  const parsed = requireNonNegativeInteger(name, value);
  if (parsed > MAX_DATE_MS) throw new Error(`invalid-reddit-referral-${name}`);
  return parsed;
};

/** Provides require binding behavior. */
const requireBinding = (
  value: FirebaseFirestore.DocumentData | undefined,
  input: {
    /** Stores invitee uid. */
    inviteeUid: string; /** Stores inviter uid. */
    /** Stores inviter uid. */
    inviterUid?: string; /** Stores token id. */
    /** Stores token id. */
    tokenId?: string; /** Stores issued at ms. */
    /** Stores issued at ms. */
    issuedAtMs?: number; /** Stores expires at ms. */
    /** Stores expires at ms. */
    expiresAtMs?: number;
    /** Stores locale. */
    locale?: SupportedLocale; /** Stores post id hash. */
    /** Stores post id hash. */
    postIdHash?: string; /** Stores environment. */
    /** Stores environment. */
    environment?: "sandbox" | "production";
  },
): {
  /** Stores inviter uid. */
  inviterUid: string; /** Stores bound at ms. */
  /** Stores bound at ms. */
  boundAtMs: number; /** Stores settled at ms. */
  /** Stores settled at ms. */
  settledAtMs: number | null;
} => {
  /** Provides inviter uid behavior. */
  const inviterUid = typeof value?.inviterUid === "string" ? value.inviterUid : "";
  /** Provides token behavior. */
  const token = typeof value?.tokenId === "string" ? value.tokenId : "";
  /** Provides bound at ms behavior. */
  const boundAtMs = requireStoredClock("binding-bound-at", value?.boundAtMs);
  /** Sets tled at ms. */
  const settledAtMs = value?.settledAtMs === null ? null : requireStoredClock("binding-settled-at", value?.settledAtMs);
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
  )
    throw new Error("reddit-referral-binding-conflict");
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
  /** Solo receipt that earned this grant; absent for legacy and multiplayer settlements. */
  completionReceiptId?: string;
};

/** Creates an opaque seven-day inviter token; only its hash is persisted. */
export async function issueRedditReferralToken(
  inviterUid: string,
  now = Date.now(),
  randomToken = () => randomBytes(REDDIT_REFERRAL_TOKEN_BYTES).toString("base64url"),
  db: Firestore = admin.firestore(),
  provenance?: RedditReferralProvenance,
): Promise<{
  /** Stores token. */
  token: string; /** Stores expires at ms. */
  /** Stores expires at ms. */
  expiresAtMs: number;
}> {
  if (!isRedditFirebaseUid(inviterUid)) throw new Error("invalid-reddit-referrer");
  requireClock(now);
  /** Provides token behavior. */
  const token = randomToken();
  /** Provides id behavior. */
  const id = tokenId(token);
  /** Provides expires at ms behavior. */
  const expiresAtMs = now + REDDIT_REFERRAL_TOKEN_TTL_MS;
  /** Provides token ref behavior. */
  const tokenRef = db.collection("redditReferralTokens").doc(id);
  /** Provides trusted behavior. */
  const trusted = provenance ? requireProvenance(provenance) : undefined;
  /** Provides r ref. */
  const userRef = db.collection("users").doc(inviterUid);
  /** Provides deletion ref behavior. */
  const deletionRef = getJestAccountDeletionRef(db, inviterUid);
  await db.runTransaction(async (transaction) => {
    /** Provides [user, deletion] behavior. */
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
  /** Provides id behavior. */
  const id = tokenId(token);
  /** Provides token ref behavior. */
  const tokenRef = db.collection("redditReferralTokens").doc(id);
  /** Provides binding ref behavior. */
  const bindingRef = db.collection("redditReferralBindings").doc(inviteeUid);
  /** Provides invitee ref behavior. */
  const inviteeRef = db.collection("users").doc(inviteeUid);
  /** Provides deletion ref behavior. */
  const deletionRef = getJestAccountDeletionRef(db, inviteeUid);
  /** Provides trusted behavior. */
  const trusted = provenance ? requireProvenance(provenance) : undefined;
  return db.runTransaction(async (transaction) => {
    /** Provides [token snapshot, binding, invitee, deletion] behavior. */
    const [tokenSnapshot, binding, invitee, deletion] = await Promise.all([
      transaction.get(tokenRef),
      transaction.get(bindingRef),
      transaction.get(inviteeRef),
      transaction.get(deletionRef),
    ]);
    assertJestAccountActive(deletion);
    if (!tokenSnapshot.exists) throw new Error("reddit-referral-token-not-found");
    /** Provides token data behavior. */
    const tokenData = tokenSnapshot.data()!;
    /** Provides inviter uid behavior. */
    const inviterUid = typeof tokenData.inviterUid === "string" ? tokenData.inviterUid : "";
    if (tokenData.provider !== "reddit" || !isRedditFirebaseUid(inviterUid) || inviterUid === inviteeUid) {
      throw new Error("invalid-reddit-referrer");
    }
    /** Provides issued at ms behavior. */
    const issuedAtMs = requireStoredClock("token-issued-at", tokenData.issuedAtMs);
    /** Provides expires at ms behavior. */
    const expiresAtMs = requireStoredClock("token-expires-at", tokenData.expiresAtMs);
    if (
      trusted &&
      (tokenData.locale !== trusted.locale ||
        tokenData.postIdHash !== trusted.postIdHash ||
        tokenData.environment !== trusted.environment)
    ) {
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
    /** Provides [inviter, inviter deletion] behavior. */
    const [inviter, inviterDeletion] = await Promise.all([
      transaction.get(db.collection("users").doc(inviterUid)),
      transaction.get(getJestAccountDeletionRef(db, inviterUid)),
    ]);
    assertJestAccountActive(inviterDeletion);
    if (!inviter.exists) throw new Error("reddit-referrer-not-found");
    if (!invitee.exists) throw new Error("reddit-invitee-not-found");
    /** Provides r. */
    const user = invitee.data()!;
    /** Provides games played behavior. */
    const gamesPlayed = requireStat(user.stats, "gamesPlayed");
    /** Server-recorded solo wins can establish the referral conversion milestone. */
    const wins = requireStat(user.stats, "wins");
    if (typeof user.hasPurchasedApp !== "boolean") throw new Error("invalid-reddit-referral-purchase-state");
    if (gamesPlayed > 0 || wins > 0 || requireStat(user.stats, "multiplayerWins", 0) > 0 ||
      requireStat(user.stats, "multiplayerGamesPlayed", 0) > 0 || requireStat(user.stats, "multiplayerChallengesCreated", 0) > 0 || user.hasPurchasedApp) {
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
    transaction.set(
      db.doc(`users/${inviteeUid}/knownRivals/${inviterUid}`),
      {
        targetUserId: inviterUid,
        source: "reddit_invite",
        referralTokenId: id,
        establishedAtMs: now,
      },
      {merge: true},
    );
    transaction.set(
      db.doc(`users/${inviterUid}/knownRivals/${inviteeUid}`),
      {
        targetUserId: inviteeUid,
        source: "reddit_invite",
        referralTokenId: id,
        establishedAtMs: now,
      },
      {merge: true},
    );
    return {alreadyBound: false, expiresAtMs};
  });
}

/** Settles the two-sided reward once, after the invitee has a server-recorded first win. */
export async function settleRedditReferralAfterAuthoritativeWin(
  inviteeUid: string,
  now = Date.now(),
  db: Firestore = admin.firestore(),
  completionReceiptId?: string,
): Promise<RedditReferralSettlement> {
  if (!isRedditFeatureEnabled("referrals") || !isRedditFirebaseUid(inviteeUid)) {
    return {alreadySettled: false, inviteeCoins: 0, inviterCoins: 0};
  }
  requireClock(now);
  if (completionReceiptId !== undefined && !/^[0-9a-f]{64}$/.test(completionReceiptId)) {
    throw new Error("invalid-reddit-referral-completion-receipt");
  }
  /** Provides binding ref behavior. */
  const bindingRef = db.collection("redditReferralBindings").doc(inviteeUid);
  /** Sets tlement ref. */
  const settlementRef = db.collection("redditReferralSettlements").doc(hash("settlement", inviteeUid));
  /** Provides invitee deletion ref behavior. */
  const inviteeDeletionRef = getJestAccountDeletionRef(db, inviteeUid);
  return db.runTransaction(async (transaction) => {
    /** Provides [binding, settlement, invitee deletion] behavior. */
    const [binding, settlement, inviteeDeletion] = await Promise.all([
      transaction.get(bindingRef),
      transaction.get(settlementRef),
      transaction.get(inviteeDeletionRef),
    ]);
    if (settlement.exists) {
      /** Provides data behavior. */
      const data = settlement.data()!;
      /** Provides replay tombstone behavior. */
      const replayTombstone = data.provider === "reddit" && data.replayProtection === true;
      /** Provides active receipt behavior. */
      const activeReceipt =
        data.provider === "reddit" &&
        data.replayProtection !== true &&
        data.inviteeUid === inviteeUid &&
        typeof data.inviterUid === "string" &&
        isRedditFirebaseUid(data.inviterUid) &&
        data.inviterUid !== inviteeUid;
      if (!replayTombstone && !activeReceipt) throw new Error("reddit-referral-settlement-conflict");
      /** Provides invitee coins behavior. */
      const inviteeCoins = requireNonNegativeInteger("settlement-invitee-coins", data.inviteeCoins);
      /** Provides inviter coins behavior. */
      const inviterCoins = requireNonNegativeInteger("settlement-inviter-coins", data.inviterCoins);
      /** Persisted attribution is immutable; a later caller cannot claim an older grant. */
      const settledCompletionReceiptId: unknown = data.completionReceiptId;
      requireStoredClock("settlement-settled-at", data.settledAtMs);
      if (
        inviteeCoins !== REDDIT_REFERRAL_REWARD_COINS ||
        (inviterCoins !== 0 && inviterCoins !== REDDIT_REFERRAL_REWARD_COINS) ||
        (settledCompletionReceiptId !== undefined &&
          (typeof settledCompletionReceiptId !== "string" || !/^[0-9a-f]{64}$/.test(settledCompletionReceiptId)))
      ) {
        throw new Error("reddit-referral-settlement-conflict");
      }
      return {
        alreadySettled: true,
        inviteeCoins,
        inviterCoins,
        ...(settledCompletionReceiptId !== undefined ? {completionReceiptId: settledCompletionReceiptId} : {}),
      };
    }
    assertJestAccountActive(inviteeDeletion);
    if (!binding.exists) return {alreadySettled: false, inviteeCoins: 0, inviterCoins: 0};
    /** Provides binding data behavior. */
    const bindingData = binding.data()!;
    /** Parses d binding. */
    const parsedBinding = requireBinding(bindingData, {inviteeUid});
    if (parsedBinding.settledAtMs !== null) {
      throw new Error("reddit-referral-settlement-missing");
    }
    /** Provides inviter uid behavior. */
    const inviterUid = parsedBinding.inviterUid;
    /** Provides invitee ref behavior. */
    const inviteeRef = db.collection("users").doc(inviteeUid);
    /** Provides inviter ref behavior. */
    const inviterRef = db.collection("users").doc(inviterUid);
    /** Provides cap ref behavior. */
    const capRef = db.collection("redditReferralDailyCaps").doc(hash("cap", `${inviterUid}\0${utcDay(now)}`));
    /** Provides inviter deletion ref behavior. */
    const inviterDeletionRef = getJestAccountDeletionRef(db, inviterUid);
    /** Provides [invitee, inviter, cap, inviter deletion] behavior. */
    const [invitee, inviter, cap, inviterDeletion] = await Promise.all([
      transaction.get(inviteeRef),
      transaction.get(inviterRef),
      transaction.get(capRef),
      transaction.get(inviterDeletionRef),
    ]);
    if (!invitee.exists) throw new Error("reddit-referral-win-not-established");
    /** Server-recorded solo wins can establish the referral conversion milestone. */
    const wins = requireStat(invitee.data()?.stats, "wins");
    /** A confirmed multiplayer win also qualifies the invitee for conversion. */
    const multiplayerWins = requireStat(invitee.data()?.stats, "multiplayerWins", 0);
    if (wins < 1 && multiplayerWins < 1) {
      throw new Error("reddit-referral-win-not-established");
    }
    /** Provides cap count behavior. */
    const capCount = cap.exists ? requireNonNegativeInteger("daily-cap", cap.data()?.count) : 0;
    if (capCount > REDDIT_REFERRER_DAILY_REWARD_CAP) throw new Error("reddit-referral-cap-conflict");
    if (cap.exists && (cap.data()?.inviterUid !== inviterUid || cap.data()?.utcDay !== utcDay(now))) {
      throw new Error("reddit-referral-cap-conflict");
    }
    /** Provides inviter eligible behavior. */
    const inviterEligible = inviter.exists && !inviterDeletion.exists && capCount < REDDIT_REFERRER_DAILY_REWARD_CAP;
    /** Provides inviter coins behavior. */
    const inviterCoins = inviterEligible ? REDDIT_REFERRAL_REWARD_COINS : 0;
    /** Provides invitee balance behavior. */
    const inviteeBalance = requireNonNegativeInteger("invitee-balance", invitee.data()?.coins);
    transaction.update(inviteeRef, {
      coins: safeAdd("invitee-balance", inviteeBalance, REDDIT_REFERRAL_REWARD_COINS),
      lastLogin: now,
    });
    if (inviterEligible) {
      /** Provides inviter balance behavior. */
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
      ...(completionReceiptId !== undefined ? {completionReceiptId} : {}),
    });
    return {alreadySettled: false, inviteeCoins: REDDIT_REFERRAL_REWARD_COINS, inviterCoins,
      ...(completionReceiptId !== undefined ? {completionReceiptId} : {})};
  });
}
