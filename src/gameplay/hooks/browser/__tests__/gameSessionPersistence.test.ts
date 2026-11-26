import {describe, expect, it} from "@jest/globals";
import {createInitialGameSession, gameSessionReducer} from "../../../session/gameSession";
import {createSavedGame} from "../../../session/checkpoints/GameSessionCheckpoints";

/** Provides riddle behavior. */
const riddle = {
  riddleId: "classic-persistence-1",
  sessionToken: "00000000-0000-4000-8000-000000000004",
  text: "What has keys but cannot open doors?",
  answerLength: 5,
  gameMode: "classic" as const,
  index: 1,
  attemptsUsed: 0,
  hasUsedContinue: false,
  awaitingContinue: false,
};

describe("game session persistence", () => {
  it("persists an unacknowledged terminal outcome and clears it only after acknowledgement", () => {
    expect(createSavedGame(createInitialGameSession(), 100)).toBeNull();

    /** Completes d. */
    let completed = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle});
    for (const letter of ["P", "I", "A", "N", "O"]) {
      completed = gameSessionReducer(completed, {type: "typeLetter", letter});
    }
    completed = gameSessionReducer(completed, {type: "guessRequested"});
    completed = gameSessionReducer(completed, {
      type: "guessResolved",
      feedback: {guess: ["P", "I", "A", "N", "O"], feedback: ["green", "green", "green", "green", "green"]},
      attempts: 1,
      isCorrect: true,
      gameOver: true,
      canContinue: false,
    });
    expect(createSavedGame(completed, 100)).toMatchObject({
      schemaVersion: 1,
      savedAt: 100,
      riddleId: riddle.riddleId,
      sessionToken: riddle.sessionToken,
      pendingOutcome: {
        id: `${riddle.sessionToken}-win-1`,
        kind: "win",
        riddleId: riddle.riddleId,
        sessionToken: riddle.sessionToken,
        attempts: 1,
        isCorrect: true,
      },
    });

    completed = gameSessionReducer(completed, {type: "completionAcknowledged", outcome: riddle});
    expect(createSavedGame(completed, 101)).toBeNull();
  });

  it("creates a stable versioned snapshot for an active session", () => {
    /** Provides active behavior. */
    let active = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle});
    active = gameSessionReducer(active, {type: "typeLetter", letter: "P"});

    expect(createSavedGame(active, 123_456)).toEqual({
      schemaVersion: 1,
      savedAt: 123_456,
      draftRevision: active.draftRevision,
      riddleId: riddle.riddleId,
      sessionToken: riddle.sessionToken,
      gameMode: "classic",
      currentLetters: ["P", "", "", "", ""],
      activeSlotIndex: 1,
      hintRevealedIndices: [],
      guesses: [],
      engineSnapshot: active.engineSnapshot,
      awaitingContinue: false,
      letterStates: {},
    });
  });

  it("persists the bounded Continue decision state", () => {
    /** Provides awaiting behavior. */
    const awaiting = gameSessionReducer(createInitialGameSession(), {
      type: "loadRiddle",
      riddle: {...riddle, attemptsUsed: 5, awaitingContinue: true},
    });

    expect(createSavedGame(awaiting, 123_456)).toMatchObject({
      awaitingContinue: true,
      engineSnapshot: {attemptsUsed: 5, hasUsedContinue: false, gameOver: false},
    });
  });

  it("restores a dropped decline completion without racing a reopened Continue modal", () => {
    /** Provides awaiting riddle behavior. */
    const awaitingRiddle = {...riddle, attemptsUsed: 5, awaitingContinue: true};
    /** Provides awaiting behavior. */
    let awaiting = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: awaitingRiddle});
    awaiting = gameSessionReducer(awaiting, {type: "declineContinue"});
    /** Saves d. */
    const saved = createSavedGame(awaiting, 123_456);
    if (!saved) throw new Error("Expected the pending decline to remain retryable.");

    /** Provides reloaded behavior. */
    let reloaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: awaitingRiddle});
    reloaded = gameSessionReducer(reloaded, {
      type: "restoreSession", riddleId: riddle.riddleId, sessionToken: riddle.sessionToken,
      currentLetters: saved.currentLetters,
      activeSlotIndex: saved.activeSlotIndex,
      hintRevealedIndices: saved.hintRevealedIndices,
      guesses: saved.guesses,
      engineSnapshot: saved.engineSnapshot,
      awaitingContinue: saved.awaitingContinue,
      letterStates: saved.letterStates,
      pendingOutcome: saved.pendingOutcome,
    });

    expect(saved).toMatchObject({awaitingContinue: false, pendingOutcome: {kind: "loss", attempts: 5}});
    expect(reloaded.modal).toBeNull();
    expect(reloaded.lastOutcome).toMatchObject({kind: "loss", attempts: 5});
    expect(reloaded.engineSnapshot?.gameOver).toBe(true);
  });

  it("discards a stale saved decline when another tab already bought Continue", () => {
    /** Provides awaiting riddle behavior. */
    const awaitingRiddle = {...riddle, attemptsUsed: 5, awaitingContinue: true};
    /** Provides awaiting behavior. */
    let awaiting = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: awaitingRiddle});
    awaiting = gameSessionReducer(awaiting, {type: "declineContinue"});
    /** Saves d. */
    const saved = createSavedGame(awaiting, 123_456);
    if (!saved) throw new Error("Expected a saved decline race fixture.");

    /** Provides continued riddle behavior. */
    const continuedRiddle = {
      ...riddle,
      attemptsUsed: 5,
      hasUsedContinue: true,
      awaitingContinue: false,
    };
    /** Provides reloaded behavior. */
    let reloaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: continuedRiddle});
    reloaded = gameSessionReducer(reloaded, {
      type: "restoreSession", riddleId: riddle.riddleId, sessionToken: riddle.sessionToken,
      currentLetters: saved.currentLetters,
      activeSlotIndex: saved.activeSlotIndex,
      hintRevealedIndices: saved.hintRevealedIndices,
      guesses: saved.guesses,
      engineSnapshot: saved.engineSnapshot,
      awaitingContinue: saved.awaitingContinue,
      letterStates: saved.letterStates,
      pendingOutcome: saved.pendingOutcome,
    });

    expect(reloaded.lastOutcome).toBeNull();
    expect(reloaded.modal).toBeNull();
    expect(reloaded.engineSnapshot).toMatchObject({attemptsUsed: 5, hasUsedContinue: true, gameOver: false});
    for (const letter of ["P", "I", "A", "N", "O"]) {
      reloaded = gameSessionReducer(reloaded, {type: "typeLetter", letter});
    }
    reloaded = gameSessionReducer(reloaded, {type: "guessRequested"});
    expect(reloaded.guessPending).toBe(true);
    reloaded = gameSessionReducer(reloaded, {
      type: "guessResolved",
      feedback: {guess: ["P", "I", "A", "N", "O"], feedback: ["green", "green", "green", "green", "green"]},
      attempts: 6,
      isCorrect: true,
      gameOver: true,
      canContinue: false,
    });
    expect(reloaded.lastOutcome).toMatchObject({kind: "win", attempts: 6});
  });
});

