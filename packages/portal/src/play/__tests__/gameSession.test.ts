import {describe, expect, it} from "@jest/globals";
import {
  createInitialGameSession,
  gameSessionReducer,
  getCurrentGuessValue,
  type GameSessionAction,
  type GameSessionState,
} from "../gameSession";

/** Provides riddle behavior. */
const riddle = {
  riddleId: "classic-1",
  sessionToken: "00000000-0000-4000-8000-000000000001",
  text: "What has keys but cannot open doors?",
  answerLength: 5,
  gameMode: "classic" as const,
  index: 1,
  attemptsUsed: 0,
  hasUsedContinue: false,
  awaitingContinue: false,
};

/** Provides reduce behavior. */
const reduce = (state: GameSessionState, action: GameSessionAction) => gameSessionReducer(state, action);

/** Resolves guess. */
const resolveGuess = (
  state: GameSessionState,
  guess: string,
  attempts: number,
  {isCorrect = false, gameOver = false, canContinue = false} = {},
) =>
  reduce(reduce(state, {type: "guessRequested"}), {
    type: "guessResolved",
    feedback: {
      guess: [...guess.toUpperCase()],
      feedback: [...guess].map(() => (isCorrect ? ("green" as const) : ("red" as const))),
    },
    attempts,
    isCorrect,
    gameOver,
    canContinue,
  });

