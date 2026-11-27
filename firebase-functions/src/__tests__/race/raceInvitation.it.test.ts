import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {reserveRaceInviteForUser, claimRaceInviteForUser, getRaceEntryForUser, cancelRaceInviteForUser} from "../../race/invitations/raceInvitation";
import {getAccountDeletionRef} from "../../shared/accountDeletion";
import {startRaceRunForUser, submitRaceGuessForUser, publishRaceChallengeForUser, resumeRaceRunForUser} from "../../race/raceService";

/** Isolated emulator project selected by the invoking test command. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "demo-race-invitation";
/** Fixed authority time, independent of browser and emulator clocks. */
const NOW = 1800000000000;
/** Real transactional storage adapter. */
let db: FirebaseFirestore.Firestore;
beforeAll(() => {
  if (!getApps().length) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all(["raceInviteLobbies", "raceInviteRequests", "raceChallenges", "jestAccountDeletionTombstones", "users", "localizedRiddles", "raceRuns", "raceDecks", "raceStartRequests", "raceAttempts", "raceMatchCandidates", "raceSettlementOutbox", "racePerformanceOutbox"].map(name => db.recursiveDelete(db.collection(name))));
});
/** Reserve through the production interface with deterministic authority time. */
const reserve = (requestId = "reserve-invitation-1") => reserveRaceInviteForUser("creator", {locale: "en", requestId}, {db, nowMs: NOW});
/** Publishes a completed recording through the real authority seam. */
const record = async (challengeId: string) => {
  /** Validated canonical pool contains the complete immutable race deck. */
  const batch = db.batch();
  for (let index = 0; index < 30; index++) batch.set(db.doc(`localizedRiddles/en/riddles/invitation-${index}`), {
    riddleId: `en-invitation-${index}`, canonicalRiddleId: `invitation:${index}`, text: `Unique invitation clue ${index} follows its own path`, answer: `w${String(index).padStart(6, "0")}`,
    categoryId: "history", difficultyBand: ["easy", "medium", "hard"][index % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  batch.set(db.doc("users/creator"), {displayName: "Nova"});
  await batch.commit();
  /** Authority issues the immutable creator deck. */
  const start = await startRaceRunForUser("creator", {locale: "en", categoryId: "history", requestId: `record-${challengeId}`}, {db, nowMs: NOW});
  for (let index = 0; index < 10; index++) {
    /** Answer comes from the test's authoritative storage adapter. */
    const run = (await db.doc(`raceRuns/${start.run.runId}`).get()).data()!;
    /** Current immutable content determines the correct authority mutation. */
    const riddle = run.riddles[run.currentPosition];
    await submitRaceGuessForUser("creator", {runId: start.run.runId, riddleId: riddle.riddleId, guess: riddle.answer, requestId: `${challengeId}-${index}`}, {db, nowMs: NOW + 1000 + index * 1000});
  }
  return publishRaceChallengeForUser("creator", {runId: start.run.runId, requestId: `publish-${challengeId}`, reservedChallengeId: challengeId}, {db, nowMs: NOW + 12000});
};

describe("Race Invitation transactional lifecycle", () => {
  it.each([
    {creator: `facebook_${"a".repeat(40)}`, recipient: "legacy-recipient"},
    {creator: "legacy-creator", recipient: `facebook_${"b".repeat(40)}`},
    {creator: `facebook_${"a".repeat(40)}`, recipient: `reddit_${"b".repeat(40)}`},
  ])("does not expose or claim an invitation across provider/legacy namespaces: %j", async identities => {
    /** Reservation records belong to the authenticated creator namespace. */
    const invitation = await reserveRaceInviteForUser(identities.creator, {locale: "en", requestId: "provider-reserve"}, {db, nowMs: NOW});
    await expect(getRaceEntryForUser(identities.recipient, invitation.challengeId, "en", {db, nowMs: NOW + 1}))
      .resolves.toMatchObject({status: "unavailable", reason: "inactive"});
    expect((await db.doc(`raceInviteLobbies/${invitation.challengeId}`).get()).data()?.claimState).toBe("unclaimed");
  });
  it.each([true, false])("preserves independent facts when publication precedes claim: %s", async publicationFirst => {
    /** Authority-issued opaque reservation. */
    const reserved = await reserve();
    if (publicationFirst) await record(reserved.challengeId);
    /** Creator recovery reads cannot occupy the recipient seat. */
    const creator = await getRaceEntryForUser("creator", reserved.challengeId, "en", {db, nowMs: NOW + 1});
    expect(creator).toMatchObject({invitation: {role: "creator", canCancel: true, claimState: "unclaimed"}});
    /** First recipient claims atomically, whether the recording exists or is pending. */
    const recipient = await getRaceEntryForUser("recipient", reserved.challengeId, "en", {db, nowMs: NOW + 2});
    expect(recipient).toMatchObject({status: publicationFirst ? "ready" : "waiting", invitation: {role: "recipient", claimState: "claimed", publicationState: publicationFirst ? "published" : "pending"}});
    if (!publicationFirst) await record(reserved.challengeId);
    await expect(getRaceEntryForUser("recipient", reserved.challengeId, "en", {db, nowMs: NOW + 3})).resolves.toMatchObject({status: "ready", invitation: {claimState: "claimed", publicationState: "published"}});
    await expect(claimRaceInviteForUser("recipient", reserved.challengeId, "en", {db, nowMs: NOW + 4})).resolves.toBe(true);
    expect((await db.doc(`raceInviteLobbies/${reserved.challengeId}`).get()).data()).toMatchObject({recipientId: "recipient", claimState: "claimed"});
    expect(JSON.stringify(recipient)).not.toContain("creatorId");
    expect(JSON.stringify(recipient)).not.toContain("recipientId");
  });
  it("negotiates creator facts for public recordings without changing legacy responses or reserving a seat", async () => {
    /** Private reservation supplies the original recording used by public-entry recovery tests. */
    const reserved = await reserve();
    await record(reserved.challengeId);
    /** Validated stored recording copied into a reusable public challenge fixture. */
    const stored = (await db.doc(`raceChallenges/${reserved.challengeId}`).get()).data()!;
    /** Public recording identity selected independently of the private reservation. */
    const challengeId = "public-owner-recovery";
    await db.doc(`raceChallenges/${challengeId}`).set({...stored, challengeId, scope: "public"});
    /** Negotiated creator entry proves results access without claiming the recipient seat. */
    const creator = await getRaceEntryForUser("creator", challengeId, "en", {db, nowMs: NOW + 13000, includeViewerRole: true});
    expect(creator).toMatchObject({status: "ready", viewerRole: "creator"});
    expect(creator).not.toHaveProperty("invitation");
    /** Negotiated recipient entry verifies public challenge acceptance context. */
    const recipient = await getRaceEntryForUser("recipient", challengeId, "en", {db, nowMs: NOW + 13000, includeViewerRole: true});
    expect(recipient).toMatchObject({status: "ready", viewerRole: "recipient"});
    expect(recipient).not.toHaveProperty("invitation");
    /** Legacy entry response must omit unrequested negotiated recovery fields. */
    const legacy = await getRaceEntryForUser("creator", challengeId, "en", {db, nowMs: NOW + 13000});
    expect(legacy).toMatchObject({status: "ready"});
    expect(legacy).not.toHaveProperty("viewerRole");
    expect(JSON.stringify(creator)).not.toContain("creatorId");
    expect((await db.doc(`raceInviteLobbies/${challengeId}`).get()).exists).toBe(false);
    await expect(startRaceRunForUser("creator", {locale: "en", challengeId, requestId: "self-accept-rejected"}, {db, nowMs: NOW + 13000}))
      .rejects.toMatchObject({code: "failed-precondition"});
  });
  it("exposes an accepted run only to its owner and only when recovery is requested", async () => {
    /** Private reservation supplies the original recording used by public-entry recovery tests. */
    const reserved = await reserve();
    await record(reserved.challengeId);
    /** Validated stored recording copied into a reusable public challenge fixture. */
    const stored = (await db.doc(`raceChallenges/${reserved.challengeId}`).get()).data()!;
    /** Public recording identity selected independently of the private reservation. */
    const challengeId = "public-played-recovery";
    await db.doc(`raceChallenges/${challengeId}`).set({...stored, challengeId, scope: "public"});
    /** Server-authoritative accepted attempt provides the owner-bound recovery pointer. */
    const started = await startRaceRunForUser("recipient", {locale: "en", challengeId, requestId: "accepted-once"}, {db, nowMs: NOW + 13000});
    /** Explicit authority clock and negotiated fields for accepted-attempt recovery. */
    const options = {db, nowMs: NOW + 14000, includeViewerRole: true, includeExistingAttempt: true};
    await expect(getRaceEntryForUser("recipient", challengeId, "en", options)).resolves.toMatchObject({status: "ready", existingRunId: started.run.runId, viewerRole: "recipient"});
    /** Legacy entry response must omit unrequested negotiated recovery fields. */
    const legacy = await getRaceEntryForUser("recipient", challengeId, "en", {db, nowMs: NOW + 14000, includeViewerRole: true});
    expect(legacy).not.toHaveProperty("existingRunId");
    /** Another recipient's entry must not expose the first player's accepted run. */
    const other = await getRaceEntryForUser("stranger", challengeId, "en", options);
    expect(other).toMatchObject({status: "ready"});
    expect(other).not.toHaveProperty("existingRunId");
    for (let index = 0; index < 10; index++) {
      /** Canonical run fixture retains identity and competitive facts for recovery assertions. */
      const run = (await db.doc(`raceRuns/${started.run.runId}`).get()).data()!;
      /** Canonical next question supplied by the current authority-owned content state. */
      const riddle = run.riddles[run.currentPosition];
      await submitRaceGuessForUser("recipient", {runId: started.run.runId, riddleId: riddle.riddleId, guess: riddle.answer, requestId: `played-${index}`}, {db, nowMs: NOW + 14000 + index * 500});
    }
    await expect(getRaceEntryForUser("recipient", challengeId, "en", {...options, nowMs: NOW + 26000})).resolves.toMatchObject({status: "ready", existingRunId: started.run.runId});
    await db.doc(`raceRuns/${started.run.runId}`).update({userId: "stranger"});
    await expect(getRaceEntryForUser("recipient", challengeId, "en", options)).resolves.toMatchObject({status: "unavailable", reason: "invalid"});
  });
  it("allows exactly one concurrent recipient and retains the seat on recovery", async () => {
    /** Exclusive two-seat invitation. */
    const reserved = await reserve();
    /** Simultaneous recipient transactions race on the same canonical reservation. */
    const results = await Promise.all(["one", "two", "three"].map(userId => getRaceEntryForUser(userId, reserved.challengeId, "en", {db, nowMs: NOW + 1})));
    expect(results.filter(result => result.status === "waiting")).toHaveLength(1);
    expect(results.filter(result => result.status === "unavailable" && result.reason === "claimed")).toHaveLength(2);
    /** Durable owner remains recoverable without another claim. */
    const winner = (await db.doc(`raceInviteLobbies/${reserved.challengeId}`).get()).data()!.recipientId;
    await expect(getRaceEntryForUser(winner, reserved.challengeId, "en", {db, nowMs: NOW + 2})).resolves.toMatchObject({status: "waiting", invitation: {claimState: "claimed"}});
  });
  it("cancels idempotently, revokes future entry, and rejects recipient or cross-target receipts", async () => {
    /** Reservation with a published recording. */
    const reserved = await reserve();
    await record(reserved.challengeId);
    await getRaceEntryForUser("recipient", reserved.challengeId, "en", {db, nowMs: NOW + 1});
    /** Already-issued challenger snapshots remain playable after cancellation. */
    const issued = await startRaceRunForUser("recipient", {locale: "en", challengeId: reserved.challengeId, requestId: "issued-invitation-run"}, {db, nowMs: NOW + 13000});
    /** Creator-only receipt tied to this exact invitation. */
    const input = {challengeId: reserved.challengeId, locale: "en" as const, requestId: "cancel-invitation-1"};
    await expect(cancelRaceInviteForUser("recipient", input, {db, nowMs: NOW + 2})).rejects.toMatchObject({code: "permission-denied"});
    /** First terminal response is replayed rather than issuing a second cancellation. */
    const cancelled = await cancelRaceInviteForUser("creator", input, {db, nowMs: NOW + 3});
    await expect(cancelRaceInviteForUser("creator", input, {db, nowMs: NOW + 4})).resolves.toEqual(cancelled);
    expect(cancelled).toMatchObject({status: "cancelled", invitation: {claimState: "claimed", publicationState: "published", canCancel: false}});
    expect((await db.doc(`raceChallenges/${reserved.challengeId}`).get()).data()!.status).toBe("revoked");
    await expect(getRaceEntryForUser("recipient", reserved.challengeId, "en", {db, nowMs: NOW + 5})).resolves.toMatchObject({status: "cancelled"});
    await expect(claimRaceInviteForUser("recipient", reserved.challengeId, "en", {db, nowMs: NOW + 6})).rejects.toMatchObject({code: "failed-precondition"});
    await expect(resumeRaceRunForUser("recipient", issued.run.runId, {db, nowMs: NOW + 14000})).resolves.toMatchObject({run: {runId: issued.run.runId, status: "active"}});
    /** Another creator-owned target cannot reuse an earlier cancellation receipt. */
    const other = await reserve("reserve-invitation-2");
    await expect(cancelRaceInviteForUser("creator", {...input, challengeId: other.challengeId}, {db, nowMs: NOW + 7})).rejects.toMatchObject({code: "already-exists"});
  });
  it("fails closed for expiry, locale mismatch, blocks, deletion and malformed legacy facts", async () => {
    /** Pending invitation can be inspected without publishing content. */
    const reserved = await reserve();
    await expect(getRaceEntryForUser("recipient", reserved.challengeId, "es", {db, nowMs: NOW + 1})).resolves.toMatchObject({status: "unavailable", reason: "locale"});
    await db.doc("users/creator/blockedRivals/recipient").set({blocked: true});
    await expect(getRaceEntryForUser("recipient", reserved.challengeId, "en", {db, nowMs: NOW + 2})).resolves.toMatchObject({status: "unavailable", reason: "blocked"});
    await db.doc("users/creator/blockedRivals/recipient").delete();
    await getAccountDeletionRef(db, "creator").set({deletedAtMs: NOW});
    await expect(getRaceEntryForUser("recipient", reserved.challengeId, "en", {db, nowMs: NOW + 3})).resolves.toMatchObject({status: "unavailable", reason: "deleted"});
    await expect(claimRaceInviteForUser("recipient", reserved.challengeId, "en", {db, nowMs: NOW + 3})).rejects.toMatchObject({code: "permission-denied"});
    await expect(reserve()).rejects.toMatchObject({code: "permission-denied"});
    await getAccountDeletionRef(db, "creator").delete();
    await expect(getRaceEntryForUser("recipient", reserved.challengeId, "en", {db, nowMs: reserved.expiresAtMs})).resolves.toMatchObject({status: "expired"});
    await db.doc(`raceInviteLobbies/${reserved.challengeId}`).update({locale: "made-up"});
    await expect(getRaceEntryForUser("recipient", reserved.challengeId, "en", {db, nowMs: NOW + 4})).resolves.toMatchObject({status: "unavailable", reason: "invalid"});
    expect((await db.doc(`raceInviteLobbies/${reserved.challengeId}`).get()).data()!.recipientId).toBeUndefined();
  });
  it("does not publish a recording into a cancelled pending invitation", async () => {
    /** Reserved identity remains terminal even after its creator completes the deck. */
    const reserved = await reserve();
    await cancelRaceInviteForUser("creator", {challengeId: reserved.challengeId, locale: "en", requestId: "cancel-before-publication"}, {db, nowMs: NOW + 1});
    await expect(record(reserved.challengeId)).rejects.toMatchObject({code: "failed-precondition"});
    expect((await db.doc(`raceChallenges/${reserved.challengeId}`).get()).exists).toBe(false);
  });
});

it.each([{status: "claimed"}, {creatorId: "other/account"}, {challengeId: "different-lobby"}, {createdAtMs: -1}, {claimedAtMs: 0.5}])(
  "does not claim or disclose an invalid invitation storage record %j", async changes => {
    /** A legitimate reservation is corrupted only through the admin emulator fixture. */
    const reserved = await reserve();
    await db.doc(`raceInviteLobbies/${reserved.challengeId}`).update(changes);
    await expect(getRaceEntryForUser("recipient", reserved.challengeId, "en", {db, nowMs: NOW + 1}))
      .resolves.toMatchObject({status: "unavailable", reason: "invalid"});
    expect((await db.doc(`raceInviteLobbies/${reserved.challengeId}`).get()).data()?.recipientId).toBeUndefined();
  },
);
