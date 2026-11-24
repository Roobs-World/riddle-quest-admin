import {useCallback, useLayoutEffect, useMemo, useRef} from "react";
import {trackEvent} from "../../../observability/analytics/events";
import type {GameToHostMessage} from "../../../platform/bridge/messages";
import {prepareAvatarImage} from "../../../accounts/browser/avatarImage";
import {createRequestId} from "../../session/requestIds";
import {useProvisionalPlayRecovery} from "./useProvisionalPlayRecovery";
/** Routes optional host commands around the ordered Provisional Play recovery module. */
export function useGameOperations(options: Parameters<typeof useProvisionalPlayRecovery>[0]) {
  /** Shares current game identity and the target sender with operation ownership. */
  const {dispatch, postToHost, state, stateRef} = options;
  /** A committed account and sender own this view's asynchronous avatar work. */
  const avatarScope = useMemo(
    () => ({postToHost, stateRef, uid: state.user?.uid, generation: state.user?.accountGeneration}),
    [postToHost, stateRef, state.user?.uid, state.user?.accountGeneration],
  );
  /** Commit retirement also distinguishes StrictMode effect replay from a current request. */
  const avatarOwnerRef = useRef<{
    /** Immutable account and sender captured by this callback. */ scope: typeof avatarScope;
    /** Newer selections revoke an earlier unfinished preparation. */ request: number;
    /** Cooperative cancellation skips remaining decoder and encoder follow-up work. */ preparation: AbortController | null;
  } | null>(null);
  useLayoutEffect(() => {
    /** Every committed scope receives a fresh lifetime token. */
    const owner: NonNullable<typeof avatarOwnerRef.current> = {scope: avatarScope, request: 0, preparation: null};
    avatarOwnerRef.current = owner;
    return () => {
      owner.preparation?.abort();
      if (avatarOwnerRef.current === owner) avatarOwnerRef.current = null;
    };
  }, [avatarScope]);
  /** Provides recovery behavior. */
  const recovery = useProvisionalPlayRecovery(options);
  /** Requests purchase. */
  const requestPurchase = useCallback(
    (productId: string) => {
      if (!recovery.canPurchase) return;
      trackEvent("shop_item_selected", {product_id: productId});
      postToHost({
        type: "game:requestPurchase",
        requestId: createRequestId("purchase"),
        payload: {productId},
      });
    },
    [recovery.canPurchase, postToHost],
  );
  /** Requests leaderboard. */
  const requestLeaderboard = useCallback(
    (leaderboardType: "xp" | "totalWins" | "bestStreak" | "multiplayerWins") => {
      /** Correlates ranking success or failure with this exact selection and retry. */
      const requestId = createRequestId("leaderboard");
      dispatch({type: "leaderboardRequested", leaderboardType, requestId});
      trackEvent("leaderboard_requested", {leaderboard_type: leaderboardType});
      postToHost({
        type: "game:loadLeaderboard",
        requestId,
        payload: {leaderboardType},
      });
    },
    [dispatch, postToHost],
  );
  /** Updates username. */
  const updateUsername = useCallback(
    (username: string) => {
      trackEvent("profile_update_requested", {field: "username"});
      postToHost({
        type: "game:updateUsername",
        requestId: createRequestId("username"),
        payload: {username},
      });
    },
    [postToHost],
  );
  /** Updates avatar. */
  const updateAvatar = useCallback(
    async (file: File) => {
      /** Decoder and encoder callbacks cannot outlive their originating account visit. */
      const owner = avatarOwnerRef.current;
      if (!owner || owner.scope !== avatarScope) return;
      /** This native selection replaces any earlier unfinished avatar preparation. */
      const request = ++owner.request;
      /** Render-time identity changes revoke delivery before replacement commit. */
      const isCurrent = () => avatarOwnerRef.current === owner && owner.request === request &&
        stateRef.current.user?.uid === avatarScope.uid &&
        stateRef.current.user?.accountGeneration === avatarScope.generation;
      if (!isCurrent()) return;
      owner.preparation?.abort();
      /** One cancellation signal belongs to this selection's remaining image stages. */
      const preparation = new AbortController();
      owner.preparation = preparation;
      /** Encoding and validation failures remain visible only to their current selection. */
      let imageDataUrl: string;
      try {
        imageDataUrl = await prepareAvatarImage(file, preparation.signal);
      } catch (error) {
        if (!isCurrent()) return;
        throw error;
      } finally {
        if (owner.preparation === preparation) owner.preparation = null;
      }
      if (!isCurrent()) return;
      trackEvent("profile_update_requested", {field: "avatar"});
      postToHost({
        type: "game:updateAvatar",
        requestId: createRequestId("avatar"),
        payload: {imageDataUrl},
      });
    },
    [avatarScope, postToHost, stateRef],
  );
  /** Deletes account. */
  const deleteAccount = useCallback(() => {
    trackEvent("account_deletion_requested");
    postToHost({
      type: "game:deleteAccount",
      requestId: createRequestId("delete-account"),
      payload: {},
    });
  }, [postToHost]);

  return {...recovery, requestPurchase, requestLeaderboard, updateUsername, updateAvatar, deleteAccount};
}
