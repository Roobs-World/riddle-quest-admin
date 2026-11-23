import {createHash, randomBytes} from "node:crypto";
import type {Firestore} from "firebase-admin/firestore";
import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../../../../firebase-functions/src/shared/accountDeletion";
import {isFacebookFirebaseUid} from "./facebookSecurity";
import {isFacebookFeatureEnabled} from "./facebookFeatureFlags";

/** Defines the facebook referral reward coins value. */
export const FACEBOOK_REFERRAL_REWARD_COINS = 100;
/** Defines the facebook referral token ttl ms value. */
export const FACEBOOK_REFERRAL_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
/** Defines the facebook referrer daily reward cap value. */
export const FACEBOOK_REFERRER_DAILY_REWARD_CAP = 5;
/** Defines the facebook referral token bytes value. */
const FACEBOOK_REFERRAL_TOKEN_BYTES = 32;
/** Defines the max date ms value. */
const MAX_DATE_MS = 253_402_300_799_999;

/** Provides hash behavior. */
const hash = (domain: string, value: string) =>
  createHash("sha256").update(`riddle-quest\0facebook-referral\0${domain}\0${value}`).digest("hex");

/** Provides token id behavior. */
const tokenId = (token: string): string => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("invalid-facebook-referral-token");
  return hash("token", token);
};

/** Provides require non negative integer behavior. */
const requireNonNegativeInteger = (name: string, value: unknown): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`invalid-facebook-referral-${name}`);
  }
  return value;
};

/** Provides require stat behavior. */
const requireStat = (value: unknown, field: string, missingValue?: number): number => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("invalid-facebook-referral-stats");
  }
  /** Older profiles may predate multiplayer counters; malformed present values still fail closed. */
  const counter = (value as Record<string, unknown>)[field];
  return requireNonNegativeInteger(`stats-${field}`, counter === undefined ? missingValue : counter);
};

/** Provides safe add behavior. */
const safeAdd = (name: string, left: number, right: number): number => {
  /** Provides value behavior. */
  const value = left + right;
  if (!Number.isSafeInteger(value)) throw new Error(`invalid-facebook-referral-${name}`);
  return value;
};

/** Provides require clock behavior. */
const requireClock = (now: number): void => {
  if (!Number.isSafeInteger(now) || now < 0 || now > MAX_DATE_MS - FACEBOOK_REFERRAL_TOKEN_TTL_MS) {
    throw new Error("invalid-facebook-referral-time");
  }
};

/** Provides require stored clock behavior. */
const requireStoredClock = (name: string, value: unknown): number => {
  /** Parses d. */
  const parsed = requireNonNegativeInteger(name, value);
  if (parsed > MAX_DATE_MS) throw new Error(`invalid-facebook-referral-${name}`);
  return parsed;
};

/** Provides require binding behavior. */
export const requireFacebookReferralBinding = (
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
  /** New bindings retain the invitation window after temporary token rows expire. */
  const hasWindow = value?.tokenIssuedAtMs !== undefined || value?.tokenExpiresAtMs !== undefined;
  if (hasWindow) {
    /** Validated server-issued window, never inferred from a client retry clock. */
    const issued = requireStoredClock("binding-token-issued-at", value?.tokenIssuedAtMs);
    /** Seven-day logical expiry remains independent of asynchronous physical deletion. */
    const expires = requireStoredClock("binding-token-expires-at", value?.tokenExpiresAtMs);
    if (expires !== issued + FACEBOOK_REFERRAL_TOKEN_TTL_MS || boundAtMs < issued || boundAtMs >= expires ||
      input.issuedAtMs !== undefined && input.issuedAtMs !== issued || input.expiresAtMs !== undefined && input.expiresAtMs !== expires)
      throw new Error("facebook-referral-binding-conflict");
  }
  if (
    value?.provider !== "facebook" ||
    value.inviteeUid !== input.inviteeUid ||
    !isFacebookFirebaseUid(inviterUid) ||
    inviterUid === input.inviteeUid ||
    !/^[0-9a-f]{64}$/.test(token) ||
    (input.inviterUid !== undefined && inviterUid !== input.inviterUid) ||
    (input.tokenId !== undefined && token !== input.tokenId) ||
    (input.issuedAtMs !== undefined && boundAtMs < input.issuedAtMs) ||
    (input.expiresAtMs !== undefined && boundAtMs >= input.expiresAtMs) ||
    (settledAtMs !== null && settledAtMs < boundAtMs)
  )
    throw new Error("facebook-referral-binding-conflict");
  return {inviterUid, boundAtMs, settledAtMs};
};

