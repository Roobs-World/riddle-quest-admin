import {useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject} from "react";
import type {AttemptRecoveryCapability} from "../../../platform/types";
import type {GameSessionAction, GameSessionState} from "../../gameSessionTypes";

/** Applies only a target-authorised continuation to the still-current exhausted session. */
export function useAttemptRecovery({capability, stateRef, dispatch}: {
  capability?: AttemptRecoveryCapability;
  stateRef: MutableRefObject<GameSessionState>;
  dispatch: Dispatch<GameSessionAction>;
}) {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {mounted.current = false;};
  }, []);
  const request = useCallback(async () => {
    const before = stateRef.current;
    const riddle = before.riddle;
    if (!capability || busy.current || !riddle || before.modal !== "continue" || before.guessPending ||
      before.pendingCoinSpend || before.engineSnapshot?.hasUsedContinue) return;
    busy.current = true;
    setPending(true);
    dispatch({type: "setNotice", notice: null});
    try {
      const result = await capability.request({gameMode: riddle.gameMode, riddleId: riddle.riddleId, sessionToken: riddle.sessionToken});
      const current = stateRef.current;
      if (!mounted.current || current.user?.uid !== before.user?.uid ||
        current.riddle?.sessionToken !== riddle.sessionToken || current.modal !== "continue") return;
      if (result.status === "success") {
        if (current.profile) dispatch({type: "profileUpdated", profile: {...current.profile, coins: result.value.newCoins}});
        dispatch({type: "continueGranted"});
      } else if (result.status !== "cancelled") {
        dispatch({type: "setNotice", notice: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"});
      }
    } catch {
      if (mounted.current && stateRef.current.riddle?.sessionToken === riddle.sessionToken)
        dispatch({type: "setNotice", notice: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"});
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }, [capability, dispatch, stateRef]);
  return {pending, request, isPending: () => busy.current};
}
