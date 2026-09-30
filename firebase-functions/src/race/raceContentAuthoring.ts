import {RACE_CATEGORY_IDS} from "@qwordly/core/race";
import {generateUniqueRiddle, GeneratedRiddleSchema, RIDDLE_GENERATION_MODEL} from "../riddles/openaiService";
import {
  createRaceContentImportPlan,
  RaceContentImportItemSchema,
  type RaceContentImportFile,
} from "./raceContentImport";
import {RACE_POOL_SIZE} from "./raceContentValidation";
import {clueContainsLiteralAnswer} from "../riddles/riddleQuality";

/** New multiplayer banks contain twenty easy and ten medium cards per category. */
export const RACE_AUTHORING_EASY_COUNT = 20;
/** Bounded retries for a single slot; incomplete banks are never importable. */
const MAX_ATTEMPTS_PER_CARD = 3;

/** Local progress is bound by the CLI to the source and authoring model. */
type AuthoringProgress = {
  /** Stores completed. */
  completed?: unknown;
  /** Stores save. */
  save?: (riddles: RaceContentImportFile["riddles"]) => Promise<void>;
};

/** Authors an English bank locally, with the same blind solve and review as single player. */
export async function authorRaceContent(
  existing: {
    /** Existing riddle prompt. */
    text: string;
    /** Existing riddle answer. */
    answer: string;
  }[] = [],
  onProgress?: (completed: number, total: number) => void,
  progress: AuthoringProgress = {},
): Promise<RaceContentImportFile> {
  /** Provides total behavior. */
  const total = RACE_CATEGORY_IDS.length * RACE_POOL_SIZE;
  /** Provides riddles behavior. */
  const riddles = RaceContentImportItemSchema.array()
    .max(total)
    .parse(progress.completed ?? []);
  for (const [index, card] of riddles.entries()) {
    /** Provides category behavior. */
    const category = RACE_CATEGORY_IDS[Math.floor(index / RACE_POOL_SIZE)];
    /** Provides slot behavior. */
    const slot = index % RACE_POOL_SIZE;
    if (
      card.canonicalRiddleId !== `race:sol61:${category}:${String(slot + 1).padStart(2, "0")}` ||
      card.categoryId !== category ||
      card.difficultyBand !== (slot < RACE_AUTHORING_EASY_COUNT ? "easy" : "medium") ||
      card.qualityVersion !== `reviewed_${RIDDLE_GENERATION_MODEL}_v1` ||
      !GeneratedRiddleSchema.safeParse({question: card.text, answer: card.answer}).success ||
      clueContainsLiteralAnswer(card.text, card.answer) ||
      [...existing, ...riddles.slice(0, index)].some(
        (previous) =>
          previous.answer.toLowerCase() === card.answer || previous.text.toLowerCase() === card.text.toLowerCase(),
      )
    ) {
      throw new Error("Invalid race authoring checkpoint.");
    }
  }
  /** Provides excluded answers behavior. */
  const excludedAnswers = [...existing, ...riddles].map((item) => item.answer);
  /** Provides excluded questions behavior. */
  const excludedQuestions = [...existing, ...riddles].map((item) => item.text);

  for (const categoryId of RACE_CATEGORY_IDS) {
    for (let index = 0; index < RACE_POOL_SIZE; index++) {
      /** Provides slot behavior. */
      const slot = RACE_CATEGORY_IDS.indexOf(categoryId) * RACE_POOL_SIZE + index;
      if (slot < riddles.length) continue;
      /** Provides difficulty band behavior. */
      const difficultyBand = index < RACE_AUTHORING_EASY_COUNT ? "easy" : "medium";
      /** Provides accepted behavior. */
      let accepted = false;
      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_CARD; attempt++) {
        /** Provides candidate behavior. */
        const candidate = await generateUniqueRiddle("en", excludedAnswers, {
          mode: "multiplayer",
          categoryId,
          difficulty: difficultyBand,
          excludedQuestions,
        });
        if (!candidate) continue;
        /** Provides [text, answer] behavior. */
        const [text, answer] = candidate;
        riddles.push({
          canonicalRiddleId: `race:sol61:${categoryId}:${String(index + 1).padStart(2, "0")}`,
          text,
          answer,
          categoryId,
          difficultyBand,
          qualityVersion: `reviewed_${RIDDLE_GENERATION_MODEL}_v1`,
        });
        excludedAnswers.push(answer);
        excludedQuestions.push(text);
        accepted = true;
        await progress.save?.(riddles.map((riddle) => ({...riddle})));
        onProgress?.(riddles.length, total);
        break;
      }
      if (!accepted) throw new Error(`Race authoring exhausted attempts for ${categoryId} slot ${index + 1}.`);
    }
  }

  /** Provides file behavior. */
  const file: RaceContentImportFile = {locale: "en", riddles};
  if (!createRaceContentImportPlan(file).valid) throw new Error("Generated race bank failed import validation.");
  return file;
}
