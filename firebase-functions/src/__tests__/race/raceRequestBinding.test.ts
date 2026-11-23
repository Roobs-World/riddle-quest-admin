import {RACE_RULES} from "../../../../src/races/contracts/index.js";
import {bindRaceRequest, assertRaceRequestReplay, assertRaceMutationReceipt, assertLegacyRaceStart, type RaceReceiptCommand} from "../../race/raceRequestBinding";
import {applyRaceGuess, applyRaceHint, applyRaceSkip, abandonRaceRun, toRaceRunView, type RaceRunRecord} from "../../race/raceEngine";

/** Original typed guess whose letters never enter binding metadata. */
const input = {runId: "run", riddleId: "q-0", requestId: "request-0001", guess: "xxxx"};
/** Valid immutable deck used for historical receipt reconstruction. */
const fixture = (): RaceRunRecord => ({runId: "run", userId: "player", role: "creator", status: "active", categoryId: "history", locale: "en",
  rulesVersion: RACE_RULES.version, deckId: "deck", riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`,
    canonicalRiddleId: `c-${position}`, text: "A clue", answer: "test", position})), currentPosition: 0, correctCount: 0,
  guessesUsed: 0, hintUsed: false, revealedLetters: [], startedAtMs: 1000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: []});

it("canonicalizes equivalent boolean defaults, object order and NFC guesses without binding request IDs", () => {
  /** NFC normalization matches the feedback graphemes emitted by the engine. */
  const first = bindRaceRequest({kind: "guess", input: {...input, guess: "cafe\u0301"}});
  expect(first).toEqual(bindRaceRequest({kind: "guess", input: {includeEvaluation: false, guess: "café", requestId: "another-id",
    riddleId: input.riddleId, runId: input.runId}}));
  expect(Object.keys(first).sort()).toEqual(["fingerprint", "kind", "version"]);
  expect(JSON.stringify(first)).not.toContain("café");
});

it.each(["guess", "hint", "skip", "abandon", "start", "publish", "reserve", "cancel"] as const)("binds the %s operation independently of its receipt namespace", kind => {
  /** Complete typed intents span scoring, acceptance, publication and invitation lifecycle. */
  const commands: RaceReceiptCommand[] = [{kind: "guess", input}, {kind: "hint", input}, {kind: "skip", input}, {kind: "abandon", input},
    {kind: "start", input: {locale: "en", categoryId: "history", requestId: "request-0001"}}, {kind: "publish", input},
    {kind: "reserve", input: {locale: "en", requestId: "request-0001"}}, {kind: "cancel", input: {challengeId: "challenge", locale: "en", requestId: "request-0001"}}];
  /** Every distinct command kind has a distinct digest even when IDs or inputs overlap. */
  const binding = bindRaceRequest(commands.find(command => command.kind === kind)!);
  expect(binding.kind).toBe(kind);
  expect(new Set(commands.map(command => bindRaceRequest(command).fingerprint)).size).toBe(commands.length);
  expect(assertRaceRequestReplay({userId: "player", commandBinding: binding}, "player", binding)).toBe(true);
});

it.each([undefined, null, {}, {version: 2}, {version: 1, kind: "guess", fingerprint: "broken"}])("rejects corrupt ownership or bindings without downgrading: %j", damaged => {
  /** Known expected command is independent of untrusted receipt fields. */
  const binding = bindRaceRequest({kind: "guess", input});
  expect(() => assertRaceRequestReplay({userId: "other", commandBinding: binding}, "player", binding)).toThrow("Stored race request is invalid");
  if (damaged === undefined) expect(assertRaceRequestReplay({userId: "player"}, "player", binding)).toBe(false);
  else expect(() => assertRaceRequestReplay({userId: "player", commandBinding: damaged}, "player", binding)).toThrow("Stored race request is invalid");
});

it("rejects changed start intent while allowing fresh presentation on an unchanged start", () => {
  /** Original start excludes presentation because resume projects it afresh. */
  const start = {locale: "en" as const, categoryId: "history" as const, requestId: "request-0001"};
  /** Preparation, source recording, category and offer provenance remain part of the command. */
  const binding = bindRaceRequest({kind: "start", input: start});
  expect(bindRaceRequest({kind: "start", input: {...start, prepare: false, includeEvaluation: true}})).toEqual(binding);
  for (const patch of [{prepare: true}, {categoryId: "music" as const}, {locale: "ja" as const}, {offerId: "a".repeat(64)},
    {fallbackOfferId: "b".repeat(64)}, {rivalryChallengeId: "rivalry"}, {challengeId: "challenge"}])
    expect(() => assertRaceRequestReplay({userId: "player", commandBinding: binding}, "player", bindRaceRequest({kind: "start", input: {...start, ...patch}})))
      .toThrow("reused for different input");
  expect(() => assertLegacyRaceStart(start, fixture())).not.toThrow();
  expect(() => assertLegacyRaceStart({...start, prepare: true}, fixture())).toThrow("reused for different input");
});

it.each(["wrong", "correct", "auto-skip"])("reconstructs a historical %s guess across successor advancement", kind => {
  /** Original engine feedback preserves the original submitted graphemes. */
  const request = {...input, guess: kind === "correct" ? "test" : "xxxx"};
  /** Auto-skip occurs after the fifth wrong guess, leaving a successor prompt. */
  const original = {...fixture(), guessesUsed: kind === "auto-skip" ? 4 : 0};
  /** Genuine historical accepted response has no command binding. */
  const result = applyRaceGuess(original, request, 2000);
  /** The receipt retains its own accepted projection independently of today's progress. */
  const response = {run: toRaceRunView(result.run, 2000), feedback: result.feedback, isCorrect: result.isCorrect, autoSkipped: result.autoSkipped};
  expect(() => assertRaceMutationReceipt(response, {kind: "guess", input: request}, result.run, false)).not.toThrow();
  expect(() => assertRaceMutationReceipt(response, {kind: "guess", input: {...request, riddleId: "q-1"}}, result.run, false)).toThrow("reused for different input");
  expect(() => assertRaceMutationReceipt(response, {kind: "guess", input: {...request, guess: "yyyy"}}, result.run, true)).toThrow("Stored race request is invalid");
});

it("accepts historical paid and abandonment receipts, and rejects wrong operation or parent authority", () => {
  /** Historical hint response retains its original question and selected position. */
  const hint = applyRaceHint(fixture(), input, 2000);
  /** Historical paid skip response retains its original scoring event after advancement. */
  const skip = applyRaceSkip(fixture(), input, 2000);
  /** Historical abandonment has an explicit null result rather than a competitive outcome. */
  const abandoned = abandonRaceRun(fixture(), 2000);
  /** Correctly shaped historical receipts remain compatible without creating new charges. */
  const hinted = {run: toRaceRunView(hint.run, 2000), revealedLetter: hint.revealedLetter, index: hint.index};
  expect(() => assertRaceMutationReceipt(hinted, {kind: "hint", input}, hint.run, false)).not.toThrow();
  expect(() => assertRaceMutationReceipt({run: toRaceRunView(skip, 2000), penaltyAddedMs: 45000}, {kind: "skip", input}, skip, false)).not.toThrow();
  expect(() => assertRaceMutationReceipt({run: toRaceRunView(abandoned, 2000), result: null}, {kind: "abandon", input}, abandoned, false)).not.toThrow();
  expect(() => assertRaceMutationReceipt(hinted, {kind: "skip", input}, fixture(), false)).toThrow("reused for different input");
  expect(() => assertRaceMutationReceipt(hinted, {kind: "hint", input}, {...hint.run, locale: "ja"}, true)).toThrow("Stored race request is invalid");
  expect(() => assertRaceMutationReceipt(hinted, {kind: "hint", input: {...input, includeEvaluation: true}}, hint.run, false)).toThrow("reused for different input");
});

it("preserves genuine old one-hint receipts, optional preload hints and missing historical clock metadata", () => {
  /** Old unversioned rules did not retain a snapshot and supported only one selected hint. */
  const source = {...fixture(), rulesSnapshot: {...RACE_RULES, maxHintsPerRiddle: 1 as const}};
  /** Produce genuine historical gameplay, then omit metadata absent from the older transport. */
  const hinted = applyRaceHint(source, input, 2000);
  /** Optional hints in the deck were introduced after local evaluation support. */
  const view = toRaceRunView(hinted.run, 2000, true);
  delete view.startsAtMs;
  delete view.serverNowMs;
  view.preloadedRiddles!.forEach(prompt => {delete prompt.hint;});
  expect(() => assertRaceMutationReceipt({run: view, revealedLetter: hinted.revealedLetter, index: hinted.index},
    {kind: "hint", input: {...input, includeEvaluation: true}}, {...hinted.run, rulesSnapshot: undefined}, false)).not.toThrow();
  expect(() => assertRaceMutationReceipt({run: view, revealedLetter: hinted.revealedLetter, index: hinted.index},
    {kind: "hint", input: {...input, includeEvaluation: true}}, {...hinted.run, rulesSnapshot: undefined, recordVersion: 1}, true))
    .toThrow("Stored race request is invalid");
});

it("checks immutable rivalry and preparation expiry without freezing opponent presentation identity", () => {
  /** Prepared provenance remains fixed while a privacy-safe display name can change. */
  const source = {...fixture(), rivalryChallengeId: "rivalry", preparationExpiresAtMs: 30000,
    opponent: {displayName: "Creator", subjectUserId: "creator", adjustedFinishMs: 100000, events: []}};
  /** Real hint projection is accepted independently of its copied display name. */
  const hinted = applyRaceHint(source, input, 2000);
  /** Both receipt minimization and deletion hydration can change only presentation identity. */
  const response = {run: toRaceRunView(hinted.run, 2000), revealedLetter: hinted.revealedLetter, index: hinted.index};
  response.run.opponent!.displayName = "Riddle Quest player";
  expect(() => assertRaceMutationReceipt(response, {kind: "hint", input}, hinted.run, true)).not.toThrow();
  response.run.rivalryChallengeId = "another-rivalry";
  expect(() => assertRaceMutationReceipt(response, {kind: "hint", input}, hinted.run, true)).toThrow("Stored race request is invalid");
  response.run.rivalryChallengeId = source.rivalryChallengeId;
  response.run.preparationExpiresAtMs!++;
  expect(() => assertRaceMutationReceipt(response, {kind: "hint", input}, hinted.run, true)).toThrow("Stored race request is invalid");
});

it("never restores local evaluation content from a receipt belonging to a server-only run", () => {
  /** Requesting evaluation does not override the immutable server-only policy. */
  const source = {...fixture(), evaluationPolicy: "server-only" as const};
  /** Engine projection omits both current evaluation and the preload deck. */
  const hinted = applyRaceHint(source, input, 2000);
  /** Genuine answer-free response remains accepted. */
  const response = {run: toRaceRunView(hinted.run, 2000, true), revealedLetter: hinted.revealedLetter, index: hinted.index};
  expect(() => assertRaceMutationReceipt(response, {kind: "hint", input: {...input, includeEvaluation: true}}, hinted.run, true)).not.toThrow();
  response.run.currentRiddle!.evaluation = {answer: "test", locale: "en"};
  expect(() => assertRaceMutationReceipt(response, {kind: "hint", input: {...input, includeEvaluation: true}}, hinted.run, true))
    .toThrow("Stored race request is invalid");
  delete response.run.currentRiddle!.evaluation;
  response.run.preloadedRiddles = toRaceRunView(fixture(), 2000, true).preloadedRiddles;
  expect(() => assertRaceMutationReceipt(response, {kind: "hint", input: {...input, includeEvaluation: true}}, hinted.run, true))
    .toThrow("Stored race request is invalid");
});
