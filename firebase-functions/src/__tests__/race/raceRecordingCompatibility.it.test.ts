import {createHash} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {RACE_RULES} from "../../../../src/races/contracts/index.js";
import {startRaceRunForUser, publishRaceChallengeForUser} from "../../race/raceService";
import {inspectRaceChallengeEligibility} from "../../race/access/raceEligibility";
import {raceDeckContentVersion} from "../../race/runs/raceDeckSnapshot";
import {parseChallengeRecord, type RaceChallengeRecord} from "../../race/raceSetupService";
import type {RaceRunRecord} from "../../race/runs/raceEngine";

/** Canonical fixtures only touch a private loopback demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "", A = `facebook_${"a".repeat(40)}`, B = `facebook_${"b".repeat(40)}`, NOW = 1_800_000_000_000;
/** Actual SDK provides original archives, locked eligibility reads and accepted publication/attempt writes. */
let db: FirebaseFirestore.Firestore;
/** Named authoritative source identities make every dependent mutation inspectable. */
const RUN = "recording-source", CHALLENGE = "recording-challenge", DECK = "recording-deck", INVITE = `race-invite-${createHash("sha256").update(A).digest("hex")}-${"d".repeat(32)}`;
/** The dedicated demo owns all these collections; profiles remain bounded to two fixture accounts. */
const clear = async () => {
  for (const collection of ["raceRuns", "raceChallenges", "raceDecks", "raceStartRequests", "raceAttempts", "raceInviteLobbies", "raceMatchCandidates", "racePerformanceOutbox", "raceSettlementOutbox"]) await db.recursiveDelete(db.collection(collection));
  for (const owner of [A, B]) {await db.recursiveDelete(db.doc(`users/${owner}`)); await db.recursiveDelete(db.doc(`jestAccountDeletionTombstones/${owner}`));}
};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT}); db = getFirestore();
});
beforeEach(clear); afterAll(clear);
/** A valid creator timeline can skip an unplayable first question or finish before a later malformed question. */
const seed = async (modern: boolean, answer = " cat ", position = 14, locale: "en" | "fr" = "en") => {
  /** Original immutable deck is never reconstructed from the catalog. */
  const riddles = Array.from({length: 15}, (_, index) => ({riddleId: `recorded-${index}`, canonicalRiddleId: `history:${index}`,
    text: `Original question ${index}`, answer: index === position ? answer : "piano", position: index}));
  /** Skipping the first malformed clue retains the original authoritative penalty in the ghost. */
  const skipped = position === 0, skipPenaltyMs = skipped ? RACE_RULES.skipPenaltyMs : 0, wallFinishMs = skipped ? 11000 : 10000;
  /** Fully consistent recorded scoring events preserve original successful creator history. */
  const events: RaceRunRecord["events"] = [
    ...(skipped ? [{sequence: 0, type: "skip" as const, riddlePosition: 0, wallElapsedMs: 1000, penaltyAddedMs: skipPenaltyMs,
      totalPenaltyMs: skipPenaltyMs, adjustedElapsedMs: 1000+skipPenaltyMs, correctCount: 0}] : []),
    ...Array.from({length: 10}, (_, index) => ({sequence: index+(skipped ? 1 : 0), type: "correct" as const,
      riddlePosition: index+(skipped ? 1 : 0), wallElapsedMs: (index+(skipped ? 2 : 1))*1000, penaltyAddedMs: 0,
      totalPenaltyMs: skipPenaltyMs, adjustedElapsedMs: (index+(skipped ? 2 : 1))*1000+skipPenaltyMs, correctCount: index+1})),
  ];
  /** The source archive is completed, owned and linked to the exact challenge clocks and rules. */
  const run: RaceRunRecord = {runId: RUN, userId: A, role: "creator", status: "completed", result: "recorded", categoryId: "history", locale,
    rulesVersion: RACE_RULES.version, rulesSnapshot: RACE_RULES, deckId: DECK, riddles, currentPosition: skipped ? 10 : 9, correctCount: 10,
    guessesUsed: 0, guessHistory: [], hintUsed: false, revealedLetters: [], startedAtMs: NOW-50000,
    finishedAtMs: NOW-50000+wallFinishMs, wallFinishMs, hintPenaltyMs: 0, skipPenaltyMs, events, evaluationPolicy: "preloaded"};
  /** Modern snapshots and legacy hydration retain the same byte-exact ordered content. */
  const challenge: RaceChallengeRecord = {challengeId: CHALLENGE, creatorId: A, creatorRunId: RUN, creatorSnapshot: {displayName: "Recorded Alice"},
    categoryId: "history", locale, deckId: DECK, canonicalRiddleIds: riddles.map(riddle => riddle.canonicalRiddleId), targetCorrect: 10,
    creatorWallFinishMs: wallFinishMs, creatorHintPenaltyMs: 0, creatorSkipPenaltyMs: skipPenaltyMs, creatorTotalPenaltyMs: skipPenaltyMs,
    creatorAdjustedFinishMs: wallFinishMs+skipPenaltyMs, ghostEvents: events, rules: RACE_RULES, contentVersion: raceDeckContentVersion(riddles),
    status: "active", createdAtMs: NOW-30000, expiresAtMs: NOW+100000, ...(modern ? {riddles, snapshotVersion: 1 as const} : {})};
  await db.doc(`users/${A}`).set({username: "Recorded Alice", coins: 100}); await db.doc(`users/${B}`).set({username: "Recorded Bob", coins: 100});
  await db.doc(`raceRuns/${RUN}`).set(run); await db.doc(`raceChallenges/${CHALLENGE}`).set(challenge);
  await db.doc(`raceDecks/${DECK}`).set({deckId: DECK, categoryId: "history", locale, canonicalRiddleIds: challenge.canonicalRiddleIds, rulesVersion: RACE_RULES.version, createdAtMs: NOW-50000});
  return {run, challenge};
};
/** Both archive formats expose malformed current and future questions without relying on presentation negotiation. */
const starts = [true, false].flatMap(modern => [0, 14].flatMap(position => [" cat ", "a"+"\u0301".repeat(128)].map(answer => ({modern, position, answer}))));
it.each(starts)("rejects incompatible immutable entry, modern=$modern position=$position", async ({modern, position, answer}) => {
  await seed(modern, answer, position);
  /** Original canonical records must survive rejection unchanged. */
  const source = (await db.doc(`raceRuns/${RUN}`).get()).data(), archive = (await db.doc(`raceChallenges/${CHALLENGE}`).get()).data();
  for (const prepare of [false, true]) for (const includeEvaluation of [false, true]) {
    /** Neither server-only presentation nor prepared entry can evade the original-answer compatibility check. */
    const error = await startRaceRunForUser(B, {locale: "en", challengeId: CHALLENGE, requestId: `recorded-start-${prepare}-${includeEvaluation}`, prepare, includeEvaluation}, {db, nowMs: NOW}).then(() => null, failure => failure);
    expect(error).toMatchObject({code: "data-loss"});
  }
  expect((await db.collection("raceStartRequests").get()).empty).toBe(true); expect((await db.collection("raceAttempts").get()).empty).toBe(true);
  expect((await db.collection("raceRuns").get()).size).toBe(1); expect((await db.collection("raceDecks").get()).size).toBe(1);
  expect((await db.doc(`users/${B}/raceMatchProfiles/en`).get()).exists).toBe(false);
  expect((await db.doc(`raceRuns/${RUN}`).get()).data()).toEqual(source); expect((await db.doc(`raceChallenges/${CHALLENGE}`).get()).data()).toEqual(archive);
});

