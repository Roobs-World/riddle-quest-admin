"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLocalizedTodaysDailyChallenge = void 0;
exports.generateLocalizedClassicRiddlesForLocale = generateLocalizedClassicRiddlesForLocale;
exports.generateLocalizedClassicRiddles = generateLocalizedClassicRiddles;
exports.generateAndAppendRiddles = generateAndAppendRiddles;
exports.generateAndAppendDailyRiddles = generateAndAppendDailyRiddles;
exports.initializeRiddleDatabaseIfEmpty = initializeRiddleDatabaseIfEmpty;
exports.initializeLocalizedRiddleDatabaseIfEmpty = initializeLocalizedRiddleDatabaseIfEmpty;
const v2_1 = require("firebase-functions/v2");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const openaiService_1 = require("./openaiService");
const sentry_1 = require("../shared/sentry");
const firestoreSchemas_1 = require("../validation/firestoreSchemas");
const validation_1 = require("@qwordly/core/validation");
const riddleGenerationRepository_1 = require("./riddleGenerationRepository");
var dailyRiddleGeneration_1 = require("../daily/dailyRiddleGeneration");
Object.defineProperty(exports, "generateLocalizedTodaysDailyChallenge", { enumerable: true, get: function () { return dailyRiddleGeneration_1.generateLocalizedTodaysDailyChallenge; } });
/** Provides generate localized classic riddles for locale behavior. */
async function generateLocalizedClassicRiddlesForLocale(locale, numberOfRiddles, 
/** Worker deadline bounds retries while preserving all content quality checks. */
workerDeadlineAtMs) {
    v2_1.logger.info(`Generating ${numberOfRiddles} new classic riddles for locale ${locale}...`);
    /** Provides open ai key behavior. */
    const openAIKey = process.env.OPENAI_API_KEY;
    if (!openAIKey) {
        throw new Error("OPENAI_API_KEY environment variable is required");
    }
    /** Provides existing behavior. */
    const existing = await (0, riddleGenerationRepository_1.getLocalizedExistingRiddlesFromFirestoreForLocale)(locale);
    /** Starts ing index. */
    const startingIndex = await (0, riddleGenerationRepository_1.getNextClassicIndex)(locale);
    /** Provides new riddles behavior. */
    const newRiddles = [];
    /** Provides generated attempts behavior. */
    const generatedAttempts = [];
    /** Provides max attempts behavior. */
    const maxAttempts = numberOfRiddles * 10;
    /** Provides attempt count behavior. */
    let attemptCount = 0;
    while (newRiddles.length < numberOfRiddles && attemptCount < maxAttempts &&
        (workerDeadlineAtMs === undefined || Date.now() < workerDeadlineAtMs)) {
        attemptCount++;
        /** Provides riddle behavior. */
        const riddle = await (0, openaiService_1.generateUniqueRiddle)(locale, [...existing.answers, ...generatedAttempts.map((item) => item.answer)], {
            mode: "classic",
            background: workerDeadlineAtMs !== undefined,
            difficulty: (startingIndex + newRiddles.length) % 3 === 0 ? "medium" : undefined,
            excludedQuestions: [...existing.questions, ...generatedAttempts.map((item) => item.question)],
        });
        if (!riddle) {
            v2_1.logger.warn(`Failed to generate unique classic riddle for locale ${locale}, retrying... (attempt ${attemptCount}/${maxAttempts})`);
            continue;
        }
        /** Provides new riddle behavior. */
        const newRiddle = { question: riddle[0], answer: riddle[1], ...(riddle[2] ? { difficultyBand: riddle[2] } : {}) };
        if (!(0, riddleGenerationRepository_1.riddleHasPlayableClue)(newRiddle)) {
            v2_1.logger.warn(`Generated classic riddle for locale ${locale} reveals its answer, trying again... (attempt ${attemptCount}/${maxAttempts})`);
            continue;
        }
        if (!(0, riddleGenerationRepository_1.riddleExists)(newRiddle, existing.questions, existing.answers) &&
            !(0, riddleGenerationRepository_1.riddleExists)(newRiddle, generatedAttempts.map((item) => item.question), generatedAttempts.map((item) => item.answer))) {
            newRiddles.push(newRiddle);
            existing.questions.push(newRiddle.question.toLowerCase());
            existing.answers.push(newRiddle.answer.toLowerCase());
            v2_1.logger.info(`Generated classic riddle ${newRiddles.length}/${numberOfRiddles} for locale ${locale} (attempt ${attemptCount})`);
        }
        else {
            v2_1.logger.warn(`Generated classic riddle for locale ${locale} is a duplicate, trying again... (attempt ${attemptCount}/${maxAttempts})`);
        }
        generatedAttempts.push(newRiddle);
    }
    if (newRiddles.length < numberOfRiddles && (attemptCount >= maxAttempts || workerDeadlineAtMs !== undefined)) {
        v2_1.logger.warn(`Circuit breaker activated: Only generated ${newRiddles.length}/${numberOfRiddles} classic riddles for locale ${locale} after ${maxAttempts} attempts`);
        if (newRiddles.length === 0) {
            throw new Error(`Failed to generate any unique classic riddles for locale ${locale} after ${maxAttempts} attempts`);
        }
    }
    if (newRiddles.length > 0) {
        await (0, riddleGenerationRepository_1.storeLocalizedClassicRiddlesInFirestore)(locale, newRiddles, startingIndex);
        v2_1.logger.info(`Successfully generated and stored ${newRiddles.length} classic riddles for locale ${locale}.`);
    }
}
/** Provides generate localized classic riddles behavior. */
async function generateLocalizedClassicRiddles(numberOfRiddles) {
    /** Provides locale concurrency behavior. */
    const localeConcurrency = 3;
    for (let index = 0; index < validation_1.SUPPORTED_LOCALES.length; index += localeConcurrency) {
        /** Provides locale batch behavior. */
        const localeBatch = validation_1.SUPPORTED_LOCALES.slice(index, index + localeConcurrency);
        await Promise.all(localeBatch.map(async (locale) => {
            if (await (0, riddleGenerationRepository_1.areLocalizedClassicRiddlesSeededForLocale)(locale)) {
                v2_1.logger.info(`Skipping locale ${locale} because localized classic riddles already exist.`);
                return;
            }
            await generateLocalizedClassicRiddlesForLocale(locale, numberOfRiddles);
        }));
    }
}
/**
 * Generates a specified number of unique riddles and stores them directly in Firestore.
 * This function is called automatically by the submit answer function when needed.
 *
 * @param numberOfRiddles - The number of new riddles to generate.
 */
