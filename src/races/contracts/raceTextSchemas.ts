import {z} from "zod";
import {graphemeLength} from "../../gameplay/input/graphemes";
import {MAX_RIDDLE_ANSWER_CHARACTERS} from "../../gameplay/rules/limits";

/** Original authored answer budget; evaluations and immutable archives preserve these source bytes. */
export const RACE_ANSWER_TEXT_UNITS = 128;
/** UAX #15 section 9 bounds NFC expansion to three times the source code-unit length. */
export const RACE_NORMALIZED_TEXT_UNITS = RACE_ANSWER_TEXT_UNITS * 3;
/** Authoritative answers fit the original raw budget and seven user-perceived slots. */
export const RaceAnswerTextSchema = z.string().min(1).max(RACE_ANSWER_TEXT_UNITS)
  .refine(value => value.length <= RACE_ANSWER_TEXT_UNITS && graphemeLength(value) <= MAX_RIDDLE_ANSWER_CHARACTERS);
/** Native guesses may already be NFC; both raw and normalized text remain bounded before segmentation. */
export const RaceGuessTextSchema = z.string().trim().min(1).max(RACE_NORMALIZED_TEXT_UNITS)
  .refine(value => value.length <= RACE_NORMALIZED_TEXT_UNITS && value.normalize("NFC").length <= RACE_NORMALIZED_TEXT_UNITS && graphemeLength(value) <= MAX_RIDDLE_ANSWER_CHARACTERS);
/** Each hint, feedback and history cell carries one complete bounded grapheme without rewriting its bytes. */
export const RaceGraphemeTextSchema = z.string().min(1).max(RACE_NORMALIZED_TEXT_UNITS)
  .refine(value => value.length <= RACE_NORMALIZED_TEXT_UNITS && value.normalize("NFC").length <= RACE_NORMALIZED_TEXT_UNITS && graphemeLength(value) === 1);