it.each([true, false].flatMap(modern => [" cat ", "a"+"\u0301".repeat(128)].map(answer => ({modern, answer}))))(
  "excludes unplayable recording content from locked eligibility, modern=$modern", async ({modern, answer}) => {
  await seed(modern, answer);
  /** Same locked canonical challenge and archive reads are used by discovery and acceptance. */
  const result = await db.runTransaction(async transaction => {
    /** Actual challenge snapshot is parsed through the production authority boundary. */
    const snapshot = await transaction.get(db.doc(`raceChallenges/${CHALLENGE}`));
    return inspectRaceChallengeEligibility(transaction, db, B, parseChallengeRecord(snapshot.data(), snapshot.id), "en", NOW);
  });
  expect(result).toEqual({reason: "content"}); expect((await db.collection("raceAttempts").get()).empty).toBe(true);
});

it.each([false, true].flatMap(privateInvite => [" cat ", "a"+"\u0301".repeat(128)].map(answer => ({privateInvite, answer}))))(
  "rejects new publication and its rewards for an incompatible frozen deck, private=$privateInvite", async ({privateInvite, answer}) => {
  await seed(true, answer);
  if (privateInvite) await db.doc(`raceInviteLobbies/${INVITE}`).set({challengeId: INVITE, creatorId: A, recipientId: B, locale: "en",
    status: "claimed", claimState: "claimed", publicationState: "pending", createdAtMs: NOW-10000, expiresAtMs: NOW+100000});
  /** Publication must not mutate the original run, balance, pending invitation or discovery candidates. */
  const run = (await db.doc(`raceRuns/${RUN}`).get()).data(), profile = (await db.doc(`users/${A}`).get()).data(), lobby = (await db.doc(`raceInviteLobbies/${INVITE}`).get()).data();
  /** Capture rejection separately before verifying every canonical publication effect. */
  const error = await publishRaceChallengeForUser(A, {runId: RUN, requestId: "recorded-publication", ...(privateInvite ? {reservedChallengeId: INVITE} : {})}, {db, nowMs: NOW}).then(() => null, failure => failure);
  expect(error).toMatchObject({code: "data-loss"});
  expect((await db.collection("raceChallenges").get()).size).toBe(1); expect((await db.collection("raceMatchCandidates").get()).empty).toBe(true);
  expect((await db.doc(`raceRuns/${RUN}`).get()).data()).toEqual(run); expect((await db.doc(`users/${A}`).get()).data()).toEqual(profile);
  expect((await db.doc(`raceInviteLobbies/${INVITE}`).get()).data()).toEqual(lobby);
  expect((await db.collection(`raceRuns/${RUN}/requests`).get()).empty).toBe(true);
});

