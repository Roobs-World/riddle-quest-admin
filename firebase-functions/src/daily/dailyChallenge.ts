import {triggerClassicRiddleGenerationIfNeeded} from "../riddles/riddleSupply";
import {getDailyDate} from "@qwordly/core/validation/dailyCalendar";
import * as functions from "firebase-functions";
import {admin} from "../shared/firebaseAdmin";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {getUser} from "../gameplay/firestoreService";
import {captureException} from "../shared/sentry";
import {SUPPORTED_LOCALES} from "@qwordly/core/validation";
import {GetCurrentDailyChallengeResponse, GetCurrentDailyChallengeResponseSchema} from "@qwordly/core/validation/requestSchemas";
import {validateCallableResponse} from "../validation/callableValidation";
import {gameplayCallableOptions, gameplayInteractiveCallableOptions} from "../shared/gameplayCallableOptions";
import {resolveDailyChallengeProgress} from "./dailyChallengeProgress";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {getSinglePlayerCompletionKey, getSinglePlayerContentKey} from "../gameplay/singlePlayerAnswerPolicy";
import {ensureAuthoritativeSessionWithState, getIssuedAuthoritativeSession} from "../gameplay/singlePlayerSession";
import {completeAuthoritativeGame, isDailyCompletionDateEligible} from "../gameplay/completeGameLogic";
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
    /** Parses d. */
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
  }
  return undefined;
};

/**
 * Ensures a usable "current" daily challenge document exists for today.
 *
 * @returns Fresh challenge snapshot plus today's regional date string.
 */
