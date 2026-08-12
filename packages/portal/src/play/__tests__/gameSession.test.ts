import {describe, expect, it} from "@jest/globals";
import {
  createInitialGameSession,
  gameSessionReducer,
  getCurrentGuessValue,
  type GameSessionAction,
  type GameSessionState,
} from "../gameSession";

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

const reduce = (state: GameSessionState, action: GameSessionAction) => gameSessionReducer(state, action);

const resolveGuess = (
  state: GameSessionState,
  guess: string,
  attempts: number,
  {isCorrect = false, gameOver = false, canContinue = false} = {},
) => reduce(reduce(state, {type: "guessRequested"}), {
  type: "guessResolved",
  feedback: {
    guess: [...guess.toUpperCase()],
    feedback: [...guess].map(() => isCorrect ? "green" as const : "red" as const),
  },
  attempts,
  isCorrect,
  gameOver,
  canContinue,
});

describe("game session reducer", () => {
  it("does not open the skip modal for a daily riddle", () => {
    const dailyRiddle = {...riddle, riddleId: "daily-1", gameMode: "challenge" as const};
    const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: dailyRiddle});

    expect(reduce(state, {type: "openModal", modal: "skip"})).toBe(state);
  });

  it("ignores incomplete submissions without showing an error", () => {
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
    state = reduce(state, {type: "typeLetter", letter: "P"});

    const beforeSubmit = state;
    state = reduce(state, {type: "guessRequested"});

    expect(state).toBe(beforeSubmit);
    expect(state.notice).toBeNull();
    expect(state.guesses).toHaveLength(0);
  });

  it("loads a riddle and wins with a correct guess", () => {
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
    const awaitingRiddle = {
      ...riddle,
      attemptsUsed: 5,
      awaitingContinue: true,
    };
    const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: awaitingRiddle});

    expect(state.modal).toBe("continue");
    expect(state.engineSnapshot).toMatchObject({attemptsUsed: 5, hasUsedContinue: false, gameOver: false});
  });

  it("keeps a restored declined outcome retryable without reopening Continue", () => {
    const awaitingRiddle = {...riddle, attemptsUsed: 5, awaitingContinue: true};
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: awaitingRiddle});
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

  it("clears leaderboard rows while a fresh leaderboard request is loading", () => {
    const existingEntry = {
      userId: "player-1",
      username: "Previous result",
      level: 3,
      xp: 420,
      totalWins: 5,
      bestStreak: 2,
    };
    let state: GameSessionState = {
      ...createInitialGameSession(),
      leaderboard: [existingEntry],
    };

    state = reduce(state, {type: "openModal", modal: "leaderboard"});

    expect(state.leaderboard).toEqual([]);
    expect(state.leaderboardLoading).toBe(true);

    state = reduce(state, {type: "leaderboardLoaded", leaderboardType: "xp", entries: [existingEntry]});

    expect(state.leaderboard).toEqual([existingEntry]);
    expect(state.leaderboardLoading).toBe(false);
  });
});
