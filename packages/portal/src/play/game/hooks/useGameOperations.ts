import {useCallback, useEffect, useRef} from "react";
import type {Dispatch, MutableRefObject} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import type {SavedGame} from "../../../platform/types";
import {prepareAvatarImage} from "../../avatarImage";
import type {GameSessionAction, GameSessionState} from "../../gameSessionTypes";
import {createRequestId} from "../../requestIds";
import type {GameFeedbackKind} from "./useGameAudio";

/** Describes post to host. */
type PostToHost = (message: GameToHostMessage) => void;

/** Owns player-initiated host commands and their idempotent retry identifiers. */
export function useGameOperations({
  state,
  stateRef,
  restoredGame,
  dispatch,
  postToHost,
  playFeedback,
}: {
  /** Stores state. */
  state: GameSessionState;
  /** Stores state ref. */
  stateRef: MutableRefObject<GameSessionState>;
  /** Stores restored game. */
  restoredGame?: SavedGame | null;
  /** Stores dispatch. */
  dispatch: Dispatch<GameSessionAction>;
  /** Stores post to host. */
  postToHost: PostToHost;
  /** Stores play feedback. */
  playFeedback: (kind: GameFeedbackKind) => void;
}) {
  /** Provides guess retry ref behavior. */
  const guessRetryRef = useRef<{
    /** Stores riddle id. */
    riddleId: string; /** Stores guess. */
    /** Stores guess. */
    guess: string; /** Stores request id. */
    /** Stores request id. */
    requestId: string;
  } | null>(null);
  /** Provides hint retry ref behavior. */
  const hintRetryRef = useRef<{
    /** Stores session token. */
    sessionToken: string; /** Stores attempt. */
    /** Stores attempt. */
    attempt: string; /** Stores request id. */
    /** Stores request id. */
    requestId: string;
  } | null>(null);
  /** Provides continue retry ref behavior. */
  const continueRetryRef = useRef<{
    /** Stores session token. */
    sessionToken: string; /** Stores request id. */
    /** Stores request id. */
    requestId: string;
  } | null>(null);
  /** Provides skip retry ref behavior. */
  const skipRetryRef = useRef<{
    /** Stores session token. */
    sessionToken: string; /** Stores request id. */
    /** Stores request id. */
    requestId: string;
  } | null>(null);

  /** Requests riddle. */
  const requestRiddle = useCallback(() => {
    /** Provides current behavior. */
    const current = stateRef.current;
    postToHost({
      type: "game:loadRiddle",
      requestId: createRequestId("load"),
      payload: {
        gameMode: current.gameMode,
        locale: current.locale,
        classicIndex: current.profile?.classicIndex,
        sessionToken: current.riddle?.sessionToken ?? restoredGame?.sessionToken,
        riddleId: current.riddle?.riddleId ?? restoredGame?.riddleId,
      },
    });
  }, [postToHost, restoredGame?.riddleId, restoredGame?.sessionToken, stateRef]);

  /** Provides current attempt behavior. */
  const currentAttempt = state.riddle
    ? Array.from({length: state.riddle.answerLength}, (_, index) => state.currentLetters[index] ?? "")
    : [];
  /** Indicates whether can submit. */
  const canSubmit = !state.guessPending && currentAttempt.length > 0 && currentAttempt.every(Boolean);

  /** Submits guess. */
  const submitGuess = useCallback(() => {
    if (!canSubmit || !state.riddle) return;
    /** Provides guess behavior. */
    const guess = currentAttempt.join("");
    /** Provides retry behavior. */
    const retry = guessRetryRef.current;
    /** Requests id. */
    const requestId =
      retry?.riddleId === state.riddle.riddleId && retry.guess === guess ? retry.requestId : createRequestId("guess");
    guessRetryRef.current = {riddleId: state.riddle.riddleId, guess, requestId};
    playFeedback("submit");
    dispatch({type: "guessRequested"});
    postToHost({
      type: "game:submitGuess",
      requestId,
      payload: {
        riddleId: state.riddle.riddleId,
        gameMode: state.riddle.gameMode,
        sessionToken: state.riddle.sessionToken,
        guess,
        requestId,
      },
    });
  }, [canSubmit, currentAttempt, dispatch, playFeedback, postToHost, state.riddle]);

  useEffect(() => {
    guessRetryRef.current = null;
  }, [state.guesses.length]);

  /** Requests hint. */
  const requestHint = useCallback(() => {
    if (!state.riddle) return;
    /** Provides attempt behavior. */
    const attempt = currentAttempt.join("");
    /** Provides retry behavior. */
    const retry = hintRetryRef.current;
    /** Requests id. */
    const requestId =
      retry?.sessionToken === state.riddle.sessionToken && retry.attempt === attempt
        ? retry.requestId
        : createRequestId("hint");
    hintRetryRef.current = {sessionToken: state.riddle.sessionToken, attempt, requestId};
    postToHost({
      type: "game:requestHint",
      requestId,
      payload: {
        riddleId: state.riddle.riddleId,
        gameMode: state.riddle.gameMode,
        sessionToken: state.riddle.sessionToken,
        requestId,
        currentAttempt,
      },
    });
  }, [currentAttempt, postToHost, state.riddle]);

  useEffect(() => {
    hintRetryRef.current = null;
  }, [state.hintRevealedIndices.length]);

  /** Requests continue. */
  const requestContinue = useCallback(
    (amount?: number) => {
      if (!state.riddle) return;
      /** Provides retry behavior. */
      const retry = continueRetryRef.current;
      /** Requests id. */
      const requestId =
        retry?.sessionToken === state.riddle.sessionToken ? retry.requestId : createRequestId("continue");
      continueRetryRef.current = {sessionToken: state.riddle.sessionToken, requestId};
      postToHost({
        type: "game:spendCoins",
        requestId,
        payload: {
          reason: "continue",
          gameMode: state.riddle.gameMode,
          riddleId: state.riddle.riddleId,
          sessionToken: state.riddle.sessionToken,
          amount,
        },
      });
    },
    [postToHost, state.riddle],
  );

  /** Requests skip. */
  const requestSkip = useCallback(() => {
    if (!state.riddle || state.riddle.gameMode !== "classic") return;
    /** Provides retry behavior. */
    const retry = skipRetryRef.current;
    /** Requests id. */
    const requestId = retry?.sessionToken === state.riddle.sessionToken ? retry.requestId : createRequestId("skip");
    skipRetryRef.current = {sessionToken: state.riddle.sessionToken, requestId};
    postToHost({
      type: "game:skipRiddle",
      requestId,
      payload: {
        riddleId: state.riddle.riddleId,
        gameMode: state.riddle.gameMode,
        sessionToken: state.riddle.sessionToken,
      },
    });
  }, [postToHost, state.riddle]);

  /** Requests purchase. */
  const requestPurchase = useCallback(
    (productId: string) => {
      postToHost({
        type: "game:requestPurchase",
        requestId: createRequestId("purchase"),
        payload: {productId},
      });
    },
    [postToHost],
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

  return {
    canSubmit,
    submitGuess,
    requestRiddle,
    requestHint,
    requestContinue,
    requestSkip,
    requestPurchase,
    requestLeaderboard,
    updateUsername,
    updateAvatar,
    deleteAccount,
  };
}
