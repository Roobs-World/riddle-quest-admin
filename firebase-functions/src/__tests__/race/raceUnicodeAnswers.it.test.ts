import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {splitGraphemes} from "@riddle-quest/core/game";
import {SubmitRaceGuessRequestSchema} from "@riddle-quest/core/race";
import type {RaceRunRecord} from "../../race/raceEngine";
import {startRaceRunForUser, submitRaceGuessForUser, requestRaceHintForUser} from "../../race/raceService";

/** Mutation guards confine authored catalogs and canonical accounts to one private loopback demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "", OWNER = `jest_${"a".repeat(40)}`, NOW = 1_800_000_000_000;
/** Actual SDK implements immutable deck publication, run mutation and idempotent receipts. */
let db: FirebaseFirestore.Firestore;
/** Decomposed European/Japanese answers and Indic conjuncts exceed seven UTF-16 units while fitting seven slots. */
const cases = [{locale: "fr", answer: "élément".normalize("NFD")}, {locale: "ru", answer: "майонез".normalize("NFD")},
  {locale: "ja", answer: "ざざざざざざざ".normalize("NFD")}, {locale: "hi", answer: "महाराष्ट्र"}] as const;
/** Unique answer suffixes preserve a complete competitive pool without changing its Unicode prefix. */
const answerAt = (item: typeof cases[number], index: number) => splitGraphemes(item.answer, item.locale).slice(0, 5).join("").normalize("NFD")+String(index).padStart(2, "0");
/** Named fixture documents permit bounded catalog cleanup while all run collections belong to the dedicated demo. */
const clear = async () => {
  await Promise.all(cases.flatMap(item => Array.from({length: 30}, (_, index) => db.doc(`localizedRiddles/${item.locale}/riddles/unicode-${index}`).delete())));
  await db.recursiveDelete(db.doc(`users/${OWNER}`)); await db.recursiveDelete(db.doc(`jestAccountDeletionTombstones/${OWNER}`));
  for (const collection of ["raceRuns", "raceDecks", "raceStartRequests", "raceRequests", "racePerformanceOutbox", "raceSettlementOutbox"]) await db.recursiveDelete(db.collection(collection));
};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT}); db = getFirestore();
});
beforeEach(async () => {
  await clear();
  /** All easy and medium choices retain the Unicode property regardless of random run IDs. */
  const batch = db.batch();
  for (const item of cases) for (let index = 0; index < 30; index++) batch.set(db.doc(`localizedRiddles/${item.locale}/riddles/unicode-${index}`), {
    riddleId: `${item.locale}-unicode-${index}`, canonicalRiddleId: `history:${index}`, text: `Unique ${item.locale} question ${index}`,
    answer: answerAt(item, index), categoryId: "history", difficultyBand: (["easy", "medium", "hard"] as const)[index%3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  batch.set(db.doc(`users/${OWNER}`), {username: "Unicode player", coins: 550}); await batch.commit();
});
afterAll(clear);

it.each(cases)("publishes and scores the complete $locale evaluation deck without changing canonical answers", async item => {
  /** Real race creation validates its public response before committing the private run. */
  const start = await startRaceRunForUser(OWNER, {locale: item.locale, categoryId: "history", requestId: "unicode-evaluation-start", includeEvaluation: true}, {db, nowMs: NOW});
  /** Immutable stored run remains the original authoritative answer source. */
  const original = (await db.doc(`raceRuns/${start.run.runId}`).get()).data() as RaceRunRecord;
  expect(start.run.preloadedRiddles).toHaveLength(15);
  expect(start.run.preloadedRiddles!.map(riddle => riddle.evaluation.answer)).toEqual(original.riddles.map(riddle => riddle.answer));
  expect(start.run.currentRiddle!.evaluation!.answer.length).toBeGreaterThan(7);
  /** Hint feedback uses the existing NFC grapheme projection while retaining raw evaluation text. */
  const hinted = await requestRaceHintForUser(OWNER, {runId: start.run.runId, riddleId: start.run.currentRiddle!.riddleId, requestId: "unicode-evaluation-hint", includeEvaluation: true}, {db, nowMs: NOW+1000});
  expect(hinted.run.currentRiddle!.revealedLetters).toHaveLength(1);
  expect(hinted.run.currentRiddle!.evaluation!.answer).toBe(original.riddles[0].answer);
  /** Decode the same bounded request schema used by bridge and callable transports before scoring. */
  const command = SubmitRaceGuessRequestSchema.parse({runId: start.run.runId, riddleId: start.run.currentRiddle!.riddleId,
    guess: original.riddles[0].answer, requestId: "unicode-evaluation-guess", includeEvaluation: true});
  /** Committed response includes canonical scoring and the next validated question. */
  const response = await submitRaceGuessForUser(OWNER, command, {db, nowMs: NOW+2000});
  expect(response.run.correctCount).toBe(1); expect(response.isCorrect).toBe(true);
  expect(response.feedback.every(letter => letter.status === "green")).toBe(true);
  expect((await submitRaceGuessForUser(OWNER, command, {db, nowMs: NOW+3000})).run.correctCount).toBe(1);
  expect((await db.doc(`raceRuns/${start.run.runId}`).get()).data()!.riddles).toEqual(original.riddles);
  expect((await db.doc(`users/${OWNER}`).get()).data()?.coins).toBe(550);
});

it.each(cases)("accepts a canonically equivalent decomposed $locale guess in an answer-free run", async item => {
  /** Legacy presentation must still let the client submit a seven-slot Unicode answer. */
  const start = await startRaceRunForUser(OWNER, {locale: item.locale, categoryId: "history", requestId: "unicode-legacy-start"}, {db, nowMs: NOW});
  /** Actual private snapshot supplies the original answer without client evaluation. */
  const stored = (await db.doc(`raceRuns/${start.run.runId}`).get()).data()!;
  /** This original Unicode answer remains larger than the previous string-unit bound. */
  const answer = stored.riddles[0].answer as string;
  expect(start.run.currentRiddle?.evaluation).toBeUndefined(); expect(start.run.preloadedRiddles).toBeUndefined(); expect(answer.length).toBeGreaterThan(7);
  /** Normalized client input and original stored bytes compare through the same scoring semantics. */
  const command = SubmitRaceGuessRequestSchema.parse({runId: start.run.runId, riddleId: start.run.currentRiddle!.riddleId,
    requestId: "unicode-legacy-guess", guess: ` ${answer.normalize("NFD")} `});
  /** Committed response includes canonical scoring and the next validated question. */
  const response = await submitRaceGuessForUser(OWNER, command, {db, nowMs: NOW+1000});
  expect(response.isCorrect).toBe(true); expect(response.run.correctCount).toBe(1); expect(response.run.currentRiddle?.evaluation).toBeUndefined();
  expect((await db.doc(`raceRuns/${start.run.runId}`).get()).data()!.riddles).toEqual(stored.riddles);
});

it.each(["abcdefgh", "é".repeat(8).normalize("NFD")])("rejects more than seven slots without changing the canonical run", async guess => {
  /** A playable legacy run supplies the unchanged-state negative control. */
  const start = await startRaceRunForUser(OWNER, {locale: "fr", categoryId: "history", requestId: "unicode-invalid-start"}, {db, nowMs: NOW});
  /** Invalid transport inputs cannot alter any canonical run field. */
  const before = (await db.doc(`raceRuns/${start.run.runId}`).get()).data();
  expect(SubmitRaceGuessRequestSchema.safeParse({runId: start.run.runId, riddleId: start.run.currentRiddle!.riddleId, requestId: "unicode-invalid-guess", guess}).success).toBe(false);
  expect((await db.doc(`raceRuns/${start.run.runId}`).get()).data()).toEqual(before);
});
