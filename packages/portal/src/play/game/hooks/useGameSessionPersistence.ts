import {useEffect, useLayoutEffect, useRef, type Dispatch} from "react";
import type {SavedGame} from "../../../platform/types";
import type {GameSessionAction, GameSessionState} from "../../gameSessionTypes";
import {GameSessionCheckpoints, createSavedGame} from "../../GameSessionCheckpoints";

export {createSavedGame} from "../../GameSessionCheckpoints";

/** React adapter for the session-owned checkpoint interface and browser lifecycle signals. */
export const useGameSessionPersistence = ({state, stateRef, restoredGame, dispatch, onSaveGame}: {
  /** Current immutable reducer snapshot. */ state: GameSessionState;
  /** Render-time account scope immediately revokes saving during identity replacement. */ stateRef: {
    /** Current state. */ current: GameSessionState;
  };
  /** Target-provided checkpoint to reconcile with the authority-issued riddle. */ restoredGame?: SavedGame | null;
  /** Applies a restore decision through the existing reducer. */ dispatch: Dispatch<GameSessionAction>;
  /** Sends client-owned progress to the target storage adapter. */ onSaveGame?: (game: SavedGame | null) => void;
}) => {
  /** One checkpoint owner survives render and callback changes. */
  const checkpointsRef = useRef<GameSessionCheckpoints | null>(null);
  if (!checkpointsRef.current) checkpointsRef.current = new GameSessionCheckpoints();
  /** Stable module identity owns every restore/save decision. */
  const checkpoints = checkpointsRef.current;
  /** Duplicate suppression cannot acknowledge a projection while its writer is unavailable. */
  const missedSaveRef = useRef<{
    /** Only the originating account can deliver its previously missed progress. */
    uid: string | undefined;
    /** A recreated identity cannot inherit an earlier account's pending save. */
    generation: number | undefined;
  } | null>(null);
  /** Background saves follow visible progress and its committed target adapter. */
  const committedRef = useRef({state, onSaveGame});
  useLayoutEffect(() => {committedRef.current = {state, onSaveGame};}, [state, onSaveGame]);
  /** Commit retirement prevents hidden-page events from reaching a removed game. */
  const backgroundOwnerRef = useRef<object | null>(null);
  useLayoutEffect(() => {
    /** Each committed listener scope retires independently during effect replay. */
    const owner = {};
    backgroundOwnerRef.current = owner;
    return () => {if (backgroundOwnerRef.current === owner) backgroundOwnerRef.current = null;};
  }, [checkpoints, stateRef]);

  useEffect(() => {
    /** Account replacement discards undelivered progress before a new writer can receive it. */
    const missed = missedSaveRef.current;
    if (missed && (missed.uid !== state.user?.uid || missed.generation !== state.user?.accountGeneration))
      missedSaveRef.current = null;
    /** Restoration precedes saving so an initial draft cannot overwrite restored progress. */
    const effect = checkpoints.update(state, restoredGame);
    if (effect?.kind === "restore") dispatch(effect.action);
    else if (effect?.kind === "save") {
      if (onSaveGame) {onSaveGame(effect.game); missedSaveRef.current = null;}
      else missedSaveRef.current = {uid: state.user?.uid, generation: state.user?.accountGeneration};
    } else if (onSaveGame && missedSaveRef.current) {
      // A new question or acknowledged outcome may have replaced the missed draft.
      // Project the current confirmed board rather than replaying an obsolete payload.
      onSaveGame(createSavedGame(state));
      missedSaveRef.current = null;
    }
  }, [checkpoints, state, restoredGame, dispatch, onSaveGame]);

  useEffect(() => {
    /** Passive registration preserves restoration-before-saving startup ordering. */
    const owner = backgroundOwnerRef.current;
    /** Browser lifecycle supplies only a signal; checkpoint policy stays in the module. */
    const saveBeforeBackgrounding = (event: Event) => {
      if (owner === null || backgroundOwnerRef.current !== owner ||
        event.type === "visibilitychange" && document.visibilityState !== "hidden") return;
      /** Background saves include committed changes before passive checkpoint effects run. */
      const committed = committedRef.current;
      // A pending account replacement must not save through the previous adapter.
      if (stateRef.current.user?.uid !== committed.state.user?.uid ||
        stateRef.current.user?.accountGeneration !== committed.state.user?.accountGeneration) return;
      /** Projects only the still-owned committed progress for the target adapter. */
      const effect = checkpoints.update(committed.state, undefined, true);
      if (effect?.kind === "save") {
        if (committed.onSaveGame) {committed.onSaveGame(effect.game); missedSaveRef.current = null;}
        else missedSaveRef.current = {
          uid: committed.state.user?.uid,
          generation: committed.state.user?.accountGeneration,
        };
      }
    };
    document.addEventListener("visibilitychange", saveBeforeBackgrounding);
    window.addEventListener("pagehide", saveBeforeBackgrounding);
    return () => {
      document.removeEventListener("visibilitychange", saveBeforeBackgrounding);
      window.removeEventListener("pagehide", saveBeforeBackgrounding);
    };
  }, [checkpoints, stateRef]);
};
