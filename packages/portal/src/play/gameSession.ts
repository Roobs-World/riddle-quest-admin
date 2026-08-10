import {
  GameEngine,
  computeLetterStates,
  lowerCaseGraphemes,
  splitGraphemes,
  type Feedback,
  type ScoredGuess,
} from "@qwordly/core/game";
import type {BridgeProfile} from "@qwordly/core/bridge";
import type {GameSessionAction, GameSessionState} from "./gameSessionTypes";

export type {GameModal, GameSessionAction, GameSessionState} from "./gameSessionTypes";

/** Creates initial game session. */
export const createInitialGameSession = (): GameSessionState => ({
  initialized: false,
  paused: false,
  locale: "en",
  gameMode: "classic",
  user: null,
  profile: null,
  products: [],
  leaderboard: [],
  leaderboardType: "xp",
  leaderboardLoading: false,
  riddle: null,
  currentLetters: [],
  activeSlotIndex: 0,
  hintRevealedIndices: [],
  guesses: [],
  engineSnapshot: null,
  modal: null,
  muted:
    typeof localStorage !== "undefined"
      ? localStorage.getItem("riddleQuest:soundEnabled") === "false"
      : false,
  notice: null,
  lastRewards: null,
  auxiliaryFanfare: null,
  lastOutcome: null,
  letterStates: {},
});

/** Creates engine. */
const createEngine = (state: GameSessionState): GameEngine | null => {
  if (!state.riddle || !state.engineSnapshot) {
    return null;
  }

  const engine = new GameEngine(
    {
      answer: state.riddle.answer,
      initialAttempts: 5,
      continueAttempts: 1,
    },
    state.riddle.answer,
  );
  engine.restore(state.engineSnapshot);
  return engine;
};

/** Normalizes input letter. */
const normalizeInputLetter = (letter: string): string | null => {
  const graphemes = splitGraphemes(letter.trim());
  return graphemes[0]?.toUpperCase() ?? null;
};

/** Runs profile coins. */
const withProfileCoins = (profile: BridgeProfile | null, coins?: number): BridgeProfile | null => {
  if (coins === undefined || !profile) {
    return profile;
  }

  return {...profile, coins};
};

/** Computes states. */
const computeStates = (guesses: ScoredGuess[]): Record<string, Feedback> => {
  return computeLetterStates(guesses);
};

/** Provides first editable slot behavior. */
const firstEditableSlot = (letters: string[], locked: number[], start = 0): number => {
  for (let offset = 0; offset < letters.length; offset += 1) {
    const index = (start + offset) % letters.length;
    if (!locked.includes(index) && !letters[index]) {
      return index;
    }
  }
  return Math.max(0, Math.min(start, letters.length - 1));
};

/** Provides previous editable slot behavior. */
const previousEditableSlot = (letters: string[], locked: number[], start: number): number | null => {
  for (let index = Math.min(start, letters.length - 1); index >= 0; index -= 1) {
    if (!locked.includes(index) && letters[index]) {
      return index;
    }
  }
  for (let index = letters.length - 1; index > start; index -= 1) {
    if (!locked.includes(index) && letters[index]) {
      return index;
    }
  }
  return null;
};

/** Resets attempt letters. */
const resetAttemptLetters = (state: GameSessionState): string[] =>
  state.riddle
    ? Array.from({length: state.riddle.answerLength}, (_, index) =>
        state.hintRevealedIndices.includes(index) ? (state.currentLetters[index] ?? "") : "",
      )
    : [];

