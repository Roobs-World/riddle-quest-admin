import {RACE_CHALLENGE_TTL_MS} from "@qwordly/core/race";
import {HttpsError} from "firebase-functions/v2/https";
import {applyRaceCompletionPrivacy} from "./raceCompletionPrivacy";
import {type RaceRunRecord} from "./raceEngine";
import {raceRunPrivacyWrite, resolveRaceOpponentPrivacy} from "./raceOpponentPrivacy";
import {hydrateRaceReceiptResponse, minimizeRaceReceiptResponse, raceReceiptExpiresAt} from "./raceReceiptPrivacy";
import {evaluateRaceRollout} from "./raceRollout";
import {
  applyActionRateLimit,
  parseRunRecord,
  requestDocumentId,
  stripUndefined,
  type Firestore,
} from "./raceSetupService";

/** Rejects a race when either participant has blocked the other. */
export async function assertRaceInteractionAllowed(
  transaction: FirebaseFirestore.Transaction,
  db: Firestore,
  userId: string,
  opponentUserId: string | undefined,
): Promise<void> {
  if (!opponentUserId) return;
  const [outgoingBlock, incomingBlock] = await Promise.all([
    transaction.get(db.doc(`users/${userId}/blockedRivals/${opponentUserId}`)),
    transaction.get(db.doc(`users/${opponentUserId}/blockedRivals/${userId}`)),
  ]);
  if (outgoingBlock.exists || incomingBlock.exists) {
    throw new HttpsError("permission-denied", "This race interaction is blocked.");
  }
}

/** Applies one idempotent race mutation with rollout, privacy, and interaction enforcement. */
export async function mutateRaceRun<T>(
  userId: string,
  runId: string,
  requestId: string,
  nowMs: number,
  db: Firestore,
  mutate: (run: RaceRunRecord) => {run: RaceRunRecord; response: T},
  options: {enforceRaceAccess?: boolean} = {},
): Promise<T> {
  const runRef = db.collection("raceRuns").doc(runId);
  const requestRef = runRef.collection("requests").doc(requestDocumentId(userId, requestId));
  return db.runTransaction(async (transaction) => {
    const [requestSnapshot, runSnapshot, rolloutSnapshot] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(runRef),
      options.enforceRaceAccess ? transaction.get(db.doc("raceConfig/rollout")) : Promise.resolve(null),
    ]);
    if (!runSnapshot.exists) throw new HttpsError("not-found", "Race to 10 run not found.");
    const storedRun = parseRunRecord(runSnapshot.data());
    if (storedRun.userId !== userId) throw new HttpsError("permission-denied", "This race run belongs to another player.");
    const privacy = await resolveRaceOpponentPrivacy(transaction, db, storedRun);
    const run = privacy.run;
    await assertRaceInteractionAllowed(transaction, db, userId, run.opponent?.subjectUserId);
    if (requestSnapshot.exists) {
      const response = hydrateRaceReceiptResponse(requestSnapshot.data()?.response as T, run);
      if (privacy.scrubbed) {
        transaction.set(runRef, raceRunPrivacyWrite(run, true), {merge: true});
        transaction.update(requestRef, {response: stripUndefined(minimizeRaceReceiptResponse(response))});
      }
      return response;
    }
    if (
      options.enforceRaceAccess &&
      !evaluateRaceRollout(rolloutSnapshot?.exists ? rolloutSnapshot.data() : undefined, userId).enabled
    ) {
      throw new HttpsError("permission-denied", "Race to 10 is not enabled for this player.");
    }
    const completed = await applyRaceCompletionPrivacy(
      transaction,
      db,
      userId,
      run,
      mutate(applyActionRateLimit(run, userId, nowMs)),
      nowMs,
      privacy.scrubbed,
    );
    const {result} = completed;
    transaction.set(runRef, raceRunPrivacyWrite(result.run, completed.scrubbed), {merge: true});
    transaction.create(requestRef, {
      userId,
      createdAtMs: nowMs,
      response: stripUndefined(minimizeRaceReceiptResponse(result.response)),
      expiresAt: raceReceiptExpiresAt(runSnapshot.data()?.expiresAt, nowMs + RACE_CHALLENGE_TTL_MS),
    });
    return result.response;
  });
}
