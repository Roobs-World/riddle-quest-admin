import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import type {Firestore} from "firebase-admin/firestore";
import {readFacebookReferralTokenRecord, requireFacebookReferralBinding} from "./facebookReferrals";

/** Backfills one legacy token and its matching bindings atomically before enabling its expiry. */
export async function prepareFacebookReferralTokenRetention(db: Firestore, tokenHash: string, apply = false): Promise<{
  /** Bounded operational outcome without player identifiers. */
  status: "ready" | "already-ready" | "missing" | "too-many-bindings";
  /** Number of bindings needing durable invitation-window metadata. */
  bindingUpdates: number;
}> {
  if (!/^[0-9a-f]{64}$/.test(tokenHash)) throw new Error("invalid-facebook-referral-token-hash");
  /** This temporary row alone receives TTL; reward/binding receipts remain permanent. */
  const ref = db.collection("facebookReferralTokens").doc(tokenHash);
  return db.runTransaction(async transaction => {
    /** A concurrent TTL deletion requires no recreation or retry-side issuance. */
    const token = await transaction.get(ref);
    if (!token.exists) return {status: "missing", bindingUpdates: 0};
    /** Rejects corrupt windows or existing TTL timestamps rather than silently repairing them. */
    const record = readFacebookReferralTokenRecord(token.data());
    /** One extra result detects fan-out beyond the bounded transaction's write budget. */
    const bindings = await transaction.get(db.collection("facebookReferralBindings").where("tokenId", "==", tokenHash).limit(201));
    if (bindings.size > 200) return {status: "too-many-bindings", bindingUpdates: 0};
    /** Read/validate every dependent receipt before any writes or TTL activation. */
    const pending = bindings.docs.filter(binding => {
      requireFacebookReferralBinding(binding.data(), {inviteeUid: binding.id, tokenId: tokenHash,
        inviterUid: record.inviterUid, issuedAtMs: record.issuedAtMs, expiresAtMs: record.expiresAtMs});
      return binding.data().tokenIssuedAtMs === undefined;
    });
    /** Existing prepared tokens and receipts remain byte-for-byte unchanged. */
    const ready = pending.length === 0 && token.data()?.expiresAt !== undefined;
    if (apply && !ready) {
      for (const binding of pending) transaction.update(binding.ref, {
        tokenIssuedAtMs: record.issuedAtMs, tokenExpiresAtMs: record.expiresAtMs,
      });
      transaction.update(ref, {expiresAt: admin.firestore.Timestamp.fromMillis(record.expiresAtMs)});
    }
    return {status: ready ? "already-ready" : "ready", bindingUpdates: pending.length};
  });
}