/** Provides game session reducer behavior. */
export const gameSessionReducer = (
  state: GameSessionState,
  action: GameSessionAction,
): GameSessionState => {
  switch (action.type) {
    case "hostInit":
      return {
        ...state,
        initialized: true,
        locale: action.locale,
        gameMode: action.gameMode,
        user: action.user,
        profile: action.profile,
        products: action.products,
      };
    case "authState":
      return {...state, user: action.user, profile: action.profile};
    case "loadRiddle": {
      const engine = new GameEngine({answer: action.riddle.answer, initialAttempts: 5, continueAttempts: 1});
      const snapshot = engine.getSnapshot();
      return {
        ...state,
        riddle: action.riddle,
        gameMode: action.riddle.gameMode,
        profile: action.profile === undefined ? state.profile : action.profile,
        currentLetters: Array.from({length: action.riddle.answerLength}, () => ""),
        activeSlotIndex: 0,
        hintRevealedIndices: [],
        guesses: snapshot.guesses,
        engineSnapshot: snapshot,
        modal: null,
        notice: null,
        lastOutcome: null,
        lastRewards: null,
        auxiliaryFanfare: null,
        letterStates: {},
      };
    }
    case "typeLetter": {
      if (!state.riddle || state.modal) {
        return state;
      }
      const letter = normalizeInputLetter(action.letter);
      if (!letter || state.hintRevealedIndices.includes(state.activeSlotIndex)) {
        return state;
      }
      const currentLetters = [...state.currentLetters];
      currentLetters[state.activeSlotIndex] = letter;
      return {
        ...state,
        currentLetters,
        activeSlotIndex: firstEditableSlot(
          currentLetters,
          state.hintRevealedIndices,
          (state.activeSlotIndex + 1) % currentLetters.length,
        ),
        notice: null,
      };
    }
    case "backspace": {
      const target =
        !state.hintRevealedIndices.includes(state.activeSlotIndex) && state.currentLetters[state.activeSlotIndex]
          ? state.activeSlotIndex
          : previousEditableSlot(state.currentLetters, state.hintRevealedIndices, state.activeSlotIndex - 1);
      if (target === null) {
        return state;
      }
      const currentLetters = [...state.currentLetters];
      currentLetters[target] = "";
      return {...state, currentLetters, activeSlotIndex: target, notice: null};
    }
    case "selectSlot":
      if (
        !state.riddle ||
        action.index < 0 ||
        action.index >= state.riddle.answerLength ||
        state.hintRevealedIndices.includes(action.index)
      ) {
        return state;
      }
      return {...state, activeSlotIndex: action.index};
    case "submitGuess": {
      if (!state.riddle) {
        return state;
      }
      if (state.currentLetters.some((letter) => !letter)) {
        return state;
      }

      const engine = createEngine(state);
      const outcome = engine?.submitGuess(state.currentLetters);
      if (!engine || !outcome) {
        return state;
      }

      const snapshot = engine.getSnapshot();
      const guesses = snapshot.guesses;
      const isTerminal = outcome.kind === "win" || outcome.kind === "loss";
      const modal =
        outcome.kind === "win"
          ? "victory"
          : outcome.kind === "attemptLimitReached"
            ? "continue"
            : outcome.kind === "loss"
              ? null
              : state.modal;
      const nextLetters = resetAttemptLetters(state);

      return {
        ...state,
        currentLetters: nextLetters,
        activeSlotIndex: firstEditableSlot(nextLetters, state.hintRevealedIndices),
        guesses,
        engineSnapshot: snapshot,
        modal,
        notice: null,
        lastOutcome: isTerminal
          ? {
              id: `${state.riddle.riddleId}-${outcome.kind}-${outcome.attempts}`,
              kind: outcome.kind,
              riddleId: state.riddle.riddleId,
              gameMode: state.riddle.gameMode,
              attempts: outcome.attempts,
              isCorrect: outcome.kind === "win",
            }
          : state.lastOutcome,
        letterStates: computeStates(guesses),
      };
    }
    case "applyHint": {
      if (!state.riddle || action.index >= state.riddle.answerLength) {
        return state;
      }
      const nextLetters = [...state.currentLetters];
      while (nextLetters.length <= action.index) {
        nextLetters.push("");
      }
      nextLetters[action.index] = action.letter.toUpperCase();
      const hintRevealedIndices = [...new Set([...state.hintRevealedIndices, action.index])].sort(
        (left, right) => left - right,
      );
      return {
        ...state,
        currentLetters: nextLetters.slice(0, state.riddle.answerLength),
        activeSlotIndex: firstEditableSlot(nextLetters, hintRevealedIndices, action.index + 1),
        hintRevealedIndices,
        profile: withProfileCoins(state.profile, action.newCoins),
        notice: null,
      };
    }
    case "coinsUpdated":
      return {...state, profile: withProfileCoins(state.profile, action.newCoins)};
    case "leaderboardRequested":
      return {
        ...state,
        leaderboardType: action.leaderboardType,
        leaderboard: [],
        leaderboardLoading: true,
      };
    case "leaderboardLoaded":
      return {
        ...state,
        leaderboardType: action.leaderboardType,
        leaderboard: action.entries,
        leaderboardLoading: false,
      };
    case "leaderboardLoadFailed":
      return {...state, leaderboard: [], leaderboardLoading: false};
    case "profileUpdated":
      return {...state, profile: action.profile};
    case "completionReward":
      return {...state, lastRewards: action.reward};
    case "showAuxiliaryFanfare":
      return {...state, auxiliaryFanfare: action.fanfare, modal: "reward"};
    case "restoreSession":
      if (!state.riddle || action.currentLetters.length !== state.riddle.answerLength) {
        return state;
      }
      return {
        ...state,
        currentLetters: action.currentLetters,
        activeSlotIndex: action.activeSlotIndex,
        hintRevealedIndices: action.hintRevealedIndices,
        guesses: action.guesses,
        engineSnapshot: action.engineSnapshot,
        letterStates: action.letterStates,
      };
    case "continueGranted": {
      const engine = createEngine(state);
      if (!engine) {
        return state;
      }
      engine.continueAfterLimit();
      const snapshot = engine.getSnapshot();
      const nextLetters = resetAttemptLetters(state);
      return {
        ...state,
        guesses: snapshot.guesses,
        engineSnapshot: snapshot,
        currentLetters: nextLetters,
        activeSlotIndex: firstEditableSlot(nextLetters, state.hintRevealedIndices),
        modal: null,
        notice: null,
        letterStates: {},
      };
    }
    case "declineContinue":
      if (state.modal !== "continue" || !state.riddle || !state.engineSnapshot) {
        return state;
      }
      return {
        ...state,
        modal: null,
        lastOutcome: {
          id: `${state.riddle.riddleId}-loss-${state.engineSnapshot.attemptsUsed}`,
          kind: "loss",
          riddleId: state.riddle.riddleId,
          gameMode: state.riddle.gameMode,
          attempts: state.engineSnapshot.attemptsUsed,
          isCorrect: false,
        },
      };
    case "openModal":
      if (action.modal === "skip" && state.gameMode === "challenge") {
        return state;
      }
      return action.modal === "leaderboard"
        ? {...state, modal: action.modal, leaderboard: [], leaderboardLoading: true}
        : {...state, modal: action.modal};
    case "closeModal":
      return {
        ...state,
        modal: null,
        auxiliaryFanfare: state.modal === "reward" ? null : state.auxiliaryFanfare,
      };
    case "setNotice":
      return {...state, notice: action.notice};
    case "toggleMute":
      return {...state, muted: !state.muted};
    case "pause":
      return {...state, paused: true};
    case "resume":
      return {...state, paused: false};
    default:
      action satisfies never;
      return state;
  }
};

/** Gets current guess value. */
export const getCurrentGuessValue = (state: GameSessionState): string => {
  return lowerCaseGraphemes(state.currentLetters.join("")).join("");
};
