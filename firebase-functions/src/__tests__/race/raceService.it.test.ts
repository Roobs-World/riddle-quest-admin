import {getApps, initializeApp} from "firebase-admin/app";
import {logger} from "firebase-functions";
import {getFirestore} from "firebase-admin/firestore";
import {RACE_CHALLENGE_TTL_MS} from "../../../../src/races/contracts/index.js";
import {
  abandonRaceRunForUser,
  getRaceOutcomeForUser,
  getRaceChallengePreview,
  listRaceInboxForUser,
  publishRaceChallengeForUser,
  reserveRaceInviteForUser,
  readyRaceRunForUser,
  claimRaceInviteForUser,
  requestRaceHintForUser,
  resumeRaceRunForUser,
  skipRaceRiddleForUser,
  startRaceRunForUser,
  submitRaceGuessForUser,
} from "../../race/raceService";
import {removeCrossUserRaceIdentitySnapshots} from "../../profile/accountDeletion/deleteAccountData";
import {requestDocumentId} from "../../race/raceSetupService";
import {deliverRaceSettlement} from "../../race/settlement/raceSettlementDelivery";
import {recordJestAccountDeletion} from "../../../../platforms/web/jest/server/jestAccountDeletion";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
/** Renders the now interface. */
const NOW = 1_800_000_000_000;
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;

/** Creates a manually released promise for deterministic transaction interleavings. */
function deferred(): {
  /** Stores promise. */
  promise: Promise<void>; /** Provides resolve behavior. */
  /** Provides resolve behavior. */
  resolve(): void;
} {
  /** Resolves promise. */
  let resolvePromise: (() => void) | undefined;
  /** Provides promise behavior. */
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {promise, resolve: () => resolvePromise?.()};
}

