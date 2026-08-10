import {useCallback, useEffect, useRef, type Dispatch} from "react";
import type {JestSavedGame} from "../../../jest/types";
import type {GameSessionAction, GameSessionState} from "../../gameSession";

/** Projects an active game session into the versioned low-integrity Jest player-data snapshot. */
export const createSavedGame = (state: GameSessionState, savedAt = Date.now()): JestSavedGame | null => {
  if (!state.riddle || !state.engineSnapshot || state.lastOutcome) return null;
  return {
    schemaVersion: 1,
    savedAt,
    riddleId: state.riddle.riddleId,
    gameMode: state.gameMode,
    currentLetters: state.currentLetters,
    activeSlotIndex: state.activeSlotIndex,
    hintRevealedIndices: state.hintRevealedIndices,
    guesses: state.guesses,
    engineSnapshot: state.engineSnapshot,
    letterStates: state.letterStates,
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
  state: GameSessionState;
  stateRef: {current: GameSessionState};
  restoredGame?: JestSavedGame | null;
  dispatch: Dispatch<GameSessionAction>;
  onSaveGame?: (game: JestSavedGame | null) => void;
}) => {
  const lastClearedOutcomeRef = useRef<string | null>(null);
  const lastServerCheckpointRef = useRef<{riddleId: string; signature: string} | null>(null);
  const getSavedGame = useCallback(() => createSavedGame(stateRef.current), [stateRef]);

  useEffect(() => {
    if (!state.riddle || restoredGame?.riddleId !== state.riddle.riddleId) return;
    dispatch({
      type: "restoreSession",
      currentLetters: restoredGame.currentLetters,
      activeSlotIndex: restoredGame.activeSlotIndex,
      hintRevealedIndices: restoredGame.hintRevealedIndices,
      guesses: restoredGame.guesses,
      engineSnapshot: restoredGame.engineSnapshot,
      letterStates: restoredGame.letterStates,
    });
  }, [dispatch, restoredGame, state.riddle?.riddleId]);

  useEffect(() => {
    if (state.lastOutcome) {
      if (lastClearedOutcomeRef.current !== state.lastOutcome.id) {
        lastClearedOutcomeRef.current = state.lastOutcome.id;
        onSaveGame?.(null);
      }
      return;
    }
    const savedGame = getSavedGame();
    if (!savedGame) return;
    const signature = JSON.stringify({
      currentLetters: savedGame.currentLetters,
      activeSlotIndex: savedGame.activeSlotIndex,
      guesses: savedGame.guesses.length,
      hints: savedGame.hintRevealedIndices,
      attemptsUsed: savedGame.engineSnapshot.attemptsUsed,
      hasUsedContinue: savedGame.engineSnapshot.hasUsedContinue,
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
    state.riddle?.riddleId,
  ]);

  useEffect(() => {
    const saveBeforeBackgrounding = () => {
      if (document.visibilityState !== "hidden") return;
      const savedGame = getSavedGame();
      if (savedGame) onSaveGame?.(savedGame);
    };
    document.addEventListener("visibilitychange", saveBeforeBackgrounding);
    return () => document.removeEventListener("visibilitychange", saveBeforeBackgrounding);
  }, [getSavedGame, onSaveGame]);
};
