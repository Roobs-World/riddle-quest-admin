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
exports.getClassicRiddleByIndex = getClassicRiddleByIndex;
exports.getDailyRiddle = getDailyRiddle;
exports.getRiddle = getRiddle;
exports.getRiddleByGameMode = getRiddleByGameMode;
const functions = __importStar(require("firebase-functions"));
const validation_1 = require("@qwordly/core/validation");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
/** Defines the localized riddles collection value. */
const LOCALIZED_RIDDLES_COLLECTION = "localizedRiddles";
/** Defines the localized riddle subcollection value. */
const LOCALIZED_RIDDLE_SUBCOLLECTION = "riddles";
/** Provides db instance behavior. */
let dbInstance;
/** Gets db. */
function getDb() {
    dbInstance ??= firebaseAdmin_1.admin.firestore();
    return dbInstance;
}
/** Gets localized riddle collection path. */
const getLocalizedRiddleCollectionPath = (locale) => `${LOCALIZED_RIDDLES_COLLECTION}/${locale}/${LOCALIZED_RIDDLE_SUBCOLLECTION}`;
/** Resolves locale. */
const resolveLocale = (locale) => (validation_1.SUPPORTED_LOCALES.find((entry) => entry === locale) ?? "en");
/** Gets classic riddle. */
async function getClassicRiddle(riddleId, locale) {
    /** Resolves d locale. */
    const resolvedLocale = resolveLocale(locale);
    /** Provides localized doc behavior. */
    const localizedDoc = await getDb().collection(getLocalizedRiddleCollectionPath(resolvedLocale)).doc(riddleId).get();
    if (!localizedDoc.exists) {
        functions.logger.info(`Classic riddle document not found for ID ${riddleId} in locale ${resolvedLocale}`);
        return undefined;
    }
    /** Provides data behavior. */
    const data = localizedDoc.data();
    if (!data) {
        functions.logger.info(`Classic riddle data is null for ID ${riddleId} in locale ${resolvedLocale}`);
        return undefined;
    }
    /** Provides riddle data behavior. */
    const riddleData = data;
    return { ...riddleData, riddleId: riddleData.riddleId || riddleId, locale: riddleData.locale || resolvedLocale };
}
/** Gets classic riddle by index. */
async function getClassicRiddleByIndex(classicIndex, locale) {
    /** Resolves d locale. */
    const resolvedLocale = resolveLocale(locale);
    /** Provides snapshot behavior. */
    const snapshot = await getDb()
        .collection(getLocalizedRiddleCollectionPath(resolvedLocale))
        .where("classicIndex", "==", classicIndex)
        .limit(1)
        .get();
    if (snapshot.empty) {
        functions.logger.info(`Classic riddle document not found for index ${classicIndex} in locale ${resolvedLocale}`);
        return undefined;
    }
    /** Provides doc behavior. */
    const doc = snapshot.docs[0];
    /** Provides data behavior. */
    const data = doc.data();
    if (!data) {
        functions.logger.info(`Classic riddle data is null for index ${classicIndex} in locale ${resolvedLocale}`);
        return undefined;
    }
    /** Provides riddle data behavior. */
    const riddleData = data;
    return { ...riddleData, riddleId: riddleData.riddleId || doc.id, locale: riddleData.locale || resolvedLocale };
}
/** Gets daily riddle. */
async function getDailyRiddle(riddleId, locale) {
    /** Resolves d locale. */
    const resolvedLocale = resolveLocale(locale);
    /** Provides localized doc behavior. */
    const localizedDoc = await getDb().collection(getLocalizedRiddleCollectionPath(resolvedLocale)).doc(riddleId).get();
    if (!localizedDoc.exists) {
        functions.logger.info(`Daily riddle document not found for ID ${riddleId} in locale ${resolvedLocale}`);
        return undefined;
    }
    /** Provides data behavior. */
    const data = localizedDoc.data();
    if (!data) {
        functions.logger.info(`Daily riddle data is null for ID ${riddleId} in locale ${resolvedLocale}`);
        return undefined;
    }
    /** Provides riddle data behavior. */
    const riddleData = data;
    return { ...riddleData, riddleId: riddleData.riddleId || riddleId, locale: riddleData.locale || resolvedLocale };
}
/** Gets riddle. */
async function getRiddle(riddleId) {
    /** Provides classic riddle behavior. */
    const classicRiddle = await getClassicRiddle(riddleId);
    if (classicRiddle)
        return classicRiddle;
    /** Provides daily riddle behavior. */
    const dailyRiddle = await getDailyRiddle(riddleId);
    if (dailyRiddle)
        return dailyRiddle;
    functions.logger.info(`Riddle document not found for ID ${riddleId} in any collection`);
    return undefined;
}
/** Gets riddle by game mode. */
async function getRiddleByGameMode(riddleId, gameMode, locale) {
    if (gameMode === "classic")
        return getClassicRiddle(riddleId, locale);
    if (gameMode === "challenge")
        return getDailyRiddle(riddleId, locale);
    functions.logger.warn(`Unknown game mode: ${gameMode}`);
    return undefined;
}
//# sourceMappingURL=riddleRepository.js.map