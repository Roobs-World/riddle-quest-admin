"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPlayableRiddleContent = void 0;
exports.getPlayableClassicRiddle = getPlayableClassicRiddle;
const functions = __importStar(require("firebase-functions"));
const firestoreService_1 = require("./firestoreService");
const singlePlayerAnswerPolicy_1 = require("./singlePlayerAnswerPolicy");
const riddleGenerationRepository_1 = require("../riddles/riddleGenerationRepository");
/** Enforces keyboard compatibility and the no-answer-in-clue policy. */
const isPlayableRiddleContent = (riddle) => typeof riddle.text === "string" &&
    riddle.text.length > 0 &&
    (0, singlePlayerAnswerPolicy_1.isPlayableSinglePlayerAnswer)(riddle.answer) &&
    (0, riddleGenerationRepository_1.riddleHasPlayableClue)({ question: riddle.text, answer: riddle.answer });
exports.isPlayableRiddleContent = isPlayableRiddleContent;
/** Loads a localized Classic riddle with a safe English legacy fallback. */
async function getPlayableClassicRiddle(classicIndex, locale) {
    /** Provides riddle behavior. */
    let riddle = await (0, firestoreService_1.getClassicRiddleByIndex)(classicIndex, locale);
    /** Provides content locale behavior. */
    let contentLocale = locale;
    if ((!riddle || !(0, exports.isPlayableRiddleContent)(riddle)) && locale !== "en") {
        functions.logger.warn("Localized Classic content is not playable; using the English canonical fallback.", {
            requestedLocale: locale,
            classicIndex,
        });
        /** Provides english fallback behavior. */
        const englishFallback = await (0, firestoreService_1.getClassicRiddleByIndex)(classicIndex, "en");
        if (englishFallback && (0, exports.isPlayableRiddleContent)(englishFallback)) {
            riddle = englishFallback;
            contentLocale = "en";
        }
    }
    return riddle && (0, exports.isPlayableRiddleContent)(riddle) ? { riddle, contentLocale } : undefined;
}
//# sourceMappingURL=classicRiddleFallback.js.map