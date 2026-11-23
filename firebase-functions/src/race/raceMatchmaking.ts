import {createHash, randomUUID} from "node:crypto";
import {logger} from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";
import {RaceMatchResponseSchema, RACE_CHALLENGE_TTL_MS, RACE_RULES, type RaceMatchRequest, type RaceMatchResponse} from "@riddle-quest/core/race";
import {admin} from "../shared/firebaseAdmin";
import {inspectRaceChallengeEligibility, readRaceEligibilityDocuments, raceProviderScope, type RaceEligibilityReason} from "./raceEligibility";
import {emptyRaceMatchProfile, RaceMatchProfileSchema, scoreRaceCandidate, raceDifficultyAdjustedMs, racePerformanceExpectation} from "./raceMatchPerformance";
import {loadRaceMatchPolicy, raceMatchContext, raceMatchPolicySnapshot, type RaceMatchExperimentAssignment} from "./raceMatchPolicy";
import {challengePreview, parseChallengeRecord, requestDocumentId, type RaceChallengeRecord, type Firestore} from "./raceSetupService";
import {searchRaceCandidates, RACE_MATCH_READ_BUDGET} from "./raceCandidateSearch";
import {assertRaceMatchReadBudget, RACE_MATCH_LOOKUP_MS, withMeteredRaceTransaction, RACE_MATCH_DOCUMENT_READ_BUDGET, type RaceMatchReadMeter} from "./raceMatchReadMeter";
import {parseRaceMatchCandidate, projectRaceMatchCandidate, raceMatchCandidateEquals, type RaceMatchCandidate} from "./raceMatchCandidates";
import {classifyRaceMatchFailure, raceMatchFailure} from "@riddle-quest/core/race";

import {parseRaceMatchOffer} from "./raceMatchOfferRecord";
import {raceCandidateNeedsFreshness, raceFreshnessInspectionBatch, selectRaceFreshCandidate} from "./raceMatchFreshness";
import {raceRecordingFingerprint} from "./raceDeckSnapshot";
import {offerRaceBot, replayRaceBotOffer} from "./raceBot";

export {RACE_MATCH_PAGE_SIZE, RACE_MATCH_READ_BUDGET} from "./raceCandidateSearch";
/** Short offer lifetime; a ghost remains reusable by other players. */
export const RACE_MATCH_OFFER_MS = 60_000;
/** A complete small scope avoids empty-bucket RPCs; full probes retain indexed sampling. */
const RACE_MATCH_SCOPE_PROBE_SIZE = 12;

/** Inspection results remain hints until offer creation revalidates canonical eligibility. */
type CandidateInspection = {
  /** Eligible canonical archive. */
  challenge?: RaceChallengeRecord;
  /** Immutable archive identity checked before receipt replay. */
  recordingFingerprint?: string;
  /** Stable rejection category. */
  reason?: RaceEligibilityReason;
};

/** Groups canonical snapshots and shares common privacy reads inside one read-only transaction. */
async function readEligibleChallenges(db: Firestore, userId: string, challengeIds: string[], input: RaceMatchRequest, nowMs: number, meter: RaceMatchReadMeter) {
  return withMeteredRaceTransaction(db, meter, async transaction => {
    /** Canonical records are hydrated before any eligibility dependency reads. */
    const snapshots = await readRaceEligibilityDocuments(transaction, challengeIds.map(id => db.doc(`raceChallenges/${id}`)));
    /** Each result is associated with its physical source, independent of completion order. */
    const results = await Promise.all(snapshots.map(async (snapshot): Promise<CandidateInspection> => {
      if (!snapshot.exists) return {reason: "inactive"};
      /** Unsupported or corrupt canonical data is never mistaken for a healthy empty pool. */
      let challenge;
      try {challenge = parseChallengeRecord(snapshot.data(), snapshot.id);}
      catch (error) {
        if (error instanceof HttpsError && ["data-loss", "internal"].includes(error.code)) return {reason: "content"};
        throw error;
      }
      if (input.categoryId && challenge.categoryId !== input.categoryId) return {reason: "content"};
      /** Staged eligibility uses the transaction's shared document cache. */
      const inspection = await inspectRaceChallengeEligibility(transaction, db, userId, challenge, input.locale, nowMs);
      return inspection.reason ? {reason: inspection.reason} : {challenge, recordingFingerprint: raceRecordingFingerprint(challenge, inspection.riddles!)};
    }));
    return new Map(challengeIds.map((id, index) => [id, results[index]]));
  }, {readOnly: true});
}
/** Healthy dense pools inspect one record; replay also preserves its minimal read path. */
async function readEligibleChallenge(db: Firestore, userId: string, challengeId: string, input: RaceMatchRequest, nowMs: number, meter: RaceMatchReadMeter) {
  return (await readEligibleChallenges(db, userId, [challengeId], input, nowMs, meter)).get(challengeId)!;
}

