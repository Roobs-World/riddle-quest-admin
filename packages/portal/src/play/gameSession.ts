import {
  GameEngine,
  computeLetterStates,
  lowerCaseGraphemes,
  splitGraphemes,
  type Feedback,
  type GameEngineSnapshot,
  type ScoredGuess,
} from "@qwordly/core/game";
import type {BridgeProfile, BridgeRiddle, BridgeUser} from "@qwordly/core/bridge";
import type {ProductSummary} from "./types";

export type GameModal = "victory" | "loss" | "continue" | "shop" | "profile" | "settings" | "leaderboard" | "achievements" | null;

export type GameSessionState = {
  initialized: boolean;
  paused: boolean;
  locale: string;
  gameMode: "classic" | "challenge";
  user: BridgeUser | null;
  profile: BridgeProfile | null;
  products: ProductSummary[];
  riddle: BridgeRiddle | null;
  currentLetters: string[];
  guesses: ScoredGuess[];
  engineSnapshot: GameEngineSnapshot | null;
  modal: GameModal;
  muted: boolean;
  notice: string | null;
  lastOutcome: {
    id: string;
    kind: "win" | "loss";
    riddleId: string;
    gameMode: "classic" | "challenge";
    attempts: number;
    isCorrect: boolean;
  } | null;
  letterStates: Record<string, Feedback>;
};

export type GameSessionAction =
  | {
      type: "hostInit";
      locale: string;
      gameMode: "classic" | "challenge";
      user: BridgeUser | null;
      profile: BridgeProfile | null;
      products: ProductSummary[];
    }
  | {type: "authState"; user: BridgeUser | null; profile: BridgeProfile | null}
  | {type: "loadRiddle"; riddle: BridgeRiddle; profile?: BridgeProfile | null}
  | {type: "typeLetter"; letter: string}
  | {type: "backspace"}
  | {type: "submitGuess"}
  | {type: "applyHint"; index: number; letter: string; newCoins?: number}
  | {type: "coinsUpdated"; newCoins: number}
  | {type: "continueGranted"}
  | {type: "openModal"; modal: Exclude<GameModal, null>}
  | {type: "closeModal"}
  | {type: "setNotice"; notice: string | null}
  | {type: "toggleMute"}
  | {type: "pause"}
  | {type: "resume"};

export const createInitialGameSession = (): GameSessionState => ({
  initialized: false,
  paused: false,
  locale: "en",
  gameMode: "classic",
  user: null,
  profile: null,
  products: [],
  riddle: null,
  currentLetters: [],
  guesses: [],
  engineSnapshot: null,
  modal: null,
  muted: false,
  notice: null,
  lastOutcome: null,
  letterStates: {},
});

const createEngine = (state: GameSessionState): GameEngine | null => {
  if (!state.riddle || !state.engineSnapshot) {
    return null;
  }

  const engine = new GameEngine(
    {
      answer: state.riddle.answer,
      initialAttempts: 5,
      continueAttempts: 2,
    },
    state.riddle.answer,
  );
  engine.restore(state.engineSnapshot);
  return engine;
};

const normalizeInputLetter = (letter: string): string | null => {
  const graphemes = splitGraphemes(letter.trim());
  return graphemes[0]?.toUpperCase() ?? null;
};

const withProfileCoins = (profile: BridgeProfile | null, coins?: number): BridgeProfile | null => {
  if (coins === undefined || !profile) {
    return profile;
  }

  return {...profile, coins};
};

const computeStates = (guesses: ScoredGuess[]): Record<string, Feedback> => {
  return computeLetterStates(guesses);
};

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
      const engine = new GameEngine({answer: action.riddle.answer, initialAttempts: 5, continueAttempts: 2});
      const snapshot = engine.getSnapshot();
      return {
        ...state,
        riddle: action.riddle,
        gameMode: action.riddle.gameMode,
        profile: action.profile === undefined ? state.profile : action.profile,
        currentLetters: [],
        guesses: snapshot.guesses,
        engineSnapshot: snapshot,
        modal: null,
        notice: null,
        lastOutcome: null,
        letterStates: {},
      };
    }
    case "typeLetter": {
      if (!state.riddle || state.currentLetters.length >= state.riddle.answerLength || state.modal) {
        return state;
      }
      const letter = normalizeInputLetter(action.letter);
      return letter ? {...state, currentLetters: [...state.currentLetters, letter], notice: null} : state;
    }
    case "backspace":
      return {...state, currentLetters: state.currentLetters.slice(0, -1), notice: null};
    case "submitGuess": {
      if (!state.riddle) {
        return state;
      }
      if (state.currentLetters.length !== state.riddle.answerLength) {
        return {...state, notice: "WebPortal.FILL_WORD_NOTICE"};
      }

      const engine = createEngine(state);
      const outcome = engine?.submitGuess(state.currentLetters);
      if (!engine || !outcome) {
        return state;
      }

      const snapshot = engine.getSnapshot();
      const guesses = snapshot.guesses;
      const isTerminal = outcome.kind === "win" || outcome.kind === "loss";
      const modal = outcome.kind === "win" ? "victory" : outcome.kind === "attemptLimitReached" ? "continue" : outcome.kind === "loss" ? "loss" : state.modal;

      return {
        ...state,
        currentLetters: [],
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
      return {
        ...state,
        currentLetters: nextLetters.slice(0, state.riddle.answerLength),
        profile: withProfileCoins(state.profile, action.newCoins),
        notice: null,
      };
    }
    case "coinsUpdated":
      return {...state, profile: withProfileCoins(state.profile, action.newCoins)};
    case "continueGranted": {
      const engine = createEngine(state);
      if (!engine) {
        return state;
      }
      engine.continueAfterLimit();
      const snapshot = engine.getSnapshot();
      return {
        ...state,
        guesses: snapshot.guesses,
        engineSnapshot: snapshot,
        currentLetters: [],
        modal: null,
        notice: null,
        letterStates: {},
      };
    }
    case "openModal":
      return {...state, modal: action.modal};
    case "closeModal":
      return {...state, modal: null};
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

export const getCurrentGuessValue = (state: GameSessionState): string => {
  return lowerCaseGraphemes(state.currentLetters.join("")).join("");
};