async function generateAndAppendRiddles(numberOfRiddles) {
    v2_1.logger.info(`Generating ${numberOfRiddles} new riddles...`);
    // Check for required environment variables
    /** Provides open ai key behavior. */
    const openAIKey = process.env.OPENAI_API_KEY;
    if (!openAIKey) {
        throw new Error("OPENAI_API_KEY environment variable is required");
    }
    // Get existing riddles for duplicate checking
    /** Provides existing behavior. */
    const existing = await (0, riddleGenerationRepository_1.getExistingRiddlesFromFirestore)();
    // Get the next available classic index
    /** Starts ing index. */
    const startingIndex = await (0, riddleGenerationRepository_1.getNextClassicIndex)();
    /** Provides new riddles behavior. */
    const newRiddles = [];
    /** Provides generated attempts behavior. */
    const generatedAttempts = [];
    // Circuit breaker: Maximum attempts to prevent infinite loops
    /** Provides max attempts behavior. */
    const maxAttempts = numberOfRiddles * 10; // Allow 10x attempts for retries
    /** Provides attempt count behavior. */
    let attemptCount = 0;
    while (newRiddles.length < numberOfRiddles && attemptCount < maxAttempts) {
        attemptCount++;
        // Generate a riddle using the OpenAI service
        /** Provides riddle behavior. */
        const riddle = await (0, openaiService_1.generateUniqueRiddle)("en", [...existing.answers, ...generatedAttempts.map((item) => item.answer)], {
            mode: "classic",
            difficulty: (startingIndex + newRiddles.length) % 3 === 0 ? "medium" : undefined,
            excludedQuestions: [...existing.questions, ...generatedAttempts.map((item) => item.question)],
        });
        if (riddle) {
            /** Provides new riddle behavior. */
            const newRiddle = {
                question: riddle[0],
                answer: riddle[1],
                ...(riddle[2] ? { difficultyBand: riddle[2] } : {}),
            };
            if (!(0, riddleGenerationRepository_1.riddleHasPlayableClue)(newRiddle)) {
                v2_1.logger.warn(`Generated riddle reveals its answer, trying again... (attempt ${attemptCount}/${maxAttempts})`);
                continue;
            }
            // Check for duplicates against existing and newly generated riddles
            if (!(0, riddleGenerationRepository_1.riddleExists)(newRiddle, existing.questions, existing.answers) &&
                !(0, riddleGenerationRepository_1.riddleExists)(newRiddle, generatedAttempts.map((r) => r.question), generatedAttempts.map((r) => r.answer))) {
                newRiddles.push(newRiddle);
                // Add to existing for subsequent duplicate checks within this run
                existing.questions.push(newRiddle.question.toLowerCase());
                existing.answers.push(newRiddle.answer.toLowerCase());
                v2_1.logger.info(`Generated riddle ${newRiddles.length}/${numberOfRiddles} (attempt ${attemptCount})`);
            }
            else {
                v2_1.logger.warn(`Generated riddle is a duplicate, trying again... (attempt ${attemptCount}/${maxAttempts})`);
            }
            generatedAttempts.push(newRiddle);
        }
        else {
            v2_1.logger.warn(`Failed to generate unique riddle, retrying... (attempt ${attemptCount}/${maxAttempts})`);
        }
    }
    // Check if we hit the circuit breaker
    if (newRiddles.length < numberOfRiddles && attemptCount >= maxAttempts) {
        v2_1.logger.warn(`Circuit breaker activated: Only generated ${newRiddles.length}/${numberOfRiddles} riddles after ${maxAttempts} attempts`);
        if (newRiddles.length === 0) {
            throw new Error(`Failed to generate any unique riddles after ${maxAttempts} attempts`);
        }
    }
    if (newRiddles.length > 0) {
        // Store riddles directly in Firestore
        await (0, riddleGenerationRepository_1.storeClassicRiddlesInFirestore)(newRiddles, startingIndex);
        v2_1.logger.info(`Successfully generated and stored ${newRiddles.length} new riddles in Firestore.`);
    }
    else {
        v2_1.logger.warn("No new unique riddles were generated.");
    }
}
/**
 * Generates a specified number of unique daily riddles and stores them directly in Firestore.
 * This function is called automatically by the submit answer function when needed.
 *
 * @param numberOfRiddles - The number of new daily riddles to generate.
 */
