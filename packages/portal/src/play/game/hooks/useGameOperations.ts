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
  state: GameSessionState;
  stateRef: MutableRefObject<GameSessionState>;
  restoredGame?: SavedGame | null;
  dispatch: Dispatch<GameSessionAction>;
  postToHost: PostToHost;
  playFeedback: (kind: GameFeedbackKind) => void;
}) {
  const guessRetryRef = useRef<{riddleId: string; guess: string; requestId: string} | null>(null);
  const hintRetryRef = useRef<{sessionToken: string; attempt: string; requestId: string} | null>(null);
  const continueRetryRef = useRef<{sessionToken: string; requestId: string} | null>(null);
  const skipRetryRef = useRef<{sessionToken: string; requestId: string} | null>(null);

  const requestRiddle = useCallback(() => {
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

  const currentAttempt = state.riddle
    ? Array.from({length: state.riddle.answerLength}, (_, index) => state.currentLetters[index] ?? "")
    : [];
  const canSubmit = !state.guessPending && currentAttempt.length > 0 && currentAttempt.every(Boolean);

  const submitGuess = useCallback(() => {
    if (!canSubmit || !state.riddle) return;
    const guess = currentAttempt.join("");
    const retry = guessRetryRef.current;
    const requestId = retry?.riddleId === state.riddle.riddleId && retry.guess === guess
      ? retry.requestId
      : createRequestId("guess");
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

  const requestHint = useCallback(() => {
    if (!state.riddle) return;
    const attempt = currentAttempt.join("");
    const retry = hintRetryRef.current;
    const requestId = retry?.sessionToken === state.riddle.sessionToken && retry.attempt === attempt
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

  const requestContinue = useCallback((amount?: number) => {
    if (!state.riddle) return;
    const retry = continueRetryRef.current;
    const requestId = retry?.sessionToken === state.riddle.sessionToken
      ? retry.requestId
      : createRequestId("continue");
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
  }, [postToHost, state.riddle]);

  const requestSkip = useCallback(() => {
    if (!state.riddle || state.riddle.gameMode !== "classic") return;
    const retry = skipRetryRef.current;
    const requestId = retry?.sessionToken === state.riddle.sessionToken
      ? retry.requestId
      : createRequestId("skip");
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

  const requestPurchase = useCallback((productId: string) => {
    postToHost({
      type: "game:requestPurchase",
      requestId: createRequestId("purchase"),
      payload: {productId},
    });
  }, [postToHost]);

  const requestLeaderboard = useCallback((leaderboardType: "xp" | "totalWins" | "bestStreak") => {
    dispatch({type: "leaderboardRequested", leaderboardType});
    postToHost({
      type: "game:loadLeaderboard",
      requestId: createRequestId("leaderboard"),
      payload: {leaderboardType},
    });
  }, [dispatch, postToHost]);

  const updateUsername = useCallback((username: string) => {
    postToHost({
      type: "game:updateUsername",
      requestId: createRequestId("username"),
      payload: {username},
    });
  }, [postToHost]);

  const updateAvatar = useCallback(async (file: File) => {
    const imageDataUrl = await prepareAvatarImage(file);
    postToHost({
      type: "game:updateAvatar",
      requestId: createRequestId("avatar"),
      payload: {imageDataUrl},
    });
  }, [postToHost]);

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
