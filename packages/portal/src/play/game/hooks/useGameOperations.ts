import {useCallback} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {prepareAvatarImage} from "../../avatarImage";
import {createRequestId} from "../../requestIds";
import {useProvisionalPlayRecovery} from "./useProvisionalPlayRecovery";
/** Routes optional host commands around the ordered Provisional Play recovery module. */
export function useGameOperations(options: Parameters<typeof useProvisionalPlayRecovery>[0]) {
  /** Provides {dispatch, post to host} behavior. */
  const {dispatch, postToHost} = options;
  /** Provides recovery behavior. */
  const recovery = useProvisionalPlayRecovery(options);
  /** Requests purchase. */
  const requestPurchase = useCallback(
    (productId: string) => {
      if (!recovery.canPurchase) return;
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
    (leaderboardType: "xp" | "totalWins" | "bestStreak") => {
      dispatch({type: "leaderboardRequested", leaderboardType});
      postToHost({
        type: "game:loadLeaderboard",
        requestId: createRequestId("leaderboard"),
        payload: {leaderboardType},
      });
    },
    [dispatch, postToHost],
  );
  /** Updates username. */
  const updateUsername = useCallback(
    (username: string) => {
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
      /** Provides image data url behavior. */
      const imageDataUrl = await prepareAvatarImage(file);
      postToHost({
        type: "game:updateAvatar",
        requestId: createRequestId("avatar"),
        payload: {imageDataUrl},
      });
    },
    [postToHost],
  );
  /** Deletes account. */
  const deleteAccount = useCallback(() => {
    postToHost({
      type: "game:deleteAccount",
      requestId: createRequestId("delete-account"),
      payload: {},
    });
  }, [postToHost]);

  return {...recovery, requestPurchase, requestLeaderboard, updateUsername, updateAvatar, deleteAccount};
}
