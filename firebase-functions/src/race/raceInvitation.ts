import {admin} from "../shared/firebaseAdmin";
import {createHash, randomUUID} from "node:crypto";
import {ReserveRaceInviteResponseSchema, RaceEntryResponseSchema, RACE_CHALLENGE_TTL_MS, type ReserveRaceInviteRequest, type ReserveRaceInviteResponse, type RaceLocale, type RaceChallengePreview, type RaceEntryResponse, type RaceInvitationView, type CancelRaceInviteRequest} from "@riddle-quest/core/race";
import {HttpsError} from "firebase-functions/v2/https";
import {getJestAccountDeletionRef} from "../shared/accountDeletion";
import {assertRaceInteractionAllowed} from "./raceRunMutation";
import {challengePreview, dbOrDefault, parseChallengeRecord, parseRunRecord, requestDocumentId, stripUndefined, resolveChallengeRiddles, type Firestore, type RaceChallengeRecord} from "./raceSetupService";
import {parseRaceInvitation, assertRaceInvitationOpen, type RaceInvitationRecord} from "./raceInvitationRecord";
import {raceProviderScope, assertRaceChallengeEligible} from "./raceEligibility";
import {bindRaceRequest, assertRaceRequestReplay, rejectRaceRequestReuse} from "./raceRequestBinding";

/** Storage and clock adapters shared by invitation behaviour tests. */
type InvitationOptions = {
  /** Authoritative Firestore adapter. */ db?: Firestore;
  /** Deterministic wall-clock adapter. */ nowMs?: number;
  /** Negotiated response field; legacy clients retain their exact contract. */ includeViewerRole?: boolean;
  /** Opt-in recovery pointer visible only to the attempt owner. */ includeExistingAttempt?: boolean;
};
/** Removes all private identities from the independent lifecycle facts. */
const invitationView = (invitation: RaceInvitationRecord, userId: string): RaceInvitationView => ({
  claimState: invitation.claimState, publicationState: invitation.publicationState,
  role: invitation.creatorId === userId ? "creator" : "recipient",
  canCancel: invitation.creatorId === userId && invitation.cancelledAtMs === undefined,
  expiresAtMs: invitation.expiresAtMs,
});
/** Reserves an idempotent, expiring invite lobby before any provider share UI opens. */
export async function reserveRaceInviteForUser(
  userId: string,
  input: ReserveRaceInviteRequest,
  options: {
    /** Optional Firestore boundary used by integration tests. */
    db?: Firestore;
    /** Optional clock boundary used by integration tests. */
    nowMs?: number;
  } = {},
): Promise<ReserveRaceInviteResponse> {
  /** Authoritative storage and time boundary. */
  const db = dbOrDefault(options.db);
  /** Current server time used for creation and expiry. */
  const nowMs = options.nowMs ?? Date.now();
  /** Idempotency receipt for this user-scoped reservation request. */
  const requestRef = db.collection("raceInviteRequests").doc(requestDocumentId(userId, input.requestId));
  /** Reservation language is immutable for an accepted request identity. */
  const commandBinding = bindRaceRequest({kind: "reserve", input});
  /** Non-reversible creator component used to namespace the opaque challenge ID. */
  const ownerHash = createHash("sha256").update(userId).digest("hex");
  /** Opaque challenge identifier sent through the Jest referral entry payload. */
  const challengeId = `jest-invite-${ownerHash}-${randomUUID().replace(/-/g, "")}`;
  /** Authoritative two-seat lobby document. */
  const lobbyRef = db.collection("raceInviteLobbies").doc(challengeId);
  /** Shared expiration timestamp for the lobby and request receipt. */
  const expiresAtMs = nowMs + RACE_CHALLENGE_TTL_MS;
  /** Validated response persisted for idempotent replays. */
  const response = ReserveRaceInviteResponseSchema.parse({challengeId, expiresAtMs});
  return db.runTransaction(async (transaction) => {
    /** Existing idempotency receipt, when the request was already handled. */
    const existing = await transaction.get(requestRef);
    /** Deletion is checked even when replaying an earlier reservation receipt. */
    const deletion = await transaction.get(getJestAccountDeletionRef(db, userId));
    if (deletion.exists) throw new HttpsError("permission-denied", "Race invitation account is deleted.");
    if (existing.exists) {
      /** Historical receipts prove their retained language through the original canonical lobby. */
      const bound = assertRaceRequestReplay(existing.data(), userId, commandBinding);
      /** Response schema validation precedes any privacy or lifecycle writes. */
      const cached = ReserveRaceInviteResponseSchema.parse(existing.data()?.response);
      if (!bound) {
        /** The original reservation remains the authority for legacy language and ownership. */
        const original = await transaction.get(db.doc(`raceInviteLobbies/${cached.challengeId}`));
        if (!original.exists || original.data()?.creatorId !== userId) throw new HttpsError("data-loss", "Stored race request is invalid.");
        if (original.data()?.locale !== input.locale) rejectRaceRequestReuse();
      }
      return cached;
    }
    /** Firestore TTL timestamp shared by both reservation documents. */
    const expiresAt = admin.firestore.Timestamp.fromMillis(expiresAtMs);
    transaction.create(lobbyRef, {
      challengeId,
      creatorId: userId,
      locale: input.locale,
      status: "inviting",
      claimState: "unclaimed",
      publicationState: "pending",
      createdAtMs: nowMs,
      expiresAtMs,
      expiresAt,
    });
    transaction.create(requestRef, {userId, commandBinding, createdAtMs: nowMs, response, expiresAt});
    return response;
  });
}


