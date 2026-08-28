import {admin} from "../shared/firebaseAdmin";
import {getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {RACE_CHALLENGE_TTL_MS} from "@qwordly/core/race";
import {raceOutcome, type RaceRunRecord} from "./raceEngine";
import {minimizeRaceReceiptResponse} from "./raceReceiptPrivacy";
import {scrubRaceOpponent} from "./raceOpponentPrivacy";
import {parseChallengeRecord, persistRaceAchievementEvent, requestDocumentId, type Firestore} from "./raceSetupService";

/** Applies cross-user completion writes only while the challenge creator is active. */
export async function applyRaceCompletionPrivacy<T>(
  transaction: FirebaseFirestore.Transaction,
  db: Firestore,
  userId: string,
  previousRun: RaceRunRecord,
  result: {
    /** Stores run. */
    run: RaceRunRecord; /** Stores response. */
    /** Stores response. */
    response: T;
  },
  nowMs: number,
  alreadyScrubbed: boolean,
): Promise<{
  /** Stores result. */
  result: {
    /** Stores run. */
    run: RaceRunRecord; /** Stores response. */
    /** Stores response. */
    response: T;
  }; /** Stores scrubbed. */
  /** Stores scrubbed. */
  scrubbed: boolean;
}> {
  if (
    previousRun.status !== "active" ||
    result.run.status === "active" ||
    result.run.status === "abandoned" ||
    !result.run.challengeId
  )
    return {result, scrubbed: alreadyScrubbed};

  /** Provides challenge behavior. */
  const challenge = parseChallengeRecord(
    (await transaction.get(db.collection("raceChallenges").doc(result.run.challengeId))).data(),
  );
  /** Provides creator deletion behavior. */
  const creatorDeletion = await transaction.get(getJestAccountDeletionRef(db, challenge.creatorId));
  if (creatorDeletion.exists) {
    return {
      result: {
        run: scrubRaceOpponent(result.run),
        response: minimizeRaceReceiptResponse(result.response),
      },
      scrubbed: true,
    };
  }

  /** Provides creator ref behavior. */
  const creatorRef = db.collection("users").doc(challenge.creatorId);
  /** Provides [challenger snapshot, creator snapshot] behavior. */
  const [challengerSnapshot, creatorSnapshot] = await Promise.all([
    transaction.get(db.collection("users").doc(userId)),
    transaction.get(creatorRef),
  ]);
  /** Provides outcome behavior. */
  const outcome = raceOutcome(result.run, nowMs);
  /** Provides adjusted delta ms behavior. */
  const adjustedDeltaMs = outcome.adjustedFinishMs - challenge.creatorAdjustedFinishMs;
  /** Provides creator result behavior. */
  const creatorResult = adjustedDeltaMs < 0 ? "loss" : adjustedDeltaMs > 0 ? "win" : "tie";
  /** Provides challenger behavior. */
  const challenger = challengerSnapshot.data() ?? {};
  /** Provides item id behavior. */
  const itemId = requestDocumentId(result.run.challengeId, userId);
  transaction.set(db.doc(`users/${challenge.creatorId}/raceInbox/${itemId}`), {
    itemId,
    challengeId: result.run.challengeId,
    opponentUserId: userId,
    opponentDisplayName: String(challenger.displayName || challenger.username || "Riddle Quest player")
      .trim()
      .slice(0, 80),
    ...(typeof challenger.avatarUrl === "string" ? {opponentAvatarUrl: challenger.avatarUrl} : {}),
    categoryId: result.run.categoryId,
    result: creatorResult,
    adjustedDeltaMs,
    read: false,
    createdAtMs: nowMs,
    expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + RACE_CHALLENGE_TTL_MS),
  });
  transaction.set(
    db.doc(`users/${userId}/knownRivals/${challenge.creatorId}`),
    {
      targetUserId: challenge.creatorId,
      source: "completed_race",
      challengeId: result.run.challengeId,
      establishedAtMs: nowMs,
    },
    {merge: true},
  );
  transaction.set(
    db.doc(`users/${challenge.creatorId}/knownRivals/${userId}`),
    {
      targetUserId: userId,
      source: "completed_race",
      challengeId: result.run.challengeId,
      establishedAtMs: nowMs,
    },
    {merge: true},
  );
  if (creatorSnapshot.exists) {
    persistRaceAchievementEvent(
      transaction,
      creatorRef,
      creatorSnapshot.data() ?? {},
      {kind: "opponent_resolved", won: creatorResult === "win"},
      nowMs,
    );
  }
  return {result, scrubbed: alreadyScrubbed};
}
