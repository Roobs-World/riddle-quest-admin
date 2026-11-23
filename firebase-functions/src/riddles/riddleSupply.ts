import {admin} from "../shared/firebaseAdmin";
import * as functions from "firebase-functions";
import type {SupportedLocale} from "../../../src/core/validation/index.js";
import {RIDDLE_GENERATION_THRESHOLD} from "../shared/constants";
import {captureException} from "../shared/sentry";

/** Defines the riddle supply requests collection value. */
const RIDDLE_SUPPLY_REQUESTS_COLLECTION = "classicSupplyJobs";

/** Indicates whether is already exists error. */
function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  /** Provides code behavior. */
  const code = (
    error as {
      /** Stores code. */
      code?: string | number;
    }
  ).code;
  return code === 6 || code === "already-exists" || code === "6";
}

/** Durably requests localized supply without running the model in a player request. */
export async function triggerClassicRiddleGenerationIfNeeded(
  userId: string,
  currentClassicIndex: number,
  locale: SupportedLocale,
): Promise<void> {
  try {
    /** Provides collection behavior. */
    const collection = `localizedRiddles/${locale}/riddles`;
    /** Highest-index discovery excludes unused text, answers and provenance from the backend payload. */
    const snapshot = await admin
      .firestore()
      .collection(collection)
      .where("classicIndex", ">=", 0)
      .orderBy("classicIndex", "desc")
      .limit(1)
      .select("classicIndex")
      .get();
    /** Provides highest classic index behavior. */
    const highestClassicIndex = snapshot.empty ? -1 : Number(snapshot.docs[0]?.data().classicIndex ?? -1);
    /** Provides remaining behavior. */
    const remaining = highestClassicIndex - currentClassicIndex;

    functions.logger.info(
      `User ${userId} currentClassicIndex: ${currentClassicIndex}, highestClassicIndex: ${highestClassicIndex}, remainingClassicRiddles: ${remaining}`,
    );

    if (remaining > RIDDLE_GENERATION_THRESHOLD) return;

    /** Requests ref. */
    const requestRef = admin
      .firestore()
      .collection(RIDDLE_SUPPLY_REQUESTS_COLLECTION)
      .doc(`${locale}_${highestClassicIndex}`);
    try {
      await requestRef.create({
        locale,
        highestClassicIndex,
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        nextAttemptAtMs: 0,
      });
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        // Player activity can restart a request after Eventarc's retry window has expired.
        await admin.firestore().runTransaction(async transaction => {
          /** Existing deterministic request inspected before reactivation. */
          const snapshot = await transaction.get(requestRef);
          /** Persisted completion and retry state owned by the worker. */
          const current = snapshot.data();
          /** Server clock shared by the retry and outage-age checks. */
          const nowMs = Date.now();
          if (!snapshot.exists || current?.completed === true || current?.nextAttemptAtMs > nowMs) return;
          /** Most recent activation determines the minimum recovery interval. */
          const requestedAtMs = current?.requeuedAtMs ?? current?.requestedAt?.toMillis?.();
          if (!Number.isFinite(requestedAtMs) || nowMs - requestedAtMs < 24 * 60 * 60 * 1000) return;
          transaction.update(requestRef, {requeuedAtMs: nowMs, nextAttemptAtMs: nowMs});
        });
        functions.logger.info(`Riddle replenishment is already claimed for ${locale} at ${highestClassicIndex}.`);
        return;
      }
      throw error;
    }

    functions.logger.info("Queued Classic replenishment without delaying gameplay.", {locale, highestClassicIndex});
  } catch (error) {
    functions.logger.error("Error checking classic riddle count:", error);
    captureException(error);
  }
}
