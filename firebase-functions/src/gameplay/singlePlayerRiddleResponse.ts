import {splitGraphemes} from "@qwordly/core/game";
import type {GetCurrentDailyChallengeResponse} from "../validation/requestSchemas";
import {projectPublicSinglePlayerSession} from "./singlePlayerPublicSession";
import type {SinglePlayerSessionState} from "./singlePlayerSessionTypes";

/** Minimal canonical content needed to create an answer-free load response. */
type CanonicalPublicRiddle = {
  /** Canonical riddle identifier. */ riddleId: string;
  /** Player-facing clue. */ text: string;
  /** Private answer used only to derive its public length. */ answer: string;
  /** Locale used for grapheme segmentation. */ locale?: string;
};

/** Builds one answer-free challenge-shaped response with authoritative recovery state. */
export function buildSinglePlayerChallengeResponse(
  riddle: CanonicalPublicRiddle,
  date: string | undefined,
  sessionToken: string,
  state: SinglePlayerSessionState,
): NonNullable<GetCurrentDailyChallengeResponse["challenge"]> {
  return {
    date,
    questions: [
      {
        riddleId: riddle.riddleId,
        text: riddle.text,
        answerLength: splitGraphemes(riddle.answer, riddle.locale ?? state.locale).length,
        sessionToken,
        questionNumber: 1,
        ...projectPublicSinglePlayerSession(state),
      },
    ],
    totalQuestions: 1,
  };
}
