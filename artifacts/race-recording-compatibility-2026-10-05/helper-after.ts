import {graphemeLength} from "@qwordly/core/game";
import {RacePreloadedRiddleSchema, type RaceLocale} from "@qwordly/core/race";
import {HttpsError} from "firebase-functions/v2/https";
import type {RaceRiddleSnapshot} from "./raceEngine";

/** Checks original frozen question identities, clues and answers before new gameplay or publication. */
export function assertRaceDeckCompatible(riddles: RaceRiddleSnapshot[], locale: RaceLocale): void {
  for (const riddle of riddles) {
    /** Validation discards normalization output so source bytes and recording fingerprints remain unchanged. */
    const prompt = RacePreloadedRiddleSchema.safeParse({riddleId: riddle.riddleId, text: riddle.text,
      answerLength: graphemeLength(riddle.answer, locale), position: riddle.position, evaluation: {answer: riddle.answer, locale}});
    if (!prompt.success || prompt.data.riddleId !== riddle.riddleId || riddle.answer !== riddle.answer.trim())
      throw new HttpsError("data-loss", "The frozen race questions are not compatible with gameplay.");
  }
}
