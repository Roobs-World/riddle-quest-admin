import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {RACE_RULES} from "../../../../src/core/race/index.js";
import {submitRaceGuessForUser, requestRaceHintForUser, skipRaceRiddleForUser, startRaceRunForUser,
  reserveRaceInviteForUser, publishRaceChallengeForUser, abandonRaceRunForUser} from "../../race/raceService";
import {requestDocumentId} from "../../race/raceSetupService";
import type {RaceRunRecord} from "../../race/raceEngine";

/** Isolated demo storage never accesses production. */
let db: FirebaseFirestore.Firestore;
/** Complete owned state for public mutation and replay tests. */
const fixture = (): RaceRunRecord => ({runId: "binding-run", userId: "binding-player", role: "creator", status: "active",
  categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version, deckId: "binding-deck",
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
    text: "A clue", answer: "test", position})), currentPosition: 0, correctCount: 0, guessesUsed: 0,
  hintUsed: false, revealedLetters: [], startedAtMs: 1000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: []});
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("request-binding-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await db.recursiveDelete(db.doc("raceRuns/binding-run"));
  await db.doc(`raceStartRequests/${requestDocumentId("binding-player", "binding-start")}`).delete();
  await db.doc(`raceInviteRequests/${requestDocumentId("binding-player", "binding-reserve")}`).delete();
  await db.doc("racePerformanceOutbox/binding-run").delete();
  await db.doc("raceSettlementOutbox/binding-run").delete();
  await db.doc("users/binding-player").set({displayName: "Player", coins: 0});
  await db.doc("raceRuns/binding-run").set(fixture());
});

it.each(["guess", "hint", "skip", "abandon"] as const)("retains exact historical %s replay without another mutation", async kind => {
  /** Unchanged original input is replayed after its binding is removed to model supported history. */
  const input = {runId: "binding-run", riddleId: "q-0", guess: "xxxx", requestId: "binding-legacy"};
  /** Public functions generate genuine accepted receipts and engine projections. */
  const execute = () => kind === "guess" ? submitRaceGuessForUser("binding-player", input, {db, nowMs: 2000}) :
    kind === "hint" ? requestRaceHintForUser("binding-player", input, {db, nowMs: 2000}) :
      kind === "skip" ? skipRaceRiddleForUser("binding-player", input, {db, nowMs: 2000}) :
        abandonRaceRunForUser("binding-player", input, {db, nowMs: 2000});
  /** First accepted reply is immutable even when its metadata predates the new binding. */
  const original = await execute();
  await db.doc(`raceRuns/binding-run/requests/${requestDocumentId("binding-player", input.requestId)}`).update({commandBinding: FieldValue.delete()});
  /** Current canonical state must remain byte-for-byte unchanged on replay. */
  const before = (await db.doc("raceRuns/binding-run").get()).data();
  expect(await execute()).toEqual(original);
  expect((await db.doc("raceRuns/binding-run").get()).data()).toEqual(before);
});

it.each([null, {version: 2}, {version: 1, kind: "hint", fingerprint: "invalid"}])("rejects damaged binding metadata without legacy downgrade: %j", commandBinding => {
  // This test returns the asynchronous sequence so every rejection is observed by Jest.
  return (async () => {
    /** Original paid command produces a validated receipt. */
    const input = {runId: "binding-run", riddleId: "q-0", requestId: "binding-damaged"};
    await requestRaceHintForUser("binding-player", input, {db, nowMs: 2000});
    await db.doc(`raceRuns/binding-run/requests/${requestDocumentId("binding-player", input.requestId)}`).update({commandBinding});
    /** Rejected replay cannot change penalties, reveals, rate limits or command clocks. */
    const before = (await db.doc("raceRuns/binding-run").get()).data();
    await expect(requestRaceHintForUser("binding-player", input, {db, nowMs: 3000})).rejects.toMatchObject({code: "data-loss"});
    expect((await db.doc("raceRuns/binding-run").get()).data()).toEqual(before);
  })();
});