it.each([true, false])("keeps valid Unicode originals and accepted publication receipts unchanged, modern=%s", async modern => {
  /** Seven graphemes may occupy nine UTF-16 units without changing archive identity. */
  const original = await seed(modern, "élément".normalize("NFD"), 14, "fr");
  /** New evaluation-enabled entry preserves every original answer and consumes one attempt. */
  const response = await startRaceRunForUser(B, {locale: "fr", challengeId: CHALLENGE, requestId: "recorded-valid-start", includeEvaluation: true}, {db, nowMs: NOW});
  expect(response.run.preloadedRiddles?.map(riddle => riddle.evaluation.answer)).toEqual(original.run.riddles.map(riddle => riddle.answer));
  expect((await db.doc(`raceRuns/${RUN}`).get()).data()?.riddles).toEqual(original.run.riddles);
  /** A legitimate completed source may publish once and then replay its accepted receipt. */
  const command = {runId: RUN, requestId: "recorded-valid-publication"};
  /** Accepted preview and one-time grants are retained by the committed publication receipt. */
  const published = await publishRaceChallengeForUser(A, command, {db, nowMs: NOW});
  /** Canonical post-publication balance provides the duplicate-grant control. */
  const profile = (await db.doc(`users/${A}`).get()).data();
  /** Corruption after an accepted publication cannot rewrite cached receipts or award publication twice. */
  await db.doc(`raceRuns/${RUN}`).update({riddles: original.run.riddles.map((riddle, position) => position === 14 ? {...riddle, answer: " cat "} : riddle)});
  expect(await publishRaceChallengeForUser(A, command, {db, nowMs: NOW+1000})).toEqual(published);
  expect((await db.doc(`users/${A}`).get()).data()).toEqual(profile);
  expect((await db.doc(`raceChallenges/${published.challengeId}`).get()).data()?.riddles).toEqual(original.run.riddles);
});

it.each([true, false])("leaves a rejected attempt available after an explicit fixture repair, modern=%s", async modern => {
  await seed(modern);
  /** The original request namespace must remain unconsumed after content rejection. */
  const command = {locale: "en" as const, challengeId: CHALLENGE, requestId: "recorded-retry-start", includeEvaluation: true};
  expect(await startRaceRunForUser(B, command, {db, nowMs: NOW}).then(() => null, error => error)).toMatchObject({code: "data-loss"});
  /** Test-only repair changes the archive source explicitly; production never silently rewrites frozen answers. */
  const repaired = await seed(modern, "piano");
  /** The identical previously rejected request may now consume exactly one valid attempt. */
  const retried = await startRaceRunForUser(B, command, {db, nowMs: NOW+1000});
  expect(retried.run.preloadedRiddles?.map(riddle => riddle.evaluation.answer)).toEqual(repaired.run.riddles.map(riddle => riddle.answer));
  expect((await db.collection("raceAttempts").get()).size).toBe(1); expect((await db.collection("raceStartRequests").get()).size).toBe(1);
});
