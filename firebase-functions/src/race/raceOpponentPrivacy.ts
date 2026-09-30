import {admin} from "../shared/firebaseAdmin";
import {getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import type {RaceRunRecord} from "./raceEngine";
import {stripUndefined, type Firestore} from "./raceSetupService";

/** Neutral identity used when a race opponent can no longer be linked safely. */
export const PRIVATE_RACE_PLAYER_NAME = "Riddle Quest player";

/** Removes copied name/avatar linkage while preserving bounded ghost timing. */
export function scrubRaceOpponent(run: RaceRunRecord): RaceRunRecord {
  if (!run.opponent) return run;
  return {
    ...run,
    opponent: {
      ...run.opponent,
      displayName: PRIVATE_RACE_PLAYER_NAME,
      avatarUrl: undefined,
      subjectUserId: undefined,
    },
  };
}

/** Resolves a run against the permanent opponent-deletion authority. */
export async function resolveRaceOpponentPrivacy(
  transaction: FirebaseFirestore.Transaction,
  db: Firestore,
  run: RaceRunRecord,
): Promise<{
  /** Stores run. */
  run: RaceRunRecord; /** Stores scrubbed. */
  /** Stores scrubbed. */
  scrubbed: boolean;
}> {
  /** Provides subject user id behavior. */
  const subjectUserId = run.opponent?.subjectUserId;
  if (!run.opponent) return {run, scrubbed: false};
  if (run.opponent.kind === "bot") return {run, scrubbed: false};
  if (typeof subjectUserId !== "string" || subjectUserId.length === 0) {
    return {run: scrubRaceOpponent(run), scrubbed: true};
  }
  /** Provides deletion behavior. */
  const deletion = await transaction.get(getJestAccountDeletionRef(db, subjectUserId));
  return deletion.exists ? {run: scrubRaceOpponent(run), scrubbed: true} : {run, scrubbed: false};
}

/** Produces a merge-safe run write that physically removes scrubbed fields. */
export function raceRunPrivacyWrite(run: RaceRunRecord, scrubbed: boolean): FirebaseFirestore.DocumentData {
  /** Stores d. */
  const stored = stripUndefined(run) as FirebaseFirestore.DocumentData;
  if (!scrubbed || !stored.opponent) return stored;
  return {
    ...stored,
    opponent: {
      ...stored.opponent,
      avatarUrl: admin.firestore.FieldValue.delete(),
      subjectUserId: admin.firestore.FieldValue.delete(),
    },
  };
}
