"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.editRaceInput = exports.deleteRaceLetter = exports.insertRaceText = exports.insertRaceLetter = exports.isRaceSlotEditable = void 0;
const game_1 = require("@qwordly/core/game");
/** Valid answer positions are integer indexes within the fixed prompt shape. */
const isRaceSlotInBounds = (riddle, index) => Number.isInteger(index) && index >= 0 && index < riddle.answerLength;
/** Returns whether a slot can be edited without overriding a server hint. */
const isRaceSlotEditable = (riddle, index) => isRaceSlotInBounds(riddle, index) && !riddle.revealedLetters.some((revealedLetter) => revealedLetter.index === index);
exports.isRaceSlotEditable = isRaceSlotEditable;
/** Inserts a letter and advances to the next empty, editable answer slot. */
const insertRaceLetter = (riddle, state, letter) => {
    if (!(0, exports.isRaceSlotEditable)(riddle, state.activeSlotIndex))
        return state;
    /** Provides graphemes behavior. */
    const graphemes = (0, game_1.splitGraphemes)(letter.normalize("NFC"));
    if (graphemes.length !== 1 || !graphemes[0].trim())
        return state;
    /** Updated answer attempt after inserting the supplied letter. */
    const letters = Array.from({ length: riddle.answerLength }, (_, index) => state.letters[index] ?? "");
    letters[state.activeSlotIndex] = graphemes[0];
    /** Server-revealed positions excluded from automatic selection. */
    const revealedIndexes = new Set(riddle.revealedLetters.map(({ index }) => index));
    /** Next empty editable slot after the current position, with wraparound. */
    const nextSlotIndex = Array.from({ length: riddle.answerLength }, (_, offset) => (state.activeSlotIndex + offset + 1) % riddle.answerLength).find((index) => !revealedIndexes.has(index) && !letters[index]);
    return {
        letters,
        activeSlotIndex: nextSlotIndex ?? state.activeSlotIndex,
    };
};
exports.insertRaceLetter = insertRaceLetter;
/** Inserts one committed IME/paste unit atomically, ignoring text beyond the initially editable capacity. */
const insertRaceText = (riddle, state, text) => {
    if (!(0, exports.isRaceSlotEditable)(riddle, state.activeSlotIndex))
        return state;
    /** Provides revealed indexes behavior. */
    const revealedIndexes = new Set(riddle.revealedLetters.map(({ index }) => index));
    /** Provides initial letters behavior. */
    const initialLetters = Array.from({ length: riddle.answerLength }, (_, index) => state.letters[index] ?? "");
    /** Provides capacity behavior. */
    const capacity = initialLetters.reduce((count, letter, index) => count + (!revealedIndexes.has(index) && !letter ? 1 : 0), 0) +
        (initialLetters[state.activeSlotIndex] ? 1 : 0);
    /** Each accepted grapheme fills only the capacity that belonged to this committed edit. */
    let current = state, accepted = 0;
    /** Ignored whitespace does not consume capacity; ignored suffixes need not be enumerated. */
    for (const grapheme of (0, game_1.iterateGraphemes)(text)) {
        if (!grapheme.trim())
            continue;
        current = (0, exports.insertRaceLetter)(riddle, current, grapheme);
        if (++accepted === capacity)
            break;
    }
    return current;
};
exports.insertRaceText = insertRaceText;
/** Deletes the active letter or the nearest previous editable letter. */
const deleteRaceLetter = (riddle, state) => {
    if (!isRaceSlotInBounds(riddle, state.activeSlotIndex))
        return state;
    /** Server-revealed positions excluded from deletion. */
    const revealedIndexes = new Set(riddle.revealedLetters.map(({ index }) => index));
    /** Updated answer attempt from which one letter will be removed. */
    const letters = Array.from({ length: riddle.answerLength }, (_, index) => state.letters[index] ?? "");
    /** Editable position selected for deletion. */
    let targetIndex = state.activeSlotIndex;
    if (!letters[targetIndex] || revealedIndexes.has(targetIndex)) {
        targetIndex =
            Array.from({ length: riddle.answerLength }, (_, offset) => (state.activeSlotIndex - offset - 1 + riddle.answerLength) % riddle.answerLength).find((index) => !revealedIndexes.has(index) && Boolean(letters[index])) ?? state.activeSlotIndex;
    }
    if (revealedIndexes.has(targetIndex))
        return state;
    letters[targetIndex] = "";
    return { letters, activeSlotIndex: targetIndex };
};
exports.deleteRaceLetter = deleteRaceLetter;
/** Applies only bounded answer edits, preserving state identity for ignored input. */
const editRaceInput = (riddle, draft, kind, value) => {
    if (kind === "slot")
        return typeof value === "number" && (0, exports.isRaceSlotEditable)(riddle, value)
            ? { ...draft, activeSlotIndex: value } : draft;
    return kind === "backspace" ? (0, exports.deleteRaceLetter)(riddle, draft) : kind === "text"
        ? (0, exports.insertRaceText)(riddle, draft, String(value)) : (0, exports.insertRaceLetter)(riddle, draft, String(value));
};
exports.editRaceInput = editRaceInput;
