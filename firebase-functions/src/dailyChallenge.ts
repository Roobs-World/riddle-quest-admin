import * as functions from "firebase-functions";
import * as admin from "firebase-admin"; // Added for Firestore access
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {getUser, getClassicRiddleByIndex} from "./firestoreService";
import {captureException} from "./sentry";
import {SUPPORTED_LOCALES} from "@qwordly/core/validation";
import {
  GetCurrentDailyChallengeResponse,
  GetCurrentDailyChallengeResponseSchema,
} from "./validation/requestSchemas";
import {validateCallableResponse} from "./validation/callableValidation";

const DAILY_CHALLENGE_QUESTION_COUNT = 1;
const CURRENT_DAILY_RIDDLE_DOC_ID = "current";
const jestWebCallableOptions = {
  enforceAppCheck: process.env.JEST_ALLOW_WEB_CALLABLES !== "true",
};

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
 * Gets the current daily challenge data (single question, excluding answer).
 * Returns the daily challenge and the user's progress.
 * Optionally includes the user's completion status if authenticated.
 */
export const getCurrentDailyChallenge = onCall(
  {
    ...jestWebCallableOptions,
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
  jestWebCallableOptions,
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
