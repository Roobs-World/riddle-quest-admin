"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocalizedCanonicalKey = exports.getLocalizedClassicDocRef = exports.getLocalizedDailyDocRef = void 0;
exports.riddleExists = riddleExists;
exports.riddleHasPlayableClue = riddleHasPlayableClue;
exports.areLocalizedClassicRiddlesSeeded = areLocalizedClassicRiddlesSeeded;
exports.areLocalizedClassicRiddlesSeededForLocale = areLocalizedClassicRiddlesSeededForLocale;
exports.getExistingRiddlesFromFirestore = getExistingRiddlesFromFirestore;
exports.getLocalizedExistingRiddlesFromFirestoreForLocale = getLocalizedExistingRiddlesFromFirestoreForLocale;
exports.getNextClassicIndex = getNextClassicIndex;
exports.storeClassicRiddlesInFirestore = storeClassicRiddlesInFirestore;
exports.storeLocalizedClassicRiddlesInFirestore = storeLocalizedClassicRiddlesInFirestore;
exports.getNextDailyIndex = getNextDailyIndex;
exports.storeDailyRiddlesInFirestore = storeDailyRiddlesInFirestore;
const v2_1 = require("firebase-functions/v2");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const sentry_1 = require("../shared/sentry");
const firestoreSchemas_1 = require("../validation/firestoreSchemas");
const riddleQuality_1 = require("./riddleQuality");
const validation_1 = require("@qwordly/core/validation");
const errorMetadata_1 = require("../shared/errorMetadata");
/** Provides riddle exists behavior. */
function riddleExists(riddle, existingQuestions, existingAnswers) {
    /** Normalizes d question. */
    const normalizedQuestion = riddle.question.toLowerCase();
    /** Normalizes d answer. */
    const normalizedAnswer = riddle.answer.toLowerCase();
    return existingQuestions.includes(normalizedQuestion) || existingAnswers.includes(normalizedAnswer);
}
/** Provides riddle has playable clue behavior. */
function riddleHasPlayableClue(riddle) {
    return !(0, riddleQuality_1.clueContainsLiteralAnswer)(riddle.question, riddle.answer);
}
/** Defines the localized riddles collection value. */
const LOCALIZED_RIDDLES_COLLECTION = "localizedRiddles";
/** Defines the localized riddle subcollection value. */
const LOCALIZED_RIDDLE_SUBCOLLECTION = "riddles";
/** Gets localized riddle collection. */
const getLocalizedRiddleCollection = (locale) => `${LOCALIZED_RIDDLES_COLLECTION}/${locale}/${LOCALIZED_RIDDLE_SUBCOLLECTION}`;
/** Gets localized daily doc ref. */
const getLocalizedDailyDocRef = (locale, challengeDate) => firebaseAdmin_1.admin
    .firestore()
    .collection(getLocalizedRiddleCollection(locale))
    .doc(challengeDate ? `daily-${challengeDate}` : "current");
exports.getLocalizedDailyDocRef = getLocalizedDailyDocRef;
/** Gets localized classic doc ref. */
const getLocalizedClassicDocRef = (locale, riddleId) => firebaseAdmin_1.admin.firestore().collection(getLocalizedRiddleCollection(locale)).doc(riddleId);
exports.getLocalizedClassicDocRef = getLocalizedClassicDocRef;
/** Gets localized canonical key. */
const getLocalizedCanonicalKey = (category, index, locale) => `${category}:${index}:${locale}`;
exports.getLocalizedCanonicalKey = getLocalizedCanonicalKey;
/** Provides are localized classic riddles seeded behavior. */
async function areLocalizedClassicRiddlesSeeded() {
    for (const locale of validation_1.SUPPORTED_LOCALES) {
        if (!(await areLocalizedClassicRiddlesSeededForLocale(locale))) {
            return false;
        }
    }
    return true;
}
/** Provides are localized classic riddles seeded for locale behavior. */
async function areLocalizedClassicRiddlesSeededForLocale(locale) {
    /** Provides snapshot behavior. */
    const snapshot = await firebaseAdmin_1.admin
        .firestore()
        .collection(getLocalizedRiddleCollection(locale))
        .where("classicIndex", ">=", 0)
        .limit(1)
        .get();
    return !snapshot.empty;
}
/**
 * Fetches existing riddles from all riddle collections for duplicate checking.
 * Checks classic riddles, daily riddles
 * @returns A promise that resolves with an object containing arrays of questions and answers.
 */
