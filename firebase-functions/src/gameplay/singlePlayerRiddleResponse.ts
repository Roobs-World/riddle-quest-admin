import {splitGraphemes} from "../../../src/core/game/index.js";
import type {GetCurrentDailyChallengeResponse} from "../../../src/core/validation/requestSchemas.js";
import {projectPublicSinglePlayerSession} from "./singlePlayerPublicSession";
import type {SinglePlayerSessionState} from "./singlePlayerSessionTypes";

/** Minimal canonical content needed to create a preloaded single-player feedback response. */
type CanonicalPublicRiddle = {
  /** Canonical riddle identifier. */ riddleId: string;
  /** Player-facing clue. */ text: string;
  /** Canonical answer used for immediate feedback; never trusted back from the client. */ answer: string;
  /** Locale used for grapheme segmentation. */ locale?: string;
};

/** Builds an authoritative recovery response, optionally including presentation-only scoring data. */
export function buildSinglePlayerChallengeResponse(
  riddle: CanonicalPublicRiddle,
  date: string | undefined,
  sessionToken: string,
  state: SinglePlayerSessionState,
  includeEvaluation = false,
  includeHintRecovery = false,
  includeGuessRecovery = false,
): NonNullable<GetCurrentDailyChallengeResponse["challenge"]> {
  /** Use the issued snapshot; retain compatibility with older content-only projections. */
  const answer = state.answer ?? riddle.answer;
  /** The session locale is the locale used by authoritative submission. */
  const locale = state.locale ?? riddle.locale;
  /** Extracts the fixture or authority fields required by this transition. */
  const {revealedHints, acceptedGuesses, ...status} = projectPublicSinglePlayerSession(state);
  return {
    date,
    questions: [
      {
        riddleId: riddle.riddleId,
        text: riddle.text,
        ...(includeEvaluation ? {evaluation: {answer, locale: state.locale}} : {}),
        answerLength: splitGraphemes(answer, locale).length,
        sessionToken,
        questionNumber: 1,
        ...status,
        ...(includeHintRecovery ? {revealedHints} : {}),
        ...(includeGuessRecovery && acceptedGuesses ? {acceptedGuesses} : {}),
      },
    ],
    totalQuestions: 1,
  };
}
