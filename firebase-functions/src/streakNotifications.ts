/**
 * @fileoverview Daily streak reminder notifications for Qwordly.
 *
 * A scheduled Cloud Function runs at 18:00 UTC every day. It queries all users
 * who have an FCM token registered, skips those who have already completed
 * today's daily challenge or already received a reminder today, and sends each
 * remaining user a personalised push notification whose copy is tailored to
 * their current win streak.
 *
 * Schema additions:
 *  - `users/{uid}.lastStreakReminderSentAt` (number, epoch ms) — updated after
 *    each successful send so we never send more than one reminder per user per day.
 *
 * History:
 *  - Each sent/failed attempt is recorded in `notificationHistory` (server-only).
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {onSchedule, ScheduledEvent} from "firebase-functions/v2/scheduler";
import {captureException} from "./sentry";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StreakReminderResult {
  /** Number of notifications successfully sent. */
  sent: number;
  /** Number of users skipped by eligibility checks. */
  skipped: number;
  /** Number of failed send attempts. */
  failed: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy helpers
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationCopy {
  /** Notification title text. */
  title: string;
  /** Notification body text. */
  body: string;
}

/**
 * Returns a personalised notification title and body based on the user's
 * current win streak.
 */
export function buildStreakReminderCopy(winStreak: number): NotificationCopy {
  if (winStreak >= 14) {
    return {
      title: "🔥 Don't break your legendary streak!",
      body: `${winStreak} days straight! Today's challenge is waiting — keep the fire alive.`,
    };
  }
  if (winStreak >= 7) {
    return {
      title: "🔥 Don't break your streak!",
      body: `You're on a ${winStreak}-day streak. Keep it going with today's challenge!`,
    };
  }
  if (winStreak >= 3) {
    return {
      title: "⚡ Your streak is building!",
      body: `${winStreak} days in a row — complete today's challenge to keep it up!`,
    };
  }
  if (winStreak > 0) {
    return {
      title: "📅 Daily Challenge awaits!",
      body: `You're on a ${winStreak}-day streak. Don't miss today's riddles!`,
    };
  }
  return {
    title: "🧩 Today's challenge is ready!",
    body: "Can you solve all 5 of today's riddles? Start your streak now!",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core logic (exported for unit tests)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends streak reminders to all eligible users for the given UTC date string
 * (format: "YYYY-MM-DD").
 *
 * A user is eligible if:
 *  1. They have an FCM token registered (`fcmToken` field is a non-empty string).
 *  2. They have NOT completed today's daily challenge
 *     (`lastDailyChallengeCompletedAt` is absent or before today's midnight UTC).
 *  3. They have NOT already received a reminder today
 *     (`lastStreakReminderSentAt` is absent or before today's midnight UTC).
 */
export async function sendStreakReminders(todayUtcDate: string): Promise<StreakReminderResult> {
  const db = admin.firestore();
  const todayMidnightUtc = new Date(todayUtcDate + "T00:00:00.000Z").getTime();
  const now = Date.now();

  // Firestore: `>= ""` returns all documents where fcmToken is a non-empty string.
  // Documents without the field are automatically excluded.
  const snapshot = await db.collection("users").where("fcmToken", ">=", "a").get();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const messaging = admin.messaging();
  const writeBatch = db.batch();
  let batchHasWrites = false;

  for (const doc of snapshot.docs) {
    const user = doc.data();
    const fcmToken = user.fcmToken as string | undefined;

    if (!fcmToken) {
      skipped++;
      continue;
    }

    // Skip if already completed today's challenge
    const lastCompleted = user.lastDailyChallengeCompletedAt as number | undefined;
    if (lastCompleted !== undefined && lastCompleted >= todayMidnightUtc) {
      skipped++;
      continue;
    }

    // Skip if already received a reminder today
    const lastReminder = user.lastStreakReminderSentAt as number | undefined;
    if (lastReminder !== undefined && lastReminder >= todayMidnightUtc) {
      skipped++;
      continue;
    }

    const winStreak = (user.stats?.winStreak as number | undefined) ?? 0;
    const {title, body} = buildStreakReminderCopy(winStreak);

    try {
      await messaging.send({
        token: fcmToken,
        notification: {title, body},
        data: {type: "streak_reminder", date: todayUtcDate},
      });

      // Record in notification history
      const historyRef = db.collection("notificationHistory").doc();
      writeBatch.set(historyRef, {
        id: historyRef.id,
        type: "streak_reminder",
        userId: doc.id,
        fcmToken,
        title,
        body,
        status: "sent",
        date: todayUtcDate,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Stamp the user so we don't send again today
      writeBatch.update(doc.ref, {lastStreakReminderSentAt: now});
      batchHasWrites = true;

      sent++;
    } catch (err) {
      functions.logger.warn(`[StreakReminder] Failed to send to user ${doc.id}:`, err);
      captureException(err, {userId: doc.id, fn: "sendStreakReminders"});
      failed++;
    }
  }

  if (batchHasWrites) {
    await writeBatch.commit();
  }

  functions.logger.info(
    `[StreakReminder] ${todayUtcDate}: sent=${sent}, skipped=${skipped}, failed=${failed}`,
  );

  return {sent, skipped, failed};
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scheduled handler (exported for testing).
 */
export const streakReminderHandler = async (_context: ScheduledEvent): Promise<void> => {
  const todayUtcDate = new Date().toISOString().split("T")[0];
  functions.logger.info(`[StreakReminder] Starting for ${todayUtcDate}`);

  try {
    const result = await sendStreakReminders(todayUtcDate);
    functions.logger.info(
      `[StreakReminder] Finished: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed`,
    );
  } catch (err) {
    functions.logger.error("[StreakReminder] Unhandled error:", err);
    captureException(err);
    throw err;
  }
};

/**
 * Cloud Function: runs daily at 18:00 UTC to send streak reminders.
 * 18:00 UTC is typically early evening in most time zones (morning in Pacific,
 * late afternoon in Europe, evening in Asia) — a good time to prompt users.
 */
export const dailyStreakReminder = onSchedule(
  {
    schedule: "0 18 * * *",
    timeZone: "UTC",
  },
  streakReminderHandler,
);
