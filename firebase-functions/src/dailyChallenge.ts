import * as functions from "firebase-functions";
import * as admin from "firebase-admin"; // Added for Firestore access
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {updateUserLastCompletedDailyChallengeDate, getUser} from "./firestoreService";
import {generateTodaysDailyChallenge} from "./riddleGeneration";
import {captureException} from "./sentry";

const DAILY_CHALLENGE_QUESTION_COUNT = 1;
const CURRENT_DAILY_RIDDLE_DOC_ID = "current";

/**
 * Converts unknown date-like input to an ISO UTC day string (`YYYY-MM-DD`).
 *
 * @param value Candidate date value.
 * @returns UTC date string or `null` when parsing fails.
 */
function toUtcDateString(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

/**
 * Checks whether a completion timestamp belongs to the current UTC day.
 *
 * @param lastCompletedAt Last completion timestamp/value.
 * @returns True when the value falls on today's UTC date.
 */
function isCompletedToday(lastCompletedAt: unknown): boolean {
  const lastCompletedDay = toUtcDateString(lastCompletedAt);
  if (!lastCompletedDay) return false;
  const today = new Date().toISOString().split("T")[0];
  return lastCompletedDay === today;
}

/**
 * Ensures a usable "current" daily challenge document exists for today.
 *
 * @returns Fresh challenge snapshot plus today's UTC date string.
 */
async function getFreshDailyChallengeDoc(): Promise<{
  dailyChallengeDoc: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>;
  todayDateString: string;
}> {
  const todayDateString = new Date().toISOString().split("T")[0];
  const dailyChallengeRef = admin.firestore().collection("dailyRiddles").doc(CURRENT_DAILY_RIDDLE_DOC_ID);

  let dailyChallengeDoc = await dailyChallengeRef.get();
  const challengeData = dailyChallengeDoc.data();
  const challengeTimestamp = challengeData?.timestamp;
  let challengeDate: string | null = null;
  if (challengeTimestamp && typeof challengeTimestamp === "object" && "toDate" in challengeTimestamp) {
    challengeDate = challengeTimestamp.toDate().toISOString().split("T")[0];
  } else if (challengeTimestamp) {
    const parsed = new Date(challengeTimestamp as string | number | Date);
    challengeDate = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split("T")[0];
  }

  const isChallengeUsable = dailyChallengeDoc.exists &&
    challengeDate === todayDateString &&
    typeof challengeData?.text === "string" &&
    challengeData.text.length > 0 &&
    typeof challengeData?.answer === "string" &&
    challengeData.answer.length > 0;

  if (!isChallengeUsable) {
    functions.logger.warn(
      `Daily challenge is missing/stale for ${todayDateString}. Attempting regeneration.`,
    );
    try {
      await generateTodaysDailyChallenge(false);
    } catch (error) {
      captureException(error, {
        functionName: "getFreshDailyChallengeDoc",
        phase: "self_heal_generation",
        challengeDate: todayDateString,
      });
      throw error;
    }
    dailyChallengeDoc = await dailyChallengeRef.get();
  }

  return {dailyChallengeDoc, todayDateString};
}

/**
 * Sets the last completed daily challenge date for the authenticated user.
 * @param request - The request object representing the request context.
 * @return A message indicating the success of the operation.
 */
export const setCompletedDailyChallenge = onCall(
  {},
  async (request: CallableRequest<unknown>): Promise<{message: string}> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The user must be authenticated to set completed daily challenge.");
      }
      const currentUserId = request.auth.uid;

      const currentDate = new Date().toISOString();

      await updateUserLastCompletedDailyChallengeDate(currentUserId, currentDate);

      return {
        message: "Last completed daily challenge date set successfully.",
      };
    } catch (error) {
      // Re-throw HttpsError instances directly
      if (error instanceof HttpsError) {
        throw error;
      }
      functions.logger.error("Error setting completed daily challenge:", error);
      captureException(error);
      throw new HttpsError("internal", "An error occurred while setting completed daily challenge.", error);
    }
  },
);

/**
 * Checks if the user has completed the current daily challenge for today.
 * @param request - The request object representing the request context.
 * @param request.data - The request data object containing the user ID.
 * @param request.data.id - The user ID.
 * @return A promise that resolves to true if the user completed today's challenge.
 */
export const hasCompletedDailyChallenge = onCall(
  {},
  async (request: CallableRequest<{id: string}>): Promise<boolean> => {
    try {
      const {id: currentUserId} = request.data;

      const user = await getUser(currentUserId);

      return isCompletedToday(user?.lastDailyChallengeCompletedAt);
    } catch (error) {
      functions.logger.error("Error checking daily challenge status:", error);
      captureException(error, {
        functionName: "hasCompletedDailyChallenge",
      });
      throw new HttpsError("internal", "An error occurred while checking daily challenge status.", error);
    }
  },
);

interface DailyChallengeQuestion {
  /** Riddle document id for this question. */
  riddleId: string;
  /** Prompt text shown to the user. */
  text: string;
  /** One-based ordinal number in the daily challenge. */
  questionNumber: number;
}

interface DailyChallengeData {
  /** UTC date string (`YYYY-MM-DD`) derived from the challenge timestamp. */
  date?: string;
  /** Ordered list of questions for the day. */
  questions: DailyChallengeQuestion[];
  /** Total number of daily challenge questions. */
  totalQuestions: number;
}

