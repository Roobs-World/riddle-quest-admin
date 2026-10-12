"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSinglePlayerChallengeResponse = buildSinglePlayerChallengeResponse;
const game_1 = require("@qwordly/core/game");
const singlePlayerPublicSession_1 = require("./singlePlayerPublicSession");
/** Builds an authoritative recovery response, optionally including presentation-only scoring data. */
function buildSinglePlayerChallengeResponse(riddle, date, sessionToken, state, includeEvaluation = false, includeHintRecovery = false, includeGuessRecovery = false) {
    /** Use the issued snapshot; retain compatibility with older content-only projections. */
    const answer = state.answer ?? riddle.answer;
    /** The session locale is the locale used by authoritative submission. */
    const locale = state.locale ?? riddle.locale;
    /** Extracts the fixture or authority fields required by this transition. */
    const { revealedHints, acceptedGuesses, ...status } = (0, singlePlayerPublicSession_1.projectPublicSinglePlayerSession)(state);
    return {
        date,
        questions: [
            {
                riddleId: riddle.riddleId,
                text: riddle.text,
                ...(includeEvaluation ? { evaluation: { answer, locale: state.locale } } : {}),
                answerLength: (0, game_1.splitGraphemes)(answer, locale).length,
                sessionToken,
                questionNumber: 1,
                ...status,
                ...(includeHintRecovery ? { revealedHints } : {}),
                ...(includeGuessRecovery && acceptedGuesses ? { acceptedGuesses } : {}),
            },
        ],
        totalQuestions: 1,
    };
}
//# sourceMappingURL=singlePlayerRiddleResponse.js.map