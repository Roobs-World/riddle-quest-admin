import * as functions from "firebase-functions";
import {admin} from "../shared/firebaseAdmin";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {getUser} from "../gameplay/firestoreService";
import {captureException} from "../shared/sentry";
import {SUPPORTED_LOCALES} from "@qwordly/core/validation";
import {GetCurrentDailyChallengeResponse, GetCurrentDailyChallengeResponseSchema} from "../validation/requestSchemas";
import {validateCallableResponse} from "../validation/callableValidation";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {resolveDailyChallengeProgress} from "./dailyChallengeProgress";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {getSinglePlayerCompletionKey, getSinglePlayerContentKey} from "../gameplay/singlePlayerAnswerPolicy";
import {
  ensureAuthoritativeSession,
  getIssuedAuthoritativeSession,
} from "../gameplay/singlePlayerSession";
import {
  completeAuthoritativeGame,
  isDailyCompletionDateEligible,
} from "../gameplay/completeGameLogic";
import {getSafeErrorMetadata} from "../shared/errorMetadata";
import {getPlayableClassicRiddle, isPlayableRiddleContent} from "../gameplay/classicRiddleFallback";
import {parseClassicLoadIndex, parseSinglePlayerResumeFields} from "../gameplay/singlePlayerLoadRequest";
import {reconcilePreviousDailyBinding} from "./dailyRolloverRecovery";
import {recoverPendingAuthoritativeCompletion} from "../gameplay/singlePlayerTerminalRecovery";
import {buildSinglePlayerChallengeResponse} from "../gameplay/singlePlayerRiddleResponse";

/** Defines the daily challenge question count value. */
const DAILY_CHALLENGE_QUESTION_COUNT = 1;
/** Defines the current daily riddle doc id value. */
const CURRENT_DAILY_RIDDLE_DOC_ID = "current";

/** Parses only trusted Firestore session timestamps. */
const trustedSessionDate = (value: unknown): Date | undefined => {
  if (typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function") {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
  }
  return undefined;
};

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
  const localizedRiddleCollection = admin
    .firestore()
    .collection(`localizedRiddles/${safeLocale}/riddles`);
  const datedDailyChallengeDoc = await localizedRiddleCollection.doc(`daily-${todayDateString}`).get();
  const dailyChallengeDoc = datedDailyChallengeDoc.exists
    ? datedDailyChallengeDoc
    : await localizedRiddleCollection.doc(CURRENT_DAILY_RIDDLE_DOC_ID).get();

  return {dailyChallengeDoc, todayDateString};
}

/**
 * Gets the current daily challenge data (single question, excluding answer).
 * Returns the daily challenge and the user's progress.
 * Optionally includes the user's completion status if authenticated.
 */
