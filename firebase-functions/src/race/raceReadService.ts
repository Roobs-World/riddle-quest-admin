import {admin} from "../shared/firebaseAdmin";
import {
  ListRaceInboxResponseSchema,
  RACE_TARGET_CORRECT,
  RaceInboxItemSchema,
  RaceOutcomeSchema,
  type RaceLocale,
  type ListRaceInboxRequest,
  type ListRaceInboxResponse,
  type RaceChallengePreview,
  type RaceOutcome,
} from "@qwordly/core/race";
import {HttpsError} from "firebase-functions/v2/https";
import {validateCallableResponse} from "../validation/callableValidation";
import {getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {raceOutcome} from "./raceEngine";
import {PRIVATE_RACE_PLAYER_NAME} from "./raceOpponentPrivacy";
import {
  challengePreview,
  dbOrDefault,
  parseChallengeRecord,
  parseRunRecord,
  persistRaceAchievementEvent,
  type Firestore,
} from "./raceSetupService";

/** Gets race challenge preview. */
export async function getRaceChallengePreview(
  challengeId: string,
  locale: RaceLocale,
  options: {db?: Firestore; nowMs?: number} = {},
): Promise<RaceChallengePreview> {
  const db = dbOrDefault(options.db);
  const challengeRef = db.collection("raceChallenges").doc(challengeId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(challengeRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "Race to 10 challenge not found.");
    const challenge = parseChallengeRecord(snapshot.data());
    if (challenge.locale !== locale) {
      throw new HttpsError("failed-precondition", "RaceTo10.ERROR_LOCALE_MISMATCH");
    }
    const deletion = await transaction.get(getJestAccountDeletionRef(db, challenge.creatorId));
    if (!deletion.exists) return challengePreview(challenge, options.nowMs ?? Date.now());
    const scrubbed = {...challenge, creatorSnapshot: {displayName: PRIVATE_RACE_PLAYER_NAME}};
    transaction.update(challengeRef, {creatorSnapshot: scrubbed.creatorSnapshot});
    return challengePreview(scrubbed, options.nowMs ?? Date.now());
  });
}
/** Gets race outcome for user. */
export async function getRaceOutcomeForUser(
  userId: string,
  runId: string,
  options: {db?: Firestore; nowMs?: number} = {},
): Promise<RaceOutcome> {
  const db = dbOrDefault(options.db);
  const nowMs = options.nowMs ?? Date.now();
  const runRef = db.collection("raceRuns").doc(runId);
  const userRef = db.collection("users").doc(userId);
  const outcome = await db.runTransaction(async (transaction) => {
    const [runSnapshot, userSnapshot] = await Promise.all([transaction.get(runRef), transaction.get(userRef)]);
    if (!runSnapshot.exists) throw new HttpsError("not-found", "Race to 10 run not found.");
    const run = parseRunRecord(runSnapshot.data());
    if (run.userId !== userId) throw new HttpsError("permission-denied", "This race run belongs to another player.");
    const baseOutcome = raceOutcome(run, nowMs);
    if (run.achievementProgressRecordedAtMs !== undefined) return baseOutcome;
    if (!userSnapshot.exists) throw new HttpsError("internal", "Player progress is unavailable for this race.");

    const update = persistRaceAchievementEvent(
      transaction,
      userRef,
      userSnapshot.data() ?? {},
      {
        kind: "completed",
        won: baseOutcome.result === "player_win",
        cleanRun: baseOutcome.correctCount === RACE_TARGET_CORRECT && baseOutcome.totalPenaltyMs === 0,
      },
      nowMs,
    );
    transaction.set(runRef, {achievementProgressRecordedAtMs: nowMs}, {merge: true});
    return {
      ...baseOutcome,
      newlyUnlockedAchievementIds: update.newlyUnlockedAchievementIds,
      achievementCoinsAwarded: update.achievementCoinsAwarded,
      newCoins: update.newCoins,
    };
  });
  return validateCallableResponse(RaceOutcomeSchema, outcome, "getRaceOutcome");
}

