import {LIVE_RACE_WIN_COINS} from "@riddle-quest/core/race";
import {randomBytes} from "node:crypto";
import {Timestamp, type Firestore} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {
  AndroidReferralIdentitySchema,
  AndroidReferralProfileSchema,
  androidReferralEstablished,
  androidReferralHash,
  type AndroidGoogleIdentity,
} from "./androidReferralIdentity";

/** Same deterministic referral award and daily ceiling as the existing provider ledgers. */
export const ANDROID_REFERRAL_COINS = 100;
/** Opaque referral tokens last seven days. */
export const ANDROID_REFERRAL_TTL_MS = 7 * 86_400_000;
/** Invitee awards remain once per Google subject even when the inviter has exhausted this daily ceiling. */
export const ANDROID_REFERRAL_DAILY_CAP = 5;
/** Canonical token input cannot encode an inviter, destination, or amount. */
export const AndroidReferralTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
/** Provider-neutral opaque entry key. */
export const androidReferralTokenId = (token: string): string =>
  androidReferralHash("token", AndroidReferralTokenSchema.parse(token));
/** Validates opaque server digests used for receipts and referral ownership. */
const Hash = z.string().regex(/^[a-f0-9]{64}$/),
  Count = z.number().int().nonnegative().safe();
/** Validates the expiring server-issued inviter record. */
const Token = z.object({
  inviterUid: z.string(),
  inviterSubjectHash: Hash,
  issuedAtMs: Count,
  expiresAtMs: Count,
  expiresAt: z.unknown(),
});
/** Validates one immutable acquisition awaiting its authoritative first win. */
const PendingBinding = z.object({
  provider: z.literal("android"),
  state: z.literal("pending"),
  inviteeUid: z.string(),
  inviterUid: z.string().nullable(),
  inviterSubjectHash: Hash.nullable(),
  tokenId: Hash,
  boundAtMs: Count,
  tokenExpiresAtMs: Count,
});
/** Only account-owned profile and durable subject rows can admit a referral operation. */
export async function readAndroidReferralOwner(
  tx: FirebaseFirestore.Transaction,
  db: Firestore,
  identity: AndroidGoogleIdentity,
) {
  /** Current Android profile, durable Google-subject generation and deletion guard. */
  const [user, durable, deleted] = await Promise.all([
    tx.get(db.doc(`users/${identity.uid}`)),
    tx.get(db.doc(`androidReferralIdentities/${identity.subjectHash}`)),
    tx.get(getJestAccountDeletionRef(db, identity.uid)),
  ]);
  assertJestAccountActive(deleted);
  /** Validated canonical Android account state used for referral eligibility. */
  const profile = AndroidReferralProfileSchema.parse(user.data()),
    record = AndroidReferralIdentitySchema.parse(durable.data());
  if (profile.androidGoogleSubjectHash !== identity.subjectHash || record.uid !== identity.uid)
    throw new HttpsError("permission-denied", "Google identity unavailable.");
  return {profile, record};
}
/** Issues random entry data only after verified Google provisioning, with a bounded per-subject issuance window. */
export async function issueAndroidReferral(
  db: Firestore,
  identity: AndroidGoogleIdentity,
  nowMs = Date.now(),
  randomToken = () => randomBytes(32).toString("base64url"),
) {
  /** Opaque provider token, never a local grant or account selector. */
  const token = AndroidReferralTokenSchema.parse(randomToken()),
    tokenId = androidReferralTokenId(token);
  /** Server-owned issuance window, scoped to the durable Google subject. */
  const hour = Math.floor(nowMs / 3_600_000),
    limitRef = db.doc(
      `androidReferralIssueLimits/${androidReferralHash("issue-limit", `${identity.subjectHash}:${hour}`)}`,
    );
  await db.runTransaction(async (tx) => {
    await readAndroidReferralOwner(tx, db, identity);
    /** Current bounded issuance count for this Google-subject window. */
    const limit = await tx.get(limitRef),
      count = limit.exists ? Count.parse(limit.data()?.count) : 0;
    if (count >= 10) throw new HttpsError("resource-exhausted", "Try again later.");
    tx.set(limitRef, {count: count + 1, expiresAt: Timestamp.fromMillis(nowMs + ANDROID_REFERRAL_TTL_MS)});
    tx.create(db.doc(`androidReferralTokens/${tokenId}`), {
      inviterUid: identity.uid,
      inviterSubjectHash: identity.subjectHash,
      issuedAtMs: nowMs,
      expiresAtMs: nowMs + ANDROID_REFERRAL_TTL_MS,
      expiresAt: Timestamp.fromMillis(nowMs + ANDROID_REFERRAL_TTL_MS),
    });
  });
  return {token, expiresAtMs: nowMs + ANDROID_REFERRAL_TTL_MS, rewardCoins: ANDROID_REFERRAL_COINS};
}
/** Binds one unplayed Google subject once, never trusting a client-supplied inviter or conversion. */
export async function bindAndroidReferral(
  db: Firestore,
  identity: AndroidGoogleIdentity,
  token: string,
  nowMs = Date.now(),
) {
  /** Domain-separated digest of the opaque referral entry. */
  const tokenId = androidReferralTokenId(token),
    bindingRef = db.doc(`androidReferralBindings/${identity.subjectHash}`);
  return db.runTransaction(async (tx) => {
    /** Validated account and durable Google-subject authority for this transaction. */
    const owner = await readAndroidReferralOwner(tx, db, identity);
    /** Lifetime acquisition binding and expiring inviter token read before referral writes. */
    const [binding, tokenSnapshot] = await Promise.all([
      tx.get(bindingRef),
      tx.get(db.doc(`androidReferralTokens/${tokenId}`)),
    ]);
    if (binding.exists) {
      /** Earlier canonical record whose replay markers survive refresh or generation changes. */
      const previous = binding.data();
      if (previous?.state !== "closed" && previous?.inviteeUid === identity.uid && previous?.tokenId === tokenId)
        return {alreadyBound: true, expiresAtMs: Count.parse(previous.tokenExpiresAtMs)};
      throw new HttpsError("failed-precondition", "Referral already bound.");
    }
    if (owner.record.bound || owner.record.established || androidReferralEstablished(owner.profile))
      throw new HttpsError("failed-precondition", "Referral requires a new player.");
    /** Current server-owned work claimed before contacting a notification provider. */
    const entry = Token.safeParse(tokenSnapshot.data());
    if (
      !entry.success ||
      entry.data.issuedAtMs > nowMs ||
      entry.data.expiresAtMs !== entry.data.issuedAtMs + ANDROID_REFERRAL_TTL_MS ||
      entry.data.expiresAtMs <= nowMs
    )
      throw new HttpsError("failed-precondition", "Referral expired.");
    if (entry.data.inviterSubjectHash === identity.subjectHash || entry.data.inviterUid === identity.uid)
      throw new HttpsError("permission-denied", "Self-referrals are unavailable.");
    await readAndroidReferralOwner(tx, db, {uid: entry.data.inviterUid, subjectHash: entry.data.inviterSubjectHash});
    tx.create(bindingRef, {
      provider: "android",
      state: "pending",
      inviteeUid: identity.uid,
      inviterUid: entry.data.inviterUid,
      inviterSubjectHash: entry.data.inviterSubjectHash,
      tokenId,
      boundAtMs: nowMs,
      tokenExpiresAtMs: entry.data.expiresAtMs,
    });
    tx.update(db.doc(`androidReferralIdentities/${identity.subjectHash}`), {bound: true});
    return {alreadyBound: false, expiresAtMs: entry.data.expiresAtMs};
  });
}
/** Exposes eligibility without returning a Google subject, token digest, or inviter identity. */
export async function androidReferralStatus(db: Firestore, identity: AndroidGoogleIdentity) {
  return db.runTransaction(async (tx) => {
    /** Validated account and durable Google-subject authority for this transaction. */
    const owner = await readAndroidReferralOwner(tx, db, identity);
    /** Durable first-win award receipt, including deletion replay tombstones. */
    const settlement = await tx.get(db.doc(`androidReferralSettlements/${identity.subjectHash}`));
    return {
      kind: "ready" as const,
      canBind: !owner.record.bound && !owner.record.established && !androidReferralEstablished(owner.profile),
      bound: owner.record.bound,
      settled: settlement.exists,
      rewardCoins: ANDROID_REFERRAL_COINS,
    };
  });
}
/** Committed source identifies a completion, never a client claim that sharing or winning occurred. */
export type AndroidReferralPlaySource =
  | Readonly<{
      /** Discriminates whether Google verification is required or referral state is available. */
      kind: "solo";
      /** Opaque canonical completion identifier used as authoritative win evidence. */
      receiptId: string;
    }>
  | Readonly<{
      /** Discriminates whether Google verification is required or referral state is available. */
      kind: "live";
      /** Immutable authoritative live match identifier. */
      matchId: string;
      /** Private server race ticket and immutable match identifiers. */
      ticketId: string;
    }>;
