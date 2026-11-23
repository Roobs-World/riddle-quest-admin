import {AndroidReferralProfileSchema, androidReferralEstablished} from "./androidReferralIdentity";
import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {deleteMatchingDocuments} from "../../../../firebase-functions/src/profile/accountDeletion/accountDeletionBatches";

/** Removes live referral identity links while retaining durable first-acquisition replay boundaries. */
export async function deleteAndroidReferralData(uid: string): Promise<void> {
  if (!/^[A-Za-z0-9]{28}$/.test(uid)) return;
  /** Real Firestore database in the dedicated local demo project. */
  const db = admin.firestore();
  await Promise.all([
    deleteMatchingDocuments("androidReferralTokens", "inviterUid", uid),
    deleteMatchingDocuments("androidReferralPlayOutbox", "uid", uid),
  ]);
  for (const collection of ["androidReferralBindings", "androidReferralSettlements"]) {
    for (const field of ["inviteeUid", "inviterUid"])
      while (true) {
        /** Bounded account-owned records selected for idempotent deletion cleanup. */
        const page = await db.collection(collection).where(field, "==", uid).limit(100).get();
        if (page.empty) break;
        for (const row of page.docs)
          await db.runTransaction(async (tx) => {
            /** Current account-owned snapshot or effect lifetime checked before applying work. */
            const current = await tx.get(row.ref),
              data = current.data();
            if (!data || data[field] !== uid) return;
            if (field === "inviterUid") {
              tx.update(row.ref, {inviterUid: null, ...(collection === "androidReferralBindings" ? {inviterSubjectHash: null} : {})});
            } else
              tx.set(row.ref, {
                provider: "android",
                state: "closed",
                replayProtection: true,
                ...(typeof data.settledAtMs === "number" ? {settledAtMs: data.settledAtMs} : {}),
                ...(typeof data.inviteeCoins === "number" ? {inviteeCoins: data.inviteeCoins} : {}),
                ...(typeof data.inviterCoins === "number" ? {inviterCoins: data.inviterCoins} : {}),
              });
          });
      }
  }
  /** Validated canonical Android account state used for referral eligibility. */
  const profile = AndroidReferralProfileSchema.safeParse((await db.doc(`users/${uid}`).get()).data());
  /** Whether authoritative activity permanently closed new-player acquisition. */
  const established = !profile.success || androidReferralEstablished(profile.data);
  while (true) {
    /** Bounded account-owned records selected for idempotent deletion cleanup. */
    const page = await db.collection("androidReferralIdentities").where("uid", "==", uid).limit(100).get();
    if (page.empty) break;
    /** Bounded atomic cleanup writes that preserve unrelated accounts. */
    const batch = db.batch();
    for (const row of page.docs) batch.update(row.ref, {uid: null, ...(established ? {established: true} : {})});
    await batch.commit();
  }
}
