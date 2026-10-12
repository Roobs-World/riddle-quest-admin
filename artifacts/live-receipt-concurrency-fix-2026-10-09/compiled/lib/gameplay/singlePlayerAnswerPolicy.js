"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSinglePlayerCompletionKey = exports.getSinglePlayerContentKey = exports.isPlayableSinglePlayerAnswer = exports.MAX_PLAYABLE_SINGLE_PLAYER_ANSWER_LENGTH = void 0;
exports.assertPlayableSinglePlayerAnswer = assertPlayableSinglePlayerAnswer;
const https_1 = require("firebase-functions/v2/https");
const node_crypto_1 = require("node:crypto");
/** Maximum answer length supported by the current single-player keyboard. */
exports.MAX_PLAYABLE_SINGLE_PLAYER_ANSWER_LENGTH = 7;
/** Indicates whether an existing riddle can be completed with the shipped keyboard. */
const isPlayableSinglePlayerAnswer = (answer) => typeof answer === "string" && /^[a-z]{1,7}$/i.test(answer);
exports.isPlayableSinglePlayerAnswer = isPlayableSinglePlayerAnswer;
/** Rejects canonical content that the current player input cannot submit. */
function assertPlayableSinglePlayerAnswer(answer) {
    if (!(0, exports.isPlayableSinglePlayerAnswer)(answer)) {
        throw new https_1.HttpsError("failed-precondition", "This riddle is not compatible with the current game input.");
    }
}
/** Builds a rollover-safe identity for one canonical single-player riddle. */
const getSinglePlayerContentKey = (riddle, gameMode, locale, now = new Date()) => {
    /** Provides stable identity behavior. */
    const stableIdentity = gameMode === "challenge"
        ? (riddle.challengeKey ?? riddle.canonicalKey ?? `${riddle.riddleId}:${now.toISOString().slice(0, 10)}`)
        : (riddle.canonicalKey ?? riddle.riddleId);
    return (0, node_crypto_1.createHash)("sha256")
        .update(`${gameMode}\0${locale}\0${stableIdentity}\0${riddle.answer.normalize("NFC").toLocaleLowerCase(locale)}`)
        .digest("hex");
};
exports.getSinglePlayerContentKey = getSinglePlayerContentKey;
/** Builds the locale-independent entitlement key used to deduplicate rewards. */
const getSinglePlayerCompletionKey = (gameMode, entitlement) => `${gameMode}:${String(entitlement)}`;
exports.getSinglePlayerCompletionKey = getSinglePlayerCompletionKey;
//# sourceMappingURL=singlePlayerAnswerPolicy.js.map