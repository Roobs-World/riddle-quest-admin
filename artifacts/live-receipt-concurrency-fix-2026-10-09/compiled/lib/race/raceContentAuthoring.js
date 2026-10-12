"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RACE_AUTHORING_EASY_COUNT = void 0;
exports.authorRaceContent = authorRaceContent;
const race_1 = require("@qwordly/core/race");
const openaiService_1 = require("../riddles/openaiService");
const raceContentImport_1 = require("./raceContentImport");
const raceContentValidation_1 = require("./raceContentValidation");
const riddleQuality_1 = require("../riddles/riddleQuality");
/** New multiplayer banks contain twenty easy and ten medium cards per category. */
exports.RACE_AUTHORING_EASY_COUNT = 20;
/** Bounded retries for a single slot; incomplete banks are never importable. */
const MAX_ATTEMPTS_PER_CARD = 3;
/** Authors an English bank locally, with the same blind solve and review as single player. */
async function authorRaceContent(existing = [], onProgress, progress = {}) {
    /** Provides total behavior. */
    const total = race_1.RACE_CATEGORY_IDS.length * raceContentValidation_1.RACE_POOL_SIZE;
    /** Provides riddles behavior. */
    const riddles = raceContentImport_1.RaceContentImportItemSchema.array()
        .max(total)
        .parse(progress.completed ?? []);
    for (const [index, card] of riddles.entries()) {
        /** Provides category behavior. */
        const category = race_1.RACE_CATEGORY_IDS[Math.floor(index / raceContentValidation_1.RACE_POOL_SIZE)];
        /** Provides slot behavior. */
        const slot = index % raceContentValidation_1.RACE_POOL_SIZE;
        if (card.canonicalRiddleId !== `race:sol61:${category}:${String(slot + 1).padStart(2, "0")}` ||
            card.categoryId !== category ||
            card.difficultyBand !== (slot < exports.RACE_AUTHORING_EASY_COUNT ? "easy" : "medium") ||
            card.qualityVersion !== `reviewed_${openaiService_1.RIDDLE_GENERATION_MODEL}_v1` ||
            !openaiService_1.GeneratedRiddleSchema.safeParse({ question: card.text, answer: card.answer }).success ||
            (0, riddleQuality_1.clueContainsLiteralAnswer)(card.text, card.answer) ||
            [...existing, ...riddles.slice(0, index)].some((previous) => previous.answer.toLowerCase() === card.answer || previous.text.toLowerCase() === card.text.toLowerCase())) {
            throw new Error("Invalid race authoring checkpoint.");
        }
    }
    /** Provides excluded answers behavior. */
    const excludedAnswers = [...existing, ...riddles].map((item) => item.answer);
    /** Provides excluded questions behavior. */
    const excludedQuestions = [...existing, ...riddles].map((item) => item.text);
    for (const categoryId of race_1.RACE_CATEGORY_IDS) {
        for (let index = 0; index < raceContentValidation_1.RACE_POOL_SIZE; index++) {
            /** Provides slot behavior. */
            const slot = race_1.RACE_CATEGORY_IDS.indexOf(categoryId) * raceContentValidation_1.RACE_POOL_SIZE + index;
            if (slot < riddles.length)
                continue;
            /** Provides difficulty band behavior. */
            const difficultyBand = index < exports.RACE_AUTHORING_EASY_COUNT ? "easy" : "medium";
            /** Provides accepted behavior. */
            let accepted = false;
            for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_CARD; attempt++) {
                /** Provides candidate behavior. */
                const candidate = await (0, openaiService_1.generateUniqueRiddle)("en", excludedAnswers, {
                    mode: "multiplayer",
                    categoryId,
                    difficulty: difficultyBand,
                    excludedQuestions,
                });
                if (!candidate)
                    continue;
                /** Provides [text, answer] behavior. */
                const [text, answer] = candidate;
                riddles.push({
                    canonicalRiddleId: `race:sol61:${categoryId}:${String(index + 1).padStart(2, "0")}`,
                    text,
                    answer,
                    categoryId,
                    difficultyBand,
                    qualityVersion: `reviewed_${openaiService_1.RIDDLE_GENERATION_MODEL}_v1`,
                });
                excludedAnswers.push(answer);
                excludedQuestions.push(text);
                accepted = true;
                await progress.save?.(riddles.map((riddle) => ({ ...riddle })));
                onProgress?.(riddles.length, total);
                break;
            }
            if (!accepted)
                throw new Error(`Race authoring exhausted attempts for ${categoryId} slot ${index + 1}.`);
        }
    }
    /** Provides file behavior. */
    const file = { locale: "en", riddles };
    if (!(0, raceContentImport_1.createRaceContentImportPlan)(file).valid)
        throw new Error("Generated race bank failed import validation.");
    return file;
}
//# sourceMappingURL=raceContentAuthoring.js.map