/** Validates only the authenticated player's one canonical accepted-attempt pointer. */
async function readAcceptedRaceEntry(transaction: FirebaseFirestore.Transaction, db: Firestore, userId: string, challengeId: string, locale: RaceLocale): Promise<{
  /** Original accepted identity, never selected by a client-supplied run ID. */ runId?: string;
  /** Existing pointer failures retain typed readiness classifications. */ reason?: "invalid" | "missing";
}> {
  /** A recorded acceptance belongs to this exact challenge and authenticated player. */
  const attempt = await transaction.get(db.doc(`raceAttempts/${requestDocumentId(challengeId, userId)}`));
  if (!attempt.exists) return {};
  /** Stored acceptance identity is checked before its referenced run is read. */
  const data = attempt.data();
  if (data?.playerId !== userId || data.challengeId !== challengeId || typeof data.runId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(data.runId)) return {reason: "invalid"};
  /** The accepted run remains the original snapshot for recovery and continued scoring. */
  const recordedRun = await transaction.get(db.doc(`raceRuns/${data.runId}`));
  if (!recordedRun.exists) return {reason: "missing"};
  /** Parsing is pure; infrastructure failures from the read above propagate separately. */
  let run;
  try {run = parseRunRecord(recordedRun.data(), data.runId);} catch (error) {
    if (error instanceof HttpsError) return {reason: "invalid"};
    throw error;
  }
  if (run.userId !== userId || run.challengeId !== challengeId || run.role !== "challenger" || run.locale !== locale) return {reason: "invalid"};
  return {runId: run.runId};
}

/** Internal authorized facts support the old preview contract without a second transaction or public identity exposure. */
type RaceEntryResolution = {
  /** Public response retains the existing typed entry contract. */ entry: RaceEntryResponse;
  /** Only authorization-complete lifecycle branches may retain their original recording metadata. */ challenge?: RaceChallengeRecord;
  /** Private lifecycle facts never enter the public response object. */ invitation?: RaceInvitationRecord;
};

/** Legacy claim contract retained while lifecycle-aware readers migrate. */
export async function claimRaceInviteForUser(userId: string, challengeId: string, locale: RaceLocale, options: InvitationOptions = {}): Promise<boolean> {
  if (!challengeId.startsWith("jest-invite-")) return false;
  /** Firestore adapter for the authorization transaction. */
  const db = dbOrDefault(options.db);
  /** Authority wall-clock, never a client timestamp. */
  const nowMs = options.nowMs ?? Date.now();
  return db.runTransaction(async transaction => {
    /** Reservation and durable publication facts must be read before claiming. */
    const [snapshot, challenge] = await Promise.all([transaction.get(db.doc(`raceInviteLobbies/${challengeId}`)), transaction.get(db.doc(`raceChallenges/${challengeId}`))]);
    if (!snapshot.exists) return false;
    /** Independent facts recover publication-before-claim in old documents. */
    const invitation = parseRaceInvitation(snapshot.data(), challenge.exists, snapshot.id);
    assertRaceInvitationOpen(invitation, nowMs);
    if (invitation.locale !== locale) throw new HttpsError("failed-precondition", "RaceTo10.ERROR_LOCALE_MISMATCH");
    if (invitation.creatorId === userId) throw new HttpsError("failed-precondition", "The creator cannot claim their own invite.");
    if (raceProviderScope(userId) !== raceProviderScope(invitation.creatorId)) assertRaceChallengeEligible("provider");
    /** A legacy caller cannot claim a seat for either deleted identity. */
    const deletions = await Promise.all([transaction.get(getJestAccountDeletionRef(db, userId)), transaction.get(getJestAccountDeletionRef(db, invitation.creatorId))]);
    if (deletions.some(deletion => deletion.exists)) throw new HttpsError("permission-denied", "Race invitation account is deleted.");
    await assertRaceInteractionAllowed(transaction, db, userId, invitation.creatorId);
    if (invitation.recipientId && invitation.recipientId !== userId) throw new HttpsError("already-exists", "Race invite lobby has already been claimed.");
    if (challenge.exists) {
      /** The reservation and publication must describe the same original creator and language. */
      const recording = parseChallengeRecord(challenge.data(), challenge.id);
      if (recording.creatorId !== invitation.creatorId) throw new HttpsError("data-loss", "Stored race challenge identity does not match its document.");
      if (recording.locale !== locale) throw new HttpsError("failed-precondition", "RaceTo10.ERROR_LOCALE_MISMATCH");
      try {
        assertRaceChallengeEligible(recording.status !== "active" || recording.expiresAtMs <= nowMs ? "inactive" : null);
        await resolveChallengeRiddles(db, locale, recording, transaction);
      } catch (error) {
        if (!(error instanceof HttpsError) || invitation.recipientId !== userId) throw error;
        /** A seat alone is insufficient; only a validated previously accepted run can recover unusable source content. */
        const accepted = await readAcceptedRaceEntry(transaction, db, userId, challengeId, locale);
        if (!accepted.runId) throw error;
      }
    }
    if (!invitation.recipientId) transaction.update(snapshot.ref, {recipientId: userId, claimState: "claimed", publicationState: invitation.publicationState,
      status: invitation.publicationState === "published" ? "published" : "claimed", claimedAtMs: nowMs});
    return true;
  });
}