/**
 * Selects an eligible recorded race within the authenticated provider pool.
 * Offers are stable across retries, scoped to the requester, and never lock a
 * reusable recording. Both offer creation and race acceptance revalidate state.
 */
export async function findRecordedRaceMatch(
  userId: string,
  input: RaceMatchRequest,
  options: {/** Storage seam for emulated concurrency tests. */ /** Stores db. */
  /** Stores db. */
  db?: Firestore; /** Authoritative request time. */ /** Stores now ms. */
  /** Stores now ms. */
  nowMs?: number} = {},
): Promise<RaceMatchResponse> {
  /** Provides provider behavior. */
  const provider = raceProviderScope(userId);
  if (!provider) throw new HttpsError("permission-denied", "Recorded matchmaking requires a provider identity.");
  /** Provides db behavior. */
  const db = options.db ?? admin.firestore();
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  /** Provides started behavior. */
  const started = Date.now();
  /** Requests id. */
  const requestId = input.requestId ?? randomUUID();
  /** Provides receipt behavior. */
  const receipt = db.doc(`raceMatchOffers/${requestDocumentId(userId, requestId)}`);
  /** Provides fingerprint behavior. */
  const fingerprint = JSON.stringify({locale: input.locale, categoryId: input.categoryId ?? null});
  /** Provides meter behavior. */
  const meter: RaceMatchReadMeter = {documentReadAttempts: 2, transactionAttempts: 0, documentReadBatches: 0, documentReadCacheHits: 0, deadlineAtMs: started + RACE_MATCH_LOOKUP_MS};
  /** Progress survives a budget/storage failure before the search can return its final page report. */
  const retrieval = {candidateQueries: 0, candidateDocumentsRead: 0};
  /** Validated attribution survives later failures without exposing configuration or identity. */
  let policyAttribution: {
    /** Canonical selected policy identity, absent before successful policy validation. */ policyHash?: string;
    /** Selected revision, never inferred for an unattributed legacy offer. */ policyRevision?: number;
    /** Public allocation identity contains neither account nor salt. */ matchExperiment?: RaceMatchExperimentAssignment;
  } = {};
  try {
  /** Provides previous behavior. */
  const [previous, previousBot] = await db.getAll(receipt, db.doc(`raceBotOffers/${receipt.id}`));
  assertRaceMatchReadBudget(meter);
  if (previous.exists && previousBot.exists) throw new HttpsError("data-loss", "Conflicting opponent receipts exist for this search.");
  if (previousBot.exists) {
    /** An issued fallback stays selected even when the human pool changes. */
    const fallback = replayRaceBotOffer(previousBot.data(), userId, input, requestId, nowMs);
    /** Validate the original fallback response before success telemetry. */
    const response = RaceMatchResponseSchema.parse({status: "empty", locale: input.locale, fallback});
    logger.info("Race matchmaking lookup", {telemetryVersion: 1, disposition: "replayed", provider, locale: input.locale,
      matched: false, replayed: true, candidateDocumentsRead: 0, candidateQueries: 0, ...meter, durationMs: Date.now() - started});
    return response;
  }
  /** Replay reads validate identity and clocks before routing. */
  const previousOffer = previous.exists ? parseRaceMatchOffer(previous.data(), previous.id, userId) : undefined;
  if (previousOffer) policyAttribution = {policyHash: previousOffer.matchPolicyHash,
    policyRevision: previousOffer.matchPolicyRevision, matchExperiment: previousOffer.matchExperiment};
  if (previousOffer?.acceptedRunId) throw new HttpsError("already-exists", "This matchmaking request was already accepted.");
  if (previous.exists && previousOffer?.fingerprint !== fingerprint) throw new HttpsError("invalid-argument", "Match request was reused for different preferences.");
  if (previousOffer !== undefined && previousOffer.expiresAtMs > nowMs) {
    /** Provides replay behavior. */
    const replay = await readEligibleChallenge(db, userId, previousOffer!.challengeId, input, nowMs, meter);
    if (replay.challenge) {
      if (previousOffer.recordingFingerprint !== undefined && previousOffer.recordingFingerprint !== replay.recordingFingerprint)
        throw new HttpsError("aborted", "The offered recording changed; begin a new search.");
      /** Validate the response before emitting a terminal success event. */
      const response = RaceMatchResponseSchema.parse({status: "matched", offerId: receipt.id, challenge: challengePreview(replay.challenge, nowMs)});
      logger.info("Race matchmaking lookup", {telemetryVersion: 1, disposition: "replayed", provider, locale: input.locale, matched: true, replayed: true,
        policyHash: typeof previousOffer?.matchPolicyHash === "string" && /^[a-f0-9]{64}$/.test(previousOffer!.matchPolicyHash) ? previousOffer!.matchPolicyHash : undefined,
        matchExperiment: previousOffer?.matchExperiment,
        policyRevision: Number.isInteger(previousOffer?.matchPolicyRevision) && previousOffer!.matchPolicyRevision! >= 1 && previousOffer!.matchPolicyRevision! <= 1000000 ? previousOffer!.matchPolicyRevision : undefined,
        candidateDocumentsRead: 0, candidateQueries: 0, ...meter, durationMs: Date.now() - started});
      return response;
    }
  }
  if (previousOffer !== undefined && previousOffer.expiresAtMs <= nowMs) throw new HttpsError("failed-precondition", "This matchmaking request has expired; begin a new search.",
    {matchmaking: raceMatchFailure("intent-expired")});
  /** Provides rejected behavior. */
  const rejected: Partial<Record<RaceEligibilityReason, number>> = {};
  /** Provides examined behavior. */
  let examined = 0;
  /** An existing intent retains its original policy even if its candidate becomes ineligible. */
  const previousPolicy = previousOffer?.matchPolicySnapshot;
  assertRaceMatchReadBudget(meter);
  meter.documentReadAttempts += previousPolicy === undefined ? 2 : 1;
  /** Scope-only probe shares the existing expiry index with candidate retrieval. */
  let availabilityQuery = db.collection("raceMatchCandidates").where("provider", "==", provider)
    .where("locale", "==", input.locale).where("rulesVersion", "==", RACE_RULES.version)
    .where("status", "==", "active").where("expiresAtMs", ">", nowMs).orderBy("expiresAtMs").limit(RACE_MATCH_SCOPE_PROBE_SIZE);
  if (input.categoryId) availabilityQuery = availabilityQuery.where("categoryId", "==", input.categoryId);
  /** Every probe document is included in the fixed physical candidate budget. */
  retrieval.candidateQueries = 1;
  /** Bounded scope query begins alongside independent history and policy reads. */
  const scopeRead = availabilityQuery.get().then(availability => {
    retrieval.candidateDocumentsRead = availability.size;
    return availability;
  });
  /** Independent scope/history/configuration reads share the bounded request lifetime. */
  const [historyResult, snapshotResult, scopeResult] = await Promise.allSettled([db.doc(`users/${userId}/raceMatchProfiles/${input.locale}`).get(),
    (async () => previousPolicy === undefined ? loadRaceMatchPolicy(db, {userId, provider, locale: input.locale}) : {...raceMatchPolicySnapshot(previousPolicy), ...(previousOffer?.matchExperiment ? {experiment: previousOffer.matchExperiment} : {})})().then(selected => {
      policyAttribution = {policyHash: selected.hash, policyRevision: selected.policy.revision, matchExperiment: selected.experiment};
      return selected;
    }), scopeRead]);
  if (snapshotResult.status === "rejected") throw snapshotResult.reason;
  if (historyResult.status === "rejected") throw historyResult.reason;
  if (scopeResult.status === "rejected") throw scopeResult.reason;
  /** Settled bounded scope snapshot determines empty or sparse retrieval. */
  const availability = scopeResult.value;
  /** Issued independent reads finish before failure reporting, preserving known assignment. */
  const history = historyResult.value;
  /** Validated immutable policy also remains available if profile validation fails below. */
  const snapshot = snapshotResult.value;
  /** Exact policy selected once for indexed retrieval, canonical ranking and offer attribution. */
  const context = raceMatchContext(snapshot, input.locale);
  /** Provides profile behavior. */
  const profile = history.exists ? RaceMatchProfileSchema.parse(history.data()) : emptyRaceMatchProfile();
  /** One bounded scope index proves an empty or complete sparse pool. */
  assertRaceMatchReadBudget(meter);
  /** Bounded indexed retrieval precedes scored selection and canonical revalidation. */
  const rejectedProjections = new Set<string>();
  /** Parsed retrieval metadata must also match its canonical source before affecting an offer. */
  const projections = new Map<string, RaceMatchCandidate>();
  /** Provides ranked behavior. */
  const rank = (documents: FirebaseFirestore.QueryDocumentSnapshot[]) => documents.flatMap((document) => {
    /** Provides data behavior. */
    const data = parseRaceMatchCandidate(document.data(), document.id);
    /** Provides performance ms behavior. */
    const performanceMs = data?.performanceMs;
    if (!data || performanceMs === undefined) {
      if (!rejectedProjections.has(document.id)) {rejectedProjections.add(document.id); rejected.content = (rejected.content ?? 0) + 1;}
      return [];
    }
    projections.set(document.id, data);
    /** Provides rating behavior. */
    const rating = scoreRaceCandidate(profile, userId, {creatorId: data.creatorId, categoryId: data.categoryId,
      performanceMs, canonicalRiddleIds: data.canonicalRiddleIds}, nowMs, context);
    /** Provides tie behavior. */
    const tie = createHash("sha256").update(`${requestId}:${document.id}`).digest("hex");
    return [{document, ...rating, tie}];
  }).sort((left, right) => left.band - right.band || left.score - right.score || left.tie.localeCompare(right.tie));
  /** Canonical inspections are reused only within this lookup, with final transactional revalidation. */
  const inspected = new Map<string, CandidateInspection>();
  /** Groups only unseen records; shared privacy dependencies stay transaction-local. */
  const inspectMany = async (ids: string[]) => {
    /** Previously checked candidates consume no repeated canonical work. */
    const pending = ids.filter(id => !inspected.has(id));
    if (!pending.length) return;
    examined += pending.length;
    /** Every group is bounded by the caller and the global document/deadline budgets. */
    const results = await readEligibleChallenges(db, userId, pending, input, nowMs, meter);
    for (const [id, original] of results) {
      /** Projection checks retain canonical ranking/content identity under grouped reads. */
      let result = original;
      if (result.challenge) {
        /** Immutable canonical metadata remains the authority for exact ranking. */
        const expected = projectRaceMatchCandidate(result.challenge);
        if (!expected || !raceMatchCandidateEquals(projections.get(id), expected)) {
          rejectedProjections.add(id);
          result = {reason: "content"};
        }
      }
      if (!result.challenge) {
        /** Count each actual canonical rejection once. */
        const reason = result.reason ?? "content";
        if (reason === "content") rejectedProjections.add(id);
        rejected[reason] = (rejected[reason] ?? 0) + 1;
      }
      inspected.set(id, result);
    }
  };
  /** Single-candidate checks remain cheap for healthy pools and fresh fallback commits. */
  const inspect = async (id: string) => {await inspectMany([id]); return inspected.get(id)!;};
  /** Optional freshness work cannot consume the canonical reads needed to commit a fallback offer. */
  const freshnessChecks = [0, 0];
  /** Exact ranking and canonical checks are shared by sparse and indexed retrieval. */
  const inspectTier = async (documents: FirebaseFirestore.QueryDocumentSnapshot[], tier: number) => {
    /** Eligibility is checked before a fresh projection can stop or widen discovery. */
    let baseline: ReturnType<typeof rank>[number] | undefined;
    /** Canonical prefetch begins only after a rejection, preserving the dense-pool fast path. */
    const ordered = rank(documents);
    /** A rejection indicates that a small grouped validation can amortize common dependencies. */
    let previousRejected = false;
    for (const [index, candidate] of ordered.entries()) {
      if (!baseline && previousRejected && !inspected.has(candidate.document.id)) {
        /** Limit speculative work to the same band and the available freshness allowance. */
        const size = Math.min(8, context.policy.algorithmVersion === 3 ? context.policy.freshness.maxAdditionalChecks + 1 : 8);
        /** Same-band grouping cannot pull far performances ahead of nearer recordings. */
        const group = ordered.slice(index, index + size).filter(item => item.band === candidate.band && !inspected.has(item.document.id));
        await inspectMany(group.map(item => item.document.id));
        /** Reads after the first eligible baseline count against optional freshness work. */
        const firstEligible = group.findIndex(item => inspected.get(item.document.id)?.challenge);
        if (firstEligible >= 0 && candidate.band <= 1) freshnessChecks[candidate.band] += group.length - firstEligible - 1;
      }
      if (baseline && candidate.band > 1) break;
      if (baseline && !inspected.has(candidate.document.id) && context.policy.algorithmVersion === 3) {
        if (meter.documentReadAttempts >= RACE_MATCH_DOCUMENT_READ_BUDGET - 30) return true;
        if (freshnessChecks[candidate.band] >= context.policy.freshness.maxAdditionalChecks) continue;
        /** Already inspected records terminate prefetch so an earlier winner cannot be skipped. */
        const pending = [];
        for (const item of ordered.slice(index, index + 4)) {
          if (inspected.has(item.document.id)) break;
          pending.push(item);
        }
        /** Keep the committing fallback reserve and charge every speculative check to its band. */
        const group = raceFreshnessInspectionBatch(pending, context.policy,
          context.policy.freshness.maxAdditionalChecks - freshnessChecks[candidate.band],
          RACE_MATCH_DOCUMENT_READ_BUDGET - 30 - meter.documentReadAttempts);
        if (!group.length) return true;
        freshnessChecks[candidate.band] += group.length;
        await inspectMany(group.map(item => item.document.id));
      }
      if (!(await inspect(candidate.document.id)).challenge) {previousRejected = true; continue;}
      baseline ??= candidate;
      if (!raceCandidateNeedsFreshness(candidate, context.policy) || candidate.band > 1) return true;
    }
    // One wider comparable tier is enough; retain the nearest eligible fallback.
    return baseline !== undefined && tier >= 1;
  };
  /** A short probe contains the whole scope, so no indexed circular sampling is needed. */
  let search;
  if (availability.size < RACE_MATCH_SCOPE_PROBE_SIZE) {
    await inspectTier(availability.docs, 2);
    search = {documents: availability.docs, exhausted: true, queries: 0};
  } else {
    search = await searchRaceCandidates(db, userId, provider, input, profile, requestId, nowMs,
      inspectTier, progress => {
        Object.assign(retrieval, {candidateQueries: progress.candidateQueries + 1,
          candidateDocumentsRead: progress.candidateDocumentsRead + availability.size});
        assertRaceMatchReadBudget(meter);
      }, context, RACE_MATCH_READ_BUDGET - availability.size);
  }
  /** Candidate scope queries and indexed pages share the same physical read budget. */
  const {documents: pool, exhausted, queries: bucketQueries} = search;
  /** Includes the scope probe in operational lookup cost. */
  const candidateQueries = bucketQueries + 1;
  if (!availability.empty && exhausted && pool.length === 0) throw new HttpsError("unavailable", "Match projections require reconciliation.",
    {matchmaking: raceMatchFailure("projection-unavailable", 15000)});
  /** Provides ranked behavior. */
  const ranked = rank(pool);
  /** Cached canonical checks prevent blocked or stale projections from winning freshness selection. */
  const eligible = ranked.filter(candidate => inspected.get(candidate.document.id)?.challenge);
  /** A fresh wider recording may replace a repetitive nearest recording within the configured wider window. */
  const fresh = selectRaceFreshCandidate(eligible, context.policy);
  /** Attribute only an actual cross-band substitution, preserving the nearest fallback. */
  const relaxedId = fresh && eligible[0] && fresh.band > eligible[0].band ? fresh.document.id : undefined;
  if (fresh) ranked.splice(0, ranked.length, fresh, ...ranked.filter(candidate => candidate !== fresh));
  /** A lost authoritative commit is a changing pool, never a stable empty fallback decision. */
  let commitEligibilityChanged = false;
  for (const rankedCandidate of ranked) {
    /** Provides candidate behavior. */
    const candidate = rankedCandidate.document;
      /** Provides result behavior. */
      const result = await inspect(candidate.id);
      if (!result.challenge) {
        /** Provides reason behavior. */
        continue;
      }
      /** Provides offered behavior. */
      const offered = await withMeteredRaceTransaction(db, meter, async (transaction) => {
        /** Independent receipt and selected recording reads share the committing snapshot. */
        const [existing, selectedSnapshot, existingBot] = await readRaceEligibilityDocuments(transaction,
          [receipt, db.doc(`raceChallenges/${candidate.id}`), db.doc(`raceBotOffers/${receipt.id}`)]);
        if (existing.exists && existingBot.exists) throw new HttpsError("data-loss", "Conflicting opponent receipts exist for this search.");
        if (existingBot.exists) return {fallback: replayRaceBotOffer(existingBot.data(), userId, input, requestId, nowMs)};
        /** Concurrent winners pass the same receipt contract as direct replays. */
        const existingOffer = existing.exists ? parseRaceMatchOffer(existing.data(), existing.id, userId) : undefined;
        if (existingOffer?.acceptedRunId) throw new HttpsError("already-exists", "This matchmaking request was already accepted.");
        if (existing.exists && existingOffer?.fingerprint !== fingerprint) throw new HttpsError("invalid-argument", "Match preferences changed.");
        if (existingOffer !== undefined && existingOffer.expiresAtMs <= nowMs) throw new HttpsError("failed-precondition", "This matchmaking request has expired; begin a new search.",
          {matchmaking: raceMatchFailure("intent-expired")});
        /** Provides challenge id behavior. */
        const challengeId = candidate.id;
        /** Provides previous id behavior. */
        const previousId = existingOffer !== undefined && existingOffer.expiresAtMs > nowMs ? existingOffer!.challengeId : undefined;
        if (typeof previousId === "string") {
          /** Provides previous snapshot behavior. */
          const previousSnapshot = await transaction.get(db.doc(`raceChallenges/${previousId}`));
          if (previousSnapshot.exists) {
            /** Provides previous challenge behavior. */
            const previousChallenge = parseChallengeRecord(previousSnapshot.data(), previousSnapshot.id);
            /** Replayed offers revalidate authorization and their immutable recording fingerprint. */
            const previousInspection = await inspectRaceChallengeEligibility(transaction, db, userId, previousChallenge, input.locale, nowMs);
            if (!previousInspection.reason) {
              if (existingOffer?.recordingFingerprint !== undefined && existingOffer.recordingFingerprint !== raceRecordingFingerprint(previousChallenge, previousInspection.riddles!))
                throw new HttpsError("aborted", "The offered recording changed; begin a new search.");
              /** A concurrent winner owns its original immutable attribution; replay never rewrites it. */
              const winnerPolicy = existingOffer?.matchPolicySnapshot;
              /** Legacy receipts remain replayable without inventing a historical policy snapshot. */
              const winnerContext = winnerPolicy === undefined ? context : raceMatchContext({...raceMatchPolicySnapshot(winnerPolicy), ...(existingOffer?.matchExperiment ? {experiment: existingOffer.matchExperiment} : {})}, input.locale);
              /** Logs describe the recording and policy actually offered by the transaction winner. */
              const quality = scoreRaceCandidate(profile, userId, {creatorId: previousChallenge.creatorId, categoryId: previousChallenge.categoryId,
                performanceMs: previousChallenge.recordingPerformanceMs ?? raceDifficultyAdjustedMs(previousChallenge.creatorAdjustedFinishMs, previousChallenge.riddles ?? []),
                canonicalRiddleIds: previousChallenge.canonicalRiddleIds}, nowMs, winnerContext);
              return {challenge: challengePreview(previousChallenge, nowMs), quality, policyHash: winnerPolicy === undefined ? undefined : winnerContext.hash,
                policyRevision: winnerPolicy === undefined ? undefined : winnerContext.policy.revision, matchExperiment: winnerContext.experiment,
                freshnessRelaxed: existingOffer?.freshnessRelaxed};
            }
          }
        }
        /** Provides snapshot behavior. */
        const snapshot = selectedSnapshot;
        if (!snapshot.exists) return null;
        /** Provides challenge behavior. */
        const challenge = parseChallengeRecord(snapshot.data(), snapshot.id);
        if (input.categoryId && challenge.categoryId !== input.categoryId) return null;
        /** Commit selects only the canonical recording authorized in this transaction. */
        const inspection = await inspectRaceChallengeEligibility(transaction, db, userId, challenge, input.locale, nowMs);
        if (inspection.reason) return null;
        /** Commit only the immutable recording actually inspected and ranked by this lookup. */
        const recordingFingerprint = raceRecordingFingerprint(challenge, inspection.riddles!);
        if (result.recordingFingerprint !== recordingFingerprint) return null;
        /** Re-selection may shorten the original intent window, but never renew it. */
        const expiresAtMs = Math.min(existingOffer?.expiresAtMs ?? nowMs + RACE_MATCH_OFFER_MS, challenge.expiresAtMs);
        /** Provides performance ms behavior. */
        const performanceMs = challenge.recordingPerformanceMs ?? raceDifficultyAdjustedMs(challenge.creatorAdjustedFinishMs, challenge.riddles ?? []);
        /** Provides quality behavior. */
        const quality = scoreRaceCandidate(profile, userId, {creatorId: challenge.creatorId, categoryId: challenge.categoryId,
          performanceMs, canonicalRiddleIds: challenge.canonicalRiddleIds}, nowMs, context);
        transaction.set(receipt, {recordVersion: 1, recordingFingerprint, requestId, userId, fingerprint, challengeId, expiresAtMs, createdAtMs: existingOffer?.createdAtMs ?? nowMs,
          ...(context.experiment ? {matchExperiment: context.experiment} : {}),
          provider, locale: input.locale, categoryId: challenge.categoryId, matchPolicyVersion: context.policy.algorithmVersion,
          matchPolicyRevision: context.policy.revision, matchPolicyHash: context.hash, matchPolicySnapshot: context.policy,
          offerBand: quality.band, performanceConfidence: quality.confidence, recordingPerformanceMs: performanceMs,
          recentRivalRepeats: quality.repeats, questionOverlap: quality.exposure, freshnessRelaxed: candidate.id === relaxedId,
          freshnessBaselineBand: eligible[0]?.band ?? quality.band,
          freshnessBaselineRepeats: eligible[0]?.repeats ?? quality.repeats,
          freshnessBaselineOverlap: eligible[0]?.exposure ?? quality.exposure,
          lookupCandidateDocumentsRead: existingOffer?.lookupCandidateDocumentsRead ?? retrieval.candidateDocumentsRead,
          lookupCandidateQueries: existingOffer?.lookupCandidateQueries ?? candidateQueries,
          lookupDocumentReadAttempts: existingOffer?.lookupDocumentReadAttempts ?? meter.documentReadAttempts,
          lookupTransactionAttempts: existingOffer?.lookupTransactionAttempts ?? meter.transactionAttempts,
          lookupSelectionDurationMs: existingOffer?.lookupSelectionDurationMs ?? Date.now() - started,
          expectedPerformanceMs: Math.exp(racePerformanceExpectation(profile, challenge.categoryId, nowMs, context.priors, context.policy.performance).expectedLog),
          expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + RACE_CHALLENGE_TTL_MS)});
        return {challenge: challengePreview(challenge, nowMs), quality, policyHash: context.hash, policyRevision: context.policy.revision, matchExperiment: context.experiment,
          freshnessRelaxed: candidate.id === relaxedId};
      });
      if (!offered) {commitEligibilityChanged = true; continue;}
      if ("fallback" in offered) {
        /** The transaction winner determines the response kind after a stale initial read. */
        const response = RaceMatchResponseSchema.parse({status: "empty", locale: input.locale, fallback: offered.fallback});
        logger.info("Race matchmaking lookup", {telemetryVersion: 1, disposition: "replayed", provider, locale: input.locale,
          matched: false, replayed: true, ...retrieval, ...meter, durationMs: Date.now() - started});
        return response;
      }
    /** One final event follows response validation and the committed offer. */
    const response = RaceMatchResponseSchema.parse({status: "matched", offerId: receipt.id, challenge: offered.challenge});
    logger.info("Race matchmaking lookup", {telemetryVersion: 1, disposition: "matched", provider, locale: input.locale, examined, rejected, matched: true,
      candidateDocumentsRead: retrieval.candidateDocumentsRead, candidateQueries, offerBand: offered.quality.band, performanceConfidence: offered.quality.confidence,
      policyHash: offered.policyHash, policyRevision: offered.policyRevision, matchExperiment: offered.matchExperiment, freshnessRelaxed: offered.freshnessRelaxed,
      ...meter, searchCapped: !exhausted && pool.length + availability.size >= RACE_MATCH_READ_BUDGET, durationMs: Date.now() - started});
    return response;
  }
  if (commitEligibilityChanged) throw new HttpsError("aborted", "Match eligibility changed during selection. Please retry.");
  if (exhausted && rejectedProjections.size) throw new HttpsError("unavailable", "Match projections require reconciliation. Please retry later.",
    {matchmaking: raceMatchFailure("projection-unavailable", 15000)});
  if (exhausted) {
    /** Empty means a completed eligible-pool search, never a capped or corrupt search. */
    if (previousOffer !== undefined) throw new HttpsError("aborted", "The recorded offer is no longer eligible; begin a new search.");
    /** Transactional fallback creation rechecks both competing receipt kinds. */
    const fallback = await offerRaceBot(db, userId, input, requestId, nowMs, profile, context, meter);
    /** Typed empty-pool response can carry one server-selected fallback receipt. */
    const response = RaceMatchResponseSchema.parse({status: "empty", locale: input.locale, ...(fallback ? {fallback} : {})});
    logger.info("Race matchmaking lookup", {telemetryVersion: 1, disposition: "empty", provider, locale: input.locale, examined, rejected, matched: false,
      policyHash: context.hash, policyRevision: context.policy.revision, matchExperiment: context.experiment, candidateDocumentsRead: retrieval.candidateDocumentsRead, candidateQueries,
      ...meter, searchCapped: false, durationMs: Date.now() - started});
    return response;
  }
  if (pool.length + availability.size < RACE_MATCH_READ_BUDGET) throw new HttpsError("aborted", "Match eligibility changed during selection. Please retry.");
  throw new HttpsError("resource-exhausted", "Match search reached its bounded candidate budget. Please retry.");
  } catch (error) {
    /** Stable terminal classification allows mutually exclusive operational counters. */
    const failure = error instanceof HttpsError && error.code === "resource-exhausted" ? raceMatchFailure("search-budget-exceeded") : classifyRaceMatchFailure(error);
    logger.warn("Race matchmaking failure", {telemetryVersion: 1, disposition: failure.reason === "search-budget-exceeded" ? "capped" : "failed",
      failureReason: failure.reason,
      provider, locale: input.locale, failureCode: error instanceof HttpsError ? error.code : "internal", ...policyAttribution, ...meter, ...retrieval,
      durationMs: Date.now() - started});
    if (error instanceof HttpsError) {
      throw new HttpsError(error.code, error.message, {matchmaking: failure});
    }
    throw error;
  }
}
