import {admin} from "../shared/firebaseAdmin";
import {
  ListRaceInboxResponseSchema,
  RaceInboxItemSchema,
  RaceOutcomeSchema,
  type RaceLocale,
  type ListRaceInboxRequest,
  type ListRaceInboxResponse,
  type RaceChallengePreview,
  type RaceOutcome,
} from "@riddle-quest/core/race";
import {HttpsError} from "firebase-functions/v2/https";
import {validateCallableResponse} from "../validation/callableValidation";
import {getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {readSettledRaceOutcome} from "./raceSettlement";
import {PRIVATE_RACE_PLAYER_NAME} from "./raceOpponentPrivacy";
import {
  challengePreview,
  dbOrDefault,
  parseChallengeRecord,
  parseRunRecord,
  type Firestore,
} from "./raceSetupService";

/** Gets race challenge preview. */
export async function getRaceChallengePreview(
  challengeId: string,
  locale: RaceLocale,
  options: {
    /** Stores db. */
    db?: Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<RaceChallengePreview> {
  /** Provides db behavior. */
  const db = dbOrDefault(options.db);
  /** Provides challenge ref behavior. */
  const challengeRef = db.collection("raceChallenges").doc(challengeId);
  return db.runTransaction(async (transaction) => {
    /** Provides snapshot behavior. */
    const snapshot = await transaction.get(challengeRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "Race to 10 challenge not found.");
    /** Provides challenge behavior. */
    const challenge = parseChallengeRecord(snapshot.data(), snapshot.id);
    if (challenge.locale !== locale) {
      throw new HttpsError("failed-precondition", "RaceTo10.ERROR_LOCALE_MISMATCH");
    }
    /** Provides deletion behavior. */
    const deletion = await transaction.get(getJestAccountDeletionRef(db, challenge.creatorId));
    if (!deletion.exists) return challengePreview(challenge, options.nowMs ?? Date.now());
    /** Provides scrubbed behavior. */
    const scrubbed = {...challenge, creatorSnapshot: {displayName: PRIVATE_RACE_PLAYER_NAME}};
    transaction.update(challengeRef, {creatorSnapshot: scrubbed.creatorSnapshot});
    return challengePreview(scrubbed, options.nowMs ?? Date.now());
  });
}
/** Gets race outcome for user. */
export async function getRaceOutcomeForUser(
  userId: string,
  runId: string,
  options: {
    /** Stores db. */
    db?: Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<RaceOutcome> {
  /** Provides db behavior. */
  const db = dbOrDefault(options.db);
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  /** Provides run ref behavior. */
  const runRef = db.collection("raceRuns").doc(runId);
  /** Provides outcome behavior. */
  return db.runTransaction(async (transaction) => {
    /** Provides run snapshot behavior. */
    const runSnapshot = await transaction.get(runRef);
    if (!runSnapshot.exists) throw new HttpsError("not-found", "Race to 10 run not found.");
    /** Provides run behavior. */
    const run = parseRunRecord(runSnapshot.data(), runSnapshot.id);
    if (run.userId !== userId) throw new HttpsError("permission-denied", "This race run belongs to another player.");
    /** Transport sanitization shares acceptance with settlement and reward presentation. */
    const outcome = await readSettledRaceOutcome(transaction, db, run, nowMs);
    return validateCallableResponse(RaceOutcomeSchema, outcome, "getRaceOutcome");
  });
}

/** Provides encode inbox cursor behavior. */
const encodeInboxCursor = (createdAtMs: number, itemId: string): string =>
  Buffer.from(JSON.stringify({createdAtMs, itemId}), "utf8").toString("base64url");

/** Provides decode inbox cursor behavior. */
const decodeInboxCursor = (
  cursor: string,
): {
  /** Stores created at ms. */
  createdAtMs: number; /** Stores item id. */
  /** Stores item id. */
  itemId: string;
} => {
  try {
    /** Provides value behavior. */
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof value.createdAtMs !== "number" || typeof value.itemId !== "string") throw new Error("invalid");
    return {createdAtMs: value.createdAtMs, itemId: value.itemId};
  } catch {
    throw new HttpsError("invalid-argument", "Race inbox cursor is invalid.");
  }
};

/** Projects a stored inbox record without leaking server-only or unlinked legacy identity fields. */
const projectRaceInboxItem = (value: FirebaseFirestore.DocumentData, subjectDeleted: boolean) => {
  /** Provides linked opponent identity behavior. */
  const linkedOpponentIdentity =
    !subjectDeleted && typeof value.opponentUserId === "string" && value.opponentUserId.length > 0;
  return RaceInboxItemSchema.parse({
    itemId: value.itemId,
    challengeId: value.challengeId,
    ...(linkedOpponentIdentity ? {opponentUserId: value.opponentUserId} : {}),
    opponentDisplayName: linkedOpponentIdentity ? value.opponentDisplayName : "Riddle Quest player",
    ...(linkedOpponentIdentity && value.opponentAvatarUrl !== undefined
      ? {opponentAvatarUrl: value.opponentAvatarUrl}
      : {}),
    ...(linkedOpponentIdentity && value.opponentLevel !== undefined ? {opponentLevel: value.opponentLevel} : {}),
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
  /** Provides db behavior. */
  const db = dbOrDefault(dbInput);
  /** Provides query behavior. */
  let query: FirebaseFirestore.Query = db
    .collection(`users/${userId}/raceInbox`)
    .orderBy("createdAtMs", "desc")
    .orderBy(admin.firestore.FieldPath.documentId(), "desc")
    .limit(input.limit + 1);
  if (input.cursor) {
    /** Provides cursor behavior. */
    const cursor = decodeInboxCursor(input.cursor);
    query = query.startAfter(cursor.createdAtMs, cursor.itemId);
  }
  /** Provides snapshot behavior. */
  const snapshot = await query.get();
  /** Provides visible behavior. */
  const visible = snapshot.docs.slice(0, input.limit);
  /** Provides opponent ids behavior. */
  const opponentIds = [
    ...new Set(
      visible.flatMap((document) => {
        /** Provides opponent user id behavior. */
        const opponentUserId = document.data().opponentUserId;
        return typeof opponentUserId === "string" && opponentUserId.length > 0 ? [opponentUserId] : [];
      }),
    ),
  ];
  /** Provides deletion snapshots behavior. */
  const deletionSnapshots =
    opponentIds.length > 0
      ? await db.getAll(...opponentIds.map((opponentId) => getJestAccountDeletionRef(db, opponentId)))
      : [];
  /** Deletes d opponent ids. */
  const deletedOpponentIds = new Set(deletionSnapshots.filter((item) => item.exists).map((item) => item.id));
  /** Provides subject deleted behavior. */
  const subjectDeleted = (value: FirebaseFirestore.DocumentData) =>
    typeof value.opponentUserId === "string" && deletedOpponentIds.has(value.opponentUserId);
  /** Provides items behavior. */
  const items = visible.map((document) => projectRaceInboxItem(document.data(), subjectDeleted(document.data())));
  /** Provides last behavior. */
  const last = visible.at(-1);
  /** Provides response behavior. */
  const response = ListRaceInboxResponseSchema.parse({
    items,
    nextCursor:
      snapshot.docs.length > input.limit && last
        ? encodeInboxCursor(Number(last.data().createdAtMs), last.id)
        : undefined,
  });
  /** Updates s. */
  const updates = visible.filter((document) => document.data().read !== true || subjectDeleted(document.data()));
  if (updates.length > 0) {
    /** Provides batch behavior. */
    const batch = db.batch();
    updates.forEach((document) => {
      /** Provides fields behavior. */
      const fields: Record<string, unknown> = {};
      if (document.data().read !== true) fields.read = true;
      if (subjectDeleted(document.data())) {
        fields.opponentDisplayName = PRIVATE_RACE_PLAYER_NAME;
        fields.opponentAvatarUrl = admin.firestore.FieldValue.delete();
        fields.opponentLevel = admin.firestore.FieldValue.delete();
      }
      batch.update(document.ref, fields);
    });
    await batch.commit();
  }
  return response;
}