/** Resolves public readiness and authorization-complete legacy metadata in one admission transaction. */
async function resolveRaceEntryForUser(userId: string, challengeId: string, locale: RaceLocale, options: InvitationOptions = {}): Promise<RaceEntryResolution> {
  /** Authoritative storage adapter. */
  const db = dbOrDefault(options.db);
  /** Server clock included for client waiting/expiry calculations. */
  const serverNowMs = options.nowMs ?? Date.now();
  return db.runTransaction(async transaction => {
    /** Public recording and exclusive reservation are independent records. */
    const [reservation, recording, userDeletion] = await Promise.all([
      transaction.get(db.doc(`raceInviteLobbies/${challengeId}`)), transaction.get(db.doc(`raceChallenges/${challengeId}`)), transaction.get(getJestAccountDeletionRef(db, userId)),
    ]);
    if (userDeletion.exists) return {entry: {status: "unavailable", reason: "deleted", serverNowMs}};
    /** Missing exclusive authorization must never become a public recording. */
    if (!reservation.exists && (!recording.exists || recording.data()?.scope === "invitation" || challengeId.startsWith("jest-invite-"))) return {entry: {status: "unavailable", reason: "missing", serverNowMs}};
    /** Validated independent invitation facts, if this is a private reservation. */
    let invitation: RaceInvitationRecord | undefined;
    if (reservation.exists) {
      try {invitation = parseRaceInvitation(reservation.data(), recording.exists, reservation.id);} catch (error) {
        if (error instanceof HttpsError) return {entry: {status: "unavailable", reason: "invalid", serverNowMs}};
        throw error;
      }
      if (invitation.challengeId !== challengeId) return {entry: {status: "unavailable", reason: "invalid", serverNowMs}};
    }
    /** A valid reservation remains independent of an incompatible recording. */
    let challenge: RaceChallengeRecord | undefined;
    /** Only structural recording failures can use the creator's negotiated recovery facts. */
    let recordingInvalid = false;
    if (recording.exists) {
      try {challenge = parseChallengeRecord(recording.data(), recording.id);} catch (error) {
        if (error instanceof HttpsError) recordingInvalid = true;
        else throw error;
      }
    }
    /** Creator identity never comes from the client or from a referral payload. */
    const creatorId = invitation?.creatorId ?? challenge?.creatorId;
    if (!creatorId || invitation && recording.exists && recording.data()?.creatorId !== invitation.creatorId) return {entry: {status: "unavailable", reason: "invalid", serverNowMs}};
    if (challenge && invitation && (challenge.creatorId !== creatorId || challenge.locale !== invitation.locale)) return {entry: {status: "unavailable", reason: "invalid", serverNowMs}};
    /** Account deletion and bidirectional blocks protect both waiting and ready reads. */
    const [creatorDeletion, outgoingBlock, incomingBlock] = await Promise.all([
      transaction.get(getJestAccountDeletionRef(db, creatorId)), transaction.get(db.doc(`users/${userId}/blockedRivals/${creatorId}`)), transaction.get(db.doc(`users/${creatorId}/blockedRivals/${userId}`)),
    ]);
    if (creatorDeletion.exists) return {entry: {status: "unavailable", reason: "deleted", serverNowMs}};
    if (outgoingBlock.exists || incomingBlock.exists) return {entry: {status: "unavailable", reason: "blocked", serverNowMs}};
    if (raceProviderScope(userId) !== raceProviderScope(creatorId)) return {entry: {status: "unavailable", reason: "inactive", serverNowMs}};
    if ((invitation?.locale ?? challenge?.locale) !== locale) return {entry: {status: "unavailable", reason: "locale", serverNowMs}};
    if (invitation?.recipientId && invitation.recipientId !== userId && invitation.creatorId !== userId) return {entry: {status: "unavailable", reason: "claimed", serverNowMs}};
    if (invitation?.cancelledAtMs !== undefined) return {entry: {status: "cancelled", invitation: invitationView(invitation, userId), serverNowMs}, challenge, invitation};
    if (invitation && invitation.expiresAtMs <= serverNowMs || challenge && challenge.expiresAtMs <= serverNowMs) return {entry: RaceEntryResponseSchema.parse(stripUndefined({status: "expired", invitation: invitation && invitationView(invitation, userId), serverNowMs})), challenge, invitation};
    if (recordingInvalid) return {entry: options.includeViewerRole && invitation?.creatorId === userId
      ? RaceEntryResponseSchema.parse({status: "unavailable", reason: "invalid", invitation: {...invitationView(invitation, userId), role: "creator"}, serverNowMs})
      : {status: "unavailable", reason: "invalid", serverNowMs}};
    if (challenge && challenge.status !== "active") return {entry: {status: "unavailable", reason: "inactive", serverNowMs}, challenge, invitation};
    /** Recover the one accepted attempt rather than advertising a forbidden second start. */
    let existingRunId: string | undefined;
    if (options.includeExistingAttempt && challenge && creatorId !== userId) {
      /** Negotiated owner recovery preserves the original missing/invalid pointer classifications. */
      const accepted = await readAcceptedRaceEntry(transaction, db, userId, challengeId, locale);
      if (accepted.reason) return {entry: {status: "unavailable", reason: accepted.reason, serverNowMs}};
      existingRunId = accepted.runId;
    }
    if (challenge && creatorId !== userId && !existingRunId) {
      try {await resolveChallengeRiddles(db, locale, challenge, transaction);} catch (error) {
        if (!(error instanceof HttpsError)) throw error;
        if (options.includeExistingAttempt) return {entry: {status: "unavailable", reason: "invalid", serverNowMs}};
        /** Older entry responses still recover accepted players, without exposing an unrequested pointer. */
        const accepted = await readAcceptedRaceEntry(transaction, db, userId, challengeId, locale);
        if (!accepted.runId) return {entry: {status: "unavailable", reason: accepted.reason ?? "invalid", serverNowMs}};
      }
    }
    if (invitation && userId !== invitation.creatorId && !invitation.recipientId) {
      invitation = {...invitation, recipientId: userId, claimState: "claimed"};
      transaction.update(reservation.ref, {recipientId: userId, claimState: "claimed", publicationState: invitation.publicationState,
        status: invitation.publicationState === "published" ? "published" : "claimed", claimedAtMs: serverNowMs});
    }
    if (!challenge) return {entry: {status: "waiting", invitation: invitationView(invitation!, userId), serverNowMs}, challenge, invitation};
    return {entry: RaceEntryResponseSchema.parse(stripUndefined({status: "ready", challenge: challengePreview(challenge, serverNowMs), existingRunId, viewerRole: options.includeViewerRole ? (creatorId === userId ? "creator" : "recipient") : undefined, invitation: invitation && invitationView(invitation, userId), serverNowMs})), challenge, invitation};
  });
}