it("does not persist a feedback preview as confirmed progress or a completion", () => {
  /** Game state driven through the submission flow. */
  let state = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {
    riddleId: "classic-1", sessionToken: "00000000-0000-4000-8000-000000000001", text: "Clue",
    answerLength: 5, gameMode: "classic", attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false,
    evaluation: {answer: "piano", locale: "en"},
  }});
  for (const letter of "PIANO") state = gameSessionReducer(state, {type: "typeLetter", letter});
  state = gameSessionReducer(state, {type: "guessRequested"});
  expect(state.modal).toBe("victory");
  /** Persisted projection excluding speculative progress. */
  const saved = createSavedGame(state);
  expect(saved?.guesses).toHaveLength(0);
  expect(saved?.engineSnapshot.attemptsUsed).toBe(0);
  expect(saved?.pendingOutcome).toBeUndefined();
  expect(saved).not.toHaveProperty("evaluation");
});

it("resumes pending-guess drafts at the next empty slot in legacy journals", () => {
  /** Issued riddle fixture supplies authoritative recovery state. */
  const loaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {
    ...riddle, evaluation: {answer: "piano", locale: "fr"},
  }});
  /** Observed resumed supplies the recovery assertion baseline. */
  let resumed = gameSessionReducer(loaded, {type: "restoreQueuedGuesses", base: loaded,
    guesses: ["AAAAA"], draft: ["P", "I", "", "", ""]});
  for (const letter of "ANO") resumed = gameSessionReducer(resumed, {type: "typeLetter", letter});
  expect(resumed.currentLetters.join("")).toBe("PIANO");
  expect(resumed.guesses).toHaveLength(1);
});

it("preserves an explicitly selected draft slot during pending recovery", () => {
  /** Issued riddle fixture supplies authoritative recovery state. */
  const loaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle});
  /** Observed resumed supplies the recovery assertion baseline. */
  const resumed = gameSessionReducer(loaded, {type: "restoreQueuedGuesses", base: loaded,
    guesses: [], draft: ["P", "I", "", "", ""], draftActiveSlotIndex: 1});
  expect(gameSessionReducer(resumed, {type: "typeLetter", letter: "A"}).currentLetters).toEqual(["P", "A", "", "", ""]);
});

it("does not restore a pending draft cursor onto a locked hint", () => {
  /** Issued riddle fixture supplies authoritative recovery state. */
  const loaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {...riddle, revealedHints: [{index: 0, letter: "P"}]}});
  /** Observed resumed supplies the recovery assertion baseline. */
  const resumed = gameSessionReducer(loaded, {type: "restoreQueuedGuesses", base: loaded,
    guesses: [], draft: ["P", "I", "", "", ""], draftActiveSlotIndex: 0});
  expect(gameSessionReducer(resumed, {type: "typeLetter", letter: "A"}).currentLetters).toEqual(["P", "I", "A", "", ""]);
});