it("replays NFC-equivalent guesses and rejects a forged receipt owner without modifying authority", async () => {
  /** Engine normalization returns NFC feedback even for decomposed input. */
  const input = {runId: "binding-run", riddleId: "q-0", guess: "cafe\u0301", requestId: "binding-unicode"};
  /** Equivalent submitted graphemes describe the same accepted command. */
  const first = await submitRaceGuessForUser("binding-player", input, {db, nowMs: 2000});
  expect(await submitRaceGuessForUser("binding-player", {...input, guess: "café", includeEvaluation: false}, {db, nowMs: 3000})).toEqual(first);
  await db.doc(`raceRuns/binding-run/requests/${requestDocumentId("binding-player", input.requestId)}`).update({userId: "another-owner"});
  await expect(submitRaceGuessForUser("binding-player", input, {db, nowMs: 4000})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc("raceRuns/binding-run").get()).data()?.guessesUsed).toBe(1);
});

it.each(["hint", "finish"] as const)("aborts %s and all staged charges/rewards when its response cannot be delivered", async kind => {
  await db.doc("raceRuns/binding-run").set({...fixture(), role: "challenger", challengeId: "binding-challenge",
    ...(kind === "finish" ? {correctCount: 9, currentPosition: 9} : {}),
    opponent: {displayName: "Creator", subjectUserId: "binding-creator", avatarUrl: "not-a-url", adjustedFinishMs: 100000, events: []}});
  /** Both canonical state and the complete account must survive response validation failure. */
  const before = (await db.doc("raceRuns/binding-run").get()).data();
  /** Settlement may stage achievement grants before the public response is validated. */
  const account = (await db.doc("users/binding-player").get()).data();
  /** Invalid display metadata cannot make the accepted mutation undeliverable after commit. */
  const input = {runId: "binding-run", riddleId: kind === "finish" ? "q-9" : "q-0", guess: "test", requestId: "binding-undeliverable"};
  await expect(kind === "hint" ? requestRaceHintForUser("binding-player", input, {db, nowMs: 2000}) :
    submitRaceGuessForUser("binding-player", input, {db, nowMs: 2000})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc("raceRuns/binding-run").get()).data()).toEqual(before);
  expect((await db.doc("users/binding-player").get()).data()).toEqual(account);
  expect((await db.collection("raceRuns/binding-run/requests").get()).empty).toBe(true);
  expect((await db.doc("racePerformanceOutbox/binding-run").get()).exists).toBe(false);
  expect((await db.doc("raceSettlementOutbox/binding-run").get()).exists).toBe(false);
});

it("rejects a damaged accepted response without reapplying the bound command", async () => {
  /** Correct receipt metadata cannot authorize a corrupt response projection. */
  const input = {runId: "binding-run", riddleId: "q-0", requestId: "binding-response-corrupt"};
  await requestRaceHintForUser("binding-player", input, {db, nowMs: 2000});
  await db.doc(`raceRuns/binding-run/requests/${requestDocumentId("binding-player", input.requestId)}`).update({response: {run: {runId: "binding-run"}}});
  /** The original hint remains charged exactly once and the corrupt response is quarantined. */
  const before = (await db.doc("raceRuns/binding-run").get()).data();
  await expect(requestRaceHintForUser("binding-player", input, {db, nowMs: 3000})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc("raceRuns/binding-run").get()).data()).toEqual(before);
});

it("records a bound alias for an accepted fallback even without content, then rejects changed intent", async () => {
  /** Physical fallback offer identity is derived by the same canonical receipt address contract. */
  const offerId = requestDocumentId("binding-player", "accepted-fallback");
  await db.doc(`raceBotOffers/${offerId}`).set({version: 1, userId: "binding-player", requestId: "accepted-fallback", locale: "en",
    categoryId: "history", requestedCategoryId: "history", performanceMs: 100000, createdAtMs: 1000, expiresAtMs: 61000, acceptedRunId: "binding-run"});
  await db.doc("raceRuns/binding-run").set({...fixture(), role: "challenger", fallbackOfferId: offerId,
    opponent: {kind: "bot", displayName: "Nova", adjustedFinishMs: 100000, events: []}});
  /** An alias resumes the already accepted run without resetting its start or generating a new deck. */
  const input = {locale: "en" as const, categoryId: "history" as const, fallbackOfferId: offerId, prepare: true, requestId: "binding-start"};
  /** Concurrent aliases coalesce into one newly bound request receipt. */
  const replies = await Promise.all([startRaceRunForUser("binding-player", input, {db, nowMs: 2000}),
    startRaceRunForUser("binding-player", input, {db, nowMs: 2000})]);
  expect(replies.every(reply => reply.run.runId === "binding-run" && reply.run.startsAtMs === 1000)).toBe(true);
  expect((await db.doc(`raceStartRequests/${requestDocumentId("binding-player", input.requestId)}`).get()).data()?.commandBinding.kind).toBe("start");
  await expect(startRaceRunForUser("binding-player", {...input, categoryId: "music"}, {db, nowMs: 3000})).rejects.toMatchObject({code: "invalid-argument"});
});

