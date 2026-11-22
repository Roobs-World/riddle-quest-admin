import {HttpsError} from "firebase-functions/v2/https";
import {LIVE_RACE_HISTORY_MS, LIVE_RACE_INVITE_MS, type JoinLiveRace} from "@riddle-quest/core/race";
import {resolveLiveRaceSafetyTarget} from "../social/liveRaceSafetyTarget";
import {raceProviderScope, assertAndroidRaceAccount} from "./raceEligibility";
import {admin} from "../shared/firebaseAdmin";

/** Validates retained source authority, safety and shared direct-invitation budgets before any writes. */
export async function prepareLiveRaceRematch(tx: FirebaseFirestore.Transaction, db: FirebaseFirestore.Firestore,
  userId: string, input: JoinLiveRace, nowMs: number) {
  /** Only authenticated game-owned provider namespaces may reserve a rematch. */
  const provider = raceProviderScope(userId);
  if (!provider || !input.rematchOfTicketId ||
    !Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > 8.64e15)
    throw new HttpsError("permission-denied", "Live rematch unavailable.");
  /** Existing private-seat resolver checks independent human seats, provider scope and deletion. */
  const recipientId = await resolveLiveRaceSafetyTarget(tx, db, userId, input.rematchOfTicketId, nowMs);
  if (provider === "android") {
    /** Retained native tickets cannot authorize accounts that are no longer canonically provisioned. */
    const [owner, recipient] = await tx.getAll(db.doc(`users/${userId}`), db.doc(`users/${recipientId}`));
    assertAndroidRaceAccount(userId, owner.data());
    assertAndroidRaceAccount(recipientId, recipient.data());
  }
  /** Only committed terminal history in the original content selection may create a rematch. */
  const source = (await tx.get(db.doc(`liveRaceTickets/${input.rematchOfTicketId}`))).data()!;
  /** Settlement and retention are independent of the caller's current active-seat pointer. */
  const match = (await tx.get(db.doc(`liveRaceMatches/${source.matchId}`))).data();
  /** Viewer seat supplies the immutable run selection. */
  const seat = match?.tickets.indexOf(input.rematchOfTicketId);
  if (!Number.isSafeInteger(source.createdAtMs) || source.createdAtMs > nowMs || nowMs >= source.createdAtMs + LIVE_RACE_HISTORY_MS ||
    !source.expiresAt || typeof source.expiresAt.toMillis !== "function" || !Number.isSafeInteger(source.expiresAt.toMillis()) || nowMs >= source.expiresAt.toMillis() ||
    source.run.locale !== input.locale || source.run.categoryId !== input.categoryId || !match ||
    ![0, 1, null].includes(match.winner) || ![0, 50].includes(match.rewardCoins) ||
    match.runs[seat]?.locale !== input.locale || match.runs[seat]?.categoryId !== input.categoryId ||
    !match.expiresAt || typeof match.expiresAt.toMillis !== "function" || !Number.isSafeInteger(match.expiresAt.toMillis()) || nowMs >= match.expiresAt.toMillis())
    throw new HttpsError("failed-precondition", "Live rematch unavailable.");
  /** The same quotas bound username-addressed invitations and private rematches together. */
  const rateRef = db.doc(`users/${userId}/liveChallengeRate/current`);
  /** Recipient cooldown prevents repeated invitations across multiple creators. */
  const recipientRateRef = db.doc(`users/${recipientId}/liveChallengeInboxRate/current`);
  /** Bilateral safety is rechecked in the creation transaction, never trusted from rendered history. */
  const [blocked, reverse, rate, recipientRate] = await Promise.all([
    tx.get(db.doc(`users/${userId}/blockedRivals/${recipientId}`)), tx.get(db.doc(`users/${recipientId}/blockedRivals/${userId}`)),
    tx.get(rateRef), tx.get(recipientRateRef),
  ]);
  if (blocked.exists || reverse.exists) throw new HttpsError("not-found", "Live rematch unavailable.");
  /** Existing reset time retains one shared hourly creator window. */
  const resetAtMs = rate.data()?.resetAtMs;
  /** A new window starts only when the previous authoritative deadline has passed. */
  const fresh = Number.isSafeInteger(resetAtMs) && resetAtMs > nowMs;
  /** Only integer server-owned counters are accepted. */
  const count = fresh ? rate.data()?.count : 0;
  if (!Number.isSafeInteger(count) || count < 0 || count >= 5 ||
    typeof recipientRate.data()?.lastAtMs === "number" && recipientRate.data()!.lastAtMs > nowMs - 60_000)
    throw new HttpsError("resource-exhausted", "Try again later.");
  return {recipientId, rateRef, recipientRateRef, count, resetAtMs: fresh ? resetAtMs : nowMs + 3_600_000};
}

/** Commits the reserved private opponent and durable inbox without granting currency. */
export function createLiveRaceRematchInvitation(tx: FirebaseFirestore.Transaction, db: FirebaseFirestore.Firestore,
  userId: string, ticketId: string, prepared: Awaited<ReturnType<typeof prepareLiveRaceRematch>>, nowMs: number) {
  /** Original issuance and fixed deadline never move on recovery. */
  const expiresAtMs = nowMs + LIVE_RACE_INVITE_MS;
  tx.set(prepared.rateRef, {count: prepared.count + 1, resetAtMs: prepared.resetAtMs});
  tx.set(prepared.recipientRateRef, {lastAtMs: nowMs});
  tx.create(db.doc(`users/${prepared.recipientId}/liveRaceInvitations/${ticketId}`), {challengeId: `live_${ticketId}`,
    createdAtMs: nowMs, expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs)});
  // Facebook retains its existing consent-gated provider delivery worker; Reddit gets only its in-game inbox.
  if (raceProviderScope(userId) === "facebook") tx.create(db.doc(`liveRacePushOutbox/${ticketId}`), {
    challengeId: `live_${ticketId}`, creatorId: userId, recipientId: prepared.recipientId, createdAtMs: nowMs,
    expiresAtMs, status: "queued", expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs + 86_400_000),
  });
}