it.each([
  {label: "same-length successor", riddleId: "classic-successor", sessionToken: "00000000-0000-4000-8000-000000000005"},
  {label: "renewed session", riddleId: riddle.riddleId, sessionToken: "00000000-0000-4000-8000-000000000006"},
])("rejects a saved draft queued before a $label loads", ({riddleId, sessionToken}) => {
  /** Earlier state supplies the baseline for recovery and ownership assertions. */
  let previous = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle});
  for (const letter of "PI") previous = gameSessionReducer(previous, {type: "typeLetter", letter});
  /** Persisted draft represents the provider checkpoint before recovery. */
  const saved = createSavedGame(previous);
  if (!saved) throw new Error("Expected a saved draft.");
  /** Current authoritative state determines which recovery facts remain valid. */
  const current = gameSessionReducer(previous, {type: "loadRiddle", riddle: {...riddle, riddleId, sessionToken}});
  /** Recovered presentation is checked against canonical session facts. */
  const restored = gameSessionReducer(current, {
    type: "restoreSession", riddleId: saved.riddleId, sessionToken: saved.sessionToken,
    currentLetters: saved.currentLetters, activeSlotIndex: saved.activeSlotIndex,
    hintRevealedIndices: saved.hintRevealedIndices, guesses: saved.guesses,
    engineSnapshot: saved.engineSnapshot, awaitingContinue: saved.awaitingContinue, letterStates: saved.letterStates,
  });
  expect(restored).toBe(current);
  expect(restored.currentLetters).toEqual(["", "", "", "", ""]);
});


it("restores purchased hint locks from the issued question without a provider checkpoint", () => {
  /** Issued riddle fixture supplies authoritative recovery state. */
  const loaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {
    ...riddle, revealedHints: [{index: 0, letter: "P"}],
  }});
  expect(loaded.currentLetters).toEqual(["P", "", "", "", ""]);
  expect(loaded.hintRevealedIndices).toEqual([0]);
  expect(loaded.activeSlotIndex).toBe(1);
  expect(gameSessionReducer(loaded, {type: "backspace"}).currentLetters[0]).toBe("P");
});

it("keeps issued paid hint letters when an older provider draft has no hint", () => {
  /** Issued riddle fixture supplies authoritative recovery state. */
  const loaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {
    ...riddle, revealedHints: [{index: 0, letter: "P"}],
  }});
  /** Older provider state cannot override newer authoritative progress. */
  const stale = createSavedGame(gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle}));
  if (!stale) throw new Error("Expected an active checkpoint.");
  /** Recovered presentation is checked against canonical session facts. */
  const restored = gameSessionReducer(loaded, {type: "restoreSession", ...stale,
    currentLetters: ["X", "I", "", "", ""], activeSlotIndex: 0});
  expect(restored.currentLetters).toEqual(["P", "I", "", "", ""]);
  expect(restored.hintRevealedIndices).toEqual([0]);
  expect(restored.activeSlotIndex).toBe(2);
});


it("restores accepted feedback without a provider save and rejects stale saved rows", () => {
  /** Positional scoring colors accompany the accepted submitted graphemes. */
  const feedback = [{letter: "p", status: "green" as const}, ...Array.from({length: 4}, () => ({letter: "z", status: "red" as const}))];
  /** Issued riddle fixture supplies authoritative recovery state. */
  const loaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {
    ...riddle, attemptsUsed: 1, revealedHints: [{index: 0, letter: "P"}],
    acceptedGuesses: [{attempt: 1, feedback}],
  }});
  expect(loaded.guesses).toEqual([{guess: ["p", "z", "z", "z", "z"], feedback: ["green", "red", "red", "red", "red"]}]);
  expect(loaded.letterStates).toMatchObject({p: "green", z: "red"});
  /** Older provider state cannot override newer authoritative progress. */
  const stale = createSavedGame(gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle}));
  if (!stale) throw new Error("Expected an older checkpoint.");
  /** Recovered presentation is checked against canonical session facts. */
  const restored = gameSessionReducer(loaded, {type: "restoreSession", ...stale});
  expect(restored.guesses).toEqual(loaded.guesses);
  expect(restored.engineSnapshot?.attemptsUsed).toBe(1);
  expect(restored.currentLetters[0]).toBe("P");
});

it("keeps the Continue round empty while recovering the five consumed attempts", () => {
  /** Issued riddle fixture supplies authoritative recovery state. */
  const loaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {
    ...riddle, attemptsUsed: 5, hasUsedContinue: true,
    acceptedGuesses: Array.from({length: 5}, (_, index) => ({attempt: index + 1,
      feedback: Array.from({length: 5}, () => ({letter: "z", status: "red" as const}))})),
  }});
  expect(loaded.guesses).toEqual([]);
  expect(loaded.engineSnapshot).toMatchObject({attemptsUsed: 5, hasUsedContinue: true});
});