async function generateAndAppendDailyRiddles(numberOfRiddles) {
    v2_1.logger.info(`Generating ${numberOfRiddles} new daily riddles...`);
    // Check for required environment variables
    /** Provides open ai key behavior. */
    const openAIKey = process.env.OPENAI_API_KEY;
    if (!openAIKey) {
        throw new Error("OPENAI_API_KEY environment variable is required");
    }
    // Get existing riddles for duplicate checking (includes both classic and daily)
    /** Provides existing behavior. */
    const existing = await (0, riddleGenerationRepository_1.getExistingRiddlesFromFirestore)();
    // Get the next available daily index
    /** Starts ing index. */
    const startingIndex = await (0, riddleGenerationRepository_1.getNextDailyIndex)();
    /** Provides new riddles behavior. */
    const newRiddles = [];
    /** Provides generated attempts behavior. */
    const generatedAttempts = [];
    // Circuit breaker: Maximum attempts to prevent infinite loops
    /** Provides max attempts behavior. */
    const maxAttempts = numberOfRiddles * 10; // Allow 10x attempts for retries
    /** Provides attempt count behavior. */
    let attemptCount = 0;
    while (newRiddles.length < numberOfRiddles && attemptCount < maxAttempts) {
        attemptCount++;
        // Generate a riddle using the OpenAI service
        /** Provides riddle behavior. */
        const riddle = await (0, openaiService_1.generateUniqueRiddle)("en", [...existing.answers, ...generatedAttempts.map((item) => item.answer)], { mode: "daily", difficulty: "medium", excludedQuestions: [...existing.questions, ...generatedAttempts.map((item) => item.question)] });
        if (riddle) {
            /** Provides new riddle behavior. */
            const newRiddle = {
                question: riddle[0],
                answer: riddle[1],
                ...(riddle[2] ? { difficultyBand: riddle[2] } : {}),
            };
            if (!(0, riddleGenerationRepository_1.riddleHasPlayableClue)(newRiddle)) {
                v2_1.logger.warn(`Generated daily riddle reveals its answer, trying again... (attempt ${attemptCount}/${maxAttempts})`);
                continue;
            }
            // Check for duplicates against existing and newly generated riddles
            if (!(0, riddleGenerationRepository_1.riddleExists)(newRiddle, existing.questions, existing.answers) &&
                !(0, riddleGenerationRepository_1.riddleExists)(newRiddle, generatedAttempts.map((r) => r.question), generatedAttempts.map((r) => r.answer))) {
                newRiddles.push(newRiddle);
                // Add to existing for subsequent duplicate checks within this run
                existing.questions.push(newRiddle.question.toLowerCase());
                existing.answers.push(newRiddle.answer.toLowerCase());
                v2_1.logger.info(`Generated daily riddle ${newRiddles.length}/${numberOfRiddles} (attempt ${attemptCount})`);
            }
            else {
                v2_1.logger.warn(`Generated daily riddle is a duplicate, trying again... (attempt ${attemptCount}/${maxAttempts})`);
            }
            generatedAttempts.push(newRiddle);
        }
        else {
            v2_1.logger.warn(`Failed to generate unique daily riddle, retrying... (attempt ${attemptCount}/${maxAttempts})`);
        }
    }
    // Check if we hit the circuit breaker
    if (newRiddles.length < numberOfRiddles && attemptCount >= maxAttempts) {
        v2_1.logger.warn(`Circuit breaker activated: Only generated ${newRiddles.length}/${numberOfRiddles} daily riddles after ${maxAttempts} attempts`);
        if (newRiddles.length === 0) {
            throw new Error(`Failed to generate any unique daily riddles after ${maxAttempts} attempts`);
        }
    }
    if (newRiddles.length > 0) {
        await (0, riddleGenerationRepository_1.storeDailyRiddlesInFirestore)(newRiddles, startingIndex);
        v2_1.logger.info("Successfully generated and stored a new current daily riddle in Firestore.");
    }
    else {
        v2_1.logger.warn("No new unique daily riddles were generated.");
    }
}
/**
 * Initializes the riddle database if it's empty.
 * This function is called automatically by the submit answer function if no riddles exist.
 *
 * @param initialRiddleCount - The number of initial riddles to generate.
 */
