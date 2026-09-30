import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {raceDeadlineAtMs, raceRules} from "./raceEngine";
import {raceDeckContentVersion, validateRaceDeckSnapshot, assertRaceCreatorArchiveLink} from "./raceDeckSnapshot";
import {projectRaceMatchCandidate, raceMatchCandidateEquals} from "./raceMatchCandidates";
import {parseChallengeRecord, parseRunRecord, stripUndefined, type Firestore} from "./raceSetupService";

/** One resumable migration page; dry runs never mutate canonical records or projections. */
export type RaceMigrationPage = {
  /** Source collection whose document IDs form the stable pagination cursor. */
  collection: "challenges" | "runs";
  /** Last successfully processed document from a previous page. */
  afterId?: string;
  /** Bounded read/write budget, at most 100 source records. */
  limit?: number;
  /** Safe default; applying a page must be explicit. */
  dryRun?: boolean;
};

/** Counts represent committed transactions, or their proposed results in dry-run mode. */
export type RaceMigrationReport = {
  /** Records read in this page. */ scanned: number;
  /** Records requiring a compatible archive, projection, or deadline update. */ changed: number;
  /** Unsupported or unavailable canonical snapshots, requiring operator investigation. */ unavailable: number;
  /** Unchanged or ineligible records. */ skipped: number;
  /** Resume cursor returned only after the whole page succeeds. */ nextAfterId?: string;
  /** Whether the query exhausted the collection; a full page requires another lookup. */ complete: boolean;
};

/** Archives eligible legacy challenges and restores discovery without mutable catalog reads. */
export async function reconcileRaceChallenge(transaction: FirebaseFirestore.Transaction, db: Firestore,
  ref: FirebaseFirestore.DocumentReference, dryRun: boolean, nowMs: number): Promise<"changed" | "skipped" | "unavailable"> {
  /** Provides document behavior. */
  const [document, existing] = await Promise.all([transaction.get(ref), transaction.get(db.doc(`raceMatchCandidates/${ref.id}`))]);
  /** Corrupt/missing source records must never leave a discoverable projection behind. */
  const removeProjection = () => {if (existing.exists && !dryRun) transaction.delete(existing.ref);};
  if (!document.exists) {removeProjection(); return existing.exists ? "changed" : "skipped";}
  /** Provides challenge behavior. */
  let challenge;
  try { challenge = parseChallengeRecord(document.data(), document.id); }
  catch (error) { if (error instanceof HttpsError) {removeProjection(); return "unavailable";} throw error; }
  if (challenge.challengeId !== document.id) {removeProjection(); return "unavailable";}
  /** Provides [lobby, deletion, existing, original] behavior. */
  const [lobby, deletion, original] = await Promise.all([
    transaction.get(db.doc(`raceInviteLobbies/${document.id}`)),
    transaction.get(getJestAccountDeletionRef(db, challenge.creatorId)),
    challenge.riddles ? Promise.resolve(null) : transaction.get(db.doc(`raceRuns/${challenge.creatorRunId}`)),
  ]);
  /** Provides scope behavior. */
  const scope = lobby.exists || challenge.scope === "invitation" || document.id.startsWith("jest-invite-") ? "invitation" : "public";
  if (challenge.status !== "active" || challenge.expiresAtMs <= nowMs || deletion.exists) {
    if (existing.exists && !dryRun) transaction.delete(existing.ref);
    return existing.exists ? "changed" : "skipped";
  }
  /** Provides riddles behavior. */
  let riddles;
  try {
    if (!challenge.riddles && (!original?.exists || original.data()?.runId !== challenge.creatorRunId || original.data()?.userId !== challenge.creatorId || original.data()?.locale !== challenge.locale)) {
      removeProjection(); return "unavailable";
    }
    if (!challenge.riddles) assertRaceCreatorArchiveLink(parseRunRecord(original!.data(), challenge.creatorRunId), challenge);
    riddles = validateRaceDeckSnapshot(challenge.riddles ?? original?.data()?.riddles, challenge.canonicalRiddleIds,
      challenge.snapshotVersion === 1 ? challenge.contentVersion : undefined);
  } catch (error) { if (error instanceof HttpsError) {removeProjection(); return "unavailable";} throw error; }
  /** Provides content version behavior. */
  const contentVersion = raceDeckContentVersion(riddles);
  /** Provides candidate behavior. */
  const candidate = projectRaceMatchCandidate({...challenge, riddles, scope, snapshotVersion: 1, contentVersion});
  /** Provides current behavior. */
  const current = existing.data();
  /** Provides candidate changed behavior. */
  const candidateChanged = candidate ? !raceMatchCandidateEquals(current, candidate) : existing.exists;
  /** Provides archive changed behavior. */
  const archiveChanged = challenge.snapshotVersion !== 1 || challenge.scope !== scope || !challenge.riddles;
  if (!archiveChanged && !candidateChanged) return "skipped";
  if (!dryRun) {
    if (archiveChanged) transaction.update(ref, stripUndefined({riddles, scope, snapshotVersion: 1, contentVersion,
      rules: challenge.rules, evaluationPolicy: challenge.evaluationPolicy ?? "preloaded"}));
    if (candidateChanged && candidate) transaction.set(db.doc(`raceMatchCandidates/${document.id}`), candidate);
    else if (candidateChanged && existing.exists) transaction.delete(existing.ref);
  }
  return "changed";
}