/** Validates retained legacy/current invitation rows before binding or retention backfill. */
export function readFacebookReferralTokenRecord(value: FirebaseFirestore.DocumentData | undefined): {
  /** Canonical inviter account. */
  inviterUid: string;
  /** Original issue clock in milliseconds. */
  issuedAtMs: number;
  /** Exact seven-day expiry in milliseconds. */
  expiresAtMs: number;
} {
  if (value?.provider !== "facebook" || !isFacebookFirebaseUid(value.inviterUid)) throw new Error("invalid-facebook-referrer");
  /** Both clocks remain inside Firestore's timestamp range. */
  const issuedAtMs = requireStoredClock("token-issued-at", value.issuedAtMs);
  /** Logical expiry is authoritative even if a TTL worker has not deleted the row yet. */
  const expiresAtMs = requireStoredClock("token-expires-at", value.expiresAtMs);
  if (expiresAtMs !== issuedAtMs + FACEBOOK_REFERRAL_TOKEN_TTL_MS) throw new Error("invalid-facebook-referral-token-window");
  if (value.expiresAt !== undefined && (!(value.expiresAt instanceof admin.firestore.Timestamp) || value.expiresAt.toMillis() !== expiresAtMs))
    throw new Error("invalid-facebook-referral-token-retention");
  return {inviterUid: value.inviterUid, issuedAtMs, expiresAtMs};
}

/** Provides utc day behavior. */
const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Describes facebook referral binding result. */
export type FacebookReferralBindingResult = {
  /** Stores already bound. */
  alreadyBound: boolean;
  /** Stores expires at ms. */
  expiresAtMs: number;
};

