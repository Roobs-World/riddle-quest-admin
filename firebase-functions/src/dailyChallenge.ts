import * as functions from "firebase-functions";
import * as admin from "firebase-admin"; // Added for Firestore access
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {updateUserLastCompletedDailyChallengeDate, getUser, getClassicRiddleByIndex} from "./firestoreService";
import {captureException} from "./sentry";
import {SUPPORTED_LOCALES} from "@qwordly/core/validation";
import {
  AdvanceDailyChallengeProgressResponseSchema,
  BooleanResponseSchema,
  GetCurrentDailyChallengeResponse,
  GetCurrentDailyChallengeResponseSchema,
  HasCompletedDailyChallengeRequestSchema,
  MessageResponseSchema,
} from "./validation/requestSchemas";
import {validateCallableRequest, validateCallableResponse} from "./validation/callableValidation";

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

  if (typeof value === "object") {
    const timestampLike = value as {
      toDate?: () => Date;
      toMillis?: () => number;
      seconds?: number;
      _seconds?: number;
      nanoseconds?: number;
      _nanoseconds?: number;
    };

    if (typeof timestampLike.toDate === "function") {
      const date = timestampLike.toDate();
      return Number.isNaN(date.getTime()) ? null : date.toISOString().split("T")[0];
    }

    if (typeof timestampLike.toMillis === "function") {
      const date = new Date(timestampLike.toMillis());
      return Number.isNaN(date.getTime()) ? null : date.toISOString().split("T")[0];
    }

    const secondsValue =
      typeof timestampLike.seconds === "number"
        ? timestampLike.seconds
        : typeof timestampLike._seconds === "number"
          ? timestampLike._seconds
          : undefined;
    if (typeof secondsValue === "number") {
      const nanosValue =
        typeof timestampLike.nanoseconds === "number"
          ? timestampLike.nanoseconds
          : typeof timestampLike._nanoseconds === "number"
            ? timestampLike._nanoseconds
            : 0;
      const millis = secondsValue * 1000 + Math.floor(nanosValue / 1_000_000);
      const date = new Date(millis);
      return Number.isNaN(date.getTime()) ? null : date.toISOString().split("T")[0];
    }
  }

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

function buildChallengeResponse(
  riddle: {riddleId: string; text: string; answer: string},
  date: string | undefined,
): GetCurrentDailyChallengeResponse["challenge"] {
  return {
    date,
    questions: [
      {
        riddleId: riddle.riddleId,
        text: riddle.text,
        answer: riddle.answer,
        questionNumber: 1,
      },
    ],
    totalQuestions: DAILY_CHALLENGE_QUESTION_COUNT,
  };
}

/**
 * Ensures a usable "current" daily challenge document exists for today.
 *
 * @returns Fresh challenge snapshot plus today's UTC date string.
 */
async function getFreshDailyChallengeDoc(locale: string = "en"): Promise<{
  dailyChallengeDoc: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>;
  todayDateString: string;
}> {
  const todayDateString = new Date().toISOString().split("T")[0];
  const safeLocale = locale || "en";
  const localizedDailyChallengeRef = admin
    .firestore()
    .collection(`localizedRiddles/${safeLocale}/riddles`)
    .doc(CURRENT_DAILY_RIDDLE_DOC_ID);
  const dailyChallengeDoc = await localizedDailyChallengeRef.get();

  return {dailyChallengeDoc, todayDateString};
}

/**
 * Sets the last completed daily challenge date for the authenticated user.
 * @param request - The request object representing the request context.
 * @return A message indicating the success of the operation.
 */
export const setCompletedDailyChallenge = onCall(
  {enforceAppCheck: true},
  async (request: CallableRequest<unknown>): Promise<{message: string}> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The user must be authenticated to set completed daily challenge.");
      }
      const currentUserId = request.auth.uid;

      const currentDate = new Date().toISOString();

      await updateUserLastCompletedDailyChallengeDate(currentUserId, currentDate);

      return validateCallableResponse(
        MessageResponseSchema,
        {
          message: "Last completed daily challenge date set successfully.",
        },
        "setCompletedDailyChallenge",
      );
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
  {enforceAppCheck: true},
  async (request: CallableRequest<{id: string}>): Promise<boolean> => {
    try {
      const {id: currentUserId} = validateCallableRequest(
        HasCompletedDailyChallengeRequestSchema,
        request.data,
        "hasCompletedDailyChallenge",
      );

      const user = await getUser(currentUserId);

      return validateCallableResponse(
        BooleanResponseSchema,
        isCompletedToday(user?.lastDailyChallengeCompletedAt),
        "hasCompletedDailyChallenge",
      );
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      functions.logger.error("Error checking daily challenge status:", error);
      captureException(error, {
        functionName: "hasCompletedDailyChallenge",
      });
      throw new HttpsError("internal", "An error occurred while checking daily challenge status.", error);
    }
  },
);

/**
 * Gets the current daily challenge data (single question, excluding answer).
 * Returns the daily challenge and the user's progress.
 * Optionally includes the user's completion status if authenticated.
 */
