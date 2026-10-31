"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertRaceDeckCompatible = assertRaceDeckCompatible;
exports.assertLiveRaceDeckCompatible = assertLiveRaceDeckCompatible;
exports.isLiveRaceDeckCompatible = isLiveRaceDeckCompatible;
const game_1 = require("@qwordly/core/game");
const race_1 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
/** Checks original frozen question identities, clues and answers before new gameplay or publication. */
function assertRaceDeckCompatible(riddles, locale) {
    if (!Array.isArray(riddles) || !riddles.length || riddles.length > race_1.RACE_DECK_SIZE || !race_1.RaceLocaleSchema.safeParse(locale).success)
        throw new https_1.HttpsError("data-loss", "The frozen race questions are not compatible with gameplay.");
    for (const riddle of riddles) {
        if (!riddle || typeof riddle !== "object" || typeof riddle.answer !== "string" ||
            !riddle.answer.length || riddle.answer.length > race_1.RACE_ANSWER_TEXT_UNITS)
            throw new https_1.HttpsError("data-loss", "The frozen race questions are not compatible with gameplay.");
        /** New opponents cannot require slots that native committed-text and single-cell edits discard. */
        const answerSlots = (0, game_1.splitGraphemes)(riddle.answer, locale);
        if (answerSlots.some(slot => !slot.trim()))
            throw new https_1.HttpsError("data-loss", "The frozen race questions are not compatible with gameplay.");
        /** Validation discards normalization output so source bytes and recording fingerprints remain unchanged. */
        const prompt = race_1.RacePreloadedRiddleSchema.safeParse({ riddleId: riddle.riddleId, text: riddle.text,
            answerLength: answerSlots.length, position: riddle.position, evaluation: { answer: riddle.answer, locale } });
        if (!prompt.success || prompt.data.riddleId !== riddle.riddleId || riddle.answer !== riddle.answer.trim())
            throw new https_1.HttpsError("data-loss", "The frozen race questions are not compatible with gameplay.");
    }
}
/** New live opponents require a complete ordered original deck with unique question identities. */
function assertLiveRaceDeckCompatible(run) {
    if (!run || !Array.isArray(run.riddles) || run.riddles.length !== race_1.RACE_DECK_SIZE ||
        run.riddles.some((riddle, position) => !riddle || typeof riddle !== "object" || riddle.position !== position ||
            typeof riddle.canonicalRiddleId !== "string" || !riddle.canonicalRiddleId.length || riddle.canonicalRiddleId.length > 160 ||
            riddle.canonicalRiddleId.includes("/")) ||
        new Set(run.riddles.map(riddle => riddle?.riddleId)).size !== race_1.RACE_DECK_SIZE ||
        new Set(run.riddles.map(riddle => riddle?.canonicalRiddleId)).size !== race_1.RACE_DECK_SIZE)
        throw new https_1.HttpsError("data-loss", "The frozen live race deck is incomplete or unordered.");
    assertRaceDeckCompatible(run.riddles, run.locale);
}
/** Live discovery excludes incompatible frozen decks while propagating unrelated failures. */
function isLiveRaceDeckCompatible(run) {
    try {
        assertLiveRaceDeckCompatible(run);
        return true;
    }
    catch (error) {
        if (error instanceof https_1.HttpsError && error.code === "data-loss")
            return false;
        throw error;
    }
}
//# sourceMappingURL=raceDeckCompatibility.js.map