import {logger} from "firebase-functions";
import {admin} from "../shared/firebaseAdmin";
import {onScheduleWithSentry} from "../shared/sentryHandlers";
import {purgeExpiredRedditProfilePage} from "./redditProfileRetention";

/** Clears one bounded Reddit cache page while containing all private storage diagnostics. */
export async function redditProfileRetentionHandler(): Promise<void> {
  try {
    /** Profile cleanup remains necessary independently of optional feature switches. */
    const result = await purgeExpiredRedditProfilePage(admin.firestore(), Date.now(), true);
    logger.info("Reddit profile retention page finished.", result);
    if (result.invalid > 0) throw new Error("reddit-profile-retention-page-incomplete");
  } catch {
    throw new Error("Reddit profile retention failed; inspect aggregate page evidence.");
  }
}

/** Overlapping/retried invocations clear fields idempotently without expiring permanent identities. */
export const redditProfileRetentionScheduler = onScheduleWithSentry(
  "redditProfileRetentionScheduler",
  {schedule: "29 * * * *", timeZone: "UTC", region: "us-central1", timeoutSeconds: 120,
    memory: "256MiB", maxInstances: 1, concurrency: 1, retryCount: 2},
  redditProfileRetentionHandler,
);
