import {useEffect, useLayoutEffect, useMemo, useRef} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import type {GameSessionState} from "../../gameSessionTypes";
import {createRequestId} from "../../requestIds";

/** Quietly prepares one issued successor while a hosted Classic victory remains visible. */
export function useClassicQuestionPreparation({enabled, state, postToHost}: {
  /** Only an authority-backed host opts in; standalone target saves keep their normal load path. */
  enabled: boolean;
  /** Current game state supplies the bound account, locale and completed question. */
  state: GameSessionState;
  /** Target-owned bridge sender; a replaced sender retires deferred preparation. */
  postToHost: (message: GameToHostMessage) => void;
}): void {
  /** A committed account visit owns preparation independently of ordinary parent renders. */
  const owner = useMemo(() => ({}), [enabled, state.user?.uid, state.user?.accountGeneration, state.locale, postToHost]);
  /** Layout retirement prevents an older passive callback from using a replacement sender. */
  const committedOwnerRef = useRef<object | null>(null);
  useLayoutEffect(() => {
    committedOwnerRef.current = owner;
    return () => {if (committedOwnerRef.current === owner) committedOwnerRef.current = null;};
  }, [owner]);
  /** Question and outcome checks use committed presentation, including suspended renders. */
  const committedStateRef = useRef(state);
  useLayoutEffect(() => {committedStateRef.current = state;}, [state]);
  /** StrictMode replay and repeated victory renders share the same single optional read. */
  const preparedRef = useRef<{
  /** Issuing account visit. */
    owner: object;
    /** Bound predecessor. */
    token: string} | null>(null);
  useEffect(() => {
    /** The committed winning question is the only allowed preparation origin. */
    const current = committedStateRef.current;
    /** Exact predecessor session prevents old outcome callbacks from preparing a different question. */
    const riddle = current.riddle;
    if (!enabled || committedOwnerRef.current !== owner || !current.user || !riddle ||
      riddle.sessionToken !== state.riddle?.sessionToken || riddle.gameMode !== "classic" ||
      current.lastOutcome?.kind !== "win" || current.lastOutcome.sessionToken !== riddle.sessionToken ||
      !Number.isSafeInteger(riddle.index) || !Number.isSafeInteger(riddle.index! + 1) || riddle.index! < 1 ||
      (preparedRef.current?.owner === owner && preparedRef.current.token === riddle.sessionToken)) return;
    preparedRef.current = {owner, token: riddle.sessionToken};
    try {
      postToHost({type: "game:loadRiddle", requestId: createRequestId("classic-prepare"),
        payload: {gameMode: "classic", locale: current.locale, classicIndex: riddle.index! + 1,
          sessionToken: riddle.sessionToken, riddleId: riddle.riddleId, prepareNext: true}});
    } catch {
      // This optional read never interrupts victory or the ordinary Next action.
    }
  }, [enabled, owner, postToHost, state.riddle?.sessionToken, state.lastOutcome?.kind]);
}
