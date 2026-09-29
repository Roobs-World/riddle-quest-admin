import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {raceDeadlineAtMs, raceRules} from "./raceEngine";
import {raceDeckContentVersion, validateRaceDeckSnapshot} from "./raceDeckSnapshot";
import {projectRaceMatchCandidate} from "./raceMatchCandidates";
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
async function migrateChallenge(transaction: FirebaseFirestore.Transaction, db: Firestore,
  ref: FirebaseFirestore.DocumentReference, dryRun: boolean, nowMs: number): Promise<"changed" | "skipped" | "unavailable"> {
  const document = await transaction.get(ref);
  if (!document.exists) return "skipped";
  let challenge;
  try { challenge = parseChallengeRecord(document.data()); }
  catch (error) { if (error instanceof HttpsError) return "unavailable"; throw error; }
  const [lobby, deletion, existing, original] = await Promise.all([
    transaction.get(db.doc(`raceInviteLobbies/${document.id}`)),
    transaction.get(getJestAccountDeletionRef(db, challenge.creatorId)),
    transaction.get(db.doc(`raceMatchCandidates/${document.id}`)),
    challenge.riddles ? Promise.resolve(null) : transaction.get(db.doc(`raceRuns/${challenge.creatorRunId}`)),
  ]);
  const scope = lobby.exists || challenge.scope === "invitation" || document.id.startsWith("jest-invite-") ? "invitation" : "public";
  if (challenge.status !== "active" || challenge.expiresAtMs <= nowMs || deletion.exists) {
    if (existing.exists && !dryRun) transaction.delete(existing.ref);
    return existing.exists ? "changed" : "skipped";
  }
  let riddles;
  try {
    if (!challenge.riddles && (!original?.exists || original.data()?.userId !== challenge.creatorId || original.data()?.locale !== challenge.locale)) return "unavailable";
    riddles = validateRaceDeckSnapshot(challenge.riddles ?? original?.data()?.riddles, challenge.canonicalRiddleIds,
      challenge.snapshotVersion === 1 ? challenge.contentVersion : undefined);
  } catch (error) { if (error instanceof HttpsError) return "unavailable"; throw error; }
  const contentVersion = raceDeckContentVersion(riddles);
  const candidate = projectRaceMatchCandidate({...challenge, riddles, scope, snapshotVersion: 1, contentVersion});
  const current = existing.data();
  const candidateChanged = candidate ? !current || Object.entries(candidate).some(([key, value]) =>
    key === "expiresAt" ? current[key]?.toMillis?.() !== candidate.expiresAt.toMillis() : current[key] !== value) : existing.exists;
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
  const document = await transaction.get(ref);
  if (!document.exists || document.data()?.status !== "active") return "skipped";
  let run;
  try { run = parseRunRecord(document.data()); }
  catch (error) { if (error instanceof HttpsError) return "unavailable"; throw error; }
  const deadlineAtMs = raceDeadlineAtMs(run);
  if (run.role !== "creator" && !Number.isFinite(deadlineAtMs)) return "unavailable";
  if (run.deadlineAtMs === deadlineAtMs && run.rulesSnapshot) return "skipped";
  if (!dryRun) transaction.update(ref, stripUndefined({deadlineAtMs, rulesSnapshot: raceRules(run)}));
  return "changed";
}

/** Processes a bounded ID-ordered page; interrupted pages are safe to replay from their prior cursor. */
export async function migrateRaceArchitecturePage(db: Firestore, input: RaceMigrationPage, nowMs = Date.now()): Promise<RaceMigrationReport> {
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new HttpsError("invalid-argument", "Migration page size must be between 1 and 100.");
  const collection = input.collection === "challenges" ? "raceChallenges" : "raceRuns";
  let query = db.collection(collection).orderBy(admin.firestore.FieldPath.documentId()).limit(limit);
  if (input.afterId) query = query.startAfter(input.afterId);
  const page = await query.get();
  const report: RaceMigrationReport = {scanned: page.size, changed: 0, unavailable: 0, skipped: 0,
    ...(page.size ? {nextAfterId: page.docs.at(-1)!.id} : {}), complete: page.size < limit};
  for (const document of page.docs) {
    const result = await db.runTransaction((transaction) => input.collection === "challenges"
      ? migrateChallenge(transaction, db, document.ref, input.dryRun !== false, nowMs)
      : migrateRun(transaction, document.ref, input.dryRun !== false));
    report[result] += 1;
  }
  return report;
}
