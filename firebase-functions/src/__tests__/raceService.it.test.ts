import * as admin from "firebase-admin";
import {
  getRaceChallengePreview,
  listRaceInboxForUser,
  publishRaceChallengeForUser,
  requestRaceHintForUser,
  resumeRaceRunForUser,
  skipRaceRiddleForUser,
  startRaceRunForUser,
  submitRaceGuessForUser,
} from "../race/raceService";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
const NOW = 1_800_000_000_000;
let db: FirebaseFirestore.Firestore;

const clearCollection = async (name: string) => {
  await db.recursiveDelete(db.collection(name));
};

beforeAll(async () => {
  if (admin.apps.length === 0) admin.initializeApp({projectId: PROJECT_ID});
  db = admin.firestore();
  await Promise.all(
    ["localizedRiddles", "raceRuns", "raceDecks", "raceChallenges", "raceAttempts", "raceStartRequests", "users"].map(
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
  batch.set(db.doc("users/creator-1"), {displayName: "Ada"});
  batch.set(db.doc("users/challenger-1"), {displayName: "Grace"});
  await batch.commit();
});

afterAll(async () => {
  await Promise.all(
    ["raceRuns", "raceDecks", "raceChallenges", "raceAttempts", "raceStartRequests", "users"].map(clearCollection),
  );
});

describe("Race to 10 transactional service", () => {
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
      currentAttempt: Array(resumed.run.currentRiddle!.answerLength).fill(""),
      requestId: "hint-request-0001",
    };
    const hint = await requestRaceHintForUser("creator-1", hintInput, {db, nowMs: NOW + 11_000});
    const duplicateHint = await requestRaceHintForUser("creator-1", hintInput, {db, nowMs: NOW + 12_000});
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
    expect(JSON.stringify(await getRaceChallengePreview(published.challengeId, {db, nowMs: NOW + 82_000}))).not.toMatch(
      /answer|riddles|ghostEvents/,
    );

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
    await expect(
      startRaceRunForUser(
        "challenger-1",
        {locale: "en", challengeId: published.challengeId, requestId: "challenge-start-0002"},
        {db, nowMs: NOW + 91_000},
      ),
    ).rejects.toMatchObject({code: "already-exists"});

    for (let solved = 0; solved < 10; solved += 1) {
      const stored = (await db.doc(`raceRuns/${challenger.run.runId}`).get()).data()!;
      const riddle = stored.riddles[stored.currentPosition];
      await submitRaceGuessForUser(
        "challenger-1",
        {
          runId: challenger.run.runId,
          riddleId: riddle.riddleId,
          guess: riddle.answer,
          requestId: `challenger-solve-${String(solved).padStart(4, "0")}`,
        },
        {db, nowMs: NOW + 94_000 + solved * 4_000},
      );
    }
    const firstInbox = await listRaceInboxForUser("creator-1", {limit: 20}, db);
    expect(firstInbox.items).toEqual([
      expect.objectContaining({
        challengeId: published.challengeId,
        opponentDisplayName: "Grace",
        result: "loss",
        read: false,
      }),
    ]);
    const reopenedInbox = await listRaceInboxForUser("creator-1", {limit: 20}, db);
    expect(reopenedInbox.items[0]).toMatchObject({read: true});

    const template = (await db.collection("users/creator-1/raceInbox").limit(1).get()).docs[0].data();
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
  });

  it("serializes concurrent receipts and rejects stale, expired, and rate-exhausted actions", async () => {
    const concurrent = await startRaceRunForUser(
      "concurrent-user",
      {locale: "en", categoryId: "history", requestId: "concurrent-start-0001"},
      {db, nowMs: NOW + 100_000},
    );
    const firstRiddle = concurrent.run.currentRiddle!;
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