export const getCurrentDailyChallenge = onCall(
  {
    enforceAppCheck: true,
    secrets: ["OPENAI_API_KEY"],
  },
  async (request: CallableRequest<unknown>): Promise<GetCurrentDailyChallengeResponse> => {
    try {
      let locale = "en";
      if (request.auth) {
        const user = await getUser(request.auth.uid);
        if (user?.preferredLanguage && SUPPORTED_LOCALES.includes(user.preferredLanguage as (typeof SUPPORTED_LOCALES)[number])) {
          locale = user.preferredLanguage;
        }
      }

      const {dailyChallengeDoc, todayDateString} = await getFreshDailyChallengeDoc(locale);

      if (!dailyChallengeDoc.exists) {
        functions.logger.warn("No daily challenge document found.");
        return validateCallableResponse(
          GetCurrentDailyChallengeResponseSchema,
          {error: "No daily challenge available at the moment."},
          "getCurrentDailyChallenge",
        );
      }

      const allData = dailyChallengeDoc.data();
      if (
        !allData ||
        typeof allData.text !== "string" ||
        allData.text.length === 0 ||
        typeof allData.answer !== "string" ||
        allData.answer.length === 0
      ) {
        functions.logger.error("Daily challenge document is missing required question data.", allData);
        return validateCallableResponse(
          GetCurrentDailyChallengeResponseSchema,
          {error: "Daily challenge data is incomplete. Expected 1 question."},
          "getCurrentDailyChallenge",
        );
      }

      let challengeDate: string | undefined = todayDateString;
      if (allData.timestamp && typeof allData.timestamp === "object" && "toDate" in allData.timestamp) {
        challengeDate = allData.timestamp.toDate().toISOString().split("T")[0];
      }

      const challengeData = {
        date: challengeDate,
        questions: [
          {
            riddleId: allData.riddleId || CURRENT_DAILY_RIDDLE_DOC_ID,
            text: allData.text,
            answer: allData.answer,
            questionNumber: 1,
          },
        ],
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
      return validateCallableResponse(
        GetCurrentDailyChallengeResponseSchema,
        {
          challenge: challengeData,
          currentQuestion,
          hasCompletedToday,
          questionsCompleted,
        },
        "getCurrentDailyChallenge",
      );
    } catch (error) {
      functions.logger.error("Error getting current daily challenge:", error);
      captureException(error, {
        functionName: "getCurrentDailyChallenge",
        isAuthenticated: !!request.auth,
      });
      return validateCallableResponse(
        GetCurrentDailyChallengeResponseSchema,
        {error: "An error occurred while fetching the daily challenge."},
        "getCurrentDailyChallenge",
      );
    }
  },
);

/**
 * Gets the current classic riddle for a player's progression index.
 *
 * This is a server-backed fallback so the client can avoid reading the classic
 * collection directly when Firestore rules or App Check prevent it.
 */
export const getCurrentClassicRiddle = onCall(
  {enforceAppCheck: true},
  async (request: CallableRequest<{classicIndex?: number; locale?: string}>): Promise<GetCurrentDailyChallengeResponse> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The user must be authenticated to load a classic riddle.");
      }

      const classicIndex =
        typeof request.data?.classicIndex === "number"
          ? request.data.classicIndex
          : undefined;
      if (classicIndex === undefined || !Number.isInteger(classicIndex) || classicIndex < 0) {
        throw new HttpsError("invalid-argument", "A non-negative classicIndex is required.");
      }

      let locale = "en";
      const user = await getUser(request.auth.uid);
      if (user?.preferredLanguage && SUPPORTED_LOCALES.includes(user.preferredLanguage as (typeof SUPPORTED_LOCALES)[number])) {
        locale = user.preferredLanguage;
      } else if (
        typeof request.data?.locale === "string" &&
        SUPPORTED_LOCALES.includes(request.data.locale as (typeof SUPPORTED_LOCALES)[number])
      ) {
        locale = request.data.locale;
      }

      const riddle = await getClassicRiddleByIndex(classicIndex, locale);
      if (!riddle) {
        return validateCallableResponse(
          GetCurrentDailyChallengeResponseSchema,
          {error: `No classic riddle available at index ${classicIndex}.`},
          "getCurrentClassicRiddle",
        );
      }

      return validateCallableResponse(
        GetCurrentDailyChallengeResponseSchema,
        {
          challenge: buildChallengeResponse(riddle, undefined),
        },
        "getCurrentClassicRiddle",
      );
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      functions.logger.error("Error getting current classic riddle:", error);
      captureException(error);
      throw new HttpsError("internal", "An error occurred while loading the current classic riddle.", error);
    }
  },
);

/**
 * Advances the user daily challenge progress.
 * For the single-riddle challenge, this marks completion.
 */
export const advanceDailyChallengeProgress = onCall(
  {enforceAppCheck: true},
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
        return validateCallableResponse(
          AdvanceDailyChallengeProgressResponseSchema,
          {
            newQuestionIndex: DAILY_CHALLENGE_QUESTION_COUNT,
            isFullyCompleted: true,
            message: "Daily challenge already completed.",
          },
          "advanceDailyChallengeProgress",
        );
      }

      const newQuestionIndex = DAILY_CHALLENGE_QUESTION_COUNT;
      const isFullyCompleted = true;

      // Update progress
      const userRef = admin.firestore().collection("users").doc(userId);
      const updates: admin.firestore.UpdateData<{
        progress: {dailyChallengeCurrentQuestion: number};
        lastDailyChallengeCompletedAt: admin.firestore.FieldValue;
      }> = {
        "progress.dailyChallengeCurrentQuestion": newQuestionIndex,
      };

      updates.lastDailyChallengeCompletedAt = admin.firestore.FieldValue.serverTimestamp();

      await userRef.update(updates);

      functions.logger.info(
        `User ${userId} marked daily challenge complete (${newQuestionIndex}/${DAILY_CHALLENGE_QUESTION_COUNT})`,
      );

      return validateCallableResponse(
        AdvanceDailyChallengeProgressResponseSchema,
        {
          newQuestionIndex,
          isFullyCompleted,
          message: "Daily challenge completed! 1 riddle finished.",
        },
        "advanceDailyChallengeProgress",
      );
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
