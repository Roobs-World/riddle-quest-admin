import {useCallback, useEffect, useRef, useSyncExternalStore, type Dispatch, type SetStateAction} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {RacePlay} from "../RacePlay";
import type {RaceOperation} from "../logic/raceOperations";
/** React delivery collaborators for the race owner. */
export type RaceOperationLifecycleOptions = {
  /** Host command adapter. */ postToHost: (message: GameToHostMessage) => void;
  /** User-visible recovery error. */ setError: Dispatch<SetStateAction<string | null>>;
};
/** Adapts one deep Race play module to React rendering without exposing protocol refs. */
export function useRaceOperationLifecycle(options: RaceOperationLifecycleOptions) {
  /** Provides options ref behavior. */
  const optionsRef = useRef(options);
  optionsRef.current = options;
  /** Provides play ref behavior. */
  const playRef = useRef<RacePlay | null>(null);
  if (!playRef.current)
    playRef.current = new RacePlay({postToHost: (message) => optionsRef.current.postToHost(message)});
  /** Provides play behavior. */
  const play = playRef.current;
  /** Provides state behavior. */
  const state = useSyncExternalStore(play.subscribe, play.getSnapshot, play.getSnapshot);
  /** Provides send behavior. */
  const send = useCallback(
    (operation: RaceOperation, type: GameToHostMessage["type"], payload: Record<string, unknown>) => {
      optionsRef.current.setError(null);
      play.send(operation, type, payload);
    },
    [play],
  );
  useEffect(() => () => play.dispose(), [play]);
  return {...state, play, send, finishOperation: play.finish, setRaceGuessAwaitingOutcome: play.setAwaitingOutcome};
}
