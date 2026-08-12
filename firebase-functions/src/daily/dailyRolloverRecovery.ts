import {getUser} from "../gameplay/firestoreService";
import {getSinglePlayerCompletionKey} from "../gameplay/singlePlayerAnswerPolicy";
import {DAILY_COMPLETION_ROLLOVER_GRACE_MS} from "../gameplay/completeGameLogic";
import {recoverPendingAuthoritativeCompletion} from "../gameplay/singlePlayerTerminalRecovery";

/** Recovers a just-finished previous-day win when local resume data was lost. */
export async function reconcilePreviousDailyBinding(
  userId: string,
  user: NonNullable<Awaited<ReturnType<typeof getUser>>>,
  isAnonymous: boolean,
): Promise<NonNullable<Awaited<ReturnType<typeof getUser>>>> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const todayStart = new Date(`${today}T00:00:00.000Z`);
  if (now.getTime() - todayStart.getTime() > DAILY_COMPLETION_ROLLOVER_GRACE_MS ||
    user.lastDailyChallengeAttemptedKey === today) return user;
  const previousDate = new Date(todayStart);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const challengeDate = previousDate.toISOString().slice(0, 10);
  const recovered = await recoverPendingAuthoritativeCompletion(
    userId,
    "challenge",
    getSinglePlayerCompletionKey("challenge", challengeDate),
    isAnonymous,
    now,
  );
  if (!recovered) return user;
  return await getUser(userId) ?? user;
}