/** Describes facebook referral settlement. */
export type FacebookReferralSettlement = {
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
export async function issueFacebookReferralToken(
  inviterUid: string,
  now = Date.now(),
  randomToken = () => randomBytes(FACEBOOK_REFERRAL_TOKEN_BYTES).toString("base64url"),
  db: Firestore = admin.firestore(),
): Promise<{
  /** Stores token. */
  token: string; /** Stores expires at ms. */
  /** Stores expires at ms. */
  expiresAtMs: number;
}> {
  if (!isFacebookFirebaseUid(inviterUid)) throw new Error("invalid-facebook-referrer");
  requireClock(now);
  /** Provides token behavior. */
  const token = randomToken();
  /** Provides id behavior. */
  const id = tokenId(token);
  /** Provides expires at ms behavior. */
  const expiresAtMs = now + FACEBOOK_REFERRAL_TOKEN_TTL_MS;
  /** Provides token ref behavior. */
  const tokenRef = db.collection("facebookReferralTokens").doc(id);
  /** Provides r ref. */
  const userRef = db.collection("users").doc(inviterUid);
  /** Provides deletion ref behavior. */
  const deletionRef = getJestAccountDeletionRef(db, inviterUid);
  await db.runTransaction(async (transaction) => {
    /** Provides [user, deletion] behavior. */
    const [user, deletion] = await Promise.all([transaction.get(userRef), transaction.get(deletionRef)]);
    assertJestAccountActive(deletion);
    if (!user.exists) throw new Error("facebook-referrer-not-found");
    transaction.create(tokenRef, {
      provider: "facebook",
      inviterUid,
      issuedAtMs: now,
      expiresAtMs,
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    });
  });
  return {token, expiresAtMs};
}

/** Permanently binds one brand-new Facebook player to the token's inviter. */
export async function bindFacebookReferralToken(
  inviteeUid: string,
  token: string,
  now = Date.now(),
  db: Firestore = admin.firestore(),
): Promise<FacebookReferralBindingResult> {
  if (!isFacebookFirebaseUid(inviteeUid)) throw new Error("invalid-facebook-invitee");
  requireClock(now);
  /** Provides id behavior. */
  const id = tokenId(token);
  /** Provides token ref behavior. */
  const tokenRef = db.collection("facebookReferralTokens").doc(id);
  /** Provides binding ref behavior. */
  const bindingRef = db.collection("facebookReferralBindings").doc(inviteeUid);
  /** Provides invitee ref behavior. */
  const inviteeRef = db.collection("users").doc(inviteeUid);
  /** Provides deletion ref behavior. */
  const deletionRef = getJestAccountDeletionRef(db, inviteeUid);
  return db.runTransaction(async (transaction) => {
    /** Provides [token snapshot, binding, invitee, deletion] behavior. */
    const [tokenSnapshot, binding, invitee, deletion] = await Promise.all([
      transaction.get(tokenRef),
      transaction.get(bindingRef),
      transaction.get(inviteeRef),
      transaction.get(deletionRef),
    ]);
    assertJestAccountActive(deletion);
    if (!tokenSnapshot.exists) {
      if (!binding.exists) throw new Error("facebook-referral-token-not-found");
      /** A permanent matching receipt makes a completed bind retryable after TTL deletion. */
      requireFacebookReferralBinding(binding.data(), {inviteeUid, tokenId: id});
      if (binding.data()?.tokenIssuedAtMs === undefined) throw new Error("facebook-referral-token-not-found");
      return {alreadyBound: true, expiresAtMs: requireStoredClock("binding-token-expires-at", binding.data()?.tokenExpiresAtMs)};
    }
    /** Provides token data behavior. */
    const tokenData = readFacebookReferralTokenRecord(tokenSnapshot.data());
    /** Provides inviter uid behavior. */
    const inviterUid = tokenData.inviterUid;
    if (inviterUid === inviteeUid) {
      throw new Error("invalid-facebook-referrer");
    }
    /** Provides issued at ms behavior. */
    const issuedAtMs = requireStoredClock("token-issued-at", tokenData.issuedAtMs);
    /** Provides expires at ms behavior. */
    const expiresAtMs = requireStoredClock("token-expires-at", tokenData.expiresAtMs);
    if (expiresAtMs !== issuedAtMs + FACEBOOK_REFERRAL_TOKEN_TTL_MS) {
      throw new Error("invalid-facebook-referral-token-window");
    }
    if (binding.exists) {
      try {
        requireFacebookReferralBinding(binding.data(), {inviteeUid, inviterUid, tokenId: id, issuedAtMs, expiresAtMs});
      } catch {
        throw new Error("facebook-referrer-already-bound");
      }
      return {alreadyBound: true, expiresAtMs};
    }
    if (expiresAtMs <= now || issuedAtMs > now) {
      throw new Error("facebook-referral-token-expired");
    }
    /** Provides [inviter, inviter deletion] behavior. */
    const [inviter, inviterDeletion] = await Promise.all([
      transaction.get(db.collection("users").doc(inviterUid)),
      transaction.get(getJestAccountDeletionRef(db, inviterUid)),
    ]);
    assertJestAccountActive(inviterDeletion);
    if (!inviter.exists) throw new Error("facebook-referrer-not-found");
    if (!invitee.exists) throw new Error("facebook-invitee-not-found");
    /** Provides r. */
    const user = invitee.data()!;
    /** Provides games played behavior. */
    const gamesPlayed = requireStat(user.stats, "gamesPlayed");
    /** Provides wins behavior. */
    const wins = requireStat(user.stats, "wins");
    if (typeof user.hasPurchasedApp !== "boolean") throw new Error("invalid-facebook-referral-purchase-state");
    if (gamesPlayed > 0 || wins > 0 || requireStat(user.stats, "multiplayerGamesPlayed", 0) > 0 ||
      requireStat(user.stats, "multiplayerWins", 0) > 0 || requireStat(user.stats, "multiplayerChallengesCreated", 0) > 0 || user.hasPurchasedApp) {
      throw new Error("facebook-invitee-already-established");
    }
    transaction.create(bindingRef, {
      provider: "facebook",
      inviteeUid,
      inviterUid,
      tokenId: id,
      boundAtMs: now,
      settledAtMs: null,
      tokenIssuedAtMs: issuedAtMs,
      tokenExpiresAtMs: expiresAtMs,
    });
    transaction.set(
      db.doc(`users/${inviteeUid}/knownRivals/${inviterUid}`),
      {
        targetUserId: inviterUid,
        source: "facebook_invite",
        referralTokenId: id,
        establishedAtMs: now,
      },
      {merge: true},
    );
    transaction.set(
      db.doc(`users/${inviterUid}/knownRivals/${inviteeUid}`),
      {
        targetUserId: inviteeUid,
        source: "facebook_invite",
        referralTokenId: id,
        establishedAtMs: now,
      },
      {merge: true},
    );
    return {alreadyBound: false, expiresAtMs};
  });
}

/** Settles the two-sided reward once, after the invitee has a server-recorded first win. */
export async function settleFacebookReferralAfterAuthoritativeWin(
  inviteeUid: string,
  now = Date.now(),
  db: Firestore = admin.firestore(),
  completionReceiptId?: string,
): Promise<FacebookReferralSettlement> {
  if (!isFacebookFeatureEnabled("referrals") || !isFacebookFirebaseUid(inviteeUid)) {
    return {alreadySettled: false, inviteeCoins: 0, inviterCoins: 0};
  }
  requireClock(now);
  if (completionReceiptId !== undefined && !/^[0-9a-f]{64}$/.test(completionReceiptId)) {
    throw new Error("invalid-facebook-referral-completion-receipt");
  }
  /** Provides binding ref behavior. */
  const bindingRef = db.collection("facebookReferralBindings").doc(inviteeUid);
  /** Sets tlement ref. */
  const settlementRef = db.collection("facebookReferralSettlements").doc(hash("settlement", inviteeUid));
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
      const replayTombstone = data.provider === "facebook" && data.replayProtection === true;
      /** Provides active receipt behavior. */
      const activeReceipt =
        data.provider === "facebook" &&
        data.replayProtection !== true &&
        data.inviteeUid === inviteeUid &&
        typeof data.inviterUid === "string" &&
        isFacebookFirebaseUid(data.inviterUid) &&
        data.inviterUid !== inviteeUid;
      if (!replayTombstone && !activeReceipt) throw new Error("facebook-referral-settlement-conflict");
      /** Provides invitee coins behavior. */
      const inviteeCoins = requireNonNegativeInteger("settlement-invitee-coins", data.inviteeCoins);
      /** Provides inviter coins behavior. */
      const inviterCoins = requireNonNegativeInteger("settlement-inviter-coins", data.inviterCoins);
      /** Persisted attribution is immutable; a later caller cannot claim an older grant. */
      const settledCompletionReceiptId: unknown = data.completionReceiptId;
      requireStoredClock("settlement-settled-at", data.settledAtMs);
      if (
        inviteeCoins !== FACEBOOK_REFERRAL_REWARD_COINS ||
        (inviterCoins !== 0 && inviterCoins !== FACEBOOK_REFERRAL_REWARD_COINS) ||
        (settledCompletionReceiptId !== undefined &&
          (typeof settledCompletionReceiptId !== "string" || !/^[0-9a-f]{64}$/.test(settledCompletionReceiptId)))
      ) {
        throw new Error("facebook-referral-settlement-conflict");
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
    const parsedBinding = requireFacebookReferralBinding(bindingData, {inviteeUid});
    if (parsedBinding.settledAtMs !== null) {
      throw new Error("facebook-referral-settlement-missing");
    }
    /** Provides inviter uid behavior. */
    const inviterUid = parsedBinding.inviterUid;
    /** Provides invitee ref behavior. */
    const inviteeRef = db.collection("users").doc(inviteeUid);
    /** Provides inviter ref behavior. */
    const inviterRef = db.collection("users").doc(inviterUid);
    /** Provides cap ref behavior. */
    const capRef = db.collection("facebookReferralDailyCaps").doc(hash("cap", `${inviterUid}\0${utcDay(now)}`));
    /** Provides inviter deletion ref behavior. */
    const inviterDeletionRef = getJestAccountDeletionRef(db, inviterUid);
    /** Provides [invitee, inviter, cap, inviter deletion] behavior. */
    const [invitee, inviter, cap, inviterDeletion] = await Promise.all([
      transaction.get(inviteeRef),
      transaction.get(inviterRef),
      transaction.get(capRef),
      transaction.get(inviterDeletionRef),
    ]);
    if (!invitee.exists || (requireStat(invitee.data()?.stats, "wins") < 1 &&
      requireStat(invitee.data()?.stats, "multiplayerWins", 0) < 1)) {
      throw new Error("facebook-referral-win-not-established");
    }
    /** Provides cap count behavior. */
    const capCount = cap.exists ? requireNonNegativeInteger("daily-cap", cap.data()?.count) : 0;
    if (capCount > FACEBOOK_REFERRER_DAILY_REWARD_CAP) throw new Error("facebook-referral-cap-conflict");
    if (cap.exists && (cap.data()?.inviterUid !== inviterUid || cap.data()?.utcDay !== utcDay(now))) {
      throw new Error("facebook-referral-cap-conflict");
    }
    /** Provides inviter eligible behavior. */
    const inviterEligible = inviter.exists && !inviterDeletion.exists && capCount < FACEBOOK_REFERRER_DAILY_REWARD_CAP;
    /** Provides inviter coins behavior. */
    const inviterCoins = inviterEligible ? FACEBOOK_REFERRAL_REWARD_COINS : 0;
    /** Provides invitee balance behavior. */
    const inviteeBalance = requireNonNegativeInteger("invitee-balance", invitee.data()?.coins);
    transaction.update(inviteeRef, {
      coins: safeAdd("invitee-balance", inviteeBalance, FACEBOOK_REFERRAL_REWARD_COINS),
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
      provider: "facebook",
      inviteeUid,
      inviterUid,
      inviteeCoins: FACEBOOK_REFERRAL_REWARD_COINS,
      inviterCoins,
      settledAtMs: now,
      ...(completionReceiptId !== undefined ? {completionReceiptId} : {}),
    });
    return {alreadySettled: false, inviteeCoins: FACEBOOK_REFERRAL_REWARD_COINS, inviterCoins,
      ...(completionReceiptId !== undefined ? {completionReceiptId} : {})};
  });
}
