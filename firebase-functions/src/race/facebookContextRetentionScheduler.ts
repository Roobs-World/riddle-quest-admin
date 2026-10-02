import {logger} from "firebase-functions";
import {admin} from "../shared/firebaseAdmin";
import {onScheduleWithSentry} from "../shared/sentryHandlers";
import {purgeExpiredFacebookContextPage} from "./facebookContextRetention";

/** Runs bounded Facebook-only cleanup without exposing provider/storage diagnostics. */
export async function facebookContextRetentionHandler(): Promise<void> {
  try {
    /** At most twenty boards and fifty score entries per board are eligible per invocation. */
    const result = await purgeExpiredFacebookContextPage(admin.firestore(), Date.now(), true);
    logger.info("Facebook context retention page finished.", result);
    if (result.invalid > 0) throw new Error("facebook-context-retention-page-incomplete");
  } catch {
    throw new Error("Facebook context retention failed; inspect aggregate page evidence.");
  }
}

/** Hourly cleanup is idempotent under repeated/overlapping scheduler delivery and context rollover. */
export const facebookContextRetentionScheduler = onScheduleWithSentry(
  "facebookContextRetentionScheduler",
  {schedule: "17 * * * *", timeZone: "UTC", region: "us-central1", timeoutSeconds: 120,
    memory: "256MiB", maxInstances: 1, concurrency: 1, retryCount: 2},
  facebookContextRetentionHandler,
);
