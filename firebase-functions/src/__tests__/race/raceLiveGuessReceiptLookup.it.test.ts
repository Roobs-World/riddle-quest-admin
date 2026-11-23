import {confirmLiveGuessReceiptForUser} from "../../race/raceLiveGuessReceipt";
import {LiveGuessReceiptQuerySchema} from "../../../../src/races/contracts/index.js";
import {getApps, initializeApp} from "firebase-admin/app";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {requestDocumentId} from "../../race/raceSetupService";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {type LiveRaceView} from "../../../../src/races/contracts/index.js";
import type {LiveMatch} from "../../race/raceLiveState";
import {getJestAccountDeletionRef} from "../../shared/accountDeletion";

/** Renders the a interface. */
const A = `jest_${"a".repeat(40)}`, B = `jest_${"b".repeat(40)}`, C = `jest_${"c".repeat(40)}`;
/** Renders the now interface. */
const NOW = 1_800_000_000_000;
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;
/** Provides clear behavior. */
async function clear() {
  for (const path of ["raceConfig", "liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "users", "localizedRiddles/en/riddles", "localizedRiddles/fr/riddles"])
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
  batch.set(db.doc("raceConfig/rollout"), {enabled: true, percentage: 100});
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
/** Reads the exact user-scoped immutable command receipt from the owned match. */
async function receipt(view: LiveRaceView, requestId: string) {
  /** Ticket ownership supplies the actual match rather than guessing its creator. */
  const ticket = await db.doc(`liveRaceTickets/${view.ticketId}`).get();
  return db.doc(`liveRaceMatches/${ticket.data()!.matchId}/requests/${requestDocumentId(A, requestId)}`).get();
}

/** Creates a real accepted wrong attempt and its exact private locator. */
async function accepted() {
  /** The second human seat joins the creator-owned match. */
  const {a, b} = await pair(), active = await update(A, a, NOW + 7000);
  /** Original guess identity, not a submitted word, is the recovery locator. */
  const query = {ticketId: a.ticketId, requestId: "lookup-wrong-001", riddleId: active.run!.currentRiddle!.riddleId, position: 0, guessesUsedBefore: 0};
  await updateLiveRaceForUser(A, {ticketId: query.ticketId, requestId: query.requestId, riddleId: query.riddleId, action: "guess", guess: "zzzzzzz"}, {db, nowMs: NOW + 8000});
  return {a, b, query, stored: await receipt(a, query.requestId)};
}
/** Captures every existing emulator document including nested receipts and economy records. */
async function databaseState(): Promise<Record<string, string>> {
  /** Update time catches even writes that recreate the same field values. */
  const result: Record<string, string> = {};
  /** Recurses through the actual SDK collection inventory rather than a guessed write list. */
  async function collect(collection: FirebaseFirestore.CollectionReference): Promise<void> {
    for (const doc of (await collection.get()).docs) {
      result[doc.ref.path] = JSON.stringify({data: doc.data(), updated: {seconds: doc.updateTime.seconds, nanoseconds: doc.updateTime.nanoseconds}});
      for (const child of await doc.ref.listCollections()) await collect(child);
    }
  }
  for (const collection of await db.listCollections()) await collect(collection);
  return result;
}
it("confirms only the current accepted attempt without mutating historical receipts", async () => {
  /** Private receipt is created by production scoring, not manually fabricated. */
  const {query, stored} = await accepted();
  expect(await confirmLiveGuessReceiptForUser(A, query, {db, nowMs: NOW + 8000})).toEqual({status: "accepted"});
  await updateLiveRaceForUser(A, {ticketId: query.ticketId, requestId: "lookup-wrong-002", riddleId: query.riddleId, action: "guess", guess: "zzzzzzz"}, {db, nowMs: NOW + 9000});
  /** Entire database snapshot verifies no scoring, lease, heartbeat or economy write. */
  /** Freeze the complete private authority before observation. */
  /** Compare every canonical document and update timestamp after observation. */
  const before = await databaseState();
  expect(await confirmLiveGuessReceiptForUser(A, query, {db, nowMs: NOW + 10000})).toEqual({status: "unconfirmed"});
  expect(await confirmLiveGuessReceiptForUser(A, {...query, requestId: "lookup-wrong-002", guessesUsedBefore: 1}, {db, nowMs: NOW + 10000})).toEqual({status: "accepted"});
  expect(await databaseState()).toEqual(before);
  expect((await stored.ref.get()).updateTime!.isEqual(stored.updateTime!)).toBe(true);
});
it.each(["requestId", "riddleId", "position", "guessesUsedBefore"] as const)("rejects a different %s without mutation", async field => {
  /** A same-question proof cannot be borrowed by another locator. */
  const {query} = await accepted(), before = await databaseState();
  expect(await confirmLiveGuessReceiptForUser(A, {...query, [field]: typeof query[field] === "number" ? Number(query[field]) + 1 : "different-lookup"}, {db, nowMs: NOW + 10000})).toEqual({status: "unconfirmed"});
  expect(await databaseState()).toEqual(before);
});
it("does not reveal another player's receipt or accept a locator for the other seat", async () => {
  /** Both authenticated users have a valid provider and existing profile. */
  const {query, b} = await accepted();
  expect(await confirmLiveGuessReceiptForUser(B, query, {db, nowMs: NOW + 10000})).toEqual({status: "unconfirmed"});
  expect(await confirmLiveGuessReceiptForUser(A, {...query, ticketId: b.ticketId}, {db, nowMs: NOW + 10000})).toEqual({status: "unconfirmed"});
});
it.each(["legacy", "wrong-owner", "wrong-count", "extra-field", "expired"])("rejects %s receipts without repairing them", async kind => {
  /** Corruption is confined to this isolated fixture's immutable receipt. */
  const {query, stored} = await accepted();
  await stored.ref.update(kind === "legacy" ? {guessProof: FieldValue.delete()} : kind === "wrong-owner" ? {userId: B} :
    kind === "wrong-count" ? {"guessProof.guessesUsedAfter": 2} : kind === "extra-field" ? {"guessProof.untrusted": true} :
    {expiresAt: new Date(NOW + 9999)});
  /** Missing proof is an observation, never a backfill operation. */
  /** Freeze the complete private authority before observation. */
  /** Compare every canonical document and update timestamp after observation. */
  const before = await databaseState();
  expect(await confirmLiveGuessReceiptForUser(A, query, {db, nowMs: NOW + 10000})).toEqual({status: "unconfirmed"});
  expect(await databaseState()).toEqual(before);
});
it.each(["cancelled", "deleted", "expired-ticket", "expired-match", "deleted-seat", "foreign-run", "foreign-match", "missing-match"])("rejects %s authority", async kind => {
  /** Match selection comes exclusively from the owned ticket. */
  const {query} = await accepted(), ticket = db.doc(`liveRaceTickets/${query.ticketId}`), match = db.doc(`liveRaceMatches/${(await ticket.get()).data()!.matchId}`);
  if (kind === "cancelled" || kind === "deleted") await ticket.update({[kind]: true});
  else if (kind === "expired-ticket") await ticket.update({expiresAt: new Date(NOW + 9999)});
  else if (kind === "expired-match") await match.update({expiresAt: new Date(NOW + 9999)});
  else if (kind === "deleted-seat") await match.update({deletedSeats: [true, false]});
  else if (kind === "foreign-run") {
    /** Keep otherwise valid run fields to isolate authenticated ownership. */
    const data = (await match.get()).data()!;
    await match.update({runs: [{...data.runs[0], userId: B}, data.runs[1]]});
  } else if (kind === "foreign-match") await ticket.update({matchId: "d".repeat(64)});
  else await match.delete();
  /** Freeze the complete private authority before observation. */
  /** Compare every canonical document and update timestamp after observation. */
  const before = await databaseState();
  expect(await confirmLiveGuessReceiptForUser(A, query, {db, nowMs: NOW + 10000})).toEqual({status: "unconfirmed"});
  expect(await databaseState()).toEqual(before);
});
it("rejects deleted accounts and disabled rollout without modifying authority", async () => {
  /** Authorization is checked on the same read-only snapshot as receipt ownership. */
  const {query} = await accepted();
  await db.doc("raceConfig/rollout").set({enabled: false, percentage: 100});
  await expect(confirmLiveGuessReceiptForUser(A, query, {db, nowMs: NOW + 10000})).rejects.toMatchObject({code: "permission-denied"});
  await db.doc("raceConfig/rollout").set({enabled: true, percentage: 100});
  await getJestAccountDeletionRef(db, A).set({deletedAtMs: NOW + 9000});
  /** Freeze the complete private authority before observation. */
  const before = await databaseState();
  await expect(confirmLiveGuessReceiptForUser(A, query, {db, nowMs: NOW + 10000})).rejects.toThrow("account-deleted");
  expect(await databaseState()).toEqual(before);
});
it("bounds locators and rejects command, account and payload selectors", () => {
  /** Strict wire contract allows only the historical locator. */
  const query = {ticketId: "a".repeat(64), requestId: "lookup-wrong-001", riddleId: "question-1", position: 0, guessesUsedBefore: 0};
  expect(LiveGuessReceiptQuerySchema.safeParse(query).success).toBe(true);
  for (const extra of [{userId: A}, {action: "guess"}, {guess: "zzzzzzz"}]) expect(LiveGuessReceiptQuerySchema.safeParse({...query, ...extra}).success).toBe(false);
  for (const invalid of [{position: 15}, {position: -1}, {guessesUsedBefore: 4}, {requestId: "x".repeat(161)}, {riddleId: ""}]) expect(LiveGuessReceiptQuerySchema.safeParse({...query, ...invalid}).success).toBe(false);
});

it("confirms the second human seat using its actual creator-owned match", async () => {
  /** The second ticket is not the match document ID. */
  const {b} = await pair(), active = await update(B, b, NOW + 7000);
  /** Receipt lookup must derive the match from the ticket rather than assume creator ownership. */
  const query = {ticketId: b.ticketId, requestId: "second-seat-guess", riddleId: active.run!.currentRiddle!.riddleId, position: 0, guessesUsedBefore: 0};
  await updateLiveRaceForUser(B, {ticketId: b.ticketId, requestId: query.requestId, riddleId: query.riddleId, action: "guess", guess: "zzzzzzz"}, {db, nowMs: NOW + 8000});
  expect(await confirmLiveGuessReceiptForUser(B, query, {db, nowMs: NOW + 10000})).toEqual({status: "accepted"});
  expect(await confirmLiveGuessReceiptForUser(A, query, {db, nowMs: NOW + 10000})).toEqual({status: "unconfirmed"});
});
it.each(["hint", "skip", "correct", "auto-skip"])("cannot confirm a %s command as a surviving wrong attempt", async kind => {
  /** Real engine commands create ordinary receipts without eligible private proof. */
  const {a} = await pair(), active = await update(A, a, NOW + 7000);
  /** Historical locator captures the attempt before any command consumes the question. */
  const query = {ticketId: a.ticketId, requestId: "noneligible-command", riddleId: active.run!.currentRiddle!.riddleId, position: 0, guessesUsedBefore: 0};
  if (kind === "auto-skip") {
    for (let index = 0; index < 4; index++) await updateLiveRaceForUser(A, {ticketId: a.ticketId, requestId: `wrong-prior-${index}`, riddleId: query.riddleId, action: "guess", guess: "zzzzzzz"}, {db, nowMs: NOW + 8000 + index * 1000});
  }
  /** Correct answer stays inside the isolated private fixture; never supplied by the lookup. */
  const ticket = (await db.doc(`liveRaceTickets/${a.ticketId}`).get()).data()!;
  /** Creator is always the first seat in this fixture. */
  const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data()!;
  await updateLiveRaceForUser(A, {ticketId: a.ticketId, requestId: query.requestId, riddleId: query.riddleId,
    action: kind === "hint" || kind === "skip" ? kind : "guess", ...(kind === "correct" ? {guess: match.runs[0].riddles[0].answer} : kind === "auto-skip" ? {guess: "zzzzzzz"} : {})}, {db, nowMs: NOW + 13000});
  expect((await receipt(a, query.requestId)).data()).not.toHaveProperty("guessProof");
  expect(await confirmLiveGuessReceiptForUser(A, query, {db, nowMs: NOW + 14000})).toEqual({status: "unconfirmed"});
});

it.each(["position", "riddle", "count", "status", "winner"])("rejects advanced %s authority without rewriting proof", async kind => {
  /** Production scoring supplies immutable acceptance evidence. */
  const {query, stored} = await accepted(), ticket = (await db.doc(`liveRaceTickets/${query.ticketId}`).get()).data()!;
  /** Owned canonical match is the only source of the current attempt version. */
  const match = db.doc(`liveRaceMatches/${ticket.matchId}`), data = (await match.get()).data()!;
  if (kind === "winner") await match.update({winner: 1});
  else {
    /** Preserve all ownership fields while changing a single recovery boundary. */
    const run = {...data.runs[0]};
    if (kind === "position") run.currentPosition++;
    /** Alter only the current frozen question identity. */
    if (kind === "riddle") run.riddles = run.riddles.map((riddle: {
      /** Frozen question identity. */
      riddleId: string;
    }, index: number) => index === run.currentPosition ? {...riddle,
      /** Replacement question cannot borrow historical acceptance. */
      riddleId: "different-question"} : riddle);
    if (kind === "count") run.guessesUsed++;
    if (kind === "status") run.status = "completed";
    await match.update({runs: [run, data.runs[1]]});
  }
  /** Compare every canonical document and update timestamp after observation. */
  const before = await databaseState();
  expect(await confirmLiveGuessReceiptForUser(A, query, {db, nowMs: NOW + 10000})).toEqual({status: "unconfirmed"});
  expect(await databaseState()).toEqual(before);
  expect((await stored.ref.get()).updateTime!.isEqual(stored.updateTime!)).toBe(true);
});
