import {expect, it} from "@jest/globals";
import {BridgeRiddleSchema} from "../../../../platform/bridge/messages";
import {createInitialGameSession, gameSessionReducer} from "../../gameSession";
import {GameSessionCheckpoints, createSavedGame} from "../../checkpoints/GameSessionCheckpoints";
import {getConfirmedRiddleOutcome, getConfirmedRiddleWin} from "../ConfirmedRiddleOutcome";
import {reconcileConfirmedPendingPlay, type PendingGuessJournal} from "../../journal/pendingGuessJournal";

/** Complete host history proves the paid final attempt exhausted this issued question. */
const issued = BridgeRiddleSchema.parse({riddleId: "classic-1", sessionToken: "00000000-0000-4000-8000-000000000001",
  gameMode: "classic", text: "What has keys?", answerLength: 5, index: 1,
  attemptsUsed: 6, hasUsedContinue: true, awaitingContinue: false,
  acceptedGuesses: Array.from({length: 6}, (_, index) => ({attempt: index + 1,
    feedback: [..."QQQQQ"].map(letter => ({letter, status: "red"}))}))});

it("recovers the host-confirmed paid sixth-attempt loss without a provider save", () => {
  /** This is the same reducer load used by the mounted host bridge. */
  const state = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: issued});
  expect(state.engineSnapshot?.gameOver).toBe(true);
  expect(state.lastOutcome).toMatchObject({kind: "loss", attempts: 6, isCorrect: false, sessionToken: issued.sessionToken});
  expect(state.modal).toBeNull();
  expect(gameSessionReducer(state, {type: "typeLetter", letter: "X"})).toBe(state);
  expect(getConfirmedRiddleWin(issued)).toBeNull();
  expect(createSavedGame(state)?.pendingOutcome).toEqual(state.lastOutcome);
  expect(createSavedGame(gameSessionReducer(state, {type: "completionAcknowledged", outcome: issued}))).toBeNull();
});

it.each(["missing", "draft", "forged-win", "foreign"])("checkpoints the canonical loss over a %s provider save", provider => {
  /** Provider save predates the host's accepted terminal history. */
  const prior = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {...issued,
    attemptsUsed: 0, hasUsedContinue: false, acceptedGuesses: []}});
  /** Stale draft is deliberately nonterminal; forged outcomes cannot override host feedback. */
  const saved = createSavedGame(prior)!;
  if (provider === "foreign") saved.sessionToken = "00000000-0000-4000-8000-000000000099";
  if (provider === "forged-win") saved.pendingOutcome = {...getConfirmedRiddleOutcome(issued)!, kind: "win", isCorrect: true};
  /** Actual checkpoint owner must save the confirmed loss instead of restoring older intent. */
  const state = gameSessionReducer(prior, {type: "loadRiddle", riddle: issued});
  expect(new GameSessionCheckpoints().update(state, provider === "missing" ? undefined : saved))
    .toMatchObject({kind: "save", game: {pendingOutcome: {kind: "loss", attempts: 6}}});
});

it.each(["restoreQueuedGuesses", "restoreConfirmedRiddle", "restoreSession"] as const)(
  "cannot reopen the confirmed loss through %s", type => {
    /** Journal and provider fields retain a pre-acceptance empty board. */
    const prior = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {...issued,
      attemptsUsed: 0, hasUsedContinue: false, acceptedGuesses: []}});
    /** Exact older rollback fields used by both real journal restoration actions. */
    const base = {currentLetters: prior.currentLetters, activeSlotIndex: prior.activeSlotIndex,
      guesses: prior.guesses, engineSnapshot: prior.engineSnapshot, modal: prior.modal, lastOutcome: prior.lastOutcome,
      completionAcknowledged: prior.completionAcknowledged, letterStates: prior.letterStates, profile: prior.profile,
      lastRewards: prior.lastRewards, optimisticAchievementIds: prior.optimisticAchievementIds};
    /** Complete authority history wins over every older local restoration. */
    const state = gameSessionReducer(prior, {type: "loadRiddle", riddle: issued});
    /** Exercise the actual reducer restoration seam rather than copying its outcome. */
    const restored = gameSessionReducer(state, type === "restoreQueuedGuesses" ? {type, base, guesses: [], draft: Array(5).fill("X")} :
      type === "restoreConfirmedRiddle" ? {type, base, riddle: prior.riddle!} : {...createSavedGame(prior)!, type});
    expect(restored.lastOutcome).toEqual(state.lastOutcome);
    expect(restored.engineSnapshot).toMatchObject({attemptsUsed: 6, gameOver: true, hasUsedContinue: true});
    expect(restored.currentLetters).toEqual(Array(5).fill(""));
  });

