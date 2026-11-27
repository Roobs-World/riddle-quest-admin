import {useCallback, useLayoutEffect, useMemo, useRef, useState, type Dispatch} from "react";
import type {AttemptRecoveryCapability} from "../../../platform/contracts/capabilities";
import type {GameSessionAction, GameSessionState} from "../../session/gameSessionTypes";

/** Stops a retired local wait while still observing its admitted provider operation. */
const awaitOwnedAttempt = <Result,>(operation: Promise<Result>, signal: AbortSignal): Promise<Result | undefined> =>
  new Promise((resolve, reject) => {
    /** Releases listener ownership when either the provider or retirement settles first. */
    const finish = () => signal.removeEventListener("abort", retire);
    /** Retirement relinquishes UI activity without undoing a provider or authority action. */
    const retire = () => {finish(); resolve(undefined);};
    signal.addEventListener("abort", retire, {once: true});
    operation.then(value => {finish(); resolve(value);}, error => {finish(); reject(error);});
    if (signal.aborted) retire();
  });

/** Applies only a target-authorised continuation to the still-current exhausted session. */
export function useAttemptRecovery({capability, state, dispatch}: {
  /** Optional target-owned continuation operation; absent capabilities expose no video action. */
  capability?: AttemptRecoveryCapability;
  /** Rendered gameplay snapshot becomes authoritative to this hook only after commit. */
  state: GameSessionState;
  /** Applies validated continuation and authoritative balance through the gameplay reducer. */
  dispatch: Dispatch<GameSessionAction>;
}) {
  /** Rendered pending state prevents conflicting continuation controls. */
  const [pending, setPending] = useState(false);
  const available = Boolean(capability && state.riddle && (capability.isAvailable?.({
    gameMode: state.riddle.gameMode, riddleId: state.riddle.riddleId, sessionToken: state.riddle.sessionToken,
  }) ?? true));
  /** Profile updates retain the same action; committed account, question and provider changes retire it. */
  const scope = useMemo(() => ({capability, dispatch, uid: state.user?.uid, generation: state.user?.accountGeneration,
    locale: state.locale, token: state.riddle?.sessionToken, riddleId: state.riddle?.riddleId,
    gameMode: state.riddle?.gameMode, modal: state.modal}),
  [capability, dispatch, state.user?.uid, state.user?.accountGeneration, state.locale,
    state.riddle?.sessionToken, state.riddle?.riddleId, state.riddle?.gameMode, state.modal]);
  /** Only committed progress can authorize a provider request or accept its result. */
  const committedState = useRef(state);
  useLayoutEffect(() => {committedState.current = state;}, [state]);
  /** A distinct action owner prevents old finally handlers from unlocking a replacement request. */
  const ownerRef = useRef<{
    /** Exact account, question, modal and provider lifetime admitted at commit. */
    scope: typeof scope;
    /** Local retirement also settles unresolved callers and releases their UI wait. */
    controller: AbortController;
    /** Synchronous admission token deduplicates clicks before React renders pending state. */
    request: object | null;
  } | null>(null);
  useLayoutEffect(() => {
    if (!scope.capability) {ownerRef.current = null; setPending(false); return;}
    /** This lifetime owns its own request and cannot revive an earlier StrictMode visit. */
    const owner = {scope, controller: new AbortController(), request: null as object | null};
    ownerRef.current = owner;
    setPending(false);
    return () => {
      owner.controller.abort();
      if (ownerRef.current === owner) ownerRef.current = null;
    };
  }, [scope]);

  /** Requests continuation only while its committed account and question still own the action. */
  const request = useCallback(async () => {
    /** Request admission follows the committed owner rather than a speculative render's refs. */
    const owner = ownerRef.current;
    if (!capability || !owner || owner.scope !== scope || owner.request) return;
    /** Original exhausted checkpoint supplies the session-bound continuation request. */
    const before = committedState.current;
    /** Current authority question supplies the immutable continuation identity. */
    const riddle = before.riddle;
    if (!riddle || before.modal !== "continue" || before.guessPending ||
      before.pendingCoinSpend || before.engineSnapshot?.hasUsedContinue) return;
    /** Only this invocation may release the current owner's pending state. */
    const action = {};
    owner.request = action;
    /** Replacement and unmount invalidate success, failure, and pending cleanup together. */
    const ownsAction = () => ownerRef.current === owner && owner.request === action && !owner.controller.signal.aborted;
    setPending(true);
    dispatch({type: "setNotice", notice: null});
    try {
      if (!ownsAction()) return;
      /** Authority response is observed even if retirement settles the local waiter first. */
      const result = await awaitOwnedAttempt(capability.request({gameMode: riddle.gameMode,
        riddleId: riddle.riddleId, sessionToken: riddle.sessionToken}), owner.controller.signal);
      if (!ownsAction() || !result) return;
      /** A concurrently confirmed paid continuation cannot be applied again. */
      const current = committedState.current;
      if (current.modal !== "continue" || current.guessPending || current.pendingCoinSpend || current.engineSnapshot?.hasUsedContinue) return;
      if (result.status === "success") {
        if (current.profile) dispatch({type: "profileUpdated", profile: {...current.profile, coins: result.value.newCoins}});
        dispatch({type: "continueGranted"});
      } else if (result.status !== "cancelled") {
        dispatch({type: "setNotice", notice: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"});
      }
    } catch {
      if (ownsAction()) dispatch({type: "setNotice", notice: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"});
    } finally {
      if (ownsAction()) {owner.request = null; setPending(false);}
    }
  }, [capability, dispatch, scope]);
  return {available, pending, request, isPending: () => Boolean(ownerRef.current?.request)};
}
