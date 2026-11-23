import type {Firestore} from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import {type SupportedLocale, SUPPORTED_LOCALES} from "../../../src/core/validation/index.js";
import {admin} from "../shared/firebaseAdmin";
import type {ClassicRiddle, DailyRiddle, FirestoreRiddle} from "../validation/firestoreSchemas";

/** Defines the localized riddles collection value. */
const LOCALIZED_RIDDLES_COLLECTION = "localizedRiddles";
/** Defines the localized riddle subcollection value. */
const LOCALIZED_RIDDLE_SUBCOLLECTION = "riddles";

/** Provides db instance behavior. */
let dbInstance: Firestore;

/** Gets db. */
function getDb(): Firestore {
  dbInstance ??= admin.firestore();
  return dbInstance;
}

/** Gets localized riddle collection path. */
const getLocalizedRiddleCollectionPath = (locale: SupportedLocale): string =>
  `${LOCALIZED_RIDDLES_COLLECTION}/${locale}/${LOCALIZED_RIDDLE_SUBCOLLECTION}`;

/** Resolves locale. */
const resolveLocale = (locale?: string): SupportedLocale =>
  (SUPPORTED_LOCALES.find((entry) => entry === locale) ?? "en") as SupportedLocale;

/** Gets classic riddle. */
async function getClassicRiddle(riddleId: string, locale?: string): Promise<ClassicRiddle | undefined> {
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
  const riddleData = data as ClassicRiddle;
  return {...riddleData, riddleId: riddleData.riddleId || riddleId, locale: riddleData.locale || resolvedLocale};
}

/** Gets classic riddle by index. */
export async function getClassicRiddleByIndex(
  classicIndex: number,
  locale?: string,
): Promise<ClassicRiddle | undefined> {
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
  const riddleData = data as ClassicRiddle;
  return {...riddleData, riddleId: riddleData.riddleId || doc.id, locale: riddleData.locale || resolvedLocale};
}

/** Gets daily riddle. */
export async function getDailyRiddle(riddleId: string, locale?: string): Promise<DailyRiddle | undefined> {
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
  const riddleData = data as DailyRiddle;
  return {...riddleData, riddleId: riddleData.riddleId || riddleId, locale: riddleData.locale || resolvedLocale};
}

/** Gets riddle. */
export async function getRiddle(riddleId: string): Promise<FirestoreRiddle | undefined> {
  /** Provides classic riddle behavior. */
  const classicRiddle = await getClassicRiddle(riddleId);
  if (classicRiddle) return classicRiddle;
  /** Provides daily riddle behavior. */
  const dailyRiddle = await getDailyRiddle(riddleId);
  if (dailyRiddle) return dailyRiddle;
  functions.logger.info(`Riddle document not found for ID ${riddleId} in any collection`);
  return undefined;
}

/** Gets riddle by game mode. */
export async function getRiddleByGameMode(
  riddleId: string,
  gameMode: "classic" | "challenge",
  locale?: string,
): Promise<FirestoreRiddle | undefined> {
  if (gameMode === "classic") return getClassicRiddle(riddleId, locale);
  if (gameMode === "challenge") return getDailyRiddle(riddleId, locale);
  functions.logger.warn(`Unknown game mode: ${gameMode}`);
  return undefined;
}