/** Validates a canonical solo or terminal multiplayer receipt inside the reward transaction. */
async function readPlay(
  tx: FirebaseFirestore.Transaction,
  db: Firestore,
  uid: string,
  source: AndroidReferralPlaySource,
) {
  if (source.kind === "solo") {
    Hash.parse(source.receiptId);
    /** Canonical Firestore source snapshot, independent of client claims. */
    const snapshot = await tx.get(db.doc(`gameCompletionReceipts/${source.receiptId}`)),
      row = snapshot.data();
    if (
      row?.status !== "completed" ||
      row.userId !== uid ||
      typeof row.result?.isCorrect !== "boolean" ||
      !(row.completedAt instanceof Timestamp)
    )
      throw new HttpsError("failed-precondition", "Confirmed game completion required.");
    return {
      won: row.result.isCorrect && typeof row.result.coinsEarned === "number" && row.result.coinsEarned > 0,
      atMs: row.completedAt.toMillis(),
      sourceKey: `solo:${source.receiptId}`,
    };
  }
  Hash.parse(source.matchId);
  Hash.parse(source.ticketId);
  /** Canonical Firestore source snapshot, independent of client claims. */
  const snapshot = await tx.get(db.doc(`liveRaceMatches/${source.matchId}`)),
    row = snapshot.data();
  /** Account-owned participant position inside the canonical match. */
  const seat = Array.isArray(row?.tickets) ? row.tickets.indexOf(source.ticketId) : -1;
  if (
    !row ||
    seat < 0 ||
    row.runs?.[seat]?.userId !== uid ||
    row.winner === undefined ||
    !Number.isSafeInteger(row.observedAtMs)
  )
    throw new HttpsError("failed-precondition", "Confirmed race completion required.");
  return {
    won:
      row.winner === seat &&
      row.rewardCoins === LIVE_RACE_WIN_COINS &&
      Array.isArray(row.runs[seat].events) &&
      row.runs[seat].events.some(
        (event: {
          /** Canonical race event discriminator used to verify actual play. */
          type?: unknown;
        }) => event?.type === "correct",
      ),
    atMs: row.observedAtMs,
    sourceKey: `live:${source.matchId}:${source.ticketId}`,
  };
}
/** Tracks authoritative play and settles at most one first-win award per durable Google subject. */
export async function settleAndroidReferralAfterPlay(
  db: Firestore,
  uid: string,
  source: AndroidReferralPlaySource,
  nowMs = Date.now(),
): Promise<{
  /** Indicates that durable first-win conversion was previously processed. */
  alreadySettled: boolean;
  /** Server-confirmed coin award for the referred player. */
  inviteeCoins: number;
  /** Server-confirmed inviter award after account checks and daily caps. */
  inviterCoins: number;
  /** Canonical solo receipt to which this presented referral bonus belongs. */
  completionReceiptId?: string;
}> {
  /** No-award outcome for unrelated providers, unbound players or ineligible activity. */
  const none = {alreadySettled: false, inviteeCoins: 0, inviterCoins: 0};
  if (!/^[A-Za-z0-9]{28}$/.test(uid)) return none;
  return db.runTransaction(async (tx) => {
    /** Canonical account reference used for the balance and identity transaction. */
    const userRef = db.doc(`users/${uid}`),
      user = await tx.get(userRef);
    /** Validated canonical profile or registry, before any provider-specific grant. */
    const parsed = AndroidReferralProfileSchema.safeParse(user.data());
    if (!parsed.success || !parsed.data.androidGoogleSubjectHash) return none;
    /** Verified Google subject and game account binding, never request-body identity. */
    const identity = {uid, subjectHash: parsed.data.androidGoogleSubjectHash},
      owner = await readAndroidReferralOwner(tx, db, identity);
    /** Durable Google-subject acquisition record. */
    const bindingRef = db.doc(`androidReferralBindings/${identity.subjectHash}`),
      receiptRef = db.doc(`androidReferralSettlements/${identity.subjectHash}`);
    /** Immutable acquisition, prior settlement and canonical completed-game proof read together. */
    const [binding, receipt, play] = await Promise.all([
      tx.get(bindingRef),
      tx.get(receiptRef),
      readPlay(tx, db, uid, source),
    ]);
    if (receipt.exists) {
      /** Current server-owned record rechecked before its transactional mutation. */
      const row = receipt.data();
      return row?.inviteeUid === uid && row.sourceKey === play.sourceKey
        ? {
            alreadySettled: true,
            inviteeCoins: Count.parse(row.inviteeCoins),
            inviterCoins: Count.parse(row.inviterCoins),
            ...(source.kind === "solo" ? {completionReceiptId: source.receiptId} : {}),
          }
        : {...none, alreadySettled: true};
    }
    /** Durable Google-subject replay boundary, retained across account deletion. */
    const identityRef = db.doc(`androidReferralIdentities/${identity.subjectHash}`);
    if (!binding.exists || binding.data()?.state !== "pending" || !play.won) {
      tx.update(identityRef, {established: true});
      return none;
    }
    if (owner.profile.stats.wins < 1 && (owner.profile.stats.multiplayerWins ?? 0) < 1)
      throw new HttpsError("failed-precondition", "Referral win not established.");
    /** Deferred provider response used to control concurrent completion order. */
    const pending = PendingBinding.parse(binding.data());
    if (pending.inviteeUid !== uid || play.atMs < pending.boundAtMs)
      throw new HttpsError("failed-precondition", "Referral win unavailable.");
    /** UTC conversion date used for the durable inviter daily cap. */
    const day = new Date(nowMs).toISOString().slice(0, 10),
      capRef = pending.inviterSubjectHash
        ? db.doc(`androidReferralDailyCaps/${androidReferralHash("daily-cap", `${pending.inviterSubjectHash}:${day}`)}`)
        : null;
    /** Inviter account, durable subject generation, deletion guard and daily award count. */
    const [inviter, inviterIdentity, inviterDeleted, cap] = await Promise.all([
      pending.inviterUid ? tx.get(db.doc(`users/${pending.inviterUid}`)) : null,
      pending.inviterSubjectHash ? tx.get(db.doc(`androidReferralIdentities/${pending.inviterSubjectHash}`)) : null,
      pending.inviterUid ? tx.get(getJestAccountDeletionRef(db, pending.inviterUid)) : null,
      capRef ? tx.get(capRef) : null,
    ]);
    /** Validated server-owned rate or reward count for this bounded window. */
    const count = cap?.exists ? Count.parse(cap.data()?.count) : 0;
    /** Canonical inviter profile whose live Google binding controls reward eligibility. */
    const inviterProfile = AndroidReferralProfileSchema.safeParse(inviter?.data());
    /** Whether the live inviter and durable subject remain eligible under the daily cap. */
    const eligible = Boolean(
      pending.inviterUid &&
      pending.inviterSubjectHash &&
      inviterProfile.success &&
      !inviterDeleted?.exists &&
      inviterIdentity?.data()?.uid === pending.inviterUid &&
      inviterProfile.data.androidGoogleSubjectHash === pending.inviterSubjectHash &&
      count < ANDROID_REFERRAL_DAILY_CAP,
    );
    /** Server-confirmed inviter award after account checks and daily caps. */
    const inviterCoins = eligible ? ANDROID_REFERRAL_COINS : 0;
    /** Safe confirmed balance after the one-time or periodic server grant. */
    const newCoins = owner.profile.coins + ANDROID_REFERRAL_COINS;
    if (
      !Number.isSafeInteger(newCoins) ||
      (inviterProfile.success && !Number.isSafeInteger(inviterProfile.data.coins + inviterCoins))
    )
      throw new HttpsError("data-loss", "Invalid coin balance.");
    tx.update(userRef, {coins: newCoins});
    tx.update(identityRef, {established: true});
    if (eligible && pending.inviterUid && capRef && inviterProfile.success) {
      tx.update(db.doc(`users/${pending.inviterUid}`), {coins: inviterProfile.data.coins + inviterCoins});
      tx.set(capRef, {count: count + 1, expiresAt: Timestamp.fromMillis(nowMs + 2 * 86_400_000)});
    }
    tx.update(bindingRef, {state: "settled"});
    tx.create(receiptRef, {
      provider: "android",
      inviteeUid: uid,
      inviterUid: pending.inviterUid,
      sourceKey: play.sourceKey,
      inviteeCoins: ANDROID_REFERRAL_COINS,
      inviterCoins,
      settledAtMs: nowMs,
    });
    return {
      alreadySettled: false,
      inviteeCoins: ANDROID_REFERRAL_COINS,
      inviterCoins,
      ...(source.kind === "solo" ? {completionReceiptId: source.receiptId} : {}),
    };
  });
}
