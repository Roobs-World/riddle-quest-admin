import type {BridgeRiddle} from "@qwordly/core/bridge";
import type {CurrentRiddleResponse} from "../firebase";

/** Maps riddle response. */
export const mapRiddleResponse = (response: CurrentRiddleResponse, gameMode: "classic" | "challenge"): BridgeRiddle => {
  if (gameMode === "challenge" && response.hasCompletedToday === true) {
    throw Object.assign(new Error("Today's daily challenge is already complete."), {code: "daily-completed"});
  }
  /** Provides question behavior. */
  const question = response.challenge?.questions[0];
  if (!question || response.error) {
    throw new Error(response.error || "No riddle was returned.");
  }

  return {
    riddleId: question.riddleId,
    text: question.text,
    answerLength: question.answerLength,
    ...(question.evaluation ? {evaluation: question.evaluation} : {}),
    sessionToken: question.sessionToken,
    gameMode,
    index: question.questionNumber,
    attemptsUsed: question.attemptsUsed,
    hasUsedContinue: question.hasUsedContinue,
    awaitingContinue: question.awaitingContinue,
  };
};
