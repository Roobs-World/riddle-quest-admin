import {getApps, initializeApp} from "firebase-admin/app";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {requestDocumentId} from "../../race/raceSetupService";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {RACE_RULES, type LiveRaceView} from "@riddle-quest/core/race";
import type {LiveMatch} from "../../race/raceLiveState";
import {getJestAccountDeletionRef} from "../../jest/jestAccountDeletion";

/** Renders the a interface. */
const A = `jest_${"a".repeat(40)}`, B = `jest_${"b".repeat(40)}`, C = `jest_${"c".repeat(40)}`;
/** Renders the now interface. */
const NOW = 1_800_000_000_000;
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;
/** Provides clear behavior. */
async function clear() {
  for (const path of ["liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "users", "localizedRiddles/en/riddles", "localizedRiddles/fr/riddles"])
    await db.recursiveDelete(db.collection(path));
  await Promise.all([A, B, C].map(user => getJestAccountDeletionRef(db, user).delete()));
}
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Local Firestore emulator required");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-live"});
  db = getFirestore();
});
beforeEach(async () => {
  await clear();
  /** Provides batch behavior. */
  const batch = db.batch();
  for (let index = 0; index < 30; index++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${index}`), {
    riddleId: `history-${index}`, canonicalRiddleId: `history:${index}`, categoryId: "history",
    text: `Unique historical question ${index} follows its own trail`, answer: `a${String(index).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[index % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  for (const user of [A, B, C]) batch.set(db.doc(`users/${user}`), {username: user === A ? "Alice" : user === B ? "Bob" : "Charlie", coins: 100,
    avatarUrl: "https://example.com/avatar.png"});
  await batch.commit();
});
afterAll(clear);
/** Provides join behavior. */
const join = (user: string, requestId: string, nowMs = NOW) => joinLiveRaceForUser(user, {locale: "en", categoryId: "history", requestId}, {db, nowMs});
/** Provides update behavior. */
const update = (user: string, view: LiveRaceView, nowMs: number, action: "poll" | "leave" = "poll", requestId = `poll-${nowMs}`) =>
  updateLiveRaceForUser(user, {ticketId: view.ticketId, action, requestId}, {db, nowMs});
/** Provides pair behavior. */
async function pair() {
  /** Provides a behavior. */
  const a = await join(A, "join-alice-1");
  /** Provides b behavior. */
  const b = await join(B, "join-bob-001", NOW + 1000);
  return {a: await update(A, a, NOW + 1000), b};
}
/** Provides answer behavior. */
async function answer(user: string, view: LiveRaceView, nowMs: number, requestId: string) {
  /** Provides match behavior. */
  const match = (await db.doc(`liveRaceMatches/${(await db.doc(`liveRaceTickets/${view.ticketId}`).get()).data()!.matchId}`).get()).data() as LiveMatch;
  /** Provides seat behavior. */
  const seat = match.tickets[0] === view.ticketId ? 0 : 1;
  /** Provides riddle behavior. */
  const riddle = match.runs[seat].riddles[match.runs[seat].currentPosition]!;
  return updateLiveRaceForUser(user, {ticketId: view.ticketId, action: "guess", requestId, riddleId: riddle.riddleId, guess: riddle.answer}, {db, nowMs});
}


/** Reads the exact user-scoped immutable command receipt from the owned match. */
async function receipt(view: LiveRaceView, requestId: string) {
  /** Ticket ownership supplies the actual match rather than guessing its creator. */
  const ticket = await db.doc(`liveRaceTickets/${view.ticketId}`).get();
  return db.doc(`liveRaceMatches/${ticket.data()!.matchId}/requests/${requestDocumentId(A, requestId)}`).get();
}

it("commits private wrong-guess proof once with its canonical attempt and leaves it immutable on retry", async () => {
  /** Human seats begin with the same unconsumed prompt. */
  const {a} = await pair();
  /** Scoring starts only after the shared countdown. */
  const active = await update(A, a, NOW + 7000);
  /** Original request identity owns the new accepted attempt. */
  const command = {ticketId: a.ticketId, action: "guess" as const, requestId: "receipt-wrong-001", riddleId: active.run!.currentRiddle!.riddleId, guess: "zzzzzzz"};
  /** The response schema remains unchanged and answer-free. */
  const accepted = await updateLiveRaceForUser(A, command, {db, nowMs: NOW + 8000});
  expect(accepted.run!.currentRiddle!.guessesUsed).toBe(1);
  expect(accepted).not.toHaveProperty("guessProof");
  /** Durable proof and attempt history originate in the same real Firestore transaction. */
  const first = await receipt(a, command.requestId);
  expect(first.data()!.guessProof).toEqual({ticketId: a.ticketId, riddleId: command.riddleId, position: 0, guessesUsedBefore: 0, guessesUsedAfter: 1});
  await updateLiveRaceForUser(A, {...command, requestId: "receipt-wrong-002"}, {db, nowMs: NOW + 9000});
  expect((await receipt(a, "receipt-wrong-002")).data()!.guessProof).toMatchObject({guessesUsedBefore: 1, guessesUsedAfter: 2});
  await updateLiveRaceForUser(A, command, {db, nowMs: NOW + 10000});
  /** A retry cannot rewrite the original attempt identity after later guesses. */
  const repeated = await receipt(a, command.requestId);
  expect(repeated.data()).toEqual(first.data());
  expect(repeated.updateTime!.isEqual(first.updateTime!)).toBe(true);
  expect((await update(A, a, NOW + 11000)).run!.currentRiddle!.guessesUsed).toBe(2);
  await expect(updateLiveRaceForUser(A, {...command, guess: "yyyyyyy"}, {db, nowMs: NOW + 12000})).rejects.toMatchObject({code: "invalid-argument"});
});

it("does not manufacture same-question proof for hints, skips or correct guesses", async () => {
  /** Only accepted wrong guesses may justify a later same-question draft. */
  const {a} = await pair();
  /** A correct guess advances its question and cannot supply this proof. */
  const correct = await answer(A, a, NOW + 7000, "receipt-correct-001");
  expect((await receipt(a, "receipt-correct-001")).data()).not.toHaveProperty("guessProof");
  await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "hint", requestId: "receipt-hint-001", riddleId: correct.run!.currentRiddle!.riddleId}, {db, nowMs: NOW + 8000});
  expect((await receipt(a, "receipt-hint-001")).data()).not.toHaveProperty("guessProof");
  await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "skip", requestId: "receipt-skip-001", riddleId: correct.run!.currentRiddle!.riddleId}, {db, nowMs: NOW + 9000});
  expect((await receipt(a, "receipt-skip-001")).data()).not.toHaveProperty("guessProof");
});