export const getCurrentDailyChallenge = onCallWithSentry(
  "getCurrentDailyChallenge",
  browserCallableSecurityOptions,
  async (request: CallableRequest<{
    locale?: unknown;
    sessionToken?: unknown;
    riddleId?: unknown;
  }>): Promise<GetCurrentDailyChallengeResponse> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The user must be authenticated to load the daily challenge.");
      }
      let locale = "en";
      let authenticatedUser: Awaited<ReturnType<typeof getUser>>;
      authenticatedUser = await getUser(request.auth.uid);
      if (!authenticatedUser) throw new HttpsError("not-found", "User data not found.");
      if (request.data?.locale !== undefined) {
        if (
          typeof request.data.locale !== "string" ||
          !SUPPORTED_LOCALES.includes(request.data.locale as (typeof SUPPORTED_LOCALES)[number])
        ) {
          throw new HttpsError("invalid-argument", "A supported locale is required.");
        }
        locale = request.data.locale;
      } else if (
        authenticatedUser.preferredLanguage &&
        SUPPORTED_LOCALES.includes(authenticatedUser.preferredLanguage as (typeof SUPPORTED_LOCALES)[number])
      ) {
        locale = authenticatedUser.preferredLanguage;
      }

      const resume = parseSinglePlayerResumeFields(request.data);
      const todayDateString = new Date().toISOString().slice(0, 10);
      if (resume) {
        const resumed = await getIssuedAuthoritativeSession(
          request.auth.uid,
          resume.sessionToken,
          "challenge",
          resume.riddleId,
        );
        if (
          resumed.terminal &&
          !resumed.isSkipped &&
          isDailyCompletionDateEligible(
            resumed.challengeDate,
            resumed.isCorrect,
            trustedSessionDate(resumed.terminalAt),
          )
        ) {
          await completeAuthoritativeGame(
            {riddleId: resume.riddleId, gameMode: "challenge", sessionToken: resume.sessionToken},
            {
              uid: request.auth.uid,
              isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
            },
          );
          authenticatedUser = await getUser(request.auth.uid);
          if (!authenticatedUser) throw new HttpsError("not-found", "User data not found.");
        }
      } else {
        authenticatedUser = await reconcilePreviousDailyBinding(
          request.auth.uid,
          authenticatedUser,
          request.auth.token?.firebase?.sign_in_provider === "anonymous",
        );
      }

      const {dailyChallengeDoc} = await getFreshDailyChallengeDoc(locale);

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
        !isPlayableRiddleContent(allData)
      ) {
        functions.logger.error("Daily challenge document is missing required playable question data.");
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
      const canonicalChallengeDate = typeof allData.challengeKey === "string"
        ? allData.challengeKey
        : challengeDate;
      if (canonicalChallengeDate !== todayDateString) {
        return validateCallableResponse(
          GetCurrentDailyChallengeResponseSchema,
          {error: "Today's daily challenge is not available yet."},
          "getCurrentDailyChallenge",
        );
      }
      challengeDate = canonicalChallengeDate;

      const completionKey = getSinglePlayerCompletionKey("challenge", todayDateString);
      let progress = resolveDailyChallengeProgress(authenticatedUser, DAILY_CHALLENGE_QUESTION_COUNT);
      if (!progress.hasCompletedToday && await recoverPendingAuthoritativeCompletion(
        request.auth.uid,
        "challenge",
        completionKey,
        request.auth.token?.firebase?.sign_in_provider === "anonymous",
      )) {
        authenticatedUser = await getUser(request.auth.uid);
        if (!authenticatedUser) throw new HttpsError("not-found", "User data not found.");
        progress = resolveDailyChallengeProgress(authenticatedUser, DAILY_CHALLENGE_QUESTION_COUNT);
      }
      if (progress.hasCompletedToday) {
        return validateCallableResponse(
          GetCurrentDailyChallengeResponseSchema,
          {...progress, error: "Today's daily challenge is already complete."},
          "getCurrentDailyChallenge",
        );
      }
      const riddleId = allData.riddleId || CURRENT_DAILY_RIDDLE_DOC_ID;
      const canonicalRiddle = {
        ...allData,
        riddleId,
        answer: allData.answer as string,
      };
      const contentKey = getSinglePlayerContentKey(canonicalRiddle, "challenge", locale);
      let sessionToken = await ensureAuthoritativeSession(
        request.auth.uid,
        "challenge",
        riddleId,
        locale,
        contentKey,
        completionKey,
        canonicalRiddle.answer,
        {challengeDate: todayDateString},
      );
      const boundSession = await getIssuedAuthoritativeSession(
        request.auth.uid,
        sessionToken,
        "challenge",
        riddleId,
      );
      if (
        boundSession.terminal &&
        !boundSession.isSkipped &&
        isDailyCompletionDateEligible(
          boundSession.challengeDate,
          boundSession.isCorrect,
          trustedSessionDate(boundSession.terminalAt),
        )
      ) {
        await completeAuthoritativeGame(
          {riddleId, gameMode: "challenge", sessionToken},
          {
            uid: request.auth.uid,
            isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
          },
        );
        authenticatedUser = await getUser(request.auth.uid);
        if (!authenticatedUser) throw new HttpsError("not-found", "User data not found.");
        const reconciledProgress = resolveDailyChallengeProgress(
          authenticatedUser,
          DAILY_CHALLENGE_QUESTION_COUNT,
        );
        if (reconciledProgress.hasCompletedToday) {
          return validateCallableResponse(
            GetCurrentDailyChallengeResponseSchema,
            {...reconciledProgress, error: "Today's daily challenge is already complete."},
            "getCurrentDailyChallenge",
          );
        }
        // A recorded loss remains retryable for the same Daily entitlement.
        sessionToken = await ensureAuthoritativeSession(
          request.auth.uid,
          "challenge",
          riddleId,
          locale,
          contentKey,
          completionKey,
          canonicalRiddle.answer,
          {challengeDate: todayDateString},
        );
      }

      const activeSession = await getIssuedAuthoritativeSession(
        request.auth.uid,
        sessionToken,
        "challenge",
        riddleId,
      );
      const challengeData = buildSinglePlayerChallengeResponse(
        {...canonicalRiddle, locale},
        challengeDate,
        sessionToken,
        activeSession,
      );

      let currentQuestion: number | undefined = undefined;
      let hasCompletedToday: boolean | undefined = undefined;
      let questionsCompleted: number | undefined = undefined;

      ({currentQuestion, hasCompletedToday, questionsCompleted} = progress);

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
      if (error instanceof HttpsError) throw error;
      functions.logger.error("Error getting current daily challenge.", getSafeErrorMetadata(error));
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
export const getCurrentClassicRiddle = onCallWithSentry(
  "getCurrentClassicRiddle",
  browserCallableSecurityOptions,
  async (
    request: CallableRequest<{
      classicIndex?: number;
      locale?: string;
      sessionToken?: unknown;
      riddleId?: unknown;
    }>,
  ): Promise<GetCurrentDailyChallengeResponse> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The user must be authenticated to load a classic riddle.");
      }

      const requestedClassicIndex = request.data?.classicIndex === undefined
        ? undefined
        : parseClassicLoadIndex(request.data.classicIndex);

      let locale = "en";
      let user = await getUser(request.auth.uid);
      if (!user) throw new HttpsError("not-found", "User data not found.");
      if (
        typeof request.data?.locale === "string" &&
        SUPPORTED_LOCALES.includes(request.data.locale as (typeof SUPPORTED_LOCALES)[number])
      ) {
        locale = request.data.locale;
      } else if (
        user?.preferredLanguage &&
        SUPPORTED_LOCALES.includes(user.preferredLanguage as (typeof SUPPORTED_LOCALES)[number])
      ) {
        locale = user.preferredLanguage;
      }

      let resume: ReturnType<typeof parseSinglePlayerResumeFields>;
      try {
        resume = parseSinglePlayerResumeFields(request.data);
      } catch (error) {
        if (!(error instanceof HttpsError) || error.code !== "invalid-argument") throw error;
        functions.logger.warn("Ignoring malformed optional Classic resume fields.", {
          hasSessionToken: request.data?.sessionToken !== undefined,
          hasRiddleId: request.data?.riddleId !== undefined,
        });
      }
      let reconciledTerminalSession = false;
      if (resume) {
        const resumed = await getIssuedAuthoritativeSession(
          request.auth.uid,
          resume.sessionToken,
          "classic",
          resume.riddleId,
        );
        if (resumed.terminal) {
          if (!resumed.isSkipped) {
            await completeAuthoritativeGame(
              {riddleId: resume.riddleId, gameMode: "classic", sessionToken: resume.sessionToken},
              {
                uid: request.auth.uid,
                isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
              },
            );
          }
          user = await getUser(request.auth.uid);
          if (!user) throw new HttpsError("not-found", "User data not found.");
          reconciledTerminalSession = true;
        }
      }

      let expectedClassicIndex = user.progress?.classicIndex ?? 1;
      if (await recoverPendingAuthoritativeCompletion(
        request.auth.uid,
        "classic",
        getSinglePlayerCompletionKey("classic", expectedClassicIndex),
        request.auth.token?.firebase?.sign_in_provider === "anonymous",
      )) {
        user = await getUser(request.auth.uid);
        if (!user) throw new HttpsError("not-found", "User data not found.");
        expectedClassicIndex = user.progress?.classicIndex ?? 1;
        reconciledTerminalSession = true;
      }
      if (requestedClassicIndex !== undefined && requestedClassicIndex !== expectedClassicIndex && !reconciledTerminalSession) {
        throw new HttpsError("permission-denied", "Only the current classic riddle can be loaded.");
      }
      let classicIndex = expectedClassicIndex;

      let playable = await getPlayableClassicRiddle(classicIndex, locale);
      if (!playable) {
        return validateCallableResponse(
          GetCurrentDailyChallengeResponseSchema,
          {error: `No classic riddle available at index ${classicIndex}.`},
          "getCurrentClassicRiddle",
        );
      }
      let {riddle, contentLocale} = playable;
      if (riddle.classicIndex !== undefined && riddle.classicIndex !== expectedClassicIndex) {
        throw new HttpsError("failed-precondition", "The classic riddle does not match current progression.");
      }
      const contentKey = getSinglePlayerContentKey(riddle, "classic", contentLocale);
      let sessionToken = await ensureAuthoritativeSession(
        request.auth.uid,
        "classic",
        riddle.riddleId,
        contentLocale,
        contentKey,
        getSinglePlayerCompletionKey("classic", expectedClassicIndex),
        riddle.answer,
        {classicIndex: expectedClassicIndex},
      );
      const boundSession = await getIssuedAuthoritativeSession(
        request.auth.uid,
        sessionToken,
        "classic",
        riddle.riddleId,
      );
      if (boundSession.terminal) {
        if (!boundSession.isSkipped) {
          await completeAuthoritativeGame(
            {riddleId: riddle.riddleId, gameMode: "classic", sessionToken},
            {
              uid: request.auth.uid,
              isAnonymous: request.auth.token?.firebase?.sign_in_provider === "anonymous",
            },
          );
        }
        user = await getUser(request.auth.uid);
        if (!user) throw new HttpsError("not-found", "User data not found.");
        const reconciledIndex = user.progress?.classicIndex ?? 1;
        if (reconciledIndex !== expectedClassicIndex) {
          classicIndex = reconciledIndex;
          playable = await getPlayableClassicRiddle(classicIndex, locale);
          if (!playable) {
            return validateCallableResponse(
              GetCurrentDailyChallengeResponseSchema,
              {error: `No classic riddle available at index ${classicIndex}.`},
              "getCurrentClassicRiddle",
            );
          }
          ({riddle, contentLocale} = playable);
        }
        const reconciledContentKey = getSinglePlayerContentKey(riddle, "classic", contentLocale);
        sessionToken = await ensureAuthoritativeSession(
          request.auth.uid,
          "classic",
          riddle.riddleId,
          contentLocale,
          reconciledContentKey,
          getSinglePlayerCompletionKey("classic", classicIndex),
          riddle.answer,
          {classicIndex},
        );
      }

      const activeSession = await getIssuedAuthoritativeSession(
        request.auth.uid,
        sessionToken,
        "classic",
        riddle.riddleId,
      );
      return validateCallableResponse(
        GetCurrentDailyChallengeResponseSchema,
        {
          challenge: buildSinglePlayerChallengeResponse(riddle, undefined, sessionToken, activeSession),
        },
        "getCurrentClassicRiddle",
      );
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      functions.logger.error("Error getting current classic riddle.", getSafeErrorMetadata(error));
      captureException(error);
      throw new HttpsError("internal", "An error occurred while loading the current classic riddle.");
    }
  },
);