it("preserves historical reservation language and rejects cross-language reuse", async () => {
  /** Canonical lobby retains the language omitted by historical receipt metadata. */
  const input = {locale: "en" as const, requestId: "binding-reserve"};
  /** Original response remains valid for the same pending or expired lobby. */
  const original = await reserveRaceInviteForUser("binding-player", input, {db, nowMs: 2000});
  await db.doc(`raceInviteRequests/${requestDocumentId("binding-player", input.requestId)}`).update({commandBinding: FieldValue.delete()});
  expect(await reserveRaceInviteForUser("binding-player", input, {db, nowMs: 3000})).toEqual(original);
  await expect(reserveRaceInviteForUser("binding-player", {...input, locale: "ja"}, {db, nowMs: 4000})).rejects.toMatchObject({code: "invalid-argument"});
});

it.each([{locale: "ja"}, {categoryId: "music"}])("rejects an accepted fallback source inconsistent with its offer before alias writes: %j", patch => {
  return (async () => {
    /** The owned offer and its immutable source must agree before a new command receipt is created. */
    const offerId = requestDocumentId("binding-player", "accepted-fallback");
    await db.doc(`raceBotOffers/${offerId}`).set({version: 1, userId: "binding-player", requestId: "accepted-fallback", locale: "en",
      categoryId: "history", requestedCategoryId: "history", performanceMs: 100000, createdAtMs: 1000, expiresAtMs: 61000, acceptedRunId: "binding-run"});
    await db.doc("raceRuns/binding-run").set({...fixture(), role: "challenger", fallbackOfferId: offerId,
      opponent: {kind: "bot", displayName: "Nova", adjustedFinishMs: 100000, events: []}, ...patch});
    await expect(startRaceRunForUser("binding-player", {locale: "en", categoryId: "history", fallbackOfferId: offerId, requestId: "binding-start"},
      {db, nowMs: 2000})).rejects.toMatchObject({code: "data-loss"});
    expect((await db.doc(`raceStartRequests/${requestDocumentId("binding-player", "binding-start")}`).get()).exists).toBe(false);
  })();
});