/** Pauses the first transaction after it reads one selected document. */
function pauseAfterDocumentRead(
  firestore: FirebaseFirestore.Firestore,
  runPath: string,
  parentRead: ReturnType<typeof deferred>,
  release: ReturnType<typeof deferred>,
): FirebaseFirestore.Firestore {
  /** Indicates whether should pause. */
  let shouldPause = true;
  return new Proxy(firestore, {
    /** Provides get behavior. */
    get(target, property) {
      if (property === "runTransaction") {
        return <T>(operation: (transaction: FirebaseFirestore.Transaction) => Promise<T>) =>
          target.runTransaction(async (transaction) =>
            operation(
              new Proxy(transaction, {
                /** Provides get behavior. */
                get(transactionTarget, transactionProperty) {
                  if (transactionProperty === "get") {
                    return async (reference: unknown) => {
                      /** Provides snapshot behavior. */
                      const snapshot = await Reflect.apply(transactionTarget.get, transactionTarget, [reference]);
                      /** Provides reference path behavior. */
                      const referencePath =
                        typeof reference === "object" && reference !== null && "path" in reference
                          ? (
                              reference as {
                                /** Stores path. */
                                path?: unknown;
                              }
                            ).path
                          : undefined;
                      if (shouldPause && referencePath === runPath) {
                        shouldPause = false;
                        parentRead.resolve();
                        await release.promise;
                      }
                      return snapshot;
                    };
                  }
                  /** Provides value behavior. */
                  const value = Reflect.get(transactionTarget, transactionProperty, transactionTarget);
                  return typeof value === "function" ? value.bind(transactionTarget) : value;
                },
              }),
            ),
          );
      }
      /** Provides value behavior. */
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** Clears collection. */
const clearCollection = async (name: string) => {
  await db.recursiveDelete(db.collection(name));
};

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all(
    [
      "localizedRiddles",
      "raceMatchCandidates",
      "raceMatchOffers",
      "raceSettlementOutbox",
      "racePerformanceOutbox",
      "raceRuns",
      "raceDecks",
      "raceChallenges",
      "raceInviteLobbies",
      "raceInviteRequests",
      "raceAttempts",
      "raceStartRequests",
      "jestAccountDeletionTombstones",
      "users",
    ].map(clearCollection),
  );

  /** Provides batch behavior. */
  const batch = db.batch();
  for (let index = 0; index < 30; index += 1) {
    /** Provides difficulty band behavior. */
    const difficultyBand = (["easy", "medium", "hard"] as const)[index % 3];
    batch.set(db.doc(`localizedRiddles/en/riddles/history-${index + 1}`), {
      riddleId: `en-history-${index + 1}`,
      canonicalRiddleId: `history:${index + 1}`,
      text: `Unique race clue ${index + 1} follows a distinct path`,
      answer: `w${String(index + 1).padStart(6, "0")}`,
      categoryId: "history",
      difficultyBand,
      raceEligible: true,
      qualityVersion: "human_review_v1",
    });
  }
  batch.set(db.doc("users/creator-1"), {displayName: "Ada", avatarUrl: "https://example.test/ada.png"});
  batch.set(db.doc("users/challenger-1"), {displayName: "Grace"});
  batch.set(db.doc("users/challenger-2"), {displayName: "Dorothy"});
  batch.set(db.doc("users/challenger-interleave"), {displayName: "Lin"});
  batch.set(db.doc("users/tombstone-challenger"), {displayName: "Katherine"});
  batch.set(db.doc("raceConfig/rollout"), {enabled: true, percentage: 100, allowlistHashes: []});
  await batch.commit();
});

afterAll(async () => {
  await Promise.all(
    [
      "raceMatchCandidates",
      "raceMatchOffers",
      "raceSettlementOutbox",
      "racePerformanceOutbox",
      "raceRuns",
      "raceDecks",
      "raceChallenges",
      "raceInviteLobbies",
      "raceInviteRequests",
      "raceAttempts",
      "raceStartRequests",
      "jestAccountDeletionTombstones",
      "users",
    ].map(clearCollection),
  );
});

describe("Race to 10 transactional service", () => {
  it("observes returned, replayed and failed start commands without logging account or offer identifiers", async () => {
    /** Logs count commands, while existing receipts remain the unique-run authority. */
    const returned = jest.spyOn(logger, "info");
    /** Failed offered entries remain visible even when no accepted run exists. */
    const failed = jest.spyOn(logger, "warn");
    try {
      /** A successful preparation and its duplicate both return the same canonical run. */
      const input = {locale: "en" as const, categoryId: "history" as const, requestId: "telemetry-start-request"};
      /** Original response creates one run. */
      const first = await startRaceRunForUser("creator-1", input, {db, nowMs: NOW});
      expect((await startRaceRunForUser("creator-1", input, {db, nowMs: NOW + 1})).run.runId).toBe(first.run.runId);
      expect(returned.mock.calls.filter(([message]) => message === "Race start command")).toHaveLength(2);
      await expect(startRaceRunForUser("creator-1", {locale: "en", challengeId: "missing-offered-recording",
        offerId: "a".repeat(64), requestId: "telemetry-failed-start"}, {db, nowMs: NOW})).rejects.toMatchObject({code: "not-found"});
      expect(failed).toHaveBeenCalledWith("Race start command", expect.objectContaining({telemetryVersion: 1,
        disposition: "failed", entryKind: "offer", locale: "en", failureCode: "not-found"}));
      expect(JSON.stringify([...returned.mock.calls, ...failed.mock.calls])).not.toMatch(/creator-1|missing-offered-recording|telemetry-start-request/);
    } finally {returned.mockRestore(); failed.mockRestore();}
  });

  it("does not charge preparation or countdown and rejects actions before the immutable scheduled start", async () => {
    /** Provides prepared behavior. */
    const prepared = await startRaceRunForUser("creator-1", {locale: "en", categoryId: "history",
      requestId: "prepared-start-0001", prepare: true, includeEvaluation: true}, {db, nowMs: NOW});
    expect(prepared.run).toMatchObject({status: "prepared", wallElapsedMs: 0, serverNowMs: NOW});
    expect(prepared.run.startsAtMs).toBeUndefined();
    /** Provides scheduled behavior. */
    const scheduled = await readyRaceRunForUser("creator-1", {runId: prepared.run.runId,
      requestId: "prepared-ready-0001", includeEvaluation: true}, {db, nowMs: NOW + 10_000});
    expect(scheduled.run).toMatchObject({status: "scheduled", wallElapsedMs: 0, startsAtMs: NOW + 13_000});
    /** Provides retry behavior. */
    const retry = await readyRaceRunForUser("creator-1", {runId: prepared.run.runId,
      requestId: "prepared-ready-0002"}, {db, nowMs: NOW + 11_000});
    expect(retry.run.startsAtMs).toBe(NOW + 13_000);
    /** Provides concurrent behavior. */
    const concurrent = await Promise.all(Array.from({length: 6}, (_, index) => readyRaceRunForUser("creator-1",
      {runId: prepared.run.runId, requestId: `concurrent-ready-${index}`}, {db, nowMs: NOW + 11_100 + index})));
    expect(concurrent.every((response) => response.run.startsAtMs === NOW + 13_000)).toBe(true);
    /** Provides riddle behavior. */
    const riddle = (await db.doc(`raceRuns/${prepared.run.runId}`).get()).data()!.riddles[0];
    /** Provides guess behavior. */
    const guess = {runId: prepared.run.runId, riddleId: riddle.riddleId, guess: riddle.answer, requestId: "prepared-guess-0001"};
    await expect(submitRaceGuessForUser("creator-1", guess, {db, nowMs: NOW + 12_999})).rejects.toMatchObject({code: "failed-precondition"});
    /** Provides scored behavior. */
    const scored = await submitRaceGuessForUser("creator-1", guess, {db, nowMs: NOW + 13_000});
    expect(scored.run).toMatchObject({status: "active", wallElapsedMs: 0, correctCount: 1});
    /** Provides resumed behavior. */
    const resumed = await resumeRaceRunForUser("creator-1", prepared.run.runId, {db, nowMs: NOW + 18_000});
    expect(resumed.run.wallElapsedMs).toBe(5_000);
  });

  it("expires unready preparation without granting a result or consuming solving time", async () => {
    await db.doc("users/preparation-expiry-player").set({coins: 25});
    /** Provides prepared behavior. */
    const prepared = await startRaceRunForUser("preparation-expiry-player", {locale: "en", categoryId: "history",
      requestId: "expired-preparation-start", prepare: true}, {db, nowMs: NOW});
    /** Provides expired behavior. */
    const expired = await readyRaceRunForUser("preparation-expiry-player", {runId: prepared.run.runId,
      requestId: "expired-preparation-ready"}, {db, nowMs: NOW + 30_000});
    expect(expired.run).toMatchObject({status: "abandoned", wallElapsedMs: 0});
    expect((await db.doc(`raceRuns/${prepared.run.runId}`).get()).data()).toMatchObject({status: "abandoned", result: null});
    expect((await db.doc("users/preparation-expiry-player").get()).data()?.coins).toBe(25);
  });

  it("schedules concurrent initial readiness once and rejects a foreign owner", async () => {
    /** Provides prepared behavior. */
    const prepared = await startRaceRunForUser("creator-1", {locale: "en", categoryId: "history",
      requestId: "concurrent-preparation-start", prepare: true}, {db, nowMs: NOW});
    await expect(readyRaceRunForUser("challenger-1", {runId: prepared.run.runId,
      requestId: "foreign-ready-request"}, {db, nowMs: NOW + 1_000})).rejects.toMatchObject({code: "permission-denied"});
    /** Provides results behavior. */
    const results = await Promise.all(Array.from({length: 6}, (_, index) => readyRaceRunForUser("creator-1",
      {runId: prepared.run.runId, requestId: `initial-ready-${index}`}, {db, nowMs: NOW + 5_000 + index * 100})));
    expect(new Set(results.map((response) => response.run.startsAtMs)).size).toBe(1);
    expect(results[0].run.startsAtMs).toBeGreaterThanOrEqual(NOW + 8_000);
    expect(results[0].run.startsAtMs).toBeLessThanOrEqual(NOW + 8_500);
  });

  it("reserves one Jest invite recipient idempotently", async () => {
    /** Initial server-owned invite lobby reservation. */
    const reservation = await reserveRaceInviteForUser(
      "creator-1",
      {locale: "en", requestId: "reserve-invite-0001"},
      {db, nowMs: NOW + 17_000},
    );
    /** Idempotent replay of the same reservation request. */
    const duplicateReservation = await reserveRaceInviteForUser(
      "creator-1",
      {locale: "en", requestId: "reserve-invite-0001"},
      {db, nowMs: NOW + 17_500},
    );

    expect(duplicateReservation).toEqual(reservation);
    expect(await claimRaceInviteForUser("challenger-1", reservation.challengeId, "en", {db, nowMs: NOW + 18_000}))
      .toBe(true);
    expect(await claimRaceInviteForUser("challenger-1", reservation.challengeId, "en", {db, nowMs: NOW + 18_500}))
      .toBe(true);
    await expect(
      claimRaceInviteForUser("challenger-2", reservation.challengeId, "en", {db, nowMs: NOW + 19_000}),
    ).rejects.toMatchObject({code: "already-exists"});
    expect((await db.doc(`raceInviteLobbies/${reservation.challengeId}`).get()).data()).toMatchObject({
      creatorId: "creator-1",
      recipientId: "challenger-1",
      status: "claimed",
    });
  });

  it("abandons a run idempotently with a persisted null result", async () => {
    /** Starts ed. */
    const started = await startRaceRunForUser(
      "creator-1",
      {locale: "en", categoryId: "history", requestId: "abandon-start-0001"},
      {db, nowMs: NOW + 2_000},
    );
    /** Provides input behavior. */
    const input = {runId: started.run.runId, requestId: "abandon-request-0001"};
    /** Provides first behavior. */
    const first = await abandonRaceRunForUser("creator-1", input, {db, nowMs: NOW + 5_000});
    /** Provides duplicate behavior. */
    const duplicate = await abandonRaceRunForUser("creator-1", input, {db, nowMs: NOW + 6_000});

    expect(duplicate).toEqual(first);
    expect(first).toMatchObject({run: {status: "abandoned", currentRiddle: null}, result: null});
    /** Provides run ref behavior. */
    const runRef = db.doc(`raceRuns/${started.run.runId}`);
    /** Stores d run. */
    const storedRun = (await runRef.get()).data()!;
    expect(storedRun).toMatchObject({
      status: "abandoned",
      result: null,
    });
    /** Provides receipt ref behavior. */
    const receiptRef = runRef.collection("requests").doc(requestDocumentId("creator-1", input.requestId));
    /** Provides receipt behavior. */
    const receipt = (await receiptRef.get()).data()!;
    expect(receipt.expiresAt.toMillis()).toBe(storedRun.expiresAt.toMillis());
    await expect(getRaceOutcomeForUser("creator-1", started.run.runId, {db, nowMs: NOW + 7_000})).rejects.toMatchObject(
      {code: "failed-precondition"},
    );
    await runRef.delete();
    await expect(abandonRaceRunForUser("creator-1", input, {db, nowMs: NOW + 8_000})).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("keeps starts and penalties idempotent and preserves elapsed time on resume", async () => {
    /** Starts input. */
    const startInput = {locale: "en" as const, categoryId: "history" as const, requestId: "start-request-0001"};
    /** Provides first behavior. */
    const first = await startRaceRunForUser("creator-1", startInput, {db, nowMs: NOW});
    /** Provides duplicate behavior. */
    const duplicate = await startRaceRunForUser("creator-1", startInput, {db, nowMs: NOW + 1_000});
    expect(duplicate.run.runId).toBe(first.run.runId);

    /** Provides resumed behavior. */
    const resumed = await resumeRaceRunForUser("creator-1", first.run.runId, {db, nowMs: NOW + 10_000});
    expect(resumed.run.wallElapsedMs).toBe(10_000);
    expect(resumed.run.currentRiddle).not.toHaveProperty("answer");

    /** Provides riddle id behavior. */
    const riddleId = resumed.run.currentRiddle!.riddleId;
    /** Provides hint input behavior. */
    const hintInput = {
      runId: first.run.runId,
      riddleId,
      requestId: "hint-request-0001",
    };
    /** Provides hint behavior. */
    const hint = await requestRaceHintForUser("creator-1", hintInput, {
      db,
      nowMs: NOW + 11_000,
      enforceAccess: true,
    });
    /** Provides duplicate hint behavior. */
    const duplicateHint = await requestRaceHintForUser("creator-1", hintInput, {
      db,
      nowMs: NOW + 12_000,
      enforceAccess: true,
    });
    expect(duplicateHint).toEqual(hint);
    expect(hint.run.totalPenaltyMs).toBe(15_000);
    /** New request ID for a second hint on the same riddle. */
    const nextHintInput = {...hintInput, requestId: "hint-request-0002"};
    /** Authoritative second-hint response. */
    const nextHint = await requestRaceHintForUser("creator-1", nextHintInput, {
      db,
      nowMs: NOW + 12_500,
      enforceAccess: true,
    });
    expect(nextHint.index).toBe(1);
    expect(nextHint.run.totalPenaltyMs).toBe(30_000);
    expect(nextHint.run.currentRiddle?.hintAvailable).toBe(true);
    expect(await requestRaceHintForUser("creator-1", nextHintInput, {
      db,
      nowMs: NOW + 12_750,
      enforceAccess: true,
    })).toEqual(nextHint);

    /** Provides wrong behavior. */
    const wrong = await submitRaceGuessForUser(
      "creator-1",
      {runId: first.run.runId, riddleId, guess: "xxxxxxx", requestId: "guess-request-0001"},
      {db, nowMs: NOW + 13_000},
    );
    expect(wrong.isCorrect).toBe(false);
    /** Provides skip input behavior. */
    const skipInput = {runId: first.run.runId, riddleId, requestId: "skip-request-0001"};
    /** Provides skipped behavior. */
    const skipped = await skipRaceRiddleForUser("creator-1", skipInput, {db, nowMs: NOW + 14_000});
    /** Provides duplicate skip behavior. */
    const duplicateSkip = await skipRaceRiddleForUser("creator-1", skipInput, {db, nowMs: NOW + 15_000});
    expect(duplicateSkip).toEqual(skipped);
    expect(skipped.run.totalPenaltyMs).toBe(75_000);
    expect(skipped.run.correctCount).toBe(1);
  });

  it("finalizes, publishes once, and gives a challenger the identical canonical deck", async () => {
    /** Provides start behavior. */
    const start = await startRaceRunForUser(
      "creator-1",
      {locale: "en", categoryId: "history", requestId: "start-request-0002"},
      {db, nowMs: NOW + 20_000},
    );
    /** Provides run id behavior. */
    const runId = start.run.runId;
    for (let solved = 0; solved < 10; solved += 1) {
      /** Stores d. */
      const stored = (await db.doc(`raceRuns/${runId}`).get()).data()!;
      /** Provides riddle behavior. */
      const riddle = stored.riddles[stored.currentPosition];
      await submitRaceGuessForUser(
        "creator-1",
        {
          runId,
          riddleId: riddle.riddleId,
          guess: riddle.answer,
          requestId: `solve-request-${String(solved).padStart(4, "0")}`,
        },
        {db, nowMs: NOW + 25_000 + solved * 5_000},
      );
    }

    /** Provides creator outcome behavior. */
    const creatorOutcome = await getRaceOutcomeForUser("creator-1", runId, {db, nowMs: NOW + 75_000});
    expect(creatorOutcome).toMatchObject({
      result: "recorded",
      newlyUnlockedAchievementIds: ["race_debut", "race_clean_run"],
      achievementCoinsAwarded: 50,
      newCoins: 50,
    });
    /** Provides repeated creator outcome behavior. */
    const repeatedCreatorOutcome = await getRaceOutcomeForUser("creator-1", runId, {db, nowMs: NOW + 76_000});
    expect(repeatedCreatorOutcome.newlyUnlockedAchievementIds).toEqual([]);
    expect((await db.doc("users/creator-1").get()).data()).toMatchObject({
      coins: 50,
      stats: {multiplayerGamesPlayed: 1, multiplayerWins: 0, multiplayerChallengesCreated: 0},
    });

    /** Publishes input. */
    /** Public recording supports independent challengers used by the settlement/privacy cases below. */
    const publishInput = {runId, requestId: "publish-request-0001"};
    await expect(publishRaceChallengeForUser("another-creator", publishInput, {db, nowMs: NOW + 79_000}))
      .rejects.toMatchObject({code: "permission-denied"});
    /** Publishes ed. */
    const published = await publishRaceChallengeForUser("creator-1", publishInput, {
      db,
      nowMs: NOW + 80_000,
    });
    /** Provides duplicate publish behavior. */
    const duplicatePublish = await publishRaceChallengeForUser("creator-1", publishInput, {
      db,
      nowMs: NOW + 81_000,
    });
    expect(duplicatePublish).toEqual(published);
    expect(published.challengeId).toBeTruthy();
    /** Replayed publication with a new request ID. */
    const replay = await publishRaceChallengeForUser("creator-1", {...publishInput, requestId: "publish-request-replay"}, {
      db,
      nowMs: NOW + 81_500,
    });
    expect(replay.challengeId).toBe(published.challengeId);
    expect(replay.achievementCoinsAwarded).toBe(0);
    expect(published).toMatchObject({
      newlyUnlockedAchievementIds: ["race_host"],
      achievementCoinsAwarded: 25,
      newCoins: 75,
    });
    expect(
      JSON.stringify(await getRaceChallengePreview(published.challengeId, "en", {db, nowMs: NOW + 82_000})),
    ).not.toMatch(/answer|riddles|ghostEvents/);
    await expect(getRaceChallengePreview(published.challengeId, "ja", {db, nowMs: NOW + 82_100})).rejects.toMatchObject(
      {
        code: "failed-precondition",
        message: "RaceTo10.ERROR_LOCALE_MISMATCH",
      },
    );
    await expect(
      startRaceRunForUser(
        "locale-mismatch-challenger",
        {locale: "ja", challengeId: published.challengeId, requestId: "locale-mismatch-start-0001"},
        {db, nowMs: NOW + 82_200},
      ),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "RaceTo10.ERROR_LOCALE_MISMATCH",
    });

    /** Provides guarded challenger behavior. */
    const guardedChallenger = await startRaceRunForUser(
      "tombstone-challenger",
      {locale: "en", challengeId: published.challengeId, requestId: "guarded-start-0001"},
      {db, nowMs: NOW + 83_000},
    );
    /** Provides guarded run ref behavior. */
    const guardedRunRef = db.doc(`raceRuns/${guardedChallenger.run.runId}`);
    /** Provides guarded record behavior. */
    const guardedRecord = (await guardedRunRef.get()).data()!;
    /** Provides guarded creator deletion ref behavior. */
    const guardedCreatorDeletionRef = db.doc("jestAccountDeletionTombstones/creator-1");
    /** Provides guarded run read behavior. */
    const guardedRunRead = deferred();
    /** Provides release guarded mutation behavior. */
    const releaseGuardedMutation = deferred();
    /** Provides guarded db behavior. */
    const guardedDb = pauseAfterDocumentRead(db, guardedRunRef.path, guardedRunRead, releaseGuardedMutation);
    /** Provides guarded input behavior. */
    const guardedInput = {
      runId: guardedChallenger.run.runId,
      riddleId: guardedRecord.riddles[0].riddleId,
      guess: "xxxxxxx",
      requestId: "guarded-guess-0001",
    };
    /** Provides guarded mutation behavior. */
    const guardedMutation = submitRaceGuessForUser("tombstone-challenger", guardedInput, {
      db: guardedDb,
      nowMs: NOW + 84_000,
    });
    try {
      await guardedRunRead.promise;
      await guardedCreatorDeletionRef.set({schemaVersion: 1, recreationBlocked: true});
      releaseGuardedMutation.resolve();
      /** Provides guarded response behavior. */
      const guardedResponse = await guardedMutation;
      expect(guardedResponse.run.opponent).toEqual(expect.objectContaining({displayName: "Riddle Quest player"}));
      expect(guardedResponse.run.opponent).not.toHaveProperty("avatarUrl");
      /** Provides persisted guarded run behavior. */
      const persistedGuardedRun = (await guardedRunRef.get()).data()!;
      expect(persistedGuardedRun.opponent).not.toHaveProperty("subjectUserId");
      expect(persistedGuardedRun.opponent).not.toHaveProperty("avatarUrl");
      /** Provides guarded receipt behavior. */
      const guardedReceipt = (
        await guardedRunRef
          .collection("requests")
          .doc(requestDocumentId("tombstone-challenger", guardedInput.requestId))
          .get()
      ).data()!;
      expect(guardedReceipt.response.run.opponent).toEqual(
        expect.objectContaining({
          displayName: "Riddle Quest player",
        }),
      );
      expect(guardedReceipt.response.run.opponent).not.toHaveProperty("avatarUrl");

      /** Provides challenge data behavior. */
      const challengeData = (await db.doc(`raceChallenges/${published.challengeId}`).get()).data()!;
      /** Provides privacy challenge id behavior. */
      const privacyChallengeId = "privacy-preview-challenge";
      /** Provides privacy challenge ref behavior. */
      const privacyChallengeRef = db.doc(`raceChallenges/${privacyChallengeId}`);
      await privacyChallengeRef.set({...challengeData, challengeId: privacyChallengeId});
      /** Provides private preview behavior. */
      const privatePreview = await getRaceChallengePreview(privacyChallengeId, "en", {db, nowMs: NOW + 85_000});
      expect(privatePreview.creator).toEqual({displayName: "Riddle Quest player"});
      expect((await privacyChallengeRef.get()).data()?.creatorSnapshot).toEqual({
        displayName: "Riddle Quest player",
      });

      /** Provides privacy inbox ref behavior. */
      const privacyInboxRef = db.doc("users/inbox-owner/raceInbox/privacy-inbox-item");
      await privacyInboxRef.set({
        itemId: "privacy-inbox-item",
        challengeId: published.challengeId,
        opponentUserId: "creator-1",
        opponentDisplayName: "Ada",
        opponentAvatarUrl: "https://example.test/ada.png",
        categoryId: "history",
        result: "loss",
        adjustedDeltaMs: 1,
        read: false,
        createdAtMs: NOW + 85_000,
      });
      /** Provides private inbox behavior. */
      const privateInbox = await listRaceInboxForUser("inbox-owner", {limit: 20}, db);
      expect(privateInbox.items[0]).toEqual(
        expect.objectContaining({
          opponentDisplayName: "Riddle Quest player",
        }),
      );
      expect(privateInbox.items[0]).not.toHaveProperty("opponentAvatarUrl");
      expect(privateInbox.items[0]).not.toHaveProperty("opponentUserId");
      expect((await privacyInboxRef.get()).data()).toMatchObject({
        opponentUserId: "creator-1",
        opponentDisplayName: "Riddle Quest player",
      });
      expect((await privacyInboxRef.get()).data()).not.toHaveProperty("opponentAvatarUrl");

      // Accepted mutations keep scoring events, consumed history and receipt clocks coherent.
      for (let position = 0; position < 9; position++) {
        await submitRaceGuessForUser("tombstone-challenger", {
          runId: guardedChallenger.run.runId,
          riddleId: guardedRecord.riddles[position].riddleId,
          guess: guardedRecord.riddles[position].answer,
          requestId: `guarded-progress-${position}`,
        }, {db, nowMs: NOW + 85_500});
      }
      /** Provides finishing record behavior. */
      const finishingRecord = (await guardedRunRef.get()).data()!;
      /** Provides creator stats before behavior. */
      const creatorStatsBefore = (await db.doc("users/creator-1").get()).data()?.stats;
      /** Provides guarded finish behavior. */
      const guardedFinish = await submitRaceGuessForUser(
        "tombstone-challenger",
        {
          runId: guardedChallenger.run.runId,
          riddleId: finishingRecord.riddles[9].riddleId,
          guess: finishingRecord.riddles[9].answer,
          requestId: "guarded-finish-0001",
        },
        {db, nowMs: NOW + 86_000},
      );
      expect(guardedFinish.run.opponent).toEqual(expect.objectContaining({displayName: "Riddle Quest player"}));
      expect(
        (
          await db
            .doc(`users/creator-1/raceInbox/${requestDocumentId(published.challengeId, "tombstone-challenger")}`)
            .get()
        ).exists,
      ).toBe(false);
      expect((await db.doc("users/creator-1").get()).data()?.stats).toEqual(creatorStatsBefore);
      await privacyChallengeRef.delete();
    } finally {
      releaseGuardedMutation.resolve();
      await guardedCreatorDeletionRef.delete();
    }

    await expect(
      startRaceRunForUser(
        "creator-1",
        {locale: "en", challengeId: published.challengeId, requestId: "self-challenge-start-0001"},
        {db, nowMs: NOW + 85_000},
      ),
    ).rejects.toMatchObject({code: "failed-precondition"});

    /** Provides creator deletion ref behavior. */
    const creatorDeletionRef = db.doc("jestAccountDeletionTombstones/creator-1");
    /** Provides injected creator deletion behavior. */
    let injectedCreatorDeletion = false;
    /** Provides interleaving db behavior. */
    const interleavingDb = {
      collection: db.collection.bind(db),
      doc: db.doc.bind(db),
      runTransaction: async <T>(operation: (transaction: FirebaseFirestore.Transaction) => Promise<T>) => {
        if (!injectedCreatorDeletion) {
          injectedCreatorDeletion = true;
          await creatorDeletionRef.set({recreationBlocked: true});
        }
        return db.runTransaction(operation);
      },
    } as unknown as FirebaseFirestore.Firestore;
    try {
      await expect(
        startRaceRunForUser(
          "challenger-1",
          {locale: "en", challengeId: published.challengeId, requestId: "deletion-race-start-0001"},
          {db: interleavingDb, nowMs: NOW + 89_000},
        ),
      ).rejects.toThrow("account-deleted");
    } finally {
      await creatorDeletionRef.delete();
    }
    expect(injectedCreatorDeletion).toBe(true);
    expect((await db.collection("raceStartRequests").where("userId", "==", "challenger-1").get()).empty).toBe(true);

    /** Provides creator block ref behavior. */
    const creatorBlockRef = db.doc("users/creator-1/blockedRivals/blocked-challenger");
    await creatorBlockRef.set({targetUserId: "blocked-challenger", blockedAtMs: NOW + 89_500});
    await expect(
      startRaceRunForUser(
        "blocked-challenger",
        {locale: "en", challengeId: published.challengeId, requestId: "blocked-start-0001"},
        {db, nowMs: NOW + 89_600},
      ),
    ).rejects.toMatchObject({code: "permission-denied"});
    await creatorBlockRef.delete();

    /** Provides challenger behavior. */
    const challenger = await startRaceRunForUser(
      "challenger-1",
      {locale: "en", challengeId: published.challengeId, requestId: "challenge-start-0001"},
      {db, nowMs: NOW + 90_000},
    );
    /** Provides creator record behavior. */
    const creatorRecord = (await db.doc(`raceRuns/${runId}`).get()).data()!;
    /** Provides challenger record behavior. */
    const challengerRecord = (await db.doc(`raceRuns/${challenger.run.runId}`).get()).data()!;
    expect(
      challengerRecord.riddles.map(
        (riddle: {
          /** Stores canonical riddle id. */ /** Stores canonical riddle id. */ /** Stores canonical riddle id. */
          /** Stores canonical riddle id. */
          canonicalRiddleId: string;
        }) => riddle.canonicalRiddleId,
      ),
    ).toEqual(
      creatorRecord.riddles.map(
        (riddle: {
          /** Stores canonical riddle id. */ /** Stores canonical riddle id. */ /** Stores canonical riddle id. */
          /** Stores canonical riddle id. */
          canonicalRiddleId: string;
        }) => riddle.canonicalRiddleId,
      ),
    );
    expect(challengerRecord.opponent).toMatchObject({subjectUserId: "creator-1", displayName: "Ada"});
    expect(challenger.run.opponent).not.toHaveProperty("subjectUserId");
    /** Provides interleaving challenger behavior. */
    const interleavingChallenger = await startRaceRunForUser(
      "challenger-interleave",
      {locale: "en", challengeId: published.challengeId, requestId: "interleave-start-0001"},
      {db, nowMs: NOW + 90_500},
    );
    /** Provides active block ref behavior. */
    const activeBlockRef = db.doc("users/challenger-interleave/blockedRivals/creator-1");
    await activeBlockRef.set({targetUserId: "creator-1", blockedAtMs: NOW + 90_600});
    /** Provides interleaving record behavior. */
    const interleavingRecord = (await db.doc(`raceRuns/${interleavingChallenger.run.runId}`).get()).data()!;
    await expect(
      submitRaceGuessForUser(
        "challenger-interleave",
        {
          runId: interleavingChallenger.run.runId,
          riddleId: interleavingRecord.riddles[0].riddleId,
          guess: interleavingRecord.riddles[0].answer,
          requestId: "blocked-active-guess-0001",
        },
        {db, nowMs: NOW + 90_700},
      ),
    ).rejects.toMatchObject({code: "permission-denied"});
    await activeBlockRef.delete();
    await expect(
      startRaceRunForUser(
        "challenger-1",
        {locale: "en", challengeId: published.challengeId, requestId: "challenge-start-0002"},
        {db, nowMs: NOW + 91_000},
      ),
    ).rejects.toMatchObject({code: "already-exists"});

    /** Provides first challenger request behavior. */
    const firstChallengerRequest = {
      runId: challenger.run.runId,
      riddleId: challengerRecord.riddles[0].riddleId,
      guess: challengerRecord.riddles[0].answer,
      requestId: "challenger-solve-0000",
    };
    for (let solved = 0; solved < 10; solved += 1) {
      /** Stores d. */
      const stored = (await db.doc(`raceRuns/${challenger.run.runId}`).get()).data()!;
      /** Provides riddle behavior. */
      const riddle = stored.riddles[stored.currentPosition];
      await submitRaceGuessForUser(
        "challenger-1",
        solved === 0
          ? firstChallengerRequest
          : {
              runId: challenger.run.runId,
              riddleId: riddle.riddleId,
              guess: riddle.answer,
              requestId: `challenger-solve-${String(solved).padStart(4, "0")}`,
            },
        {db, nowMs: NOW + 94_000 + solved * 4_000},
      );
    }
    /** Provides first challenger receipt behavior. */
    const firstChallengerReceipt = (
      await db
        .doc(
          `raceRuns/${challenger.run.runId}/requests/${requestDocumentId("challenger-1", firstChallengerRequest.requestId)}`,
        )
        .get()
    ).data()!;
    expect(firstChallengerReceipt.response.run.opponent).toEqual(
      expect.objectContaining({
        displayName: "Riddle Quest player",
      }),
    );
    expect(firstChallengerReceipt.response.run.opponent).not.toHaveProperty("avatarUrl");
    /** Provides hydrated replay behavior. */
    const hydratedReplay = await submitRaceGuessForUser("challenger-1", firstChallengerRequest, {
      db,
      nowMs: NOW + 134_000,
    });
    expect(hydratedReplay.run.opponent).toEqual(
      expect.objectContaining({
        displayName: "Ada",
        avatarUrl: "https://example.test/ada.png",
      }),
    );
    /** Provides challenger outcome behavior. */
    const challengerOutcome = await getRaceOutcomeForUser("challenger-1", challenger.run.runId, {
      db,
      nowMs: NOW + 135_000,
    });
    expect(challengerOutcome).toMatchObject({
      result: "player_win",
      newlyUnlockedAchievementIds: ["race_debut", "race_first_win", "race_clean_run"],
      achievementCoinsAwarded: 75,
      newCoins: 75,
    });
    expect((await db.doc("users/challenger-1").get()).data()).toMatchObject({
      stats: {multiplayerGamesPlayed: 1, multiplayerWins: 1},
    });
    await deliverRaceSettlement(challenger.run.runId, db, NOW + 135_000);
    expect((await db.doc("users/creator-1").get()).data()).toMatchObject({
      coins: 75,
      stats: {multiplayerGamesPlayed: 2, multiplayerWins: 0, multiplayerChallengesCreated: 1},
    });
    await expect(db.doc("users/challenger-1/knownRivals/creator-1").get()).resolves.toMatchObject({exists: true});
    await expect(db.doc("users/creator-1/knownRivals/challenger-1").get()).resolves.toMatchObject({exists: true});
    /** Provides first inbox behavior. */
    const firstInbox = await listRaceInboxForUser("creator-1", {limit: 20}, db);
    expect(firstInbox.items).toEqual([
      expect.objectContaining({
        challengeId: published.challengeId,
        opponentUserId: "challenger-1",
        opponentDisplayName: "Grace",
        result: "loss",
        read: false,
      }),
    ]);
    expect(firstInbox.items[0]).not.toHaveProperty("expiresAt");
    /** Provides reopened inbox behavior. */
    const reopenedInbox = await listRaceInboxForUser("creator-1", {limit: 20}, db);
    expect(reopenedInbox.items[0]).toMatchObject({read: true});

    /** Provides template behavior. */
    const template = (await db.collection("users/creator-1/raceInbox").limit(1).get()).docs[0].data();
    expect(template).toMatchObject({opponentUserId: "challenger-1"});
    expect(template.expiresAt.toMillis() - template.createdAtMs).toBe(RACE_CHALLENGE_TTL_MS);
    await db.doc("users/creator-1/raceInbox/page-item-a").set({
      ...template,
      itemId: "page-item-a",
      challengeId: "page-challenge-a",
      createdAtMs: NOW + 200_000,
      read: false,
    });
    await db.doc("users/creator-1/raceInbox/page-item-b").set({
      ...template,
      itemId: "page-item-b",
      challengeId: "page-challenge-b",
      createdAtMs: NOW + 190_000,
      read: false,
    });
    /** Provides inbox page one behavior. */
    const inboxPageOne = await listRaceInboxForUser("creator-1", {limit: 1}, db);
    /** Provides inbox page two behavior. */
    const inboxPageTwo = await listRaceInboxForUser("creator-1", {limit: 1, cursor: inboxPageOne.nextCursor}, db);
    expect(inboxPageOne.items[0].itemId).toBe("page-item-a");
    expect(inboxPageTwo.items[0].itemId).toBe("page-item-b");
    expect(inboxPageOne.nextCursor).toBeDefined();
    await expect(listRaceInboxForUser("creator-1", {limit: 1, cursor: "malformed"}, db)).rejects.toMatchObject({
      code: "invalid-argument",
    });

    await expect(
      startRaceRunForUser(
        "outsider",
        {
          locale: "en",
          categoryId: "history",
          rivalryChallengeId: published.challengeId,
          requestId: "outsider-counter-0001",
        },
        {db, nowMs: NOW + 205_000},
      ),
    ).rejects.toMatchObject({code: "permission-denied"});
    /** Provides counter behavior. */
    const counter = await startRaceRunForUser(
      "challenger-1",
      {
        locale: "en",
        categoryId: "history",
        rivalryChallengeId: published.challengeId,
        requestId: "counter-start-0001",
      },
      {db, nowMs: NOW + 205_000},
    );
    for (let solved = 0; solved < 10; solved += 1) {
      /** Stores d. */
      const stored = (await db.doc(`raceRuns/${counter.run.runId}`).get()).data()!;
      /** Provides riddle behavior. */
      const riddle = stored.riddles[stored.currentPosition];
      await submitRaceGuessForUser(
        "challenger-1",
        {
          runId: counter.run.runId,
          riddleId: riddle.riddleId,
          guess: riddle.answer,
          requestId: `counter-solve-${String(solved).padStart(4, "0")}`,
        },
        {db, nowMs: NOW + 210_000 + solved * 5_000},
      );
    }
    /** Provides counter published behavior. */
    const counterPublished = await publishRaceChallengeForUser(
      "challenger-1",
      {runId: counter.run.runId, requestId: "counter-publish-0001"},
      {db, nowMs: NOW + 265_000},
    );
    expect(counterPublished.preview.rivalryChallengeId).toBe(published.challengeId);

    /** Provides challenge ref behavior. */
    const challengeRef = db.doc(`raceChallenges/${published.challengeId}`);
    await challengeRef.update({status: "revoked"});
    expect(await getRaceChallengePreview(published.challengeId, "en", {db, nowMs: NOW + 210_000})).toMatchObject({
      status: "revoked",
    });
    await expect(
      startRaceRunForUser(
        "revoked-recipient",
        {locale: "en", challengeId: published.challengeId, requestId: "revoked-start-0001"},
        {db, nowMs: NOW + 210_000},
      ),
    ).rejects.toMatchObject({code: "failed-precondition"});
    await challengeRef.update({status: "active", expiresAtMs: NOW + 215_000});
    expect(await getRaceChallengePreview(published.challengeId, "en", {db, nowMs: NOW + 220_000})).toMatchObject({
      status: "expired",
    });
    await expect(
      startRaceRunForUser(
        "expired-recipient",
        {locale: "en", challengeId: published.challengeId, requestId: "expired-start-0001"},
        {db, nowMs: NOW + 220_000},
      ),
    ).rejects.toMatchObject({code: "failed-precondition"});

    /** Provides interleaving request behavior. */
    const interleavingRequest = {
      runId: interleavingChallenger.run.runId,
      riddleId: interleavingChallenger.run.currentRiddle!.riddleId,
      guess: "xxxxxxx",
      requestId: "interleave-guess-0001",
    };
    /** Provides parent read behavior. */
    const parentRead = deferred();
    /** Provides release mutation behavior. */
    const releaseMutation = deferred();
    /** Provides phase one commit started behavior. */
    const phaseOneCommitStarted = deferred();
    /** Provides original batch behavior. */
    const originalBatch = db.batch.bind(db);
    /** Provides signal first deletion batch behavior. */
    let signalFirstDeletionBatch = true;
    /** Provides batch spy behavior. */
    const batchSpy = jest.spyOn(db, "batch").mockImplementation(() => {
      /** Provides batch behavior. */
      const batch = originalBatch();
      return new Proxy(batch, {
        /** Provides get behavior. */
        get(target, property) {
          if (property === "commit") {
            return async () => {
              if (signalFirstDeletionBatch) {
                signalFirstDeletionBatch = false;
                phaseOneCommitStarted.resolve();
              }
              return target.commit();
            };
          }
          /** Provides value behavior. */
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    });
    /** Provides receipt interleaving db behavior. */
    const receiptInterleavingDb = pauseAfterDocumentRead(
      db,
      `raceRuns/${interleavingChallenger.run.runId}`,
      parentRead,
      releaseMutation,
    );
    /** Provides mutation behavior. */
    const mutation = submitRaceGuessForUser("challenger-interleave", interleavingRequest, {
      db: receiptInterleavingDb,
      nowMs: NOW + 100_000,
    });
    try {
      await parentRead.promise;
      // Account deletion persists its guard before sweeping copied race identities.
      await recordJestAccountDeletion("creator-1");
      /** Provides deletion behavior. */
      const deletion = removeCrossUserRaceIdentitySnapshots("creator-1");
      await phaseOneCommitStarted.promise;
      releaseMutation.resolve();
      await Promise.all([mutation, deletion]);
    } finally {
      releaseMutation.resolve();
      batchSpy.mockRestore();
    }

    /** Provides replay after creator deletion behavior. */
    const replayAfterCreatorDeletion = await submitRaceGuessForUser("challenger-1", firstChallengerRequest, {
      db,
      nowMs: NOW + 221_000,
    });
    expect(replayAfterCreatorDeletion.run.opponent).toEqual(
      expect.objectContaining({
        displayName: "Riddle Quest player",
      }),
    );
    expect(replayAfterCreatorDeletion.run.opponent).not.toHaveProperty("avatarUrl");

    /** Provides interleaving replay behavior. */
    const interleavingReplay = await submitRaceGuessForUser("challenger-interleave", interleavingRequest, {
      db,
      nowMs: NOW + 101_000,
    });
    expect(interleavingReplay.run.opponent).toEqual(
      expect.objectContaining({
        displayName: "Riddle Quest player",
      }),
    );
    expect(interleavingReplay.run.opponent).not.toHaveProperty("avatarUrl");
    /** Provides persisted interleaving run behavior. */
    const persistedInterleavingRun = (await db.doc(`raceRuns/${interleavingChallenger.run.runId}`).get()).data();
    expect(persistedInterleavingRun?.opponent).toEqual(
      expect.objectContaining({
        displayName: "Riddle Quest player",
      }),
    );
    expect(persistedInterleavingRun?.opponent).not.toHaveProperty("avatarUrl");
    expect(persistedInterleavingRun?.opponent).not.toHaveProperty("subjectUserId");
  }, 60_000);

  it("serializes receipts, keeps creators active, and rejects stale and rate-exhausted actions", async () => {
    /** Provides concurrent behavior. */
    const concurrent = await startRaceRunForUser(
      "concurrent-user",
      {locale: "en", categoryId: "history", requestId: "concurrent-start-0001"},
      {db, nowMs: NOW + 100_000},
    );
    /** Provides first riddle behavior. */
    const firstRiddle = concurrent.run.currentRiddle!;
    await expect(
      submitRaceGuessForUser(
        "different-user",
        {
          runId: concurrent.run.runId,
          riddleId: firstRiddle.riddleId,
          guess: "xxxxxxx",
          requestId: "cross-player-guess-0001",
        },
        {db, nowMs: NOW + 100_500},
      ),
    ).rejects.toMatchObject({code: "permission-denied"});
    /** Provides request behavior. */
    const request = {
      runId: concurrent.run.runId,
      riddleId: firstRiddle.riddleId,
      guess: "xxxxxxx",
      requestId: "concurrent-guess-0001",
    };
    /** Provides [left, right] behavior. */
    const [left, right] = await Promise.all([
      submitRaceGuessForUser("concurrent-user", request, {db, nowMs: NOW + 101_000}),
      submitRaceGuessForUser("concurrent-user", request, {db, nowMs: NOW + 101_000}),
    ]);
    expect(left).toEqual(right);
    expect((await db.doc(`raceRuns/${concurrent.run.runId}`).get()).data()?.guessesUsed).toBe(1);

    /** Provides after wrong behavior. */
    const afterWrong = left.run.currentRiddle!;
    await skipRaceRiddleForUser(
      "concurrent-user",
      {runId: concurrent.run.runId, riddleId: afterWrong.riddleId, requestId: "concurrent-skip-0001"},
      {db, nowMs: NOW + 102_000},
    );
    await expect(
      submitRaceGuessForUser(
        "concurrent-user",
        {...request, requestId: "stale-guess-0001"},
        {db, nowMs: NOW + 103_000},
      ),
    ).rejects.toMatchObject({code: "failed-precondition"});

    /** Creator run that remains recordable beyond the challenger time cap. */
    const extendedCreator = await startRaceRunForUser(
      "expiring-user",
      {locale: "en", categoryId: "history", requestId: "expiring-start-0001"},
      {db, nowMs: NOW + 200_000},
    );
    await expect(submitRaceGuessForUser(
      "expiring-user",
      {
        runId: extendedCreator.run.runId,
        riddleId: extendedCreator.run.currentRiddle!.riddleId,
        guess: "xxxxxxx",
        requestId: "extended-creator-guess-0001",
      },
      {db, nowMs: NOW + 500_001},
    )).resolves.toMatchObject({
      run: {role: "creator", status: "active", adjustedElapsedMs: 300_001},
    });

    /** Provides rate limited behavior. */
    const rateLimited = await startRaceRunForUser(
      "rate-user",
      {locale: "en", categoryId: "history", requestId: "rate-start-0001"},
      {db, nowMs: NOW + 600_000},
    );
    for (let action = 0; action < 30; action += 1) {
      /** Stores d. */
      const stored = (await db.doc(`raceRuns/${rateLimited.run.runId}`).get()).data()!;
      /** Provides riddle behavior. */
      const riddle = stored.riddles[stored.currentPosition];
      await submitRaceGuessForUser(
        "rate-user",
        {
          runId: rateLimited.run.runId,
          riddleId: riddle.riddleId,
          guess: "xxxxxxx",
          requestId: `rate-guess-${String(action).padStart(4, "0")}`,
        },
        {db, nowMs: NOW + 600_100 + action},
      );
    }
    /** Stores d. */
    const stored = (await db.doc(`raceRuns/${rateLimited.run.runId}`).get()).data()!;
    /** Provides riddle behavior. */
    const riddle = stored.riddles[stored.currentPosition];
    await expect(
      submitRaceGuessForUser(
        "rate-user",
        {
          runId: rateLimited.run.runId,
          riddleId: riddle.riddleId,
          guess: "xxxxxxx",
          requestId: "rate-guess-over-limit",
        },
        {db, nowMs: NOW + 600_200},
      ),
    ).rejects.toMatchObject({code: "resource-exhausted"});
  });
});