async function getFreshDailyChallengeDoc(locale: string = "en"): Promise<{
  /** Stores daily challenge doc. */
  dailyChallengeDoc: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>;
  /** Stores today date string. */
  todayDateString: string;
}> {
  /** Provides today date string behavior. */
  const todayDateString = getDailyDate(locale);
  /** Provides safe locale behavior. */
  const safeLocale = locale || "en";
  /** Provides localized riddle collection behavior. */
  const localizedRiddleCollection = admin.firestore().collection(`localizedRiddles/${safeLocale}/riddles`);
  /** Provides dated daily challenge doc behavior. */
  const datedDailyChallengeDoc = await localizedRiddleCollection.doc(`daily-${todayDateString}`).get();
  /** Provides daily challenge doc behavior. */
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
  gameplayInteractiveCallableOptions,
  async (
    request: CallableRequest<{
      /** Stores locale. */
      locale?: unknown;
      /** Stores session token. */
      sessionToken?: unknown;
      /** Opts into preloaded feedback without changing legacy response shapes. */
      includeEvaluation?: boolean;
      /** Opts in to purchased hint recovery without changing older client responses. */
      includeHintRecovery?: boolean;
      /** Opts in to authoritative accepted guess recovery. */
      includeGuessRecovery?: boolean;
      /** Stores riddle id. */
      riddleId?: unknown;
    }>,
  ): Promise<GetCurrentDailyChallengeResponse> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The user must be authenticated to load the daily challenge.");
      }
      /** Provides locale behavior. */
      let locale = "en";
      /** Provides authenticated user behavior. */
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

      /** Provides resume behavior. */
      const resume = parseSinglePlayerResumeFields(request.data);
      /** Provides today date string behavior. */
      const todayDateString = getDailyDate(locale);
      if (resume) {
        /** Provides resumed behavior. */
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
            new Date(), resumed.locale,
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
          locale,
        );
      }

      /** Provides completion key behavior. */
      const completionKey = getSinglePlayerCompletionKey("challenge", todayDateString);
      /** Provides progress behavior. */
      let progress = resolveDailyChallengeProgress(authenticatedUser, DAILY_CHALLENGE_QUESTION_COUNT, locale);
      if (
        !progress.hasCompletedToday &&
        (await recoverPendingAuthoritativeCompletion(
          request.auth.uid,
          "challenge",
          completionKey,
          request.auth.token?.firebase?.sign_in_provider === "anonymous",
        ))
      ) {
        authenticatedUser = await getUser(request.auth.uid);
        if (!authenticatedUser) throw new HttpsError("not-found", "User data not found.");
        progress = resolveDailyChallengeProgress(authenticatedUser, DAILY_CHALLENGE_QUESTION_COUNT, locale);
      }
      if (progress.hasCompletedToday) {
        return validateCallableResponse(
          GetCurrentDailyChallengeResponseSchema,
          {...progress, error: "Today's daily challenge is already complete."},
          "getCurrentDailyChallenge",
        );
      }

      /** Provides {daily challenge doc} behavior. */
      const {dailyChallengeDoc} = await getFreshDailyChallengeDoc(locale);

      if (!dailyChallengeDoc.exists) {
        functions.logger.warn("No daily challenge document found.");
        return validateCallableResponse(
          GetCurrentDailyChallengeResponseSchema,
          {error: "No daily challenge available at the moment."},
          "getCurrentDailyChallenge",
        );
      }

      /** Provides all data behavior. */
      const allData = dailyChallengeDoc.data();
      /** Keep authored difficulty before playable-content validation narrows the clue shape. */
      const difficultyBand = allData?.difficultyBand;
      if (!allData || !isPlayableRiddleContent(allData)) {
        functions.logger.error("Daily challenge document is missing required playable question data.");
        return validateCallableResponse(
          GetCurrentDailyChallengeResponseSchema,
          {error: "Daily challenge data is incomplete. Expected 1 question."},
          "getCurrentDailyChallenge",
        );
      }

      /** Provides challenge date behavior. */
      let challengeDate: string | undefined = todayDateString;
      if (allData.timestamp && typeof allData.timestamp === "object" && "toDate" in allData.timestamp) {
        challengeDate = getDailyDate(locale, allData.timestamp.toDate());
      }
      /** Provides canonical challenge date behavior. */
      const canonicalChallengeDate = typeof allData.challengeKey === "string" ? allData.challengeKey : challengeDate;
      if (canonicalChallengeDate !== todayDateString) {
        return validateCallableResponse(
          GetCurrentDailyChallengeResponseSchema,
          {error: "Today's daily challenge is not available yet."},
          "getCurrentDailyChallenge",
        );
      }
      challengeDate = canonicalChallengeDate;

      /** Provides riddle id behavior. */
      const riddleId = allData.riddleId || CURRENT_DAILY_RIDDLE_DOC_ID;
      /** Provides canonical riddle behavior. */
      const canonicalRiddle = {
        ...allData,
        riddleId,
        answer: allData.answer as string,
        difficultyBand,
      };
      /** Provides content key behavior. */
      const contentKey = getSinglePlayerContentKey(canonicalRiddle, "challenge", locale);
      /** The committed issuance attempt provides both identity and public projection inputs. */
      let {sessionToken, state: activeSession} = await ensureAuthoritativeSessionWithState(
        request.auth.uid,
        "challenge",
        riddleId,
        locale,
        contentKey,
        completionKey,
        canonicalRiddle.answer,
        {challengeDate: todayDateString, difficultyBand: canonicalRiddle.difficultyBand},
      );
      if (
        activeSession.terminal &&
        !activeSession.isSkipped &&
        isDailyCompletionDateEligible(
          activeSession.challengeDate,
          activeSession.isCorrect,
          trustedSessionDate(activeSession.terminalAt),
          new Date(), activeSession.locale,
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
        /** Provides reconciled progress behavior. */
        const reconciledProgress = resolveDailyChallengeProgress(authenticatedUser, DAILY_CHALLENGE_QUESTION_COUNT, locale);
        if (reconciledProgress.hasCompletedToday) {
          return validateCallableResponse(
            GetCurrentDailyChallengeResponseSchema,
            {...reconciledProgress, error: "Today's daily challenge is already complete."},
            "getCurrentDailyChallenge",
          );
        }
        // A recorded loss remains retryable for the same Daily entitlement.
        ({sessionToken, state: activeSession} = await ensureAuthoritativeSessionWithState(
          request.auth.uid,
          "challenge",
          riddleId,
          locale,
          contentKey,
          completionKey,
          canonicalRiddle.answer,
          {challengeDate: todayDateString, difficultyBand: canonicalRiddle.difficultyBand},
        ));
      }

      /** Provides challenge data behavior. */
      const challengeData = buildSinglePlayerChallengeResponse(
        {...canonicalRiddle, locale},
        challengeDate,
        sessionToken,
        activeSession,
        request.data?.includeEvaluation === true,
        request.data?.includeHintRecovery === true,
        request.data?.includeGuessRecovery === true,
      );

      /** Provides current question behavior. */
      let currentQuestion: number | undefined = undefined;
      /** Indicates whether has completed today. */
      let hasCompletedToday: boolean | undefined = undefined;
      /** Provides questions completed behavior. */
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
  gameplayCallableOptions,
  async (
    request: CallableRequest<{
      /** Stores classic index. */
      classicIndex?: number;
      /** Opts in to canonical Classic position without changing older response shapes. */
      includeClassicIndex?: boolean;
      /** Stores locale. */
      locale?: string;
      /** Stores session token. */
      sessionToken?: unknown;
      /** Opts into preloaded feedback without changing legacy response shapes. */
      includeEvaluation?: boolean;
      /** Opts in to purchased hint recovery without changing older client responses. */
      includeHintRecovery?: boolean;
      /** Opts in to authoritative accepted guess recovery. */
      includeGuessRecovery?: boolean;
      /** Stores riddle id. */
      riddleId?: unknown;
    }>,
  ): Promise<GetCurrentDailyChallengeResponse> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The user must be authenticated to load a classic riddle.");
      }

      /** Requests ed classic index. */
      const requestedClassicIndex =
        request.data?.classicIndex === undefined ? undefined : parseClassicLoadIndex(request.data.classicIndex);

      /** Provides locale behavior. */
      let locale = "en";
      /** Provides r. */
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

      /** Provides resume behavior. */
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
      /** Provides reconciled terminal session behavior. */
      let reconciledTerminalSession = false;
      if (resume) {
        /** Provides resumed behavior. */
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

      /** Provides expected classic index behavior. */
      let expectedClassicIndex = user.progress?.classicIndex ?? 1;
      if (
        await recoverPendingAuthoritativeCompletion(
          request.auth.uid,
          "classic",
          getSinglePlayerCompletionKey("classic", expectedClassicIndex),
          request.auth.token?.firebase?.sign_in_provider === "anonymous",
        )
      ) {
        user = await getUser(request.auth.uid);
        if (!user) throw new HttpsError("not-found", "User data not found.");
        expectedClassicIndex = user.progress?.classicIndex ?? 1;
        reconciledTerminalSession = true;
      }
      if (
        requestedClassicIndex !== undefined &&
        requestedClassicIndex !== expectedClassicIndex &&
        !reconciledTerminalSession
      ) {
        throw new HttpsError("permission-denied", "Only the current classic riddle can be loaded.");
      }
      /** Provides classic index behavior. */
      let classicIndex = expectedClassicIndex;

      /** Provides playable behavior. */
      let playable = await getPlayableClassicRiddle(classicIndex, locale);
      if (!playable) {
        await triggerClassicRiddleGenerationIfNeeded(request.auth.uid, classicIndex, locale as (typeof SUPPORTED_LOCALES)[number]);
        return validateCallableResponse(
          GetCurrentDailyChallengeResponseSchema,
          {error: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"},
          "getCurrentClassicRiddle",
        );
      }
      /** Provides {riddle, content locale} behavior. */
      let {riddle, contentLocale} = playable;
      if (riddle.classicIndex !== undefined && riddle.classicIndex !== expectedClassicIndex) {
        throw new HttpsError("failed-precondition", "The classic riddle does not match current progression.");
      }
      /** Provides content key behavior. */
      const contentKey = getSinglePlayerContentKey(riddle, "classic", contentLocale);
      /** The committed issuance attempt provides both identity and public projection inputs. */
      let {sessionToken, state: activeSession} = await ensureAuthoritativeSessionWithState(
        request.auth.uid,
        "classic",
        riddle.riddleId,
        contentLocale,
        contentKey,
        getSinglePlayerCompletionKey("classic", expectedClassicIndex),
        riddle.answer,
        {classicIndex: expectedClassicIndex, difficultyBand: riddle.difficultyBand},
      );
      if (activeSession.terminal) {
        if (!activeSession.isSkipped) {
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
        /** Provides reconciled index behavior. */
        const reconciledIndex = user.progress?.classicIndex ?? 1;
        if (reconciledIndex !== expectedClassicIndex) {
          classicIndex = reconciledIndex;
          playable = await getPlayableClassicRiddle(classicIndex, locale);
          if (!playable) {
            await triggerClassicRiddleGenerationIfNeeded(request.auth.uid, classicIndex, locale as (typeof SUPPORTED_LOCALES)[number]);
            return validateCallableResponse(
              GetCurrentDailyChallengeResponseSchema,
              {error: "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"},
              "getCurrentClassicRiddle",
            );
          }
          ({riddle, contentLocale} = playable);
        }
        /** Provides reconciled content key behavior. */
        const reconciledContentKey = getSinglePlayerContentKey(riddle, "classic", contentLocale);
        ({sessionToken, state: activeSession} = await ensureAuthoritativeSessionWithState(
          request.auth.uid,
          "classic",
          riddle.riddleId,
          contentLocale,
          reconciledContentKey,
          getSinglePlayerCompletionKey("classic", classicIndex),
          riddle.answer,
          {classicIndex, difficultyBand: riddle.difficultyBand},
        ));
      }

      return validateCallableResponse(
        GetCurrentDailyChallengeResponseSchema,
        {
          ...(request.data?.includeClassicIndex === true ? {classicIndex} : {}),
          challenge: buildSinglePlayerChallengeResponse(riddle, undefined, sessionToken, activeSession, request.data?.includeEvaluation === true, request.data?.includeHintRecovery === true, request.data?.includeGuessRecovery === true),
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
