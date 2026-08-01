import {admin} from "./firebaseAdmin";
import * as functions from "firebase-functions";
import type {SupportedLocale} from "@qwordly/core/validation";
import {RIDDLE_GENERATION_BATCH_SIZE, RIDDLE_GENERATION_THRESHOLD} from "./constants";
import * as riddleGeneration from "./riddleGeneration";
import {captureException} from "./sentry";

/** Replenishes localized classic riddles when a player nears the end of supply. */
export async function triggerClassicRiddleGenerationIfNeeded(
  userId: string,
  currentClassicIndex: number,
  locale: SupportedLocale,
): Promise<void> {
  try {
    const collection = `localizedRiddles/${locale}/riddles`;
    const snapshot = await admin.firestore().collection(collection).where("classicIndex", ">=", 0).get();
    const remaining = snapshot.size - currentClassicIndex;

    functions.logger.info(
      `User ${userId} currentClassicIndex: ${currentClassicIndex}, totalClassicRiddles: ${snapshot.size}, remainingClassicRiddles: ${remaining}`,
    );

    if (remaining > RIDDLE_GENERATION_THRESHOLD) return;

    functions.logger.info(
      `User ${userId} has <= ${RIDDLE_GENERATION_THRESHOLD} classic riddles remaining. Triggering generation of ${RIDDLE_GENERATION_BATCH_SIZE} new riddles.`,
    );
    try {
      await (riddleGeneration.generateLocalizedClassicRiddles ?? riddleGeneration.generateAndAppendRiddles)(
        RIDDLE_GENERATION_BATCH_SIZE,
      );
      functions.logger.info(
        `Successfully triggered generation of ${RIDDLE_GENERATION_BATCH_SIZE} new classic riddles.`,
      );
    } catch (error) {
      functions.logger.error("Error triggering generation of new classic riddles:", error);
      captureException(error);
    }
  } catch (error) {
    functions.logger.error("Error checking classic riddle count:", error);
    captureException(error);
  }
}