it("does not attach proof when an exhausted wrong attempt automatically advances the question", async () => {
  /** Exhaustion has the same recovery boundary as an explicit skip. */
  const {a} = await pair();
  /** Original question remains stable for the first four wrong attempts. */
  const active = await update(A, a, NOW + 7000);
  for (let index = 0; index < RACE_RULES.maxGuessesPerRiddle; index++) {
    await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "guess", requestId: `receipt-exhaust-${index}`, riddleId: active.run!.currentRiddle!.riddleId, guess: "zzzzzzz"}, {db, nowMs: NOW + 8000 + index * 1000});
  }
  expect((await receipt(a, `receipt-exhaust-${RACE_RULES.maxGuessesPerRiddle - 1}`)).data()).not.toHaveProperty("guessProof");
  expect((await update(A, a, NOW + 15000)).run!.currentRiddle!.position).toBe(1);
});

it("replaying a legacy accepted command cannot invent missing historical proof", async () => {
  /** The old receipt format did not record an accepted attempt identity. */
  const {a} = await pair();
  /** Original valid request is accepted exactly once. */
  const active = await update(A, a, NOW + 7000);
  /** Stable input remains bound to the legacy command even after later server versions. */
  const command = {ticketId: a.ticketId, action: "guess" as const, requestId: "receipt-legacy-001", riddleId: active.run!.currentRiddle!.riddleId, guess: "zzzzzzz"};
  await updateLiveRaceForUser(A, command, {db, nowMs: NOW + 8000});
  /** Removing the new field models an immutable receipt from the previous deployment. */
  const current = await receipt(a, command.requestId);
  await current.ref.update({guessProof: FieldValue.delete()});
  /** A repeated request must preserve this unproven historical format. */
  const legacy = await current.ref.get();
  await updateLiveRaceForUser(A, command, {db, nowMs: NOW + 9000});
  /** Retry is not authority to synthesize an attempt version retrospectively. */
  const repeated = await current.ref.get();
  expect(repeated.data()).toEqual(legacy.data());
  expect(repeated.updateTime!.isEqual(legacy.updateTime!)).toBe(true);
  expect((await update(A, a, NOW + 10000)).run!.currentRiddle!.guessesUsed).toBe(1);
});