async function getExistingRiddlesFromFirestore() {
    try {
        /** Provides questions behavior. */
        const questions = [];
        /** Provides answers behavior. */
        const answers = [];
        // Get classic riddles from 'riddles' collection
        /** Provides riddles snapshot behavior. */
        const riddlesSnapshot = await firebaseAdmin_1.admin.firestore().collection(firestoreSchemas_1.RiddleCollections.RIDDLES).get();
        riddlesSnapshot.forEach((doc) => {
            /** Provides data behavior. */
            const data = doc.data();
            if (data.text) {
                questions.push(data.text.toLowerCase());
            }
            if (data.answer) {
                answers.push(data.answer.toLowerCase());
            }
        });
        // Get daily riddles from 'dailyRiddles' collection
        /** Provides daily riddles snapshot behavior. */
        const dailyRiddlesSnapshot = await firebaseAdmin_1.admin.firestore().collection(firestoreSchemas_1.RiddleCollections.DAILY_RIDDLES).get();
        dailyRiddlesSnapshot.forEach((doc) => {
            /** Provides data behavior. */
            const data = doc.data();
            if (data.text) {
                questions.push(data.text.toLowerCase());
            }
            if (data.answer) {
                answers.push(data.answer.toLowerCase());
            }
        });
        v2_1.logger.info(`Loaded ${questions.length} existing questions and ${answers.length} existing answers for duplicate checking`);
        return { questions, answers };
    }
    catch (error) {
        v2_1.logger.error("Error fetching existing riddles from Firestore.", (0, errorMetadata_1.getSafeErrorMetadata)(error));
        (0, sentry_1.captureException)(error);
        throw new Error("Failed to fetch existing riddles from Firestore.");
    }
}
/** Gets localized existing riddles from firestore for locale. */
async function getLocalizedExistingRiddlesFromFirestoreForLocale(locale) {
    /** Provides questions behavior. */
    const questions = [];
    /** Provides answers behavior. */
    const answers = [];
    /** Provides snapshot behavior. */
    const snapshot = await firebaseAdmin_1.admin.firestore().collection(getLocalizedRiddleCollection(locale)).get();
    snapshot.forEach((doc) => {
        /** Provides data behavior. */
        const data = doc.data();
        if (data.text) {
            questions.push(data.text.toLowerCase());
        }
        if (data.answer) {
            answers.push(data.answer.toLowerCase());
        }
    });
    v2_1.logger.info(`Loaded ${questions.length} localized questions and ${answers.length} localized answers for duplicate checking in locale ${locale}`);
    return { questions, answers };
}
/**
 * Gets the next available classic index for new riddles.
 * @returns The next available classic index.
 */
async function getNextClassicIndex(locale) {
    try {
        /** Provides riddles snapshot behavior. */
        const riddlesSnapshot = await firebaseAdmin_1.admin
            .firestore()
            .collection(locale ? getLocalizedRiddleCollection(locale) : firestoreSchemas_1.RiddleCollections.RIDDLES)
            .where("classicIndex", ">=", 0)
            .orderBy("classicIndex", "desc")
            .limit(1)
            .get();
        if (riddlesSnapshot.empty) {
            return 1; // Start from 1 to match the classic_1 doc naming convention
        }
        /** Provides highest index doc behavior. */
        const highestIndexDoc = riddlesSnapshot.docs[0];
        /** Provides highest index behavior. */
        const highestIndex = highestIndexDoc.data().classicIndex || 0;
        return highestIndex + 1;
    }
    catch (error) {
        v2_1.logger.error("Error getting next classic index.", (0, errorMetadata_1.getSafeErrorMetadata)(error));
        (0, sentry_1.captureException)(error);
        throw new Error("Failed to get next classic index.");
    }
}
/**
 * Stores generated classic riddles in the riddles collection.
 * @param riddles - An array of riddle objects to store.
 * @param startingIndex - The starting classic index for the riddles.
 */
