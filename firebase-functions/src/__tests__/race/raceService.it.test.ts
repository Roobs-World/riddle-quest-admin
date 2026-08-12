import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {RACE_CHALLENGE_TTL_MS} from "@qwordly/core/race";
import {
  abandonRaceRunForUser,
  getRaceOutcomeForUser,
  getRaceChallengePreview,
  listRaceInboxForUser,
  publishRaceChallengeForUser,
  requestRaceHintForUser,
  resumeRaceRunForUser,
  skipRaceRiddleForUser,
  startRaceRunForUser,
  submitRaceGuessForUser,
} from "../../race/raceService";
import {removeCrossUserRaceIdentitySnapshots} from "../../profile/accountDeletion/deleteAccountData";
import {requestDocumentId} from "../../race/raceSetupService";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
const NOW = 1_800_000_000_000;
let db: FirebaseFirestore.Firestore;

/** Creates a manually released promise for deterministic transaction interleavings. */
function deferred(): {promise: Promise<void>; resolve(): void} {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => { resolvePromise = resolve; });
  return {promise, resolve: () => resolvePromise?.()};
}

/** Pauses the first transaction after it reads one selected document. */
function pauseAfterDocumentRead(
  firestore: FirebaseFirestore.Firestore,
  runPath: string,
  parentRead: ReturnType<typeof deferred>,
  release: ReturnType<typeof deferred>,
): FirebaseFirestore.Firestore {
  let shouldPause = true;
  return new Proxy(firestore, {
    get(target, property) {
      if (property === "runTransaction") {
        return <T>(operation: (transaction: FirebaseFirestore.Transaction) => Promise<T>) =>
          target.runTransaction(async (transaction) => operation(new Proxy(transaction, {
            get(transactionTarget, transactionProperty) {
              if (transactionProperty === "get") {
                return async (reference: unknown) => {
                  const snapshot = await Reflect.apply(transactionTarget.get, transactionTarget, [reference]);
                  const referencePath = typeof reference === "object" && reference !== null && "path" in reference
                    ? (reference as {path?: unknown}).path
                    : undefined;
                  if (shouldPause && referencePath === runPath) {
                    shouldPause = false;
                    parentRead.resolve();
                    await release.promise;
                  }
                  return snapshot;
                };
              }
              const value = Reflect.get(transactionTarget, transactionProperty, transactionTarget);
              return typeof value === "function" ? value.bind(transactionTarget) : value;
            },
          })));
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

const clearCollection = async (name: string) => {
  await db.recursiveDelete(db.collection(name));
};

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all(
    [
      "localizedRiddles",
      "raceRuns",
      "raceDecks",
      "raceChallenges",
      "raceAttempts",
      "raceStartRequests",
      "jestAccountDeletionTombstones",
      "users",
    ].map(
      clearCollection,
    ),
  );

  const batch = db.batch();
  for (let index = 0; index < 30; index += 1) {
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
  batch.set(db.doc("users/challenger-interleave"), {displayName: "Lin"});
  batch.set(db.doc("users/tombstone-challenger"), {displayName: "Katherine"});
  batch.set(db.doc("raceConfig/rollout"), {enabled: true, percentage: 100, allowlistHashes: []});
  await batch.commit();
});

afterAll(async () => {
  await Promise.all(
    [
      "raceRuns",
      "raceDecks",
      "raceChallenges",
      "raceAttempts",
      "raceStartRequests",
      "jestAccountDeletionTombstones",
      "users",
    ].map(clearCollection),
  );
});

describe("Race to 10 transactional service", () => {
  it("abandons a run idempotently with a persisted null result", async () => {
    const started = await startRaceRunForUser(
      "creator-1",
      {locale: "en", categoryId: "history", requestId: "abandon-start-0001"},
      {db, nowMs: NOW + 2_000},
    );
    const input = {runId: started.run.runId, requestId: "abandon-request-0001"};
    const first = await abandonRaceRunForUser("creator-1", input, {db, nowMs: NOW + 5_000});
    const duplicate = await abandonRaceRunForUser("creator-1", input, {db, nowMs: NOW + 6_000});

    expect(duplicate).toEqual(first);
    expect(first).toMatchObject({run: {status: "abandoned", currentRiddle: null}, result: null});
    const runRef = db.doc(`raceRuns/${started.run.runId}`);
    const storedRun = (await runRef.get()).data()!;
    expect(storedRun).toMatchObject({
      status: "abandoned",
      result: null,
    });
    const receiptRef = runRef.collection("requests").doc(requestDocumentId("creator-1", input.requestId));
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
    const startInput = {locale: "en" as const, categoryId: "history" as const, requestId: "start-request-0001"};
    const first = await startRaceRunForUser("creator-1", startInput, {db, nowMs: NOW});
    const duplicate = await startRaceRunForUser("creator-1", startInput, {db, nowMs: NOW + 1_000});
    expect(duplicate.run.runId).toBe(first.run.runId);

    const resumed = await resumeRaceRunForUser("creator-1", first.run.runId, {db, nowMs: NOW + 10_000});
    expect(resumed.run.wallElapsedMs).toBe(10_000);
    expect(resumed.run.currentRiddle).not.toHaveProperty("answer");

    const riddleId = resumed.run.currentRiddle!.riddleId;
    const hintInput = {
      runId: first.run.runId,
      riddleId,
      requestId: "hint-request-0001",
    };
    const hint = await requestRaceHintForUser("creator-1", hintInput, {
      db,
      nowMs: NOW + 11_000,
      enforceAccess: true,
    });
    const duplicateHint = await requestRaceHintForUser("creator-1", hintInput, {
      db,
      nowMs: NOW + 12_000,
      enforceAccess: true,
    });
    expect(duplicateHint).toEqual(hint);
    expect(hint.run.totalPenaltyMs).toBe(15_000);

    const wrong = await submitRaceGuessForUser(
      "creator-1",
      {runId: first.run.runId, riddleId, guess: "xxxxxxx", requestId: "guess-request-0001"},
      {db, nowMs: NOW + 13_000},
    );
    expect(wrong.isCorrect).toBe(false);
    const skipInput = {runId: first.run.runId, riddleId, requestId: "skip-request-0001"};
    const skipped = await skipRaceRiddleForUser("creator-1", skipInput, {db, nowMs: NOW + 14_000});
    const duplicateSkip = await skipRaceRiddleForUser("creator-1", skipInput, {db, nowMs: NOW + 15_000});
    expect(duplicateSkip).toEqual(skipped);
    expect(skipped.run.totalPenaltyMs).toBe(60_000);
    expect(skipped.run.correctCount).toBe(0);
  });

  it("finalizes, publishes once, and gives a challenger the identical canonical deck", async () => {
    const start = await startRaceRunForUser(
      "creator-1",
      {locale: "en", categoryId: "history", requestId: "start-request-0002"},
      {db, nowMs: NOW + 20_000},
    );
    const runId = start.run.runId;
    for (let solved = 0; solved < 10; solved += 1) {
      const stored = (await db.doc(`raceRuns/${runId}`).get()).data()!;
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

    const creatorOutcome = await getRaceOutcomeForUser("creator-1", runId, {db, nowMs: NOW + 75_000});
    expect(creatorOutcome).toMatchObject({
      result: "recorded",
      newlyUnlockedAchievementIds: ["race_debut", "race_clean_run"],
      achievementCoinsAwarded: 50,
      newCoins: 50,
    });
    const repeatedCreatorOutcome = await getRaceOutcomeForUser("creator-1", runId, {db, nowMs: NOW + 76_000});
    expect(repeatedCreatorOutcome.newlyUnlockedAchievementIds).toEqual([]);
    expect((await db.doc("users/creator-1").get()).data()).toMatchObject({
      coins: 50,
      stats: {multiplayerGamesPlayed: 1, multiplayerWins: 0, multiplayerChallengesCreated: 0},
    });

    const publishInput = {runId, requestId: "publish-request-0001"};
    const published = await publishRaceChallengeForUser("creator-1", publishInput, {
      db,
      nowMs: NOW + 80_000,
    });
    const duplicatePublish = await publishRaceChallengeForUser("creator-1", publishInput, {
      db,
      nowMs: NOW + 81_000,
    });
    expect(duplicatePublish).toEqual(published);
    expect(published).toMatchObject({
      newlyUnlockedAchievementIds: ["race_host"],
      achievementCoinsAwarded: 25,
      newCoins: 75,
    });
    expect(JSON.stringify(await getRaceChallengePreview(published.challengeId, {db, nowMs: NOW + 82_000}))).not.toMatch(
      /answer|riddles|ghostEvents/,
    );

    const guardedChallenger = await startRaceRunForUser(
      "tombstone-challenger",
      {locale: "en", challengeId: published.challengeId, requestId: "guarded-start-0001"},
      {db, nowMs: NOW + 83_000},
    );
    const guardedRunRef = db.doc(`raceRuns/${guardedChallenger.run.runId}`);
    const guardedRecord = (await guardedRunRef.get()).data()!;
    const guardedCreatorDeletionRef = db.doc("jestAccountDeletionTombstones/creator-1");
    const guardedRunRead = deferred();
    const releaseGuardedMutation = deferred();
    const guardedDb = pauseAfterDocumentRead(
      db,
      guardedRunRef.path,
      guardedRunRead,
      releaseGuardedMutation,
    );
    const guardedInput = {
      runId: guardedChallenger.run.runId,
      riddleId: guardedRecord.riddles[0].riddleId,
      guess: "xxxxxxx",
      requestId: "guarded-guess-0001",
    };
    const guardedMutation = submitRaceGuessForUser(
      "tombstone-challenger",
      guardedInput,
      {db: guardedDb, nowMs: NOW + 84_000},
    );
    try {
      await guardedRunRead.promise;
      await guardedCreatorDeletionRef.set({schemaVersion: 1, recreationBlocked: true});
      releaseGuardedMutation.resolve();
      const guardedResponse = await guardedMutation;
      expect(guardedResponse.run.opponent).toEqual(expect.objectContaining({displayName: "Riddle Quest player"}));
      expect(guardedResponse.run.opponent).not.toHaveProperty("avatarUrl");
      const persistedGuardedRun = (await guardedRunRef.get()).data()!;
      expect(persistedGuardedRun.opponent).not.toHaveProperty("subjectUserId");
      expect(persistedGuardedRun.opponent).not.toHaveProperty("avatarUrl");
      const guardedReceipt = (await guardedRunRef.collection("requests")
        .doc(requestDocumentId("tombstone-challenger", guardedInput.requestId)).get()).data()!;
      expect(guardedReceipt.response.run.opponent).toEqual(expect.objectContaining({
        displayName: "Riddle Quest player",
      }));
      expect(guardedReceipt.response.run.opponent).not.toHaveProperty("avatarUrl");

      const challengeData = (await db.doc(`raceChallenges/${published.challengeId}`).get()).data()!;
      const privacyChallengeId = "privacy-preview-challenge";
      const privacyChallengeRef = db.doc(`raceChallenges/${privacyChallengeId}`);
      await privacyChallengeRef.set({...challengeData, challengeId: privacyChallengeId});
      const privatePreview = await getRaceChallengePreview(privacyChallengeId, {db, nowMs: NOW + 85_000});
      expect(privatePreview.creator).toEqual({displayName: "Riddle Quest player"});
      expect((await privacyChallengeRef.get()).data()?.creatorSnapshot).toEqual({
        displayName: "Riddle Quest player",
      });

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
      const privateInbox = await listRaceInboxForUser("inbox-owner", {limit: 20}, db);
      expect(privateInbox.items[0]).toEqual(expect.objectContaining({
        opponentDisplayName: "Riddle Quest player",
      }));
      expect(privateInbox.items[0]).not.toHaveProperty("opponentAvatarUrl");
      expect((await privacyInboxRef.get()).data()).toMatchObject({
        opponentUserId: "creator-1",
        opponentDisplayName: "Riddle Quest player",
      });
      expect((await privacyInboxRef.get()).data()).not.toHaveProperty("opponentAvatarUrl");

      await guardedRunRef.update({currentPosition: 9, correctCount: 9, guessesUsed: 0});
      const finishingRecord = (await guardedRunRef.get()).data()!;
      const creatorStatsBefore = (await db.doc("users/creator-1").get()).data()?.stats;
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
      expect((await db.doc(
        `users/creator-1/raceInbox/${requestDocumentId(published.challengeId, "tombstone-challenger")}`,
      ).get()).exists).toBe(false);
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

    const creatorDeletionRef = db.doc("jestAccountDeletionTombstones/creator-1");
    let injectedCreatorDeletion = false;
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
      await expect(startRaceRunForUser(
        "challenger-1",
        {locale: "en", challengeId: published.challengeId, requestId: "deletion-race-start-0001"},
        {db: interleavingDb, nowMs: NOW + 89_000},
      )).rejects.toThrow("account-deleted");
    } finally {
      await creatorDeletionRef.delete();
    }
    expect(injectedCreatorDeletion).toBe(true);
    expect((await db.collection("raceStartRequests").where("userId", "==", "challenger-1").get()).empty).toBe(true);

    const challenger = await startRaceRunForUser(
      "challenger-1",
      {locale: "en", challengeId: published.challengeId, requestId: "challenge-start-0001"},
      {db, nowMs: NOW + 90_000},
    );
    const creatorRecord = (await db.doc(`raceRuns/${runId}`).get()).data()!;
    const challengerRecord = (await db.doc(`raceRuns/${challenger.run.runId}`).get()).data()!;
    expect(challengerRecord.riddles.map((riddle: {canonicalRiddleId: string}) => riddle.canonicalRiddleId)).toEqual(
      creatorRecord.riddles.map((riddle: {canonicalRiddleId: string}) => riddle.canonicalRiddleId),
    );
    expect(challengerRecord.opponent).toMatchObject({subjectUserId: "creator-1", displayName: "Ada"});
    expect(challenger.run.opponent).not.toHaveProperty("subjectUserId");
    const interleavingChallenger = await startRaceRunForUser(
      "challenger-interleave",
      {locale: "en", challengeId: published.challengeId, requestId: "interleave-start-0001"},
      {db, nowMs: NOW + 90_500},
    );
    await expect(
      startRaceRunForUser(
        "challenger-1",
        {locale: "en", challengeId: published.challengeId, requestId: "challenge-start-0002"},
        {db, nowMs: NOW + 91_000},
      ),
    ).rejects.toMatchObject({code: "already-exists"});

    const firstChallengerRequest = {
      runId: challenger.run.runId,
      riddleId: challengerRecord.riddles[0].riddleId,
      guess: challengerRecord.riddles[0].answer,
      requestId: "challenger-solve-0000",
    };
    for (let solved = 0; solved < 10; solved += 1) {
      const stored = (await db.doc(`raceRuns/${challenger.run.runId}`).get()).data()!;
      const riddle = stored.riddles[stored.currentPosition];
      await submitRaceGuessForUser(
        "challenger-1",
        solved === 0 ? firstChallengerRequest : {
          runId: challenger.run.runId,
          riddleId: riddle.riddleId,
          guess: riddle.answer,
          requestId: `challenger-solve-${String(solved).padStart(4, "0")}`,
        },
        {db, nowMs: NOW + 94_000 + solved * 4_000},
      );
    }
    const firstChallengerReceipt = (await db.doc(
      `raceRuns/${challenger.run.runId}/requests/${requestDocumentId("challenger-1", firstChallengerRequest.requestId)}`,
    ).get()).data()!;
    expect(firstChallengerReceipt.response.run.opponent).toEqual(expect.objectContaining({
      displayName: "Riddle Quest player",
    }));
    expect(firstChallengerReceipt.response.run.opponent).not.toHaveProperty("avatarUrl");
    const hydratedReplay = await submitRaceGuessForUser(
      "challenger-1",
      firstChallengerRequest,
      {db, nowMs: NOW + 134_000},
    );
    expect(hydratedReplay.run.opponent).toEqual(expect.objectContaining({
      displayName: "Ada",
      avatarUrl: "https://example.test/ada.png",
    }));
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
    expect((await db.doc("users/creator-1").get()).data()).toMatchObject({
      coins: 75,
      stats: {multiplayerGamesPlayed: 2, multiplayerWins: 0, multiplayerChallengesCreated: 1},
    });
    const firstInbox = await listRaceInboxForUser("creator-1", {limit: 20}, db);
    expect(firstInbox.items).toEqual([
      expect.objectContaining({
        challengeId: published.challengeId,
        opponentDisplayName: "Grace",
        result: "loss",
        read: false,
      }),
    ]);
    expect(firstInbox.items[0]).not.toHaveProperty("opponentUserId");
    expect(firstInbox.items[0]).not.toHaveProperty("expiresAt");
    const reopenedInbox = await listRaceInboxForUser("creator-1", {limit: 20}, db);
    expect(reopenedInbox.items[0]).toMatchObject({read: true});

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
    const inboxPageOne = await listRaceInboxForUser("creator-1", {limit: 1}, db);
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
      const stored = (await db.doc(`raceRuns/${counter.run.runId}`).get()).data()!;
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
    const counterPublished = await publishRaceChallengeForUser(
      "challenger-1",
      {runId: counter.run.runId, requestId: "counter-publish-0001"},
      {db, nowMs: NOW + 265_000},
    );
    expect(counterPublished.preview.rivalryChallengeId).toBe(published.challengeId);

    const challengeRef = db.doc(`raceChallenges/${published.challengeId}`);
    await challengeRef.update({status: "revoked"});
    expect(await getRaceChallengePreview(published.challengeId, {db, nowMs: NOW + 210_000})).toMatchObject({
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
    expect(await getRaceChallengePreview(published.challengeId, {db, nowMs: NOW + 220_000})).toMatchObject({
      status: "expired",
    });
    await expect(
      startRaceRunForUser(
        "expired-recipient",
        {locale: "en", challengeId: published.challengeId, requestId: "expired-start-0001"},
        {db, nowMs: NOW + 220_000},
      ),
    ).rejects.toMatchObject({code: "failed-precondition"});

    const interleavingRequest = {
      runId: interleavingChallenger.run.runId,
      riddleId: interleavingChallenger.run.currentRiddle!.riddleId,
      guess: "xxxxxxx",
      requestId: "interleave-guess-0001",
    };
    const parentRead = deferred();
    const releaseMutation = deferred();
    const phaseOneCommitStarted = deferred();
    const originalBatch = db.batch.bind(db);
    let signalFirstDeletionBatch = true;
    const batchSpy = jest.spyOn(db, "batch").mockImplementation(() => {
      const batch = originalBatch();
      return new Proxy(batch, {
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
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    });
    const receiptInterleavingDb = pauseAfterDocumentRead(
      db,
      `raceRuns/${interleavingChallenger.run.runId}`,
      parentRead,
      releaseMutation,
    );
    const mutation = submitRaceGuessForUser(
      "challenger-interleave",
      interleavingRequest,
      {db: receiptInterleavingDb, nowMs: NOW + 100_000},
    );
    try {
      await parentRead.promise;
      const deletion = removeCrossUserRaceIdentitySnapshots("creator-1");
      await phaseOneCommitStarted.promise;
      releaseMutation.resolve();
      await Promise.all([mutation, deletion]);
    } finally {
      releaseMutation.resolve();
      batchSpy.mockRestore();
    }

    const replayAfterCreatorDeletion = await submitRaceGuessForUser(
      "challenger-1",
      firstChallengerRequest,
      {db, nowMs: NOW + 221_000},
    );
    expect(replayAfterCreatorDeletion.run.opponent).toEqual(expect.objectContaining({
      displayName: "Riddle Quest player",
    }));
    expect(replayAfterCreatorDeletion.run.opponent).not.toHaveProperty("avatarUrl");

    const interleavingReplay = await submitRaceGuessForUser(
      "challenger-interleave",
      interleavingRequest,
      {db, nowMs: NOW + 101_000},
    );
    expect(interleavingReplay.run.opponent).toEqual(expect.objectContaining({
      displayName: "Riddle Quest player",
    }));
    expect(interleavingReplay.run.opponent).not.toHaveProperty("avatarUrl");
    const persistedInterleavingRun = (await db.doc(`raceRuns/${interleavingChallenger.run.runId}`).get()).data();
    expect(persistedInterleavingRun?.opponent).toEqual(expect.objectContaining({
      displayName: "Riddle Quest player",
    }));
    expect(persistedInterleavingRun?.opponent).not.toHaveProperty("avatarUrl");
    expect(persistedInterleavingRun?.opponent).not.toHaveProperty("subjectUserId");
  }, 60_000);

  it("serializes concurrent receipts and rejects stale, expired, and rate-exhausted actions", async () => {
    const concurrent = await startRaceRunForUser(
      "concurrent-user",
      {locale: "en", categoryId: "history", requestId: "concurrent-start-0001"},
      {db, nowMs: NOW + 100_000},
    );
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
    const request = {
      runId: concurrent.run.runId,
      riddleId: firstRiddle.riddleId,
      guess: "xxxxxxx",
      requestId: "concurrent-guess-0001",
    };
    const [left, right] = await Promise.all([
      submitRaceGuessForUser("concurrent-user", request, {db, nowMs: NOW + 101_000}),
      submitRaceGuessForUser("concurrent-user", request, {db, nowMs: NOW + 101_000}),
    ]);
    expect(left).toEqual(right);
    expect((await db.doc(`raceRuns/${concurrent.run.runId}`).get()).data()?.guessesUsed).toBe(1);

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

    const expiring = await startRaceRunForUser(
      "expiring-user",
      {locale: "en", categoryId: "history", requestId: "expiring-start-0001"},
      {db, nowMs: NOW + 200_000},
    );
    await expect(
      submitRaceGuessForUser(
        "expiring-user",
        {
          runId: expiring.run.runId,
          riddleId: expiring.run.currentRiddle!.riddleId,
          guess: "xxxxxxx",
          requestId: "expired-guess-0001",
        },
        {db, nowMs: NOW + 500_001},
      ),
    ).rejects.toMatchObject({code: "failed-precondition"});

    const rateLimited = await startRaceRunForUser(
      "rate-user",
      {locale: "en", categoryId: "history", requestId: "rate-start-0001"},
      {db, nowMs: NOW + 600_000},
    );
    for (let action = 0; action < 30; action += 1) {
      const stored = (await db.doc(`raceRuns/${rateLimited.run.runId}`).get()).data()!;
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
    const stored = (await db.doc(`raceRuns/${rateLimited.run.runId}`).get()).data()!;
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
