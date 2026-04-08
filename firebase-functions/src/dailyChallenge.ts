import * as functions from "firebase-functions";
import * as admin from "firebase-admin"; // Added for Firestore access
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {updateUserLastCompletedDailyChallengeDate, getUser} from "./firestoreService";
import {captureException} from "./sentry";

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
 * Checks if the user has completed the current daily challenge (all 5 questions).
 * @param request - The request object representing the request context.
 * @param request.data - The request data object containing the user ID.
 * @param request.data.id - The user ID.
 * @return A promise that resolves to true if the user has completed all 5 daily
 * challenge questions, otherwise false.
 */
export const hasCompletedDailyChallenge = onCall(
  {},
  async (request: CallableRequest<{id: string}>): Promise<boolean> => {
    try {
      const {id: currentUserId} = request.data;

      const user = await getUser(currentUserId);

      if (user && user.lastDailyChallengeCompletedAt) {
        const lastCompletedDate = new Date(user.lastDailyChallengeCompletedAt);
        const currentDate = new Date();

        // Check if completed today AND if all 5 questions are done
        const completedToday = currentDate.toDateString() === lastCompletedDate.toDateString();
        const currentQuestion = user.progress?.dailyChallengeCurrentQuestion || 0;

        return completedToday && currentQuestion >= 5; // All 5 questions completed (0-4 = 5 questions)
      } else {
        return false;
      }
    } catch (error) {
      functions.logger.error("Error checking daily challenge status:", error);
      captureException(error);
      throw new HttpsError("internal", "An error occurred while checking daily challenge status.", error);
    }
  },
);

interface DailyChallengeQuestion {
  riddleId: string;
  text: string;
  questionNumber: number; // 1-5
}

interface DailyChallengeData {
  date: string; // YYYY-MM-DD format to track which day this challenge is for
  questions: DailyChallengeQuestion[]; // Array of 5 questions
  totalQuestions: number; // Always 5
}

interface GetCurrentDailyChallengeResponse {
  challenge?: DailyChallengeData;
  currentQuestion?: number; // 0-4 (which question user is currently on)
  hasCompletedToday?: boolean;
  questionsCompleted?: number; // 0-5
  error?: string;
}

/**
 * Gets the current daily challenge data (5 questions, excluding answers).
 * Returns the daily challenge with 5 questions and user's current progress.
 * Optionally includes the user's completion status if authenticated.
 */
export const getCurrentDailyChallenge = onCall(
  {},
  async (request: CallableRequest<unknown>): Promise<GetCurrentDailyChallengeResponse> => {
    try {
      const currentDate = new Date();
      const todayDateString = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD format

      const dailyChallengeRef = admin.firestore().collection("dailyChallenge").doc("current");
      const dailyChallengeDoc = await dailyChallengeRef.get();

      if (!dailyChallengeDoc.exists) {
        functions.logger.warn("No daily challenge document found.");
        return {error: "No daily challenge available at the moment."};
      }

      const allData = dailyChallengeDoc.data();
      if (!allData || !allData.questions || !Array.isArray(allData.questions) || allData.questions.length !== 5) {
        functions.logger.error("Daily challenge document is missing required 5 questions.", allData);
        return {error: "Daily challenge data is incomplete. Expected 5 questions."};
      }

      // Check if the challenge is for today (optional validation)
      if (allData.date && allData.date !== todayDateString) {
        functions.logger.warn(`Daily challenge date mismatch. Expected: ${todayDateString}, Found: ${allData.date}`);
        // Still return the challenge as the scheduler will update it
      }

      const challengeData: DailyChallengeData = {
        date: allData.date || todayDateString,
        questions: allData.questions.map((q: any, index: number) => ({
          riddleId: q.riddleId,
          text: q.text,
          questionNumber: index + 1, // 1-5 for display
        })),
        totalQuestions: 5,
      };

      let currentQuestion: number | undefined = undefined;
      let hasCompletedToday: boolean | undefined = undefined;
      let questionsCompleted: number | undefined = undefined;

      if (request.auth) {
        const userId = request.auth.uid;
        const user = await getUser(userId);

        if (user) {
          // Get current question progress (0-4, or 5 if completed all)
          currentQuestion = user.progress?.dailyChallengeCurrentQuestion || 0;
          questionsCompleted = Math.min(currentQuestion, 5);

          // Check if completed today (all 5 questions done)
          if (user.lastDailyChallengeCompletedAt) {
            const lastCompletedDate = new Date(user.lastDailyChallengeCompletedAt);
            const currentDate = new Date();
            const completedToday = currentDate.toDateString() === lastCompletedDate.toDateString();
            hasCompletedToday = completedToday && (currentQuestion || 0) >= 5;
          } else {
            hasCompletedToday = false;
          }
        } else {
          currentQuestion = 0;
          questionsCompleted = 0;
          hasCompletedToday = false;
        }
      }

      functions.logger.info(
        `Returning daily challenge for ${challengeData.date}: 5 questions, user progress: ${currentQuestion}/5`,
      );
      return {
        challenge: challengeData,
        currentQuestion,
        hasCompletedToday,
        questionsCompleted,
      };
    } catch (error) {
      functions.logger.error("Error getting current daily challenge:", error);
      captureException(error);
      return {error: "An error occurred while fetching the daily challenge."};
    }
  },
);