it.each(["incomplete", "width", "order", "past-win", "unpaid", "awaiting", "seventh", "bad-letter", "bad-status", "fifth"])(
  "does not infer a loss from ambiguous or malformed authority history (%s)", invalid => {
    /** Direct helper also protects internal callers that do not traverse bridge parsing. */
    const candidate = structuredClone(issued);
    if (invalid === "incomplete") candidate.acceptedGuesses!.pop();
    if (invalid === "width") candidate.acceptedGuesses![0]!.feedback.pop();
    if (invalid === "order") candidate.acceptedGuesses![0]!.attempt = 2;
    if (invalid === "past-win") candidate.acceptedGuesses![0]!.feedback.forEach(cell => cell.status = "green");
    if (invalid === "unpaid") candidate.hasUsedContinue = false;
    if (invalid === "awaiting") candidate.awaitingContinue = true;
    if (invalid === "seventh") candidate.attemptsUsed = 7;
    if (invalid === "bad-letter") candidate.acceptedGuesses![0]!.feedback[0]!.letter = "QQ";
    if (invalid === "bad-status") Object.assign(candidate.acceptedGuesses![0]!.feedback[0]!, {status: "unknown"});
    if (invalid === "fifth") {candidate.attemptsUsed = 5; candidate.acceptedGuesses!.pop();}
    expect(getConfirmedRiddleOutcome(candidate)).toBeNull();
  });

it.each(["draft", "queued", "paid", "foreign-guess", "foreign-paid", "successor"])(
  "retires only the exact exhausted journal without advancing successors (%s)", boundary => {
    /** Local base can incorrectly project a win; host terminal feedback remains authoritative. */
    const prior = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {...issued,
      attemptsUsed: 0, hasUsedContinue: false, acceptedGuesses: []}});
    /** Valid root journal can own pending guesses, paid actions, or later issued work. */
    const journal: PendingGuessJournal = {version: 1, scope: "player:1:en", confirmedClassicIndex: 1,
      riddle: prior.riddle!, base: {currentLetters: prior.currentLetters, activeSlotIndex: 0, guesses: [],
        engineSnapshot: prior.engineSnapshot, modal: null, lastOutcome: null, completionAcknowledged: false, letterStates: {}},
      successors: [], queue: [], draft: ["X", "", "", "", ""]};
    if (boundary !== "draft") journal.queue.push({message: {type: "game:submitGuess", requestId: "lost-sixth",
      payload: {riddleId: issued.riddleId, gameMode: issued.gameMode,
        sessionToken: boundary === "foreign-guess" ? "00000000-0000-4000-8000-000000000099" : issued.sessionToken,
        guess: "QQQQQ", requestId: "lost-sixth"}}, attempts: 6, isCorrect: true, gameOver: true, canContinue: false,
      feedback: Array(5).fill("green")});
    if (boundary === "paid" || boundary === "foreign-paid") journal.coinAction = {type: "game:spendCoins", requestId: "lost-continue",
      payload: {riddleId: issued.riddleId, gameMode: issued.gameMode, reason: "continue", requestId: "lost-continue",
        sessionToken: boundary === "foreign-paid" ? "00000000-0000-4000-8000-000000000099" : issued.sessionToken}};
    if (boundary === "successor") journal.successors.push({riddle: {...prior.riddle!, index: 2, riddleId: "classic-2",
      sessionToken: "00000000-0000-4000-8000-000000000002"}, base: journal.base, draft: Array(5).fill("C")});
    /** Reconciliation never mutates the original journal or fabricates progression from a loss. */
    const before = structuredClone(journal);
    if (boundary === "paid") expect(reconcileConfirmedPendingPlay(journal, issued)).toEqual({...journal, queue: []});
    else expect(reconcileConfirmedPendingPlay(journal, issued)).toBe(["foreign-guess", "foreign-paid", "successor"].includes(boundary) ? journal : null);
    expect(journal).toEqual(before);
  });
