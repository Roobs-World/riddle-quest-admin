import {
  computeLetterStates,
  lowerCaseGraphemes,
  splitGraphemes,
  type Feedback,
  type ScoredGuess,
} from "@qwordly/core/game";
import type {BridgeProfile} from "@qwordly/core/bridge";
import type {GameSessionAction, GameSessionState} from "./gameSessionTypes";
import {safeBrowserStorageGet} from "./playerPreferences";

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
  guessPending: false,
  engineSnapshot: null,
  modal: null,
  muted: safeBrowserStorageGet("local", "riddleQuest:soundEnabled") === "false",
  notice: null,
  lastRewards: null,
  auxiliaryFanfare: null,
  lastOutcome: null,
  completionAcknowledged: false,
  letterStates: {},
});

/** Normalizes input letter. */
const normalizeInputLetter = (letter: string): string | null => {
  /** Provides graphemes behavior. */
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
    /** Provides index behavior. */
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
export const gameSessionReducer = (state: GameSessionState, action: GameSessionAction): GameSessionState => {
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
      /** Provides snapshot behavior. */
      const snapshot = {
        guesses: [],
        attemptsUsed: action.riddle.attemptsUsed,
        hasUsedContinue: action.riddle.hasUsedContinue,
        gameOver: false,
      };
      return {
        ...state,
        riddle: action.riddle,
        gameMode: action.riddle.gameMode,
        profile: action.profile === undefined ? state.profile : action.profile,
        currentLetters: Array.from({length: action.riddle.answerLength}, () => ""),
        activeSlotIndex: 0,
        hintRevealedIndices: [],
        guesses: snapshot.guesses,
        guessPending: false,
        engineSnapshot: snapshot,
        modal: action.riddle.awaitingContinue ? "continue" : null,
        notice: null,
        lastOutcome: null,
        completionAcknowledged: false,
        lastRewards: null,
        auxiliaryFanfare: null,
        letterStates: {},
      };
    }
    case "typeLetter": {
      if (!state.riddle || state.modal || state.guessPending) {
        return state;
      }
      /** Provides letter behavior. */
      const letter = normalizeInputLetter(action.letter);
      if (!letter || state.hintRevealedIndices.includes(state.activeSlotIndex)) {
        return state;
      }
      /** Provides current letters behavior. */
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
      if (state.guessPending) return state;
      /** Provides target behavior. */
      const target =
        !state.hintRevealedIndices.includes(state.activeSlotIndex) && state.currentLetters[state.activeSlotIndex]
          ? state.activeSlotIndex
          : previousEditableSlot(state.currentLetters, state.hintRevealedIndices, state.activeSlotIndex - 1);
      if (target === null) {
        return state;
      }
      /** Provides current letters behavior. */
      const currentLetters = [...state.currentLetters];
      currentLetters[target] = "";
      return {...state, currentLetters, activeSlotIndex: target, notice: null};
    }
    case "selectSlot":
      if (
        state.guessPending ||
        !state.riddle ||
        action.index < 0 ||
        action.index >= state.riddle.answerLength ||
        state.hintRevealedIndices.includes(action.index)
      ) {
        return state;
      }
      return {...state, activeSlotIndex: action.index};
    case "guessRequested":
      if (!state.riddle || state.guessPending || state.currentLetters.some((letter) => !letter)) return state;
      return {...state, guessPending: true, notice: null};
    case "guessFailed":
      return {...state, guessPending: false};
    case "guessResolved": {
      if (!state.riddle) return state;
      if (action.attempts <= (state.engineSnapshot?.attemptsUsed ?? 0)) {
        return {...state, guessPending: false, notice: null};
      }
      /** Provides guesses behavior. */
      const guesses = [...state.guesses, action.feedback];
      /** Indicates whether is terminal. */
      const isTerminal = action.gameOver;
      /** Provides modal behavior. */
      const modal = action.isCorrect ? "victory" : action.canContinue ? "continue" : state.modal;
      /** Provides next letters behavior. */
      const nextLetters = resetAttemptLetters(state);
      /** Provides snapshot behavior. */
      const snapshot = {
        guesses,
        attemptsUsed: action.attempts,
        hasUsedContinue: state.engineSnapshot?.hasUsedContinue ?? false,
        gameOver: isTerminal,
      };

      return {
        ...state,
        currentLetters: nextLetters,
        activeSlotIndex: firstEditableSlot(nextLetters, state.hintRevealedIndices),
        guesses,
        guessPending: false,
        engineSnapshot: snapshot,
        modal,
        notice: null,
        lastOutcome: isTerminal
          ? {
              id: `${state.riddle.sessionToken}-${action.isCorrect ? "win" : "loss"}-${action.attempts}`,
              kind: action.isCorrect ? "win" : "loss",
              riddleId: state.riddle.riddleId,
              gameMode: state.riddle.gameMode,
              sessionToken: state.riddle.sessionToken,
              attempts: action.attempts,
              isCorrect: action.isCorrect,
            }
          : state.lastOutcome,
        completionAcknowledged: isTerminal ? false : state.completionAcknowledged,
        letterStates: computeStates(guesses),
      };
    }
    case "applyHint": {
      if (!state.riddle || action.index >= state.riddle.answerLength) {
        return state;
      }
      /** Provides next letters behavior. */
      const nextLetters = [...state.currentLetters];
      while (nextLetters.length <= action.index) {
        nextLetters.push("");
      }
      nextLetters[action.index] = action.letter.toUpperCase();
      /** Provides hint revealed indices behavior. */
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
    case "completionAcknowledged":
      return {...state, completionAcknowledged: true};
    case "showAuxiliaryFanfare":
      return {...state, auxiliaryFanfare: action.fanfare, modal: "reward"};
    case "restoreSession":
      if (!state.riddle || action.currentLetters.length !== state.riddle.answerLength) {
        return state;
      }
      {
        /** Provides guesses behavior. */
        const guesses = action.guesses.slice(0, state.riddle.attemptsUsed);
        /** Provides pending outcome behavior. */
        const pendingOutcome =
          action.pendingOutcome?.kind === "loss" &&
          !action.pendingOutcome.isCorrect &&
          action.pendingOutcome.attempts === state.riddle.attemptsUsed &&
          state.riddle.awaitingContinue &&
          !state.riddle.hasUsedContinue
            ? action.pendingOutcome
            : null;
        /** Provides awaiting continue behavior. */
        const awaitingContinue = state.riddle.awaitingContinue && !pendingOutcome;
        /** Provides current letters behavior. */
        const currentLetters = awaitingContinue
          ? Array.from({length: state.riddle.answerLength}, () => "")
          : action.currentLetters;
        return {
          ...state,
          currentLetters,
          activeSlotIndex: awaitingContinue ? 0 : action.activeSlotIndex,
          hintRevealedIndices: action.hintRevealedIndices,
          guesses,
          guessPending: false,
          engineSnapshot: {
            guesses,
            attemptsUsed: state.riddle.attemptsUsed,
            hasUsedContinue: state.riddle.hasUsedContinue,
            gameOver: Boolean(pendingOutcome),
          },
          modal: pendingOutcome ? null : awaitingContinue ? "continue" : state.modal,
          lastOutcome: pendingOutcome,
          completionAcknowledged: false,
          letterStates: computeStates(guesses),
        };
      }
    case "continueGranted": {
      if (!state.engineSnapshot) return state;
      /** Provides snapshot behavior. */
      const snapshot = {
        ...state.engineSnapshot,
        guesses: [],
        hasUsedContinue: true,
        gameOver: false,
      };
      /** Provides next letters behavior. */
      const nextLetters = resetAttemptLetters(state);
      return {
        ...state,
        guesses: snapshot.guesses,
        guessPending: false,
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
        engineSnapshot: {...state.engineSnapshot, gameOver: true},
        lastOutcome: {
          id: `${state.riddle.sessionToken}-loss-${state.engineSnapshot.attemptsUsed}`,
          kind: "loss",
          riddleId: state.riddle.riddleId,
          gameMode: state.riddle.gameMode,
          sessionToken: state.riddle.sessionToken,
          attempts: state.engineSnapshot.attemptsUsed,
          isCorrect: false,
        },
        completionAcknowledged: false,
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