interface GetCurrentDailyChallengeResponse {
  /** Daily challenge payload for today, when available. */
  challenge?: DailyChallengeData;
  /** User's current question progress index. */
  currentQuestion?: number;
  /** True when the user already completed today's challenge. */
  hasCompletedToday?: boolean;
  /** Number of questions completed today. */
  questionsCompleted?: number;
  /** Error message when challenge retrieval fails. */
  error?: string;
}

/**
 * Gets the current daily challenge data (single question, excluding answer).
 * Returns the daily challenge and the user's progress.
 * Optionally includes the user's completion status if authenticated.
 */
export const getCurrentDailyChallenge = onCall(
  {
    secrets: ["OPENAI_API_KEY"],
  },
  async (request: CallableRequest<unknown>): Promise<GetCurrentDailyChallengeResponse> => {
    try {
      const {dailyChallengeDoc, todayDateString} = await getFreshDailyChallengeDoc();

      if (!dailyChallengeDoc.exists) {
        functions.logger.warn("No daily challenge document found.");
        return {error: "No daily challenge available at the moment."};
      }

      const allData = dailyChallengeDoc.data();
      if (!allData || typeof allData.text !== "string" || allData.text.length === 0) {
        functions.logger.error("Daily challenge document is missing required question data.", allData);
        return {error: "Daily challenge data is incomplete. Expected 1 question."};
      }

      let challengeDate: string | undefined = todayDateString;
      if (allData.timestamp && typeof allData.timestamp === "object" && "toDate" in allData.timestamp) {
        challengeDate = allData.timestamp.toDate().toISOString().split("T")[0];
      }

      const challengeData: DailyChallengeData = {
        date: challengeDate,
        questions: [{
          riddleId: allData.riddleId || CURRENT_DAILY_RIDDLE_DOC_ID,
          text: allData.text,
          questionNumber: 1,
        }],
        totalQuestions: DAILY_CHALLENGE_QUESTION_COUNT,
      };

      let currentQuestion: number | undefined = undefined;
      let hasCompletedToday: boolean | undefined = undefined;
      let questionsCompleted: number | undefined = undefined;

      if (request.auth) {
        const userId = request.auth.uid;
        const user = await getUser(userId);

        if (user) {
          currentQuestion = Math.min(user.progress?.dailyChallengeCurrentQuestion || 0, DAILY_CHALLENGE_QUESTION_COUNT);
          hasCompletedToday = isCompletedToday(user.lastDailyChallengeCompletedAt);
          questionsCompleted = hasCompletedToday ? DAILY_CHALLENGE_QUESTION_COUNT : currentQuestion;
        } else {
          currentQuestion = 0;
          questionsCompleted = 0;
          hasCompletedToday = false;
        }
      }

      functions.logger.info(
        `Returning daily challenge for ${challengeData.date}: ${DAILY_CHALLENGE_QUESTION_COUNT} question, user progress: ${questionsCompleted}/${DAILY_CHALLENGE_QUESTION_COUNT}`,
      );
      return {
        challenge: challengeData,
        currentQuestion,
        hasCompletedToday,
        questionsCompleted,
      };
    } catch (error) {
      functions.logger.error("Error getting current daily challenge:", error);
      captureException(error, {
        functionName: "getCurrentDailyChallenge",
        isAuthenticated: !!request.auth,
      });
      return {error: "An error occurred while fetching the daily challenge."};
    }
  },
);

/**
 * Advances the user daily challenge progress.
 * For the single-riddle challenge, this marks completion.
 */
export const advanceDailyChallengeProgress = onCall(
  {},
  async (
    request: CallableRequest<unknown>,
  ): Promise<{
    newQuestionIndex: number;
    isFullyCompleted: boolean;
    message: string;
  }> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated to advance progress.");
      }

      const userId = request.auth.uid;

      const user = await getUser(userId);
      if (!user) {
        throw new HttpsError("not-found", "User data not found.");
      }

      const currentQuestionIndex = user.progress?.dailyChallengeCurrentQuestion || 0;
      const completedToday = isCompletedToday(user.lastDailyChallengeCompletedAt);

      if (completedToday || currentQuestionIndex >= DAILY_CHALLENGE_QUESTION_COUNT) {
        return {
          newQuestionIndex: DAILY_CHALLENGE_QUESTION_COUNT,
          isFullyCompleted: true,
          message: "Daily challenge already completed.",
        };
      }

      const newQuestionIndex = DAILY_CHALLENGE_QUESTION_COUNT;
      const isFullyCompleted = true;

      // Update progress
      const userRef = admin.firestore().collection("users").doc(userId);
      const updates: any = {
        "progress.dailyChallengeCurrentQuestion": newQuestionIndex,
      };

      updates.lastDailyChallengeCompletedAt = admin.firestore.FieldValue.serverTimestamp();

      await userRef.update(updates);

      functions.logger.info(
        `User ${userId} marked daily challenge complete (${newQuestionIndex}/${DAILY_CHALLENGE_QUESTION_COUNT})`,
      );

      return {
        newQuestionIndex,
        isFullyCompleted,
        message: "Daily challenge completed! 1 riddle finished.",
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      functions.logger.error("Error advancing daily challenge progress:", error);
      captureException(error, {
        functionName: "advanceDailyChallengeProgress",
        isAuthenticated: !!request.auth,
      });
      throw new HttpsError("internal", "An error occurred while advancing progress.");
    }
  },
);