async function initializeRiddleDatabaseIfEmpty(initialRiddleCount = 20) {
    v2_1.logger.info("Checking if riddle database needs initialization...");
    try {
        // Check if any classic riddles already exist
        /** Provides existing riddles snapshot behavior. */
        const existingRiddlesSnapshot = await firebaseAdmin_1.admin
            .firestore()
            .collection(firestoreSchemas_1.RiddleCollections.RIDDLES)
            .where("classicIndex", ">=", 0)
            .limit(1)
            .get();
        if (!existingRiddlesSnapshot.empty) {
            v2_1.logger.info("Riddle database already initialized - classic riddles exist.");
            return;
        }
        // Generate initial batch of riddles for new database
        v2_1.logger.info(`Generating ${initialRiddleCount} initial riddles for database initialization...`);
        await generateAndAppendRiddles(initialRiddleCount);
        v2_1.logger.info(`Riddle database initialized with ${initialRiddleCount} classic riddles.`);
    }
    catch (error) {
        v2_1.logger.error("Error initializing riddle database:", error);
        (0, sentry_1.captureException)(error);
        throw new Error("Failed to initialize riddle database.");
    }
}
/** Provides initialize localized riddle database if empty behavior. */
async function initializeLocalizedRiddleDatabaseIfEmpty(initialRiddleCount = 20) {
    v2_1.logger.info("Checking if localized riddle database needs initialization...");
    try {
        if (await (0, riddleGenerationRepository_1.areLocalizedClassicRiddlesSeeded)()) {
            v2_1.logger.info("Localized riddle database already initialized - classic riddles exist for every locale.");
            return;
        }
        v2_1.logger.info(`Generating ${initialRiddleCount} initial riddles for each supported locale...`);
        await generateLocalizedClassicRiddles(initialRiddleCount);
        v2_1.logger.info(`Localized riddle database initialized with ${initialRiddleCount} classic riddles per locale.`);
    }
    catch (error) {
        v2_1.logger.error("Error initializing localized riddle database:", error);
        (0, sentry_1.captureException)(error);
        throw new Error("Failed to initialize localized riddle database.");
    }
}
/**
 * Generates 1 riddle for today's daily challenge and stores it in the challenge structure.
 * @param forceGenerate - If true, generates new riddles even if today's challenge already exists.
 * @return A promise that resolves when the daily challenge is created.
 */
//# sourceMappingURL=riddleGeneration.js.map