async function storeClassicRiddlesInFirestore(riddles, startingIndex) {
    /** Provides batch behavior. */
    const batch = firebaseAdmin_1.admin.firestore().batch();
    riddles.forEach((riddle, index) => {
        /** Provides doc id behavior. */
        const docId = `classic_${startingIndex + index}`;
        /** Provides riddle ref behavior. */
        const riddleRef = firebaseAdmin_1.admin.firestore().collection(firestoreSchemas_1.RiddleCollections.RIDDLES).doc(docId);
        /** Provides riddle data behavior. */
        const riddleData = {
            riddleId: docId,
            text: riddle.question,
            answer: riddle.answer,
            ...(riddle.difficultyBand ? { difficultyBand: riddle.difficultyBand } : {}),
            classicIndex: startingIndex + index,
            category: "classic",
        };
        batch.set(riddleRef, riddleData);
    });
    try {
        await batch.commit();
        v2_1.logger.info(`Successfully stored ${riddles.length} new classic riddles in Firestore.`);
    }
    catch (error) {
        v2_1.logger.error("Error storing classic riddles in Firestore.", (0, errorMetadata_1.getSafeErrorMetadata)(error));
        (0, sentry_1.captureException)(error);
        throw new Error("Failed to store classic riddles in Firestore.");
    }
}
/** Stores localized classic riddles in firestore. */
async function storeLocalizedClassicRiddlesInFirestore(locale, riddles, startingIndex) {
    /** Provides batch behavior. */
    const batch = firebaseAdmin_1.admin.firestore().batch();
    riddles.forEach((riddle, index) => {
        /** Provides doc id behavior. */
        const docId = `classic_${startingIndex + index}`;
        /** Provides riddle ref behavior. */
        const riddleRef = (0, exports.getLocalizedClassicDocRef)(locale, docId);
        /** Provides riddle data behavior. */
        const riddleData = {
            riddleId: docId,
            canonicalKey: (0, exports.getLocalizedCanonicalKey)("classic", startingIndex + index, locale),
            locale,
            text: riddle.question,
            answer: riddle.answer,
            ...(riddle.difficultyBand ? { difficultyBand: riddle.difficultyBand } : {}),
            classicIndex: startingIndex + index,
            category: "classic",
        };
        batch.create(riddleRef, riddleData);
    });
    try {
        await batch.commit();
        v2_1.logger.info(`Successfully stored ${riddles.length} new classic riddles in Firestore for locale ${locale}.`);
    }
    catch (error) {
        v2_1.logger.error(`Error storing classic riddles in Firestore for locale ${locale}.`, (0, errorMetadata_1.getSafeErrorMetadata)(error));
        (0, sentry_1.captureException)(error);
        throw new Error(`Failed to store classic riddles in Firestore for locale ${locale}.`);
    }
}
/**
 * Gets the next available daily index for new daily riddles.
 * @returns The next available daily index.
 */
async function getNextDailyIndex() {
    try {
        /** Provides current doc behavior. */
        const currentDoc = await firebaseAdmin_1.admin.firestore().collection(firestoreSchemas_1.RiddleCollections.DAILY_RIDDLES).doc("current").get();
        if (!currentDoc.exists) {
            return 0;
        }
        /** Provides highest index behavior. */
        const highestIndex = currentDoc.data()?.dailyIndex || 0;
        return highestIndex + 1;
    }
    catch (error) {
        v2_1.logger.error("Error getting next daily index.", (0, errorMetadata_1.getSafeErrorMetadata)(error));
        (0, sentry_1.captureException)(error);
        throw new Error("Failed to get next daily index.");
    }
}
/**
 * Stores generated daily riddles in the dailyRiddles collection.
 * @param riddles - An array of riddle objects to store.
 * @param startingIndex - The starting daily index for the riddles.
 */
async function storeDailyRiddlesInFirestore(riddles, startingIndex) {
    if (riddles.length === 0) {
        v2_1.logger.warn("No daily riddles provided to store.");
        return;
    }
    if (riddles.length > 1) {
        v2_1.logger.warn(`Received ${riddles.length} daily riddles, but schema supports only one. Keeping the first and overwriting dailyRiddles/current.`);
    }
    /** Provides selected riddle behavior. */
    const selectedRiddle = riddles[0];
    /** Provides riddle ref behavior. */
    const riddleRef = firebaseAdmin_1.admin.firestore().collection(firestoreSchemas_1.RiddleCollections.DAILY_RIDDLES).doc("current");
    /** Provides riddle data behavior. */
    const riddleData = {
        riddleId: "current",
        text: selectedRiddle.question,
        answer: selectedRiddle.answer,
        ...(selectedRiddle.difficultyBand ? { difficultyBand: selectedRiddle.difficultyBand } : {}),
        dailyIndex: startingIndex,
        category: "daily",
        timestamp: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
    };
    try {
        await riddleRef.set(riddleData);
        v2_1.logger.info("Successfully stored daily riddle in dailyRiddles/current.");
    }
    catch (error) {
        v2_1.logger.error("Error storing daily riddles in Firestore.", (0, errorMetadata_1.getSafeErrorMetadata)(error));
        (0, sentry_1.captureException)(error);
        throw new Error("Failed to store daily riddles in Firestore.");
    }
}
//# sourceMappingURL=riddleGenerationRepository.js.map