it("retains bound and historical publication replay while rejecting another reservation target", async () => {
  /** Genuine creator state is completed through ten server-authoritative answer commands. */
  for (let position = 0; position < 10; position++) await submitRaceGuessForUser("binding-player", {runId: "binding-run",
    riddleId: `q-${position}`, guess: "test", requestId: `binding-complete-${position}`}, {db, nowMs: 2000 + position * 100});
  await db.doc("raceDecks/binding-deck").set({deckId: "binding-deck", categoryId: "history", locale: "en", contentVersion: "binding-content",
    rulesVersion: RACE_RULES.version, canonicalRiddleIds: fixture().riddles.map(riddle => riddle.canonicalRiddleId)});
  /** Reservation-first publication retains one explicit target in the receipt. */
  const reservation = await reserveRaceInviteForUser("binding-player", {locale: "en", requestId: "binding-reserve"}, {db, nowMs: 4000});
  /** Original publication input is unchanged for transport and historical replay. */
  const input = {runId: "binding-run", requestId: "binding-publish", reservedChallengeId: reservation.challengeId};
  /** Accepted result and account grant remain exactly replayable. */
  const published = await publishRaceChallengeForUser("binding-player", input, {db, nowMs: 5000});
  expect(await publishRaceChallengeForUser("binding-player", input, {db, nowMs: 6000})).toEqual(published);
  /** New request aliases also retain their first response and explicit reservation intent. */
  const alias = {...input, requestId: "binding-publish-alias"};
  /** Re-publication does not repeat the achievement reward from the original publication. */
  const aliasResponse = await publishRaceChallengeForUser("binding-player", alias, {db, nowMs: 6100});
  expect(aliasResponse.achievementCoinsAwarded).toBe(0);
  expect(await publishRaceChallengeForUser("binding-player", alias, {db, nowMs: 6200})).toEqual(aliasResponse);
  expect((await db.doc(`raceRuns/binding-run/requests/${requestDocumentId("binding-player", alias.requestId)}`).get()).data()?.commandBinding.kind).toBe("publish");
  await expect(publishRaceChallengeForUser("binding-player", {runId: "binding-run", requestId: alias.requestId},
    {db, nowMs: 6300})).rejects.toMatchObject({code: "invalid-argument"});
  /** Historical metadata still proves reservation scope through its committed challenge identity. */
  const receiptRef = db.doc(`raceRuns/binding-run/requests/${requestDocumentId("binding-player", input.requestId)}`);
  await receiptRef.update({commandBinding: FieldValue.delete()});
  expect(await publishRaceChallengeForUser("binding-player", input, {db, nowMs: 7000})).toEqual(published);
  /** Removing the target is changed intent, even though the original receipt lacks a digest. */
  const account = (await db.doc("users/binding-player").get()).data();
  await expect(publishRaceChallengeForUser("binding-player", {runId: "binding-run", requestId: input.requestId},
    {db, nowMs: 8000})).rejects.toMatchObject({code: "invalid-argument"});
  expect((await db.doc("users/binding-player").get()).data()).toEqual(account);
});

it.each([{guess: "test"}, {riddleId: "q-1"}, {includeEvaluation: true}])("rejects changed guess input on an existing request: %j", async patch => {
  /** Initial command remains distinct from later altered intent. */
  const input = {runId: "binding-run", riddleId: "q-0", guess: "xxxx", requestId: "binding-guess"};
  await submitRaceGuessForUser("binding-player", input, {db, nowMs: 2000});
  /** Rejection cannot alter either the canonical run or accepted receipt. */
  const before = (await db.doc("raceRuns/binding-run").get()).data();
  await expect(submitRaceGuessForUser("binding-player", {...input, ...patch}, {db, nowMs: 3000})).rejects.toMatchObject({code: "invalid-argument"});
  expect((await db.doc("raceRuns/binding-run").get()).data()).toEqual(before);
});

it("rejects a different mutation kind before decoding another operation's cached response", async () => {
  await requestRaceHintForUser("binding-player", {runId: "binding-run", riddleId: "q-0", requestId: "binding-shared"}, {db, nowMs: 2000});
  await expect(skipRaceRiddleForUser("binding-player", {runId: "binding-run", riddleId: "q-0", requestId: "binding-shared"},
    {db, nowMs: 3000})).rejects.toMatchObject({code: "invalid-argument"});
  await expect(publishRaceChallengeForUser("binding-player", {runId: "binding-run", requestId: "binding-shared"},
    {db, nowMs: 3000})).rejects.toMatchObject({code: "invalid-argument"});
});

it("rejects changed locale on a historical start receipt rather than returning another locale's run", async () => {
  await db.doc(`raceStartRequests/${requestDocumentId("binding-player", "binding-start")}`).set({userId: "binding-player", runId: "binding-run"});
  await expect(startRaceRunForUser("binding-player", {locale: "ja", categoryId: "history", requestId: "binding-start"},
    {db, nowMs: 2000})).rejects.toMatchObject({code: "invalid-argument"});
});

it("rejects changed locale on a reservation receipt without reserving another lobby", async () => {
  await reserveRaceInviteForUser("binding-player", {locale: "en", requestId: "binding-reserve"}, {db, nowMs: 2000});
  await expect(reserveRaceInviteForUser("binding-player", {locale: "ja", requestId: "binding-reserve"},
    {db, nowMs: 3000})).rejects.toMatchObject({code: "invalid-argument"});
});
