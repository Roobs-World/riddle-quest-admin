import {logger} from "firebase-functions/v2";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {CONTINUE_COST_COINS} from "../shared/constants";
import {triggerClassicRiddleGenerationIfNeeded} from "../riddles/riddleSupply";
import {captureException} from "../shared/sentry";
import {z} from "zod";
import {
  SkipRiddleRequest,
  SkipRiddleRequestSchema,
  SkipRiddleResponse,
  SkipRiddleResponseSchema,
  SpendCoinsRequest,
  SpendCoinsRequestSchema,
  SpendCoinsResponseSchema,
  GetHintRequestSchema,
  GetHintResponseSchema,
} from "../validation/requestSchemas";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {
  getIssuedAuthoritativeSession,
  grantAuthoritativeContinue,
  purchaseAuthoritativeHint,
  skipAuthoritativeRiddle,
} from "./singlePlayerSession";
import type {SupportedLocale} from "@qwordly/core/validation";
import {getSafeErrorMetadata} from "../shared/errorMetadata";

/**
 * Skips the current riddle by marking it as completed and advancing to the next level/question.
 * @param data - The request data object containing riddleId and gameMode.
 * @param data.riddleId - The ID of the riddle being skipped.
 * @param data.gameMode - The game mode. Daily challenge riddles are rejected.
 * @param context - The context object representing the request context.
 * @return An object containing success status and new progress information.
 */
export const skipRiddle = onCallWithSentry(
  "skipRiddle",
  browserCallableSecurityOptions,
  async (request: CallableRequest<SkipRiddleRequest>): Promise<SkipRiddleResponse> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The user must be authenticated to skip a riddle.");
      }

      const currentUserId = request.auth.uid;
      const data = validateCallableRequest(
        SkipRiddleRequestSchema,
        request.data,
        "skipRiddle",
        (error) =>
          error.issues.some((issue) => issue.path[0] === "gameMode")
            ? "Invalid game mode specified."
            : "Invalid request payload for skipRiddle.",
      );
      const {riddleId, gameMode, sessionToken, requestId} = data;

      if (gameMode === "challenge") {
        throw new HttpsError("failed-precondition", "Daily riddles cannot be skipped.");
      }

      const session = await getIssuedAuthoritativeSession(currentUserId, sessionToken, "classic", riddleId);
      const result = await skipAuthoritativeRiddle(currentUserId, {
        riddleId,
        gameMode: "classic",
        sessionToken,
        requestId,
      });
      await triggerClassicRiddleGenerationIfNeeded(
        currentUserId,
        result.newProgress.classicIndex,
        session.locale as SupportedLocale,
      );
      const progressMessage = `Advanced to classic level ${result.newProgress.classicIndex}`;

      logger.info(
        `User ${currentUserId} skipped an authorized ${gameMode} riddle. ${progressMessage}`,
      );

      return validateCallableResponse(
        SkipRiddleResponseSchema,
        {
          success: true,
          newProgress: result.newProgress,
          message: `Riddle skipped successfully. ${result.costDeducted} coins deducted. ${progressMessage}`,
          costDeducted: result.costDeducted,
        },
        "skipRiddle",
      );
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("Unexpected error skipping riddle.", getSafeErrorMetadata(error));
      captureException(error);
      throw new HttpsError("internal", "An error occurred while skipping the riddle.");
    }
  },
);

/**
 * Callable function to charge the authoritative paid-continue transaction.
 * @param data - The request data.
 * @param data.reason - Always "continue"; hints/skips use dedicated callables.
 * @param context - The CallableContext object.
 * @return {Promise<{ newCoins: number }>} A Promise resolving to the new coin balance.
 */
export const spendCoins = onCallWithSentry(
  "spendCoins",
  browserCallableSecurityOptions,
  async (request: CallableRequest<SpendCoinsRequest>): Promise<{newCoins: number}> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }

    const {gameMode, riddleId, sessionToken, requestId, amount} = validateCallableRequest(
      SpendCoinsRequestSchema,
      request.data,
      "spendCoins",
      (error) => {
        if (error.issues.some((issue) => issue.path[0] === "reason")) {
          return "Invalid reason specified. Only 'continue' is supported.";
        }
        return "Invalid request payload for spendCoins.";
      },
    );
    const userId = request.auth.uid;

    try {
      if (amount !== undefined && amount !== CONTINUE_COST_COINS) {
        throw new HttpsError(
          "invalid-argument",
          `Supplied amount (${amount}) does not match expected cost (${CONTINUE_COST_COINS}) for continue.`,
        );
      }
      const newCoins = await grantAuthoritativeContinue(
        userId,
        gameMode,
        riddleId,
        requestId,
        sessionToken,
      );
      return validateCallableResponse(SpendCoinsResponseSchema, {newCoins}, "spendCoins");
    } catch (error: unknown) {
      // Only log unexpected errors, not expected business logic errors
      if (error instanceof HttpsError) {
        throw error;
      }
      // Log unexpected errors
      logger.error("Unexpected error spending coins.", getSafeErrorMetadata(error));
      captureException(error);
      throw new HttpsError("internal", "An error occurred while spending coins.");
    }
  },
);

/**
 * Callable function to reveal a single hint letter for an active riddle.
 * Charges `HINT_COST_COINS`, updates riddle state, increments `stats.totalHintsUsed`,
 * evaluates hint-related achievements, and returns the revealed letter index and costs.
 */
export const getHint = onCallWithSentry(
  "getHint",
  browserCallableSecurityOptions,
  async (request: CallableRequest<z.infer<typeof GetHintRequestSchema>>) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
      }

      const data = validateCallableRequest(GetHintRequestSchema, request.data, "getHint");
      const currentUserId = request.auth.uid;
      const result = await purchaseAuthoritativeHint(currentUserId, data);
      logger.info(`User ${currentUserId} completed an authorized hint request for ${data.gameMode}.`);
      return validateCallableResponse(GetHintResponseSchema, result, "getHint");
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      logger.error("Unexpected error in getHint.", getSafeErrorMetadata(error));
      captureException(error);
      throw new HttpsError("internal", "An unexpected error occurred in getHint.");
    }
  },
);
