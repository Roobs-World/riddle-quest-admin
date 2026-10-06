import {graphemeLength} from "@qwordly/core/game";
import {RACE_ANSWER_TEXT_UNITS, RACE_DECK_SIZE, RaceLocaleSchema, RacePreloadedRiddleSchema, type RaceLocale} from "@qwordly/core/race";
import {HttpsError} from "firebase-functions/v2/https";
import type {RaceRiddleSnapshot, RaceRunRecord} from "./raceEngine";

/** Checks original frozen question identities, clues and answers before new gameplay or publication. */
export function assertRaceDeckCompatible(riddles: RaceRiddleSnapshot[], locale: RaceLocale): void {
  if (!Array.isArray(riddles) || !riddles.length || riddles.length > RACE_DECK_SIZE || !RaceLocaleSchema.safeParse(locale).success)
    throw new HttpsError("data-loss", "The frozen race questions are not compatible with gameplay.");
  for (const riddle of riddles) {
    if (!riddle || typeof riddle !== "object" || typeof riddle.answer !== "string" ||
      !riddle.answer.length || riddle.answer.length > RACE_ANSWER_TEXT_UNITS)
      throw new HttpsError("data-loss", "The frozen race questions are not compatible with gameplay.");
    /** Validation discards normalization output so source bytes and recording fingerprints remain unchanged. */
    const prompt = RacePreloadedRiddleSchema.safeParse({riddleId: riddle.riddleId, text: riddle.text,
      answerLength: graphemeLength(riddle.answer, locale), position: riddle.position, evaluation: {answer: riddle.answer, locale}});
    if (!prompt.success || prompt.data.riddleId !== riddle.riddleId || riddle.answer !== riddle.answer.trim())
      throw new HttpsError("data-loss", "The frozen race questions are not compatible with gameplay.");
  }
}

/** New live opponents require a complete ordered original deck with unique question identities. */
export function assertLiveRaceDeckCompatible(run: Pick<RaceRunRecord, "riddles" | "locale">): void {
  if (!run || !Array.isArray(run.riddles) || run.riddles.length !== RACE_DECK_SIZE ||
    run.riddles.some((riddle, position) => !riddle || typeof riddle !== "object" || riddle.position !== position ||
      typeof riddle.canonicalRiddleId !== "string" || !riddle.canonicalRiddleId.length || riddle.canonicalRiddleId.length > 160 ||
      riddle.canonicalRiddleId.includes("/")) ||
    new Set(run.riddles.map(riddle => riddle?.riddleId)).size !== RACE_DECK_SIZE ||
    new Set(run.riddles.map(riddle => riddle?.canonicalRiddleId)).size !== RACE_DECK_SIZE)
    throw new HttpsError("data-loss", "The frozen live race deck is incomplete or unordered.");
  assertRaceDeckCompatible(run.riddles, run.locale);
}

/** Live discovery excludes incompatible frozen decks while propagating unrelated failures. */
export function isLiveRaceDeckCompatible(run: Pick<RaceRunRecord, "riddles" | "locale">): boolean {
  try {
    assertLiveRaceDeckCompatible(run);
    return true;
  } catch (error) {
    if (error instanceof HttpsError && error.code === "data-loss") return false;
    throw error;
  }
}
