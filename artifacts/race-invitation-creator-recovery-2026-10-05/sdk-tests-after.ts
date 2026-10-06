import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {getLiveRaceChallengeForUser} from "../../race/raceLiveInvitation";
import type {LiveTicket} from "../../race/raceLiveState";

/** Every source/account mutation belongs to an isolated loopback demo. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "",
  A = `jest_${"a".repeat(40)}`,
  B = `jest_${"b".repeat(40)}`,
  NOW = 1_800_000_000_000;
/** The actual SDK exercises current live invitation preview, ownership and leave transactions. */
let db: FirebaseFirestore.Firestore;
/** Only this demo owns the complete live collections and named catalog/accounts. */
const clear = async () => {
  for (const name of [
    "localizedRiddles",
    "liveRaceTickets",
    "liveRacePlayers",
    "liveRaceQueues",
    "liveRaceSignals",
    "liveRaceMatches",
  ])
    await db.recursiveDelete(db.collection(name));
  for (const owner of [A, B]) {
    await db.recursiveDelete(db.doc(`users/${owner}`));
    await db.recursiveDelete(db.doc(`jestAccountDeletionTombstones/${owner}`));
  }
};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ""))
    throw new Error("Private loopback demo required");
  if (!getApps().length) initializeApp({projectId: PROJECT});
  db = getFirestore();
});
beforeEach(async () => {
  await clear();
  /** Balanced reviewed content creates a valid current private lobby through production authority. */
  const batch = db.batch();
  for (let index = 0; index < 30; index++)
    batch.set(db.doc(`localizedRiddles/en/riddles/creator-live-${index}`), {
      riddleId: `creator-live-${index}`,
      canonicalRiddleId: `history:${index}`,
      text: `Original question ${index} follows a distinct path`,
      answer: `a${String(index).padStart(6, "0")}`,
      categoryId: "history",
      difficultyBand: ["easy", "medium", "hard"][index % 3],
      raceEligible: true,
      qualityVersion: "human_review_v1",
    });
  for (const owner of [A, B])
    batch.set(db.doc(`users/${owner}`), {username: owner === A ? "Creator" : "Recipient", coins: 500});
  await batch.commit();
});
afterAll(clear);
/** Malformed retained content must not remove the owner's independent ability to leave an unpaired live lobby. */
it.each(["space", "answer", "clue", "canonical"])(
  "preserves current live creator cleanup with malformed %s content",
  async (kind) => {
    /** The current client actually mounts this live authority path. */
    const created = await joinLiveRaceForUser(
      A,
      {locale: "en", categoryId: "history", requestId: "live-creator-audit", createChallenge: true},
      {db, nowMs: NOW},
    );
    expect(created).toMatchObject({phase: "searching"});
    expect(created.challengeId).toMatch(/^live_[a-f0-9]{64}$/);
    /** Corruption changes only a future immutable clue while retaining authoritative ownership and language. */
    const ref = db.doc(`liveRaceTickets/${created.ticketId}`),
      original = (await ref.get()).data() as LiveTicket;
    /** The retained future question has one controlled incompatibility. */
    const riddles = original.run.riddles.map((riddle, index) =>
      index !== 14
        ? riddle
        : {
            ...riddle,
            ...(kind === "clue"
              ? {text: "Q".repeat(2001)}
              : kind === "canonical"
                ? {canonicalRiddleId: original.run.riddles[0].canonicalRiddleId}
                : {answer: kind === "space" ? "a b" : "x".repeat(129)}),
          },
    );
    await ref.update({"run.riddles": riddles});
    /** Existing owner preview is separate from new-recipient gameplay admission. */
    expect(await getLiveRaceChallengeForUser(A, created.challengeId!, {db, nowMs: NOW + 1})).toMatchObject({
      status: "own",
    });
    expect(await getLiveRaceChallengeForUser(B, created.challengeId!, {db, nowMs: NOW + 1})).toMatchObject({
      status: "unavailable",
    });
    /** Unauthenticated ownership inference or another player cannot cancel the creator's seat. */
    const before = await ref.get(),
      profiles = await Promise.all([A, B].map((owner) => db.doc(`users/${owner}`).get()));
    await expect(
      updateLiveRaceForUser(
        B,
        {ticketId: created.ticketId, action: "leave", requestId: "foreign-leave"},
        {db, nowMs: NOW + 2},
      ),
    ).rejects.toMatchObject({code: "permission-denied"});
    expect((await ref.get()).updateTime?.valueOf()).toBe(before.updateTime?.valueOf());
    /** The actual close command terminates without parsing or repairing unusable question content. */
    const command = {ticketId: created.ticketId, action: "leave" as const, requestId: "owned-leave"},
      closed = await updateLiveRaceForUser(A, command, {db, nowMs: NOW + 3});
    expect(closed).toMatchObject({phase: "cancelled", ticketId: created.ticketId});
    /** Terminal replay does not rewrite the ticket or publish another signal. */
    const cancelled = await ref.get(),
      signals = await db.collection("liveRaceSignals").get();
    expect(await updateLiveRaceForUser(A, command, {db, nowMs: NOW + 4})).toMatchObject({
      phase: "cancelled",
      ticketId: created.ticketId,
    });
    expect((await ref.get()).updateTime?.valueOf()).toBe(cancelled.updateTime?.valueOf());
    expect((await db.collection("liveRaceSignals").get()).docs.map((x) => [x.id, x.updateTime?.valueOf()])).toEqual(
      signals.docs.map((x) => [x.id, x.updateTime?.valueOf()]),
    );
    expect(cancelled.data()?.run.riddles).toEqual(riddles);
    expect((await db.collection("liveRaceMatches").get()).empty).toBe(true);
    expect((await db.collection("liveRaceTickets").get()).size).toBe(1);
    for (const [index, owner] of [A, B].entries()) {
      /** Both accounts retain their original data and version. */
      const profile = await db.doc(`users/${owner}`).get();
      expect(profile.data()).toEqual(profiles[index].data());
      expect(profile.updateTime?.valueOf()).toBe(profiles[index].updateTime?.valueOf());
    }
    /** Optional audit observations retain lifecycle and version dimensions without source answers. */
    const directory = process.env.RACE_LIVE_CREATOR_AUDIT_TRACE;
    if (directory) {
      mkdirSync(directory, {recursive: true});
      writeFileSync(
        join(directory, `${kind}.json`),
        JSON.stringify(
          {
            kind,
            createdPhase: created.phase,
            closedPhase: closed.phase,
            terminalReplayVersionStable: true,
            sourceUnchanged: true,
            profilesUnchanged: true,
            matchedSeats: 0,
          },
          null,
          2,
        ),
      );
    }
  },
);
