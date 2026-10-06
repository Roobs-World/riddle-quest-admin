import {useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject} from "react";
import type {AttemptRecoveryCapability} from "../../../platform/types";
import type {GameSessionAction, GameSessionState} from "../../gameSessionTypes";

/** Applies only a target-authorised continuation to the still-current exhausted session. */
export function useAttemptRecovery({capability, stateRef, dispatch}: {
  /** Optional target-owned continuation operation; absent capabilities expose no video action. */
  capability?: AttemptRecoveryCapability;
  /** Latest gameplay state validates that asynchronous completion still owns its question. */
  stateRef: MutableRefObject<GameSessionState>;
  /** Applies validated continuation and authoritative balance through the gameplay reducer. */
  dispatch: Dispatch<GameSessionAction>;
}) {
  /** Rendered pending state prevents conflicting continuation controls. */
  const [pending, setPending] = useState(false);
  /** Synchronous action guard prevents duplicate continuation requests before React commits. */
  const busy = useRef(false);
  /** Mounted lifetime rejects asynchronous completion after cleanup. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {mounted.current = false;};
  }, []);
  /** Requests continuation only while its account and question still own the action. */
  const request = useCallback(async () => {
    /** Original account, question and session checkpoint captured before awaiting continuation. */
    const before = stateRef.current;
    /** Current authority question supplies the session-bound continuation request. */
    const riddle = before.riddle;
    if (!capability || busy.current || !riddle || before.modal !== "continue" || before.guessPending ||
      before.pendingCoinSpend || before.engineSnapshot?.hasUsedContinue) return;
    busy.current = true;
    setPending(true);
    dispatch({type: "setNotice", notice: null});
    try {
      /** Authority response is validated before applying its balance and continuation. */
      const result = await capability.request({gameMode: riddle.gameMode, riddleId: riddle.riddleId, sessionToken: riddle.sessionToken});
      /** Latest gameplay checkpoint must still match the originating continuation session. */
      const current = stateRef.current;
      if (!mounted.current || current.user?.uid !== before.user?.uid ||
        current.riddle?.sessionToken !== riddle.sessionToken || current.riddle.riddleId !== riddle.riddleId ||
        current.riddle.gameMode !== riddle.gameMode || current.modal !== "continue") return;
      if (result.status === "success") {
        if (current.profile) dispatch({type: "profileUpdated", profile: {...current.profile, coins: result.value.newCoins}});
        dispatch({type: "continueGranted"});
      } else if (result.status !== "cancelled") {
        dispatch({type: "setNotice", notice: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"});
      }
    } catch {
      if (mounted.current && stateRef.current.user?.uid === before.user?.uid && stateRef.current.riddle?.sessionToken === riddle.sessionToken)
        dispatch({type: "setNotice", notice: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"});
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }, [capability, dispatch, stateRef]);
  return {pending, request, isPending: () => busy.current};
}