describe("game session reducer", () => {
  it.each(["hint", "skip"] as const)("opens %s while a wrong answer is awaiting confirmation", (modal) => {
    /** Locally evaluated wrong answer with its server response still pending. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: {
      ...riddle, evaluation: {answer: "piano", locale: "en"},
    }});
    for (const letter of "CRANE") state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    expect(state.guessPending).toBe(true);
    expect(reduce(state, {type: "openModal", modal}).modal).toBe(modal);
  });

  it.each(["PIANO", "CRANE"])("shows feedback for %s before the server responds", (guess) => {
    /** Riddle with canonical feedback data supplied at load time. */
    const loaded = {...riddle, evaluation: {answer: "piano", locale: "en"}};
    /** Game state driven through the submission flow. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: loaded});
    for (const letter of guess) state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    expect(state.guesses).toHaveLength(1);
    expect(state.guesses[0].feedback).toEqual(guess === "PIANO"
      ? ["green", "green", "green", "green", "green"]
      : ["red", "red", "green", "green", "red"]);
    expect(state.guessPending).toBe(true);
    expect(state.lastRewards).toBeNull();
    expect(state.completionAcknowledged).toBe(false);
  });

  it("reconciles a preview without duplicate rows and rolls back rejected guesses", () => {
    /** Riddle with canonical feedback data supplied at load time. */
    const loaded = {...riddle, evaluation: {answer: "piano", locale: "en"}};
    /** Confirmed state before submitting the guess. */
    let before = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: loaded});
    for (const letter of "PIANO") before = reduce(before, {type: "typeLetter", letter});
    /** Immediate presentation before server confirmation. */
    const preview = reduce(before, {type: "guessRequested"});
    expect(preview.modal).toBe("victory");
    expect(reduce(preview, {type: "guessRequested"})).toBe(preview);
    /** State after the server rejects the submission. */
    const failed = reduce(preview, {type: "guessFailed"});
    expect(failed).toEqual(before);
    /** State after server confirmation replaces the preview. */
    const confirmed = reduce(preview, {
      type: "guessResolved", attempts: 1, isCorrect: true, gameOver: true, canContinue: false,
      feedback: {guess: [..."piano"], feedback: ["green", "green", "green", "green", "green"]},
    });
    expect(confirmed.guesses).toHaveLength(1);
    expect(confirmed.guessPending).toBe(false);
    expect(confirmed.pendingGuessState).toBeNull();
    /** Server disagreement that must override local feedback. */
    const corrected = reduce(preview, {
      type: "guessResolved", attempts: 1, isCorrect: false, gameOver: false, canContinue: false,
      feedback: {guess: [..."piano"], feedback: ["red", "red", "red", "red", "red"]},
    });
    expect(corrected.modal).toBeNull();
    expect(corrected.lastOutcome).toBeNull();
    expect(corrected.letterStates.p).toBe("red");
    expect(corrected.lastRewards).toBeNull();
  });

  it("accepts another local attempt while confirmation is slow and retains accepted rows on rejection", () => {
    /** The state used by this regression scenario. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: {
      ...riddle, evaluation: {answer: "piano", locale: "en"},
    }});
    for (const letter of "CRANE") state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    for (const letter of "SLOPE") state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    expect(state.guesses).toHaveLength(2);
    expect(state.guessPending).toBe(true);

    state = reduce(state, {type: "guessCheckpointAdvanced", attempts: 1,
      feedback: state.guesses[0], isCorrect: false, gameOver: false, canContinue: false});
    state = reduce(state, {type: "guessFailed"});
    expect(state.guesses).toHaveLength(1);
    expect(state.engineSnapshot?.attemptsUsed).toBe(1);
    expect(state.guessPending).toBe(false);
  });

  it("does not preview a continue purchase until the fifth guess is confirmed", () => {
    /** Game state driven through the submission flow. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: {
      ...riddle, attemptsUsed: 4, evaluation: {answer: "piano", locale: "en"},
    }});
    for (const letter of "CRANE") state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    expect(state.guesses).toHaveLength(1);
    expect(state.modal).toBeNull();
    expect(state.lastOutcome).toBeNull();
  });

  it("keeps the next draft editable while a wrong guess is confirming", () => {
    /** Loaded solo riddle with feedback data. */
    const loaded = {...riddle, evaluation: {answer: "piano", locale: "en"}};
    /** Submission followed by the next draft before confirmation. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: loaded});
    for (const letter of "CRANE") state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    state = reduce(state, {type: "typeLetter", letter: "P"});
    expect(state.currentLetters[0]).toBe("P");
    state = reduce(state, {
      type: "guessResolved", attempts: 1, isCorrect: false, gameOver: false, canContinue: false,
      feedback: {guess: [..."crane"], feedback: ["red", "red", "green", "green", "red"]},
    });
    expect(state.currentLetters[0]).toBe("P");
    expect(state.guesses).toHaveLength(1);
    expect(state.guessPending).toBe(false);
  });

  it("ignores a stale saved snapshot while a guess is pending", () => {
    /** State immediately before the backend acknowledges the guess. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: {
      ...riddle, evaluation: {answer: "piano", locale: "en"},
    }});
    for (const letter of "PIANO") state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    expect(reduce(state, {
      type: "restoreSession", currentLetters: [..."PIANO"], activeSlotIndex: 0,
      hintRevealedIndices: [], guesses: [], letterStates: {}, awaitingContinue: false,
      engineSnapshot: {guesses: [], attemptsUsed: 0, hasUsedContinue: false, gameOver: false},
    })).toBe(state);
  });

  it("does not open the skip modal for a daily riddle", () => {
    /** Provides daily riddle behavior. */
    const dailyRiddle = {...riddle, riddleId: "daily-1", gameMode: "challenge" as const};
    /** Provides state behavior. */
    const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: dailyRiddle});

    expect(reduce(state, {type: "openModal", modal: "skip"})).toBe(state);
  });

  it("ignores incomplete submissions without showing an error", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
    state = reduce(state, {type: "typeLetter", letter: "P"});

    /** Provides before submit behavior. */
    const beforeSubmit = state;
    state = reduce(state, {type: "guessRequested"});

    expect(state).toBe(beforeSubmit);
    expect(state.notice).toBeNull();
    expect(state.guesses).toHaveLength(0);
  });

  it("loads a riddle and wins with a correct guess", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});

    for (const letter of ["P", "I", "A", "N", "O"]) {
      state = reduce(state, {type: "typeLetter", letter});
    }
    expect(getCurrentGuessValue(state)).toBe("piano");

    state = resolveGuess(state, "piano", 1, {isCorrect: true, gameOver: true});

    expect(state.modal).toBe("victory");
    expect(state.lastOutcome).toEqual(
      expect.objectContaining({
        kind: "win",
        riddleId: "classic-1",
        isCorrect: true,
      }),
    );
    expect(state.letterStates.p).toBe("green");
  });

  it("does not append duplicate rows for an authoritative semantic replay", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
    for (const letter of ["C", "R", "A", "N", "E"]) state = reduce(state, {type: "typeLetter", letter});
    state = resolveGuess(state, "crane", 1);
    expect(state.guesses).toHaveLength(1);

    for (const letter of ["C", "R", "A", "N", "E"]) state = reduce(state, {type: "typeLetter", letter});
    state = resolveGuess(state, "crane", 1);

    expect(state.guesses).toHaveLength(1);
    expect(state.engineSnapshot?.attemptsUsed).toBe(1);
    expect(state.guessPending).toBe(false);
  });

  it("can reveal a hinted letter and update coins", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {
      type: "hostInit",
      locale: "en",
      gameMode: "classic",
      user: null,
      profile: {
        username: "Guest",
        coins: 100,
        level: 1,
        xp: 0,
        winStreak: 0,
        gamesPlayed: 0,
        wins: 0,
        achievements: [],
        classicIndex: 1,
      },
      products: [],
    });
    state = reduce(state, {type: "loadRiddle", riddle});
    state = reduce(state, {type: "applyHint", index: 2, letter: "A", newCoins: 75});

    expect(state.currentLetters[2]).toBe("A");
    expect(state.profile?.coins).toBe(75);
  });

  it("grants a continue by resetting local attempts", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});

    for (let attempt = 0; attempt < 5; attempt += 1) {
      for (const letter of ["C", "L", "O", "C", "K"]) {
        state = reduce(state, {type: "typeLetter", letter});
      }
      state = resolveGuess(state, "clock", attempt + 1, {canContinue: attempt === 4});
    }

    expect(state.modal).toBe("continue");
    state = reduce(state, {type: "continueGranted"});

    expect(state.modal).toBeNull();
    expect(state.guesses).toHaveLength(0);

    for (const letter of ["C", "L", "O", "C", "K"]) {
      state = reduce(state, {type: "typeLetter", letter});
    }
    state = resolveGuess(state, "clock", 6, {gameOver: true});

    expect(state.modal).toBeNull();
    expect(state.lastOutcome).toEqual(expect.objectContaining({kind: "loss", attempts: 6}));
  });

  it("records a declined continue without opening an answer modal", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});

    for (let attempt = 0; attempt < 5; attempt += 1) {
      for (const letter of ["C", "L", "O", "C", "K"]) {
        state = reduce(state, {type: "typeLetter", letter});
      }
      state = resolveGuess(state, "clock", attempt + 1, {canContinue: attempt === 4});
    }

    state = reduce(state, {type: "declineContinue"});

    expect(state.modal).toBeNull();
    expect(state.lastOutcome).toEqual(expect.objectContaining({kind: "loss", attempts: 5}));
  });

  it("reopens Continue from authoritative load state when no client save survived", () => {
    /** Provides awaiting riddle behavior. */
    const awaitingRiddle = {
      ...riddle,
      attemptsUsed: 5,
      awaitingContinue: true,
    };
    /** Provides state behavior. */
    const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: awaitingRiddle});

    expect(state.modal).toBe("continue");
    expect(state.engineSnapshot).toMatchObject({attemptsUsed: 5, hasUsedContinue: false, gameOver: false});
  });

  it("keeps a restored declined outcome retryable without reopening Continue", () => {
    /** Provides awaiting riddle behavior. */
    const awaitingRiddle = {...riddle, attemptsUsed: 5, awaitingContinue: true};
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: awaitingRiddle});
    /** Provides pending outcome behavior. */
    const pendingOutcome = {
      id: `${riddle.sessionToken}-loss-5`,
      kind: "loss" as const,
      riddleId: riddle.riddleId,
      gameMode: riddle.gameMode,
      sessionToken: riddle.sessionToken,
      attempts: 5,
      isCorrect: false,
    };
    state = reduce(state, {
      type: "restoreSession",
      currentLetters: ["", "", "", "", ""],
      activeSlotIndex: 0,
      hintRevealedIndices: [],
      guesses: [],
      engineSnapshot: {guesses: [], attemptsUsed: 5, hasUsedContinue: false, gameOver: true},
      awaitingContinue: false,
      letterStates: {},
      pendingOutcome,
    });

    expect(state.modal).toBeNull();
    expect(state.lastOutcome).toEqual(pendingOutcome);
    expect(state.engineSnapshot?.gameOver).toBe(true);
  });

  it("locks hinted slots while allowing non-sequential editing", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
    state = reduce(state, {type: "applyHint", index: 2, letter: "A"});
    state = reduce(state, {type: "selectSlot", index: 4});
    state = reduce(state, {type: "typeLetter", letter: "O"});
    state = reduce(state, {type: "selectSlot", index: 0});
    state = reduce(state, {type: "typeLetter", letter: "P"});
    state = reduce(state, {type: "selectSlot", index: 2});
    state = reduce(state, {type: "typeLetter", letter: "X"});

    expect(state.currentLetters).toEqual(["P", "X", "A", "", "O"]);
    expect(state.hintRevealedIndices).toEqual([2]);
  });

  it("keeps cached leaderboard rows while a fresh request is loading", () => {
    /** Provides existing entry behavior. */
    const existingEntry = {
      userId: "player-1",
      username: "Previous result",
      level: 3,
      xp: 420,
      totalWins: 5,
      bestStreak: 2,
    };
    /** Provides state behavior. */
    let state: GameSessionState = {
      ...createInitialGameSession(),
      leaderboard: [existingEntry],
    };

    state = reduce(state, {type: "openModal", modal: "leaderboard"});

    expect(state.leaderboard).toEqual([existingEntry]);
    expect(state.leaderboardLoading).toBe(true);

    state = reduce(state, {type: "leaderboardLoaded", leaderboardType: "xp", entries: [existingEntry]});

    expect(state.leaderboard).toEqual([existingEntry]);
    expect(state.leaderboardLoading).toBe(false);
  });

  it("invalidates cached rankings when the account generation or ranking profile changes", () => {
    /** The user used by this regression scenario. */
    const user = {uid: "player-1", accountGeneration: 1, isAnonymous: false};
    /** The profile used by this regression scenario. */
    const profile = {username: "Player", coins: 5, level: 1, xp: 10, winStreak: 0,
      gamesPlayed: 1, wins: 1, achievements: [], classicIndex: 2};
    /** The ranked used by this regression scenario. */
    const ranked = {...createInitialGameSession(), user, profile,
      leaderboard: [{userId: user.uid, username: "Player", level: 1, xp: 10, totalWins: 1, bestStreak: 0}]};
    expect(reduce(ranked, {type: "authState", user, profile}).leaderboard).toHaveLength(1);
    expect(reduce(ranked, {type: "authState", user: {...user, accountGeneration: 2}, profile}).leaderboard)
      .toHaveLength(0);
    expect(reduce(ranked, {type: "authState", user, profile: {...profile, xp: 20}}).leaderboard)
      .toHaveLength(0);
  });
});
