import type {ScoredGuess} from "@qwordly/core/game";
import type {SavedGame} from "../platform/types";
import type {GameSessionAction, GameSessionState} from "./gameSessionTypes";

/** Isolates adapter-owned checkpoint values from reducer-owned progress. */
const cloneGuesses = (guesses: ScoredGuess[]): ScoredGuess[] =>
  guesses.map(row => ({guess: [...row.guess], feedback: [...row.feedback]}));

/** Projects an active game session into the versioned client-owned player-data snapshot. */
export const createSavedGame = (state: GameSessionState, savedAt = Date.now()): SavedGame | null => {
  if (state.pendingGuessState) state = {...state, ...state.pendingGuessState, pendingGuessState: null};
  if (state.pendingCoinSpend?.continueState &&
    state.riddle?.sessionToken === state.pendingCoinSpend.sessionToken) {
    state = {...state, ...state.pendingCoinSpend.continueState};
  }
  if (state.pendingHintState) {
    /** Unconfirmed hint details restored before saving. */
    const {index, previousLetter, previousActiveSlotIndex} = state.pendingHintState;
    /** Current draft with any unconfirmed hint removed. */
    const currentLetters = [...state.currentLetters];
    currentLetters[index] = previousLetter;
    state = {...state, currentLetters, activeSlotIndex: previousActiveSlotIndex,
      hintRevealedIndices: state.hintRevealedIndices.filter((candidate) => candidate !== index),
      pendingHintState: null};
  }
  if (!state.riddle || !state.engineSnapshot || (state.lastOutcome && state.completionAcknowledged)) return null;
  return {
    schemaVersion: 1,
    savedAt,
    riddleId: state.riddle.riddleId,
    gameMode: state.gameMode,
    sessionToken: state.riddle.sessionToken,
    currentLetters: [...state.currentLetters],
    activeSlotIndex: state.activeSlotIndex,
    hintRevealedIndices: [...state.hintRevealedIndices],
    guesses: cloneGuesses(state.guesses),
    engineSnapshot: {...state.engineSnapshot, guesses: cloneGuesses(state.engineSnapshot.guesses)},
    awaitingContinue:
      !state.engineSnapshot.gameOver &&
      !state.engineSnapshot.hasUsedContinue &&
      state.engineSnapshot.attemptsUsed === 5,
    letterStates: {...state.letterStates},
    ...(state.lastOutcome ? {pendingOutcome: {...state.lastOutcome}} : {}),
  };
};

/** Decisions delivered by the React adapter after one complete checkpoint transition. */
export type GameSessionCheckpointEffect =
  | {
      /** Matching authority-issued riddle requires one restore. */ kind: "restore";
      /** Restoration is still validated by the game-session reducer. */ action: GameSessionAction;
    }
  | {
      /** Confirmed progress changed or an acknowledged outcome must be cleared. */ kind: "save";
      /** Client projection; null clears completed progress. */ game: SavedGame | null;
    };

/** Owns restoration, confirmed projections, duplicate suppression and background checkpoints. */
export class GameSessionCheckpoints {
  /** Initial observation consumes restoration even when no matching saved progress exists. */
  private observedRiddle: GameSessionState["riddle"] = null;
  /** Only one clear is emitted per acknowledged terminal outcome. */
  private clearedOutcome: string | null = null;
  /** Complete payload fingerprint includes session identity, feedback and terminal state. */
  private signature: string | null = null;
  /** Identity for the baseline supplied when authority loads a question. */
  private sessionToken: string | null = null;

  /** Returns one ordered restore/save decision; background saves bypass duplicate suppression. */
  update(state: GameSessionState, restoredGame?: SavedGame | null, background = false): GameSessionCheckpointEffect | null {
    if (state.riddle && this.observedRiddle !== state.riddle) {
      this.observedRiddle = state.riddle;
      if (!background && restoredGame?.riddleId === state.riddle.riddleId &&
        restoredGame.sessionToken === state.riddle.sessionToken) {
        return {kind: "restore", action: {
          type: "restoreSession", riddleId: restoredGame.riddleId, sessionToken: restoredGame.sessionToken,
          currentLetters: restoredGame.currentLetters,
          activeSlotIndex: restoredGame.activeSlotIndex, hintRevealedIndices: restoredGame.hintRevealedIndices,
          guesses: restoredGame.guesses, engineSnapshot: restoredGame.engineSnapshot,
          awaitingContinue: restoredGame.awaitingContinue, letterStates: restoredGame.letterStates,
          pendingOutcome: restoredGame.pendingOutcome,
        }};
      }
    }
    if (state.lastOutcome && state.completionAcknowledged) {
      if (this.clearedOutcome === state.lastOutcome.id) return null;
      this.clearedOutcome = state.lastOutcome.id;
      return {kind: "save", game: null};
    }
    /** Only confirmed gameplay reaches durable target storage. */
    const game = createSavedGame(state);
    if (!game) return null;
    /** Save time changes alone do not create a new checkpoint. */
    const signature = JSON.stringify({...game, savedAt: 0});
    /** A newly issued question is already held by authority; subsequent changes need checkpoints. */
    const baseline = this.sessionToken !== game.sessionToken;
    /** Whether the complete checkpoint payload changed. */
    const changed = this.signature !== signature;
    this.sessionToken = game.sessionToken;
    this.signature = signature;
    return background || (!baseline && changed) ? {kind: "save", game} : null;
  }
}