/** Provides encode inbox cursor behavior. */
const encodeInboxCursor = (createdAtMs: number, itemId: string): string =>
  Buffer.from(JSON.stringify({createdAtMs, itemId}), "utf8").toString("base64url");

/** Provides decode inbox cursor behavior. */
const decodeInboxCursor = (cursor: string): {createdAtMs: number; itemId: string} => {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof value.createdAtMs !== "number" || typeof value.itemId !== "string") throw new Error("invalid");
    return {createdAtMs: value.createdAtMs, itemId: value.itemId};
  } catch {
    throw new HttpsError("invalid-argument", "Race inbox cursor is invalid.");
  }
};

/** Projects a stored inbox record without leaking server-only or unlinked legacy identity fields. */
const projectRaceInboxItem = (value: FirebaseFirestore.DocumentData, subjectDeleted: boolean) => {
  const linkedOpponentIdentity = !subjectDeleted &&
    typeof value.opponentUserId === "string" && value.opponentUserId.length > 0;
  return RaceInboxItemSchema.parse({
    itemId: value.itemId,
    challengeId: value.challengeId,
    ...(linkedOpponentIdentity ? {opponentUserId: value.opponentUserId} : {}),
    opponentDisplayName: linkedOpponentIdentity ? value.opponentDisplayName : "Riddle Quest player",
    ...(linkedOpponentIdentity && value.opponentAvatarUrl !== undefined
      ? {opponentAvatarUrl: value.opponentAvatarUrl}
      : {}),
    categoryId: value.categoryId,
    result: value.result,
    adjustedDeltaMs: value.adjustedDeltaMs,
    read: value.read,
    createdAtMs: value.createdAtMs,
  });
};

/** Lists race inbox for user. */
export async function listRaceInboxForUser(
  userId: string,
  input: ListRaceInboxRequest,
  dbInput?: Firestore,
): Promise<ListRaceInboxResponse> {
  const db = dbOrDefault(dbInput);
  let query: FirebaseFirestore.Query = db
    .collection(`users/${userId}/raceInbox`)
    .orderBy("createdAtMs", "desc")
    .orderBy(admin.firestore.FieldPath.documentId(), "desc")
    .limit(input.limit + 1);
  if (input.cursor) {
    const cursor = decodeInboxCursor(input.cursor);
    query = query.startAfter(cursor.createdAtMs, cursor.itemId);
  }
  const snapshot = await query.get();
  const visible = snapshot.docs.slice(0, input.limit);
  const opponentIds = [...new Set(visible.flatMap((document) => {
    const opponentUserId = document.data().opponentUserId;
    return typeof opponentUserId === "string" && opponentUserId.length > 0 ? [opponentUserId] : [];
  }))];
  const deletionSnapshots = opponentIds.length > 0
    ? await db.getAll(...opponentIds.map((opponentId) => getJestAccountDeletionRef(db, opponentId)))
    : [];
  const deletedOpponentIds = new Set(deletionSnapshots.filter((item) => item.exists).map((item) => item.id));
  const subjectDeleted = (value: FirebaseFirestore.DocumentData) =>
    typeof value.opponentUserId === "string" && deletedOpponentIds.has(value.opponentUserId);
  const items = visible.map((document) => projectRaceInboxItem(document.data(), subjectDeleted(document.data())));
  const last = visible.at(-1);
  const response = ListRaceInboxResponseSchema.parse({
    items,
    nextCursor:
      snapshot.docs.length > input.limit && last
        ? encodeInboxCursor(Number(last.data().createdAtMs), last.id)
        : undefined,
  });
  const updates = visible.filter((document) => document.data().read !== true || subjectDeleted(document.data()));
  if (updates.length > 0) {
    const batch = db.batch();
    updates.forEach((document) => {
      const fields: Record<string, unknown> = {};
      if (document.data().read !== true) fields.read = true;
      if (subjectDeleted(document.data())) {
        fields.opponentDisplayName = PRIVATE_RACE_PLAYER_NAME;
        fields.opponentAvatarUrl = admin.firestore.FieldValue.delete();
      }
      batch.update(document.ref, fields);
    });
    await batch.commit();
  }
  return response;
}
