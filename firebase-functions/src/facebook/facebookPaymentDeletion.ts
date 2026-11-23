import {createHash} from "node:crypto";
import {admin} from "../shared/firebaseAdmin";

/** Retains non-rebindable token tombstones while removing the deleted generation's identity link. */
export async function anonymizeFacebookPaymentTokens(uid: string): Promise<void> {
  /** Firestore connection used to anonymize a deleted account's token records. */
  const db = admin.firestore();
  /** Opaque account hash used to find tokens without retaining the deleted UID. */
  const uidHash = createHash("sha256").update(uid).digest("hex");
  while (true) {
    /** Bounded batch of payment tokens still linked to the deleted account hash. */
    const tokens = await db.collection("facebookPaymentTokens").where("owner.uidHash", "==", uidHash).limit(400).get();
    if (tokens.empty) return;
    /** Atomic updates that remove identity links while retaining deletion tombstones. */
    const batch = db.batch();
    for (const token of tokens.docs) batch.update(token.ref, {providerIdentityId: null, owner: {kind: "deleted"}});
    await batch.commit();
  }
}
