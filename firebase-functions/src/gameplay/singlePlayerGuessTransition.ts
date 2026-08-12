import {createHash} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {computeFeedback, lowerCaseGraphemes, splitGraphemes} from "@qwordly/core/game";
import type {SubmitSinglePlayerGuessResponseData} from "../validation/requestSchemas";
import {MAX_ATTEMPTS_CHALLENGE, MAX_ATTEMPTS_CLASSIC} from "../shared/constants";
import type {GuessTransition, GuessTransitionInput, SinglePlayerSessionState} from "./singlePlayerSessionTypes";

/** Resolves the base attempt cap for a mode. */
export const baseAttemptLimit = (gameMode: "classic" | "challenge"): number =>
  gameMode === "challenge" ? MAX_ATTEMPTS_CHALLENGE : MAX_ATTEMPTS_CLASSIC;

/** Normalizes answer-bearing input exactly once on the trusted backend. */
export const normalizeAnswerText = (value: string, locale: string): string =>
  lowerCaseGraphemes(value.trim(), locale).join("");

/** Produces a fixed replay-receipt map key. */
const receiptHash = (value: string): string => createHash("sha256").update(value).digest("hex");

/** Applies one guess to canonical server-owned state. */
export function transitionSinglePlayerGuess({
  state,
  request,
  answer,
  locale,
}: GuessTransitionInput): GuessTransition {
  const normalizedAnswer = normalizeAnswerText(answer, locale);
  const normalizedGuess = normalizeAnswerText(request.guess, locale);
  const requestHash = receiptHash(request.requestId);
  const guessHash = receiptHash(normalizedGuess);
  const priorReceipt = state?.guessReceipts?.[requestHash];
  if (priorReceipt) {
    if (priorReceipt.guessHash !== guessHash) {
      throw new HttpsError("already-exists", "The guess request id was already used for different input.");
    }
    return {state: state!, result: priorReceipt.result, replayed: true};
  }
  const continueWasGrantedAfterLastGuess = state?.hasUsedContinue &&
    state.attempts === baseAttemptLimit(request.gameMode);
  if (state?.lastGuess === normalizedGuess && state.lastGuessResult && !continueWasGrantedAfterLastGuess) {
    return {state, result: state.lastGuessResult, replayed: true};
  }
  if (state?.terminal) throw new HttpsError("failed-precondition", "This riddle is already complete.");
  if (state?.awaitingContinue && !state.hasUsedContinue) {
    throw new HttpsError("failed-precondition", "Choose whether to continue before submitting another guess.");
  }

  const answerLength = splitGraphemes(normalizedAnswer, locale).length;
  const guessLetters = splitGraphemes(normalizedGuess, locale);
  if (guessLetters.length !== answerLength) {
    throw new HttpsError("invalid-argument", `The guess must contain exactly ${answerLength} characters.`);
  }
  const attempts = (state?.attempts ?? 0) + 1;
  const maxAttempts = baseAttemptLimit(request.gameMode) + (state?.hasUsedContinue ? 1 : 0);
  if (attempts > maxAttempts) throw new HttpsError("failed-precondition", "No attempts remain for this riddle.");

  const isCorrect = normalizedGuess === normalizedAnswer;
  const canContinue = !isCorrect && attempts === baseAttemptLimit(request.gameMode) && !state?.hasUsedContinue;
  const gameOver = isCorrect || (!canContinue && attempts >= maxAttempts);
  const feedbackStates = computeFeedback(normalizedGuess, normalizedAnswer);
  const result: SubmitSinglePlayerGuessResponseData = {
    feedback: guessLetters.map((letter, index) => ({letter, status: feedbackStates[index] ?? "red"})),
    attempts,
    isCorrect,
    gameOver,
    ...(canContinue ? {canContinue: true} : {}),
  };
  const nextState: SinglePlayerSessionState = {
    ...(state ?? ({} as SinglePlayerSessionState)),
    gameMode: request.gameMode,
    riddleId: request.riddleId,
    contentKey: state?.contentKey ?? "",
    completionKey: state?.completionKey ?? "",
    locale: state?.locale ?? locale,
    answer: state?.answer ?? answer,
    attempts,
    lastGuess: normalizedGuess,
    lastGuessResult: result,
    hasUsedContinue: state?.hasUsedContinue ?? false,
    awaitingContinue: canContinue,
    terminal: gameOver,
    isCorrect,
    guessReceipts: {...(state?.guessReceipts ?? {}), [requestHash]: {guessHash, result}},
  };
  return {state: nextState, result, replayed: false};
}
