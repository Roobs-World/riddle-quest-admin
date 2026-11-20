import {admin} from "../shared/firebaseAdmin";

/** Removes account and order identifiers while retaining the token hash needed to refuse replays. */
export async function anonymizeAndroidPurchaseGrants(userId: string): Promise<void> {
  /** Retains db for this operation. */
  const db = admin.firestore();
  /** Retains collection for this operation. */
  const collection = db.collection("androidPurchaseGrants");
  while (true) {
    /** Retains page for this operation. */
    const page = await collection.where("uid", "==", userId).limit(200).get();
    if (page.empty) return;
    /** Retains batch for this operation. */
    const batch = db.batch();
    for (const document of page.docs) {
      /** Retains data for this operation. */
      const data = document.data();
      batch.set(document.ref, {
        provider: "android",
        replayProtection: true,
        ...(typeof data.productId === "string" ? {productId: data.productId} : {}),
        ...(typeof data.coins === "number" && Number.isFinite(data.coins) ? {coins: data.coins} : {}),
        ...(data.grantedAt === undefined ? {} : {grantedAt: data.grantedAt}),
      });
    }
    await batch.commit();
  }
}
