import {createHash, randomUUID} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";

type CompletionMode = "classic" | "challenge";

type CompletionReceipt<Result> = {
  status?: unknown;
  operationId?: unknown;
  result?: Result;
};

/** Creates a stable opaque identifier for one player's riddle completion. */
export function gameCompletionReceiptId(userId: string, gameMode: CompletionMode, riddleId: string): string {
  return createHash("sha256").update(`${userId}\0${gameMode}\0${riddleId}`).digest("hex");
}

/**
 * Executes completion side effects once and caches the authoritative response.
 *
 * A processing receipt is intentionally fail-closed: if an invocation dies
 * after applying only some side effects, later calls cannot replay the reward.
 */
export async function runGameCompletionOnce<Result>(
  userId: string,
  gameMode: CompletionMode,
  riddleId: string,
  operation: () => Promise<Result>,
): Promise<Result> {
  const receiptId = gameCompletionReceiptId(userId, gameMode, riddleId);
  const receiptRef = admin.firestore().collection("gameCompletionReceipts").doc(receiptId);
  const operationId = randomUUID();
  const cached = await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(receiptRef);
    if (snapshot.exists) {
      const receipt = snapshot.data() as CompletionReceipt<Result>;
      if (receipt.status === "completed" && receipt.result !== undefined) return receipt.result;
      throw new HttpsError("aborted", "This game completion is already being processed.");
    }
    transaction.create(receiptRef, {
      userId,
      gameMode,
      riddleId,
      operationId,
      status: "processing",
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return undefined;
  });
  if (cached !== undefined) return cached;

  const result = await operation();
  await receiptRef.update({
    status: "completed",
    result,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return result;
}