/** Reads typed readiness and claims only an available exclusive recipient seat. */
export async function getRaceEntryForUser(userId: string, challengeId: string, locale: RaceLocale, options: InvitationOptions = {}): Promise<RaceEntryResponse> {
  return (await resolveRaceEntryForUser(userId, challengeId, locale, options)).entry;
}

/** Legacy preview clients share authenticated admission while retaining answer-free inactive metadata. */
export async function getRaceChallengeForUser(userId: string, challengeId: string, locale: RaceLocale, options: InvitationOptions = {}): Promise<RaceChallengePreview> {
  /** Only authorization-complete branches retain private facts for this legacy adapter. */
  const {entry, invitation, challenge} = await resolveRaceEntryForUser(userId, challengeId, locale, options);
  if (invitation) {
    assertRaceInvitationOpen(invitation, entry.serverNowMs);
    if (invitation.creatorId === userId) throw new HttpsError("failed-precondition", "The creator cannot claim their own invite.");
  }
  if (entry.status === "ready") return entry.challenge;
  // Closed public recordings retain the old preview's inactive status, with no new claim.
  if (challenge && (entry.status === "expired" || entry.status === "unavailable" && entry.reason === "inactive")) return challengePreview(challenge, entry.serverNowMs);
  if (entry.status === "waiting" || entry.status === "unavailable" && entry.reason === "missing") throw new HttpsError("not-found", "Race to 10 challenge not found.");
  if (entry.status === "unavailable" && entry.reason === "claimed") throw new HttpsError("already-exists", "Race invite lobby has already been claimed.");
  if (entry.status === "unavailable" && entry.reason === "invalid") throw new HttpsError("data-loss", "The frozen race questions are not compatible with gameplay.");
  /** Only authenticated eligibility reasons reach the generic rejection mapping. */
  const reason = entry.status === "unavailable" ? entry.reason : undefined;
  if (reason === "blocked" || reason === "deleted" || reason === "locale") assertRaceChallengeEligible(reason);
  else assertRaceChallengeEligible(reason === "inactive" ? "provider" : "inactive");
  throw new HttpsError("failed-precondition", "Race invitation is cancelled.");
}