/**
 * Gets the current daily challenge question for the user.
 * Returns only the specific question the user should be working on (0-4).
 */
export const getCurrentDailyChallengeQuestion = onCall(
  {},
  async (
    request: CallableRequest<unknown>,
  ): Promise<{
    question?: DailyChallengeQuestion;
    questionIndex?: number; // 0-4
    totalQuestions?: number; // Always 5
    isCompleted?: boolean;
    error?: string;
  }> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated to get current question.");
      }

      const userId = request.auth.uid;
      const user = await getUser(userId);

      if (!user) {
        throw new HttpsError("not-found", "User data not found.");
      }

      const currentQuestionIndex = user.progress?.dailyChallengeCurrentQuestion || 0;

      // If user has completed all 5 questions
      if (currentQuestionIndex >= 5) {
        return {
          questionIndex: 5,
          totalQuestions: 5,
          isCompleted: true,
        };
      }

      // Get the daily challenge data directly
      const dailyChallengeRef = admin.firestore().collection("dailyChallenge").doc("current");
      const dailyChallengeDoc = await dailyChallengeRef.get();

      if (!dailyChallengeDoc.exists) {
        return {error: "No daily challenge available at the moment."};
      }

      const allData = dailyChallengeDoc.data();
      if (!allData || !allData.questions || !Array.isArray(allData.questions) || allData.questions.length !== 5) {
        return {error: "Daily challenge data is incomplete. Expected 5 questions."};
      }

      const question = allData.questions[currentQuestionIndex];
      if (!question) {
        return {error: "Question not found for current index."};
      }

      return {
        question,
        questionIndex: currentQuestionIndex,
        totalQuestions: 5,
        isCompleted: false,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      functions.logger.error("Error getting current daily challenge question:", error);
      captureException(error);
      throw new HttpsError("internal", "An error occurred while fetching the current question.");
    }
  },
);

/**
 * Advances the user to the next daily challenge question.
 * Called when a user completes a question or skips it.
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

      if (currentQuestionIndex >= 5) {
        return {
          newQuestionIndex: 5,
          isFullyCompleted: true,
          message: "Daily challenge already completed.",
        };
      }

      const newQuestionIndex = currentQuestionIndex + 1;
      const isFullyCompleted = newQuestionIndex >= 5;

      // Update progress
      const userRef = admin.firestore().collection("users").doc(userId);
      const updates: any = {
        "progress.dailyChallengeCurrentQuestion": newQuestionIndex,
      };

      // If fully completed, update completion date and reset for next day
      if (isFullyCompleted) {
        updates.lastDailyChallengeCompletedAt = admin.firestore.FieldValue.serverTimestamp();
        // Note: dailyChallengeCurrentQuestion will be reset to 0 by the daily scheduler
      }

      await userRef.update(updates);

      functions.logger.info(`User ${userId} advanced to daily challenge question ${newQuestionIndex}/5`);

      return {
        newQuestionIndex,
        isFullyCompleted,
        message: isFullyCompleted
          ? "Daily challenge completed! All 5 questions finished."
          : `Advanced to question ${newQuestionIndex + 1}/5.`,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      functions.logger.error("Error advancing daily challenge progress:", error);
      captureException(error);
      throw new HttpsError("internal", "An error occurred while advancing progress.");
    }
  },
);
