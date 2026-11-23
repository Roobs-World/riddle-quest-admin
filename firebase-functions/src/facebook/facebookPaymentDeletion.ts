import {createHash} from "node:crypto";
import {admin} from "../shared/firebaseAdmin";

/** Retains non-rebindable token tombstones while removing the deleted generation's identity link. */
export async function anonymizeFacebookPaymentTokens(uid: string): Promise<void> {
  const db = admin.firestore();
  const uidHash = createHash("sha256").update(uid).digest("hex");
  while (true) {
    const tokens = await db.collection("facebookPaymentTokens").where("owner.uidHash", "==", uidHash).limit(400).get();
    if (tokens.empty) return;
    const batch = db.batch();
    for (const token of tokens.docs) batch.update(token.ref, {providerIdentityId: null, owner: {kind: "deleted"}});
    await batch.commit();
  }
}