/** Adds indexed deadlines and pinned supported rules to still-active legacy runs. */
async function migrateRun(transaction: FirebaseFirestore.Transaction, ref: FirebaseFirestore.DocumentReference,
  dryRun: boolean): Promise<"changed" | "skipped" | "unavailable"> {
  /** Provides document behavior. */
  const document = await transaction.get(ref);
  if (!document.exists || document.data()?.status !== "active") return "skipped";
  // Recovery metadata belongs to the deadline worker/admin replay seam. A
  // routine backfill must not bypass quarantine or a transient retry delay.
  if (document.data()?.deadlineQuarantinedAtMs !== undefined) return "unavailable";
  if (document.data()?.deadlineRecovery) return "skipped";
  /** Provides run behavior. */
  let run;
  try { run = parseRunRecord(document.data(), document.id); }
  catch (error) { if (error instanceof HttpsError) return "unavailable"; throw error; }
  /** Provides deadline at ms behavior. */
  const deadlineAtMs = raceDeadlineAtMs(run);
  if (run.role !== "creator" && !Number.isFinite(deadlineAtMs)) return "unavailable";
  if (run.deadlineAtMs === deadlineAtMs && run.rulesSnapshot) return "skipped";
  if (!dryRun) transaction.update(ref, stripUndefined({deadlineAtMs, rulesSnapshot: raceRules(run)}));
  return "changed";
}

/** Processes a bounded ID-ordered page; interrupted pages are safe to replay from their prior cursor. */
export async function migrateRaceArchitecturePage(db: Firestore, input: RaceMigrationPage, nowMs = Date.now()): Promise<RaceMigrationReport> {
  /** Provides limit behavior. */
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new HttpsError("invalid-argument", "Migration page size must be between 1 and 100.");
  /** Provides collection behavior. */
  const collection = input.collection === "challenges" ? "raceChallenges" : "raceRuns";
  /** Provides query behavior. */
  let query = db.collection(collection).orderBy(admin.firestore.FieldPath.documentId()).limit(limit);
  if (input.afterId) query = query.startAfter(input.afterId);
  /** Provides page behavior. */
  const page = await query.get();
  /** Provides report behavior. */
  const report: RaceMigrationReport = {scanned: page.size, changed: 0, unavailable: 0, skipped: 0,
    ...(page.size ? {nextAfterId: page.docs.at(-1)!.id} : {}), complete: page.size < limit};
  for (const document of page.docs) {
    /** Provides result behavior. */
    const result = await db.runTransaction((transaction) => input.collection === "challenges"
      ? reconcileRaceChallenge(transaction, db, document.ref, input.dryRun !== false, nowMs)
      : migrateRun(transaction, document.ref, input.dryRun !== false));
    report[result] += 1;
  }
  return report;
}
