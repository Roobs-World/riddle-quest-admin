import {describe, expect, it} from "@jest/globals";
import {GameSessionCheckpoints} from "../GameSessionCheckpoints";
import {createInitialGameSession, gameSessionReducer} from "../gameSession";

/** Authority-issued question without provider or answer data in its durable checkpoint. */
const riddle = {
  riddleId: "classic-checkpoint-1", sessionToken: "00000000-0000-4000-8000-000000000001",
  text: "Clue", answerLength: 5, gameMode: "classic" as const,
  attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false,
};

/** Reducer-driven active session used by callers of the checkpoint interface. */
const activeSession = () => gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle});

describe("GameSessionCheckpoints", () => {
  it("restores only a matching issued session, before saving, and ignores save echoes", () => {
    /** Session module owns ordered restore and save decisions. */
    const checkpoints = new GameSessionCheckpoints();
    /** Player draft assembled through reducer commands. */
    const typed = gameSessionReducer(activeSession(), {type: "typeLetter", letter: "P"});
    /** Durable checkpoint returned through the module interface. */
    const saved = new GameSessionCheckpoints().update(typed, undefined, true);
    if (saved?.kind !== "save" || !saved.game) throw new Error("Expected an active checkpoint.");

    /** Freshly issued question before checkpoint restoration. */
    const active = activeSession();
    expect(new GameSessionCheckpoints().update(active, {...saved.game, sessionToken: "different-session"})).toBeNull();
    /** First matching checkpoint must produce a restore decision. */
    const restore = checkpoints.update(active, saved.game);
    if (restore?.kind !== "restore") throw new Error("Expected restoration before a save.");
    /** Restored state remains editable despite echoed target saves. */
    let restored = gameSessionReducer(active, restore.action);
    expect(restored.currentLetters[0]).toBe("P");
    checkpoints.update(restored, saved.game);
    restored = gameSessionReducer(restored, {type: "typeLetter", letter: "I"});
    expect(checkpoints.update(restored, saved.game)).toMatchObject({kind: "save", game: {currentLetters: ["P", "I", "", "", ""]}});
    expect(checkpoints.update(restored, saved.game)).toBeNull();
  });

  it("never treats a delayed echo of its first save as startup restoration", () => {
    /** Session module consumes startup restoration when the authority question first arrives. */
    const checkpoints = new GameSessionCheckpoints();
    /** Player starts without a stored checkpoint. */
    let state = activeSession();
    checkpoints.update(state);
    state = gameSessionReducer(state, {type: "typeLetter", letter: "P"});
    /** First durable save can be echoed after more input arrives. */
    const saved = checkpoints.update(state);
    if (saved?.kind !== "save") throw new Error("Expected the first draft checkpoint.");
    state = gameSessionReducer(state, {type: "typeLetter", letter: "I"});
    expect(checkpoints.update(state, saved.game)).toMatchObject({kind: "save", game: {currentLetters: ["P", "I", "", "", ""]}});
  });

  it("checkpoints authoritative feedback corrections even when the row count is unchanged", () => {
    /** Session module owns ordered restore and save decisions. */
    const checkpoints = new GameSessionCheckpoints();
    /** Reducer-owned gameplay supplied through the checkpoint interface. */
    let state = gameSessionReducer(activeSession(), {type: "guessResolved",
      feedback: {guess: [..."world"], feedback: ["red", "red", "red", "red", "red"]},
      attempts: 1, isCorrect: false, gameOver: false, canContinue: false});
    checkpoints.update(state);
    state = {...state, guesses: [{guess: [..."world"], feedback: ["yellow", "red", "red", "red", "red"]}]};
    expect(checkpoints.update(state)).toMatchObject({kind: "save", game: {
      guesses: [{guess: [..."world"], feedback: ["yellow", "red", "red", "red", "red"]}],
    }});
  });

  it("keeps a provisional Continue out of durable progress until its authority acknowledgement", () => {
    /** Session module owns ordered restore and save decisions. */
    const checkpoints = new GameSessionCheckpoints();
    /** Reducer-owned gameplay supplied through the checkpoint interface. */
    let state = gameSessionReducer(createInitialGameSession(), {type: "hostInit", locale: "en", gameMode: "classic",
      user: null, products: [], profile: {username: "Guest", coins: 200, level: 1, xp: 0,
        winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1}});
    state = gameSessionReducer(state, {type: "loadRiddle", riddle: {...riddle, attemptsUsed: 5, awaitingContinue: true}});
    state = gameSessionReducer(state, {type: "previewCoinSpend", requestId: "continue-1", amount: 100, reason: "continue"});
    expect(state.engineSnapshot?.hasUsedContinue).toBe(true);
    expect(checkpoints.update(state, undefined, true)).toMatchObject({kind: "save", game: {
      awaitingContinue: true, engineSnapshot: {attemptsUsed: 5, hasUsedContinue: false},
    }});
    state = gameSessionReducer(state, {type: "confirmCoinSpend", requestId: "continue-1", newCoins: 100});
    expect(checkpoints.update(state)).toMatchObject({kind: "save", game: {
      awaitingContinue: false, engineSnapshot: {attemptsUsed: 5, hasUsedContinue: true},
    }});
  });

  it("excludes unconfirmed hints and preserves the input replaced by their preview", () => {
    /** Reducer-owned gameplay supplied through the checkpoint interface. */
    let state = gameSessionReducer(activeSession(), {type: "typeLetter", letter: "X"});
    state = gameSessionReducer(state, {type: "previewHint", index: 0, letter: "P"});
    expect(state.currentLetters[0]).toBe("P");
    /** Durable checkpoint returned through the module interface. */
    const saved = new GameSessionCheckpoints().update(state, undefined, true);
    expect(saved).toMatchObject({kind: "save", game: {currentLetters: ["X", "", "", "", ""], hintRevealedIndices: []}});
  });

  it("isolates adapter-owned snapshots from session state and clears acknowledged outcomes once", () => {
    /** Session module owns ordered restore and save decisions. */
    const checkpoints = new GameSessionCheckpoints();
    /** Reducer-owned gameplay supplied through the checkpoint interface. */
    let state = gameSessionReducer(activeSession(), {type: "guessResolved",
      feedback: {guess: [..."piano"], feedback: ["green", "green", "green", "green", "green"]},
      attempts: 1, isCorrect: true, gameOver: true, canContinue: false});
    /** Durable checkpoint returned through the module interface. */
    const saved = checkpoints.update(state, undefined, true);
    if (saved?.kind !== "save" || !saved.game) throw new Error("Expected a pending completion checkpoint.");
    saved.game.currentLetters[0] = "X";
    saved.game.guesses[0].guess[0] = "X";
    saved.game.engineSnapshot.guesses[0].feedback[0] = "red";
    if (saved.game.pendingOutcome) saved.game.pendingOutcome.attempts = 99;
    expect(state.guesses[0].guess[0]).toBe("p");
    expect(state.engineSnapshot?.guesses[0].feedback[0]).toBe("green");
    expect(state.lastOutcome?.attempts).toBe(1);

    state = gameSessionReducer(state, {type: "completionAcknowledged"});
    expect(checkpoints.update(state)).toEqual({kind: "save", game: null});
    expect(checkpoints.update(state, undefined, true)).toBeNull();
  });
});
