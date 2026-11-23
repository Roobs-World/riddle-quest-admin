import {RACE_CHALLENGE_TTL_MS} from "../../../src/core/race/index.js";
import {HttpsError} from "firebase-functions/v2/https";
import {settleRaceRun} from "./raceSettlement";
import {withRaceTransactionReads} from "./raceTransactionReads";
import {raceDeadlineAtMs, raceOperationAtMs, type RaceRunRecord} from "./raceEngine";
import {raceRunPrivacyWrite, resolveRaceOpponentPrivacy} from "./raceOpponentPrivacy";
import {hydrateRaceReceiptResponse, minimizeRaceReceiptResponse, raceReceiptExpiresAt} from "./raceReceiptPrivacy";
import {evaluateRaceRollout} from "./raceRollout";
import {bindRaceRequest, assertRaceRequestReplay, assertRaceMutationReceipt, type RaceMutationCommand} from "./raceRequestBinding";
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
  /** Provides [outgoing block, incoming block] behavior. */
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
  command: RaceMutationCommand,
  nowMs: number,
  db: Firestore,
  mutate: (run: RaceRunRecord, acceptedAtMs: number) => {
    /** Stores run. */
    run: RaceRunRecord; /** Stores response. */
    /** Stores response. */
    response: T;
  },
  options: {
    /** Stores enforce race access. */
    enforceRaceAccess?: boolean;
  } = {},
): Promise<T> {
  /** Command ownership and its receipt address come from one typed intent. */
  const {runId, requestId} = command.input;
  /** Persisted intent is a digest; guesses are never copied into receipt metadata. */
  const commandBinding = bindRaceRequest(command);
  /** Provides run ref behavior. */
  const runRef = db.collection("raceRuns").doc(runId);
  /** Requests ref. */
  const requestRef = runRef.collection("requests").doc(requestDocumentId(userId, requestId));
  return db.runTransaction(async (attempt) => {
    /** Repeated privacy and settlement reads share only this attempt's locked snapshots. */
    const transaction = withRaceTransactionReads(attempt);
    /** Provides [request snapshot, run snapshot, rollout snapshot] behavior. */
    const [requestSnapshot, runSnapshot, rolloutSnapshot] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(runRef),
      options.enforceRaceAccess ? transaction.get(db.doc("raceConfig/rollout")) : Promise.resolve(null),
    ]);
    if (!runSnapshot.exists) throw new HttpsError("not-found", "Race to 10 run not found.");
    /** Stores d run. */
    const storedRun = parseRunRecord(runSnapshot.data(), runSnapshot.id);
    if (storedRun.userId !== userId)
      throw new HttpsError("permission-denied", "This race run belongs to another player.");
    /** Provides privacy behavior. */
    const privacy = await resolveRaceOpponentPrivacy(transaction, db, storedRun);
    /** Provides run behavior. */
    const run = privacy.run;
    await assertRaceInteractionAllowed(transaction, db, userId, run.opponent?.subjectUserId);
    if (requestSnapshot.exists) {
      /** Legacy receipts prove only their recoverable original operation/input. */
      const bound = assertRaceRequestReplay(requestSnapshot.data(), userId, commandBinding);
      assertRaceMutationReceipt(requestSnapshot.data()?.response, command, run, bound);
      /** Provides response behavior. */
      const response = hydrateRaceReceiptResponse(requestSnapshot.data()?.response as T, run);
      // Current privacy-safe identity must also yield a deliverable public response.
      assertRaceMutationReceipt(response, command, run, bound);
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
    /** A transaction retry may observe a command committed after this request sampled its clock. */
    const acceptedAtMs = raceOperationAtMs(run, nowMs);
    /** Wrong guesses also retain the clock floor; scoring events alone cannot represent every accepted action. */
    const mutation = mutate({...applyActionRateLimit(run, userId, acceptedAtMs), lastActionAtMs: acceptedAtMs}, acceptedAtMs);
    /** Provides settled behavior. */
    const settled = await settleRaceRun(transaction, db, mutation.run, acceptedAtMs);
    /** Provides response behavior. */
    const response = hydrateRaceReceiptResponse(mutation.response, settled);
    // An undeliverable response must abort the whole transaction, including staged rewards and penalties.
    assertRaceMutationReceipt(response, command, settled, true);
    transaction.set(runRef, raceRunPrivacyWrite({...settled, deadlineAtMs: raceDeadlineAtMs(settled)}, privacy.scrubbed), {merge: true});
    transaction.create(requestRef, {
      userId,
      commandBinding,
      createdAtMs: acceptedAtMs,
      response: stripUndefined(minimizeRaceReceiptResponse(response)),
      expiresAt: raceReceiptExpiresAt(runSnapshot.data()?.expiresAt, acceptedAtMs + RACE_CHALLENGE_TTL_MS),
    });
    return response;
  });
}
