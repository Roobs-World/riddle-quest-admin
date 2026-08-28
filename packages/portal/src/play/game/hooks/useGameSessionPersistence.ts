import {useCallback, useEffect, useRef, type Dispatch} from "react";
import type {SavedGame} from "../../../platform/types";
import type {GameSessionAction, GameSessionState} from "../../gameSession";

/** Projects an active game session into the versioned low-integrity Jest player-data snapshot. */
export const createSavedGame = (state: GameSessionState, savedAt = Date.now()): SavedGame | null => {
  if (!state.riddle || !state.engineSnapshot || (state.lastOutcome && state.completionAcknowledged)) return null;
  return {
    schemaVersion: 1,
    savedAt,
    riddleId: state.riddle.riddleId,
    gameMode: state.gameMode,
    sessionToken: state.riddle.sessionToken,
    currentLetters: state.currentLetters,
    activeSlotIndex: state.activeSlotIndex,
    hintRevealedIndices: state.hintRevealedIndices,
    guesses: state.guesses,
    engineSnapshot: state.engineSnapshot,
    awaitingContinue:
      !state.engineSnapshot.gameOver &&
      !state.engineSnapshot.hasUsedContinue &&
      state.engineSnapshot.attemptsUsed === 5,
    letterStates: state.letterStates,
    ...(state.lastOutcome ? {pendingOutcome: state.lastOutcome} : {}),
  };
};

/** Restores and checkpoints resumable client progress without coupling persistence to game rendering. */
export const useGameSessionPersistence = ({
  state,
  stateRef,
  restoredGame,
  dispatch,
  onSaveGame,
}: {
  /** Stores state. */
  state: GameSessionState;
  /** Stores state ref. */
  stateRef: {
    /** Stores current. */
    current: GameSessionState;
  };
  /** Stores restored game. */
  restoredGame?: SavedGame | null;
  /** Stores dispatch. */
  dispatch: Dispatch<GameSessionAction>;
  /** Stores on save game. */
  onSaveGame?: (game: SavedGame | null) => void;
}) => {
  /** Provides last cleared outcome ref behavior. */
  const lastClearedOutcomeRef = useRef<string | null>(null);
  /** Provides last server checkpoint ref behavior. */
  const lastServerCheckpointRef = useRef<{
    /** Stores riddle id. */
    riddleId: string; /** Stores signature. */
    /** Stores signature. */
    signature: string;
  } | null>(null);
  /** Gets saved game. */
  const getSavedGame = useCallback(() => createSavedGame(stateRef.current), [stateRef]);

  useEffect(() => {
    if (
      !state.riddle ||
      restoredGame?.riddleId !== state.riddle.riddleId ||
      restoredGame.sessionToken !== state.riddle.sessionToken
    )
      return;
    dispatch({
      type: "restoreSession",
      currentLetters: restoredGame.currentLetters,
      activeSlotIndex: restoredGame.activeSlotIndex,
      hintRevealedIndices: restoredGame.hintRevealedIndices,
      guesses: restoredGame.guesses,
      engineSnapshot: restoredGame.engineSnapshot,
      awaitingContinue: restoredGame.awaitingContinue,
      letterStates: restoredGame.letterStates,
      pendingOutcome: restoredGame.pendingOutcome,
    });
  }, [dispatch, restoredGame, state.riddle?.riddleId, state.riddle?.sessionToken]);

  useEffect(() => {
    if (state.lastOutcome && state.completionAcknowledged) {
      if (lastClearedOutcomeRef.current !== state.lastOutcome.id) {
        lastClearedOutcomeRef.current = state.lastOutcome.id;
        onSaveGame?.(null);
      }
      return;
    }
    /** Saves d game. */
    const savedGame = getSavedGame();
    if (!savedGame) return;
    /** Provides signature behavior. */
    const signature = JSON.stringify({
      currentLetters: savedGame.currentLetters,
      activeSlotIndex: savedGame.activeSlotIndex,
      guesses: savedGame.guesses.length,
      hints: savedGame.hintRevealedIndices,
      attemptsUsed: savedGame.engineSnapshot.attemptsUsed,
      hasUsedContinue: savedGame.engineSnapshot.hasUsedContinue,
      awaitingContinue: savedGame.awaitingContinue,
      pendingOutcome: savedGame.pendingOutcome?.id,
    });
    if (lastServerCheckpointRef.current?.riddleId !== savedGame.riddleId) {
      lastServerCheckpointRef.current = {riddleId: savedGame.riddleId, signature};
      return;
    }
    if (lastServerCheckpointRef.current.signature === signature) return;
    lastServerCheckpointRef.current = {riddleId: savedGame.riddleId, signature};
    onSaveGame?.(savedGame);
  }, [
    getSavedGame,
    onSaveGame,
    state.activeSlotIndex,
    state.currentLetters,
    state.engineSnapshot,
    state.guesses,
    state.hintRevealedIndices,
    state.lastOutcome,
    state.completionAcknowledged,
    state.riddle?.riddleId,
  ]);

  useEffect(() => {
    /** Saves before backgrounding. */
    const saveBeforeBackgrounding = () => {
      if (document.visibilityState !== "hidden") return;
      /** Saves d game. */
      const savedGame = getSavedGame();
      if (savedGame) onSaveGame?.(savedGame);
    };
    document.addEventListener("visibilitychange", saveBeforeBackgrounding);
    return () => document.removeEventListener("visibilitychange", saveBeforeBackgrounding);
  }, [getSavedGame, onSaveGame]);
};
