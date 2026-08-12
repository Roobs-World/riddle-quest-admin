import * as functions from "firebase-functions";
import {getClassicRiddleByIndex} from "./firestoreService";
import {isPlayableSinglePlayerAnswer} from "./singlePlayerAnswerPolicy";
import {riddleHasPlayableClue} from "../riddles/riddleGenerationRepository";

/** Enforces keyboard compatibility and the no-answer-in-clue policy. */
export const isPlayableRiddleContent = <T extends {text?: unknown; answer?: unknown}>(
  riddle: T,
): riddle is T & {text: string; answer: string} =>
  typeof riddle.text === "string" && riddle.text.length > 0 &&
  isPlayableSinglePlayerAnswer(riddle.answer) &&
  riddleHasPlayableClue({question: riddle.text, answer: riddle.answer});

/** Loads a localized Classic riddle with a safe English legacy fallback. */
export async function getPlayableClassicRiddle(
  classicIndex: number,
  locale: string,
): Promise<{riddle: NonNullable<Awaited<ReturnType<typeof getClassicRiddleByIndex>>>; contentLocale: string} | undefined> {
  let riddle = await getClassicRiddleByIndex(classicIndex, locale);
  let contentLocale = locale;
  if ((!riddle || !isPlayableRiddleContent(riddle)) && locale !== "en") {
    functions.logger.warn("Localized Classic content is not playable; using the English canonical fallback.", {
      requestedLocale: locale,
      classicIndex,
    });
    const englishFallback = await getClassicRiddleByIndex(classicIndex, "en");
    if (englishFallback && isPlayableRiddleContent(englishFallback)) {
      riddle = englishFallback;
      contentLocale = "en";
    }
  }
  return riddle && isPlayableRiddleContent(riddle) ? {riddle, contentLocale} : undefined;
}
