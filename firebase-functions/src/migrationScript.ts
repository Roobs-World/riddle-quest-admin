import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {RiddleCollections, ClassicRiddle, DailyRiddle, TutorialRiddle} from "./validation/firestoreSchemas";

/**
 * Migrates existing riddles from the single riddles collection to separate collections
 * based on their type (classicIndex, dailyIndex, or category).
 */
export async function migrateRiddlesToSeparateCollections(): Promise<{
  classicMigrated: number;
  dailyMigrated: number;
  tutorialMigrated: number;
  errors: string[];
}> {
  const results = {
    classicMigrated: 0,
    dailyMigrated: 0,
    tutorialMigrated: 0,
    errors: [] as string[],
  };

  try {
    // Get all riddles from the original collection
    const riddlesSnapshot = await admin.firestore().collection("riddles").get();

    if (riddlesSnapshot.empty) {
      functions.logger.info("No riddles found in the original collection to migrate.");
      return results;
    }

    const batch = admin.firestore().batch();
    let batchCount = 0;
    const maxBatchSize = 500; // Firestore batch limit

    for (const doc of riddlesSnapshot.docs) {
      const data = doc.data();

      try {
        // Determine the type of riddle and migrate accordingly
        if (data.classicIndex !== undefined) {
          // Classic riddle
          const classicRiddle: ClassicRiddle = {
            riddleId: doc.id,
            text: data.text,
            answer: data.answer,
            classicIndex: data.classicIndex,
            difficulty: data.difficulty,
            category: "classic",
          };

          const newRef = admin.firestore().collection(RiddleCollections.RIDDLES).doc(doc.id);
          batch.set(newRef, classicRiddle);
          results.classicMigrated++;
        } else if (data.dailyIndex !== undefined) {
          // Daily riddle
          const dailyRiddle: DailyRiddle = {
            riddleId: doc.id,
            text: data.text,
            answer: data.answer,
            dailyIndex: data.dailyIndex,
            difficulty: data.difficulty,
            category: "daily",
          };

          const newRef = admin.firestore().collection(RiddleCollections.DAILY_RIDDLES).doc(doc.id);
          batch.set(newRef, dailyRiddle);
          results.dailyMigrated++;
        } else if (data.category === "tutorial" || data.tutorialIndex !== undefined) {
          // Tutorial riddle
          const tutorialRiddle: TutorialRiddle = {
            riddleId: doc.id,
            text: data.text,
            answer: data.answer,
            tutorialIndex: data.tutorialIndex || 0,
            difficulty: data.difficulty,
            category: "tutorial",
          };

          const newRef = admin.firestore().collection(RiddleCollections.TUTORIAL_RIDDLES).doc(doc.id);
          batch.set(newRef, tutorialRiddle);
          results.tutorialMigrated++;
        } else if (data.category === "daily-challenge" || data.category === "daily") {
          // Daily challenge riddle (from old system)
          const dailyRiddle: DailyRiddle = {
            riddleId: doc.id,
            text: data.text,
            answer: data.answer,
            dailyIndex: data.dailyIndex || 0,
            difficulty: data.difficulty,
            category: "daily",
          };

          const newRef = admin.firestore().collection(RiddleCollections.DAILY_RIDDLES).doc(doc.id);
          batch.set(newRef, dailyRiddle);
          results.dailyMigrated++;
        } else {
          // Default to classic riddle if no clear type
          const classicRiddle: ClassicRiddle = {
            riddleId: doc.id,
            text: data.text,
            answer: data.answer,
            classicIndex: data.classicIndex || 0,
            difficulty: data.difficulty,
            category: "classic",
          };

          const newRef = admin.firestore().collection(RiddleCollections.RIDDLES).doc(doc.id);
          batch.set(newRef, classicRiddle);
          results.classicMigrated++;
        }

        batchCount++;

        // Commit batch if it's getting full
        if (batchCount >= maxBatchSize) {
          await batch.commit();
          functions.logger.info(`Committed batch of ${batchCount} riddles`);
          batchCount = 0;
        }
      } catch (error) {
        const errorMessage = `Error migrating riddle ${doc.id}: ${error}`;
        functions.logger.error(errorMessage);
        results.errors.push(errorMessage);
      }
    }

    // Commit any remaining items in the batch
    if (batchCount > 0) {
      await batch.commit();
      functions.logger.info(`Committed final batch of ${batchCount} riddles`);
    }

    functions.logger.info(
      `Migration completed: ${results.classicMigrated} classic, ${results.dailyMigrated} daily, ${results.tutorialMigrated} tutorial riddles migrated`,
    );
    return results;
  } catch (error) {
    const errorMessage = `Migration failed: ${error}`;
    functions.logger.error(errorMessage);
    results.errors.push(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Removes riddles from the original collection after successful migration.
 * This should only be called after confirming the migration was successful.
 */
export async function cleanupOriginalRiddlesCollection(): Promise<{
  riddlesDeleted: number;
  errors: string[];
}> {
  const results = {
    riddlesDeleted: 0,
    errors: [] as string[],
  };

  try {
    // Get all riddles from the original collection
    const riddlesSnapshot = await admin.firestore().collection("riddles").get();

    if (riddlesSnapshot.empty) {
      functions.logger.info("No riddles found in the original collection to clean up.");
      return results;
    }

    const batch = admin.firestore().batch();
    let batchCount = 0;
    const maxBatchSize = 500; // Firestore batch limit

    for (const doc of riddlesSnapshot.docs) {
      batch.delete(doc.ref);
      results.riddlesDeleted++;
      batchCount++;

      // Commit batch if it's getting full
      if (batchCount >= maxBatchSize) {
        await batch.commit();
        functions.logger.info(`Deleted batch of ${batchCount} riddles`);
        batchCount = 0;
      }
    }

    // Commit any remaining items in the batch
    if (batchCount > 0) {
      await batch.commit();
      functions.logger.info(`Deleted final batch of ${batchCount} riddles`);
    }

    functions.logger.info(`Cleanup completed: ${results.riddlesDeleted} riddles deleted from original collection`);
    return results;
  } catch (error) {
    const errorMessage = `Cleanup failed: ${error}`;
    functions.logger.error(errorMessage);
    results.errors.push(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Validates that the migration was successful by comparing counts.
 */
export async function validateMigration(): Promise<{
  originalCount: number;
  classicCount: number;
  dailyCount: number;
  tutorialCount: number;
  totalMigrated: number;
  isValid: boolean;
  errors: string[];
}> {
  const results = {
    originalCount: 0,
    classicCount: 0,
    dailyCount: 0,
    tutorialCount: 0,
    totalMigrated: 0,
    isValid: false,
    errors: [] as string[],
  };

  try {
    // Count riddles in original collection
    const originalSnapshot = await admin.firestore().collection("riddles").count().get();
    results.originalCount = originalSnapshot.data().count;

    // Count riddles in new collections
    const classicSnapshot = await admin.firestore().collection(RiddleCollections.RIDDLES).count().get();
    results.classicCount = classicSnapshot.data().count;

    const dailySnapshot = await admin.firestore().collection(RiddleCollections.DAILY_RIDDLES).count().get();
    results.dailyCount = dailySnapshot.data().count;

    const tutorialSnapshot = await admin.firestore().collection(RiddleCollections.TUTORIAL_RIDDLES).count().get();
    results.tutorialCount = tutorialSnapshot.data().count;

    results.totalMigrated = results.classicCount + results.dailyCount + results.tutorialCount;
    results.isValid = results.originalCount === results.totalMigrated;

    if (!results.isValid) {
      const errorMessage = `Migration validation failed: Original count (${results.originalCount}) does not match total migrated (${results.totalMigrated})`;
      results.errors.push(errorMessage);
    }

    return results;
  } catch (error) {
    const errorMessage = `Validation failed: ${error}`;
    functions.logger.error(errorMessage);
    results.errors.push(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Callable function to migrate riddles to separate collections.
 * This should be called once to migrate existing data.
 */
export const migrateRiddleCollections = onCall(
  {},
  async (): Promise<{
    success: boolean;
    migration: {
      classicMigrated: number;
      dailyMigrated: number;
      tutorialMigrated: number;
      errors: string[];
    };
    validation: {
      originalCount: number;
      classicCount: number;
      dailyCount: number;
      tutorialCount: number;
      totalMigrated: number;
      isValid: boolean;
      errors: string[];
    };
  }> => {
    try {
      functions.logger.info("Starting riddle collection migration...");

      // Perform the migration
      const migrationResults = await migrateRiddlesToSeparateCollections();

      // Validate the migration
      const validationResults = await validateMigration();

      const success = migrationResults.errors.length === 0 && validationResults.isValid;

      if (success) {
        functions.logger.info("Migration completed successfully!");
      } else {
        functions.logger.error("Migration completed with errors or validation failed");
      }

      return {
        success,
        migration: migrationResults,
        validation: validationResults,
      };
    } catch (error) {
      functions.logger.error("Migration failed:", error);
      throw new HttpsError("internal", "Migration failed", error);
    }
  },
);

/**
 * Callable function to clean up the original riddles collection.
 * This should only be called after confirming the migration was successful.
 */
export const cleanupOriginalRiddles = onCall(
  {},
  async (): Promise<{
    success: boolean;
    riddlesDeleted: number;
    errors: string[];
  }> => {
    try {
      functions.logger.info("Starting cleanup of original riddles collection...");

      // First validate that migration was successful
      const validation = await validateMigration();
      if (!validation.isValid) {
        throw new HttpsError("failed-precondition", "Cannot cleanup: Migration validation failed");
      }

      // Perform the cleanup
      const cleanupResults = await cleanupOriginalRiddlesCollection();

      const success = cleanupResults.errors.length === 0;

      if (success) {
        functions.logger.info("Cleanup completed successfully!");
      } else {
        functions.logger.error("Cleanup completed with errors");
      }

      return {
        success,
        riddlesDeleted: cleanupResults.riddlesDeleted,
        errors: cleanupResults.errors,
      };
    } catch (error) {
      functions.logger.error("Cleanup failed:", error);
      throw new HttpsError("internal", "Cleanup failed", error);
    }
  },
);
