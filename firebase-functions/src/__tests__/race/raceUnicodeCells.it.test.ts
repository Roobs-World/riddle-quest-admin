import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {splitGraphemes} from "../../../../src/gameplay/input/graphemes.js";
import {isValidGuess} from "../../../../src/gameplay/rules/isValidGuess.js";
import {SubmitRaceGuessRequestSchema, UpdateLiveRaceSchema} from "../../../../src/races/contracts/index.js";
import {startRaceRunForUser, submitRaceGuessForUser, requestRaceHintForUser, resumeRaceRunForUser} from "../../race/raceService";
import {parseRunRecord} from "../../race/raceSetupService";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/live/raceLiveService";

/** Every mutation is guarded by a private loopback demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "", OWNER = `facebook_${"a".repeat(40)}`, PEER = `facebook_${"b".repeat(40)}`, NOW = 1_800_000_000_000;
/** Real SDK exercises canonical state, response validation and idempotent receipts. */
let db: FirebaseFirestore.Firestore;
/** One Indic conjunct and one canonically expanding sequence isolate output-cell and request capacities. */
const cases = [{locale: "hi", prefix: "क्ष्म्यां"}, {locale: "fr", prefix: "a"+"\u0344".repeat(120)}] as const;
/** Thirty unique letter-only answers remain within the original 128-unit authored budget. */
const answerAt = (item: typeof cases[number], index: number) => item.prefix+String.fromCharCode(97+Math.floor(index/6), 97+index%6);
/** All disposable collections belong to this dedicated demo project. */
const clear = async () => {
  for (const name of ["localizedRiddles", "users", "jestAccountDeletionTombstones", "raceRuns", "raceDecks", "raceStartRequests", "raceRequests", "racePerformanceOutbox", "raceSettlementOutbox", "liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers"]) await db.recursiveDelete(db.collection(name));
};
beforeAll(() => {if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");if (!getApps().length) initializeApp({projectId: PROJECT});db=getFirestore();});
beforeEach(async () => {
  await clear();
  /** Actual eligible pools provide deterministic long first cells in every selected question. */
  const batch=db.batch();
  for (const item of cases) for(let index=0;index<30;index++) batch.set(db.doc(`localizedRiddles/${item.locale}/riddles/cells-${index}`), {riddleId:`${item.locale}-cells-${index}`,canonicalRiddleId:`history:${index}`,text:`Authored ${item.locale} clue ${index}`,answer:answerAt(item,index),categoryId:"history",difficultyBand:(["easy","medium","hard"] as const)[index%3],raceEligible:true,qualityVersion:"human_review_v1"});
  batch.set(db.doc(`users/${OWNER}`),{username:"Cells A",coins:550});batch.set(db.doc(`users/${PEER}`),{username:"Cells B",coins:550});await batch.commit();
});
afterAll(clear);
it.each(cases)("publishes original $locale evaluations and normalized preloaded hints", async item => {
  /** Preloading must not prevent an otherwise valid race from starting. */
  const start=await startRaceRunForUser(OWNER,{locale:item.locale,categoryId:"history",requestId:"cells-evaluation-start",includeEvaluation:true},{db,nowMs:NOW});
  /** Original authored bytes are retained in both archive and public evaluation. */
  const stored=parseRunRecord((await db.doc(`raceRuns/${start.run.runId}`).get()).data(), start.run.runId);
  expect(start.run.preloadedRiddles).toHaveLength(15);expect(start.run.preloadedRiddles!.map(r=>r.evaluation.answer)).toEqual(stored.riddles.map(r=>r.answer));
  expect(start.run.preloadedRiddles![0].hint!.letter).toBe(splitGraphemes(stored.riddles[0].answer,item.locale)[0]);
});
it.each(cases)("returns and replays a long $locale hint exactly once", async item => {
  /** Answer-free entry isolates paid mutation output from preloading. */
  const start=await startRaceRunForUser(OWNER,{locale:item.locale,categoryId:"history",requestId:"cells-hint-start"},{db,nowMs:NOW});
  /** The same command identity must not charge a second penalty. */
  const input={runId:start.run.runId,riddleId:start.run.currentRiddle!.riddleId,requestId:"cells-hint-command"};
  /** Public response and receipt retain the full selected grapheme. */
  const response=await requestRaceHintForUser(OWNER,input,{db,nowMs:NOW+1000});
  expect(response.revealedLetter.length).toBeGreaterThan(8);expect(response.run.totalPenaltyMs).toBe(15000);
  expect(await requestRaceHintForUser(OWNER,input,{db,nowMs:NOW+2000})).toEqual(response);
  expect((await resumeRaceRunForUser(OWNER,start.run.runId,{db,nowMs:NOW+3000})).run.currentRiddle!.revealedLetters[0].letter).toBe(response.revealedLetter);
  expect((await db.doc(`users/${OWNER}`).get()).data()?.coins).toBe(550);
});
it.each(cases)("scores the normalized correct $locale guess and replays one committed result", async item => {
  /** Legacy entry avoids the preloading branch while exercising the same authoritative answer. */
  const start=await startRaceRunForUser(OWNER,{locale:item.locale,categoryId:"history",requestId:"cells-correct-start"},{db,nowMs:NOW});
  /** Native input uses NFC while storage and evaluation retain authored bytes. */
  const original=(await db.doc(`raceRuns/${start.run.runId}`).get()).data()!,guess=original.riddles[0].answer.normalize("NFC");
  expect(isValidGuess(guess,splitGraphemes(guess,item.locale).length)).toBe(true);
  /** Decode the actual transport contract before mutating the run. */
  const input=SubmitRaceGuessRequestSchema.parse({runId:start.run.runId,riddleId:start.run.currentRiddle!.riddleId,requestId:"cells-correct-command",guess});
  /** Scoring and feedback must publish the complete grapheme. */
  const response=await submitRaceGuessForUser(OWNER,input,{db,nowMs:NOW+1000});
  expect(response.isCorrect).toBe(true);expect(response.run.correctCount).toBe(1);expect(response.feedback[0].letter).toBe(splitGraphemes(guess,item.locale)[0]);
  expect(await submitRaceGuessForUser(OWNER,input,{db,nowMs:NOW+2000})).toEqual(response);
  expect((await db.doc(`raceRuns/${start.run.runId}`).get()).data()!.riddles).toEqual(original.riddles);
});
it.each(cases)("recovers $locale confirmed history without truncating a wrong long-cell guess", async item => {
  /** One wrong answer retains the current question and exercises stored history validation. */
  const start=await startRaceRunForUser(OWNER,{locale:item.locale,categoryId:"history",requestId:"cells-history-start"},{db,nowMs:NOW});
  /** The unused suffix keeps letter-only slot shape while guaranteeing a wrong answer. */
  const guess=(item.prefix+"zz").normalize("NFC"),input=SubmitRaceGuessRequestSchema.parse({runId:start.run.runId,riddleId:start.run.currentRiddle!.riddleId,requestId:"cells-history-command",guess});
  await submitRaceGuessForUser(OWNER,input,{db,nowMs:NOW+1000});
  /** Negotiated recovery carries full canonical rows and preserves exactly one consumed attempt. */
  const resumed=await resumeRaceRunForUser(OWNER,start.run.runId,{db,nowMs:NOW+2000,includeGuessHistory:true});
  expect(resumed.run.currentRiddle!.confirmedGuesses![0].guess).toEqual(splitGraphemes(guess,item.locale));expect(resumed.run.currentRiddle!.guessesUsed).toBe(1);
});
it.each(cases)("plays long $locale hints and history through a real live match", async item => {
  /** Both human seats are created through production matchmaking and actual SDK writes. */
  const first=await joinLiveRaceForUser(OWNER,{locale:item.locale,categoryId:"history",requestId:"cells-live-a"},{db,nowMs:NOW});
  await joinLiveRaceForUser(PEER,{locale:item.locale,categoryId:"history",requestId:"cells-live-b"},{db,nowMs:NOW+1000});
  /** Scheduled authority becomes visible only after its fixed countdown. */
  const active=await updateLiveRaceForUser(OWNER,{ticketId:first.ticketId,action:"poll",requestId:"cells-live-poll"},{db,nowMs:NOW+7000});
  /** The first hint and subsequent guessed row must share the expanded grapheme contract. */
  const hinted=await updateLiveRaceForUser(OWNER,{ticketId:first.ticketId,action:"hint",riddleId:active.run!.currentRiddle!.riddleId,requestId:"cells-live-hint"},{db,nowMs:NOW+8000});
  expect(hinted.run!.currentRiddle!.revealedLetters[0].letter.length).toBeGreaterThan(8);
  /** Live decoding uses the same expanded normalized guess budget. */
  const input=UpdateLiveRaceSchema.parse({ticketId:first.ticketId,action:"guess",riddleId:active.run!.currentRiddle!.riddleId,requestId:"cells-live-wrong",guess:(item.prefix+"zz").normalize("NFC")});
  /** Full live history is returned without advancing an incorrect question. */
  const wrong=await updateLiveRaceForUser(OWNER,input,{db,nowMs:NOW+9000});
  expect(wrong.run!.currentRiddle!.confirmedGuesses![0].guess).toEqual(splitGraphemes(input.guess!,item.locale));expect(wrong.run!.currentRiddle!.guessesUsed).toBe(1);
});

it("retains a normalized 259-unit wrong guess through canonical storage and history recovery", async () => {
  /** The existing storage cap was 256 units, below legitimate normalized transport capacity. */
  const start = await startRaceRunForUser(OWNER, {locale: "fr", categoryId: "history", requestId: "cells-storage-start"}, {db, nowMs: NOW});
  /** A canonically excluded Hebrew composite expands inside one grapheme while two suffix letters preserve the answer slot count. */
  const guess = ("\uFB2C"+"\u0344".repeat(127)+"zz").normalize("NFC");
  expect(guess.length).toBeGreaterThan(256);expect(guess.length).toBeLessThanOrEqual(384);expect(splitGraphemes(guess)).toHaveLength(3);
  /** The actual request decoder and service commit one incorrect attempt. */
  const input = SubmitRaceGuessRequestSchema.parse({runId: start.run.runId, riddleId: start.run.currentRiddle!.riddleId, requestId: "cells-storage-guess", guess});
  await submitRaceGuessForUser(OWNER, input, {db, nowMs: NOW+1000});
  /** Canonical rereads must accept their own successfully committed history bytes. */
  const recovered = await resumeRaceRunForUser(OWNER, start.run.runId, {db, nowMs: NOW+2000, includeGuessHistory: true});
  expect(recovered.run.currentRiddle!.confirmedGuesses![0].guess).toEqual(splitGraphemes(guess));
  expect((await db.doc(`raceRuns/${start.run.runId}`).get()).data()!.guessHistory).toEqual([guess]);
});