/** Cancels a creator-owned reserved invitation, preserving all already-issued run snapshots. */
export async function cancelRaceInviteForUser(userId: string, input: CancelRaceInviteRequest, options: InvitationOptions = {}): Promise<RaceEntryResponse> {
  /** Authoritative storage adapter. */
  const db = dbOrDefault(options.db);
  /** Authority cancellation clock. */
  const serverNowMs = options.nowMs ?? Date.now();
  return db.runTransaction(async transaction => {
    /** Cancel receipts are namespaced separately from reservation receipts. */
    const receiptRef = db.doc(`raceInviteRequests/${requestDocumentId(userId, `cancel:${input.requestId}`)}`);
    /** All authorization reads precede mutation writes. */
    const [receipt, reservation, recording, deletion] = await Promise.all([
      transaction.get(receiptRef), transaction.get(db.doc(`raceInviteLobbies/${input.challengeId}`)), transaction.get(db.doc(`raceChallenges/${input.challengeId}`)), transaction.get(getJestAccountDeletionRef(db, userId)),
    ]);
    if (deletion.exists) throw new HttpsError("permission-denied", "Race invitation account is deleted.");
    if (!reservation.exists) throw new HttpsError("not-found", "Race invitation is unavailable.");
    /** Cancellation never acts on a reusable public challenge. */
    const invitation = parseRaceInvitation(reservation.data(), recording.exists, reservation.id);
    if (invitation.challengeId !== input.challengeId || recording.exists && recording.data()?.creatorId !== invitation.creatorId) throw new HttpsError("failed-precondition", "Race invitation recording is invalid.");
    if (invitation.creatorId !== userId) throw new HttpsError("permission-denied", "Only the invitation creator can cancel.");
    if (invitation.locale !== input.locale) throw new HttpsError("failed-precondition", "RaceTo10.ERROR_LOCALE_MISMATCH");
    if (receipt.exists) {
      if (receipt.data()?.challengeId !== input.challengeId) throw new HttpsError("already-exists", "Cancellation receipt belongs to another invitation.");
      assertRaceRequestReplay(receipt.data(), userId, bindRaceRequest({kind: "cancel", input}));
      return RaceEntryResponseSchema.parse(receipt.data()?.response);
    }
    /** Cancelled state remains terminal even when storage TTL cleanup runs later. */
    const cancelled = {...invitation, cancelledAtMs: invitation.cancelledAtMs ?? serverNowMs};
    /** No private identities leave the cancellation response. */
    const response = RaceEntryResponseSchema.parse({status: "cancelled", invitation: invitationView(cancelled, userId), serverNowMs});
    transaction.update(reservation.ref, {cancelledAtMs: cancelled.cancelledAtMs, claimState: invitation.claimState, publicationState: invitation.publicationState});
    if (recording.exists) transaction.update(recording.ref, {status: "revoked"});
    transaction.create(receiptRef, {userId, challengeId: input.challengeId, commandBinding: bindRaceRequest({kind: "cancel", input}),
      response, createdAtMs: serverNowMs, expiresAt: admin.firestore.Timestamp.fromMillis(Math.max(serverNowMs + 86400000, invitation.expiresAtMs))});
    return response;
  });
}
