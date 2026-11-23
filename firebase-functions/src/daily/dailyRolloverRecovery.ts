import {getDailyDate, shiftDailyDate} from "../../../src/gameplay/daily/dailyCalendar.js";
import {getUser} from "../gameplay/firestoreService";
import {getSinglePlayerCompletionKey} from "../gameplay/sessions/singlePlayerAnswerPolicy";
import {recoverPendingAuthoritativeCompletion} from "../gameplay/sessions/singlePlayerTerminalRecovery";

/** Recovers a just-finished previous-day win when local resume data was lost. */
export async function reconcilePreviousDailyBinding(
  userId: string,
  user: NonNullable<Awaited<ReturnType<typeof getUser>>>,
  isAnonymous: boolean,
  locale = "UTC",
): Promise<NonNullable<Awaited<ReturnType<typeof getUser>>>> {
  /** Provides now behavior. */
  const now = new Date();
  /** Provides today behavior. */
  const today = getDailyDate(locale, now);
  // The authority checks the saved session's locale and grace window. A newly
  // selected locale must not discard a valid terminal from another clock.
  if (user.lastDailyChallengeAttemptedKey === today) return user;
  /** Previous calendar day rather than a fixed 24-hour subtraction across DST. */
  const challengeDate = shiftDailyDate(today, -1);
  /** Provides recovered behavior. */
  const recovered = await recoverPendingAuthoritativeCompletion(
    userId,
    "challenge",
    getSinglePlayerCompletionKey("challenge", challengeDate),
    isAnonymous,
    now,
  );
  if (!recovered) return user;
  return (await getUser(userId)) ?? user;
}
