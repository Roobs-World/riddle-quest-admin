import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {SUPPORTED_LOCALES} from "@qwordly/core/validation";
import {ClassicRiddleBufferResponseSchema} from "../validation/requestSchemas";
import {getUser} from "../gameplay/firestoreService";
import {getPlayableClassicRiddle} from "../gameplay/classicRiddleFallback";
import {getSinglePlayerCompletionKey, getSinglePlayerContentKey} from "../gameplay/singlePlayerAnswerPolicy";
import {ensureAuthoritativeSession, getIssuedAuthoritativeSession} from "../gameplay/singlePlayerSession";
import {buildSinglePlayerChallengeResponse} from "../gameplay/singlePlayerRiddleResponse";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {getCurrentClassicRiddle} from "./dailyChallenge";

/** Issues the current Classic question and at most two future session snapshots. */
export const getClassicRiddleBuffer = onCallWithSentry(
  "getClassicRiddleBuffer",
  browserCallableSecurityOptions,
  async (request: CallableRequest<{
    /** Requested content locale. */ locale?: string;
  }>) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required.");
    if (request.data?.locale !== undefined && !SUPPORTED_LOCALES.includes(request.data.locale as (typeof SUPPORTED_LOCALES)[number])) {
      throw new HttpsError("invalid-argument", "A supported locale is required.");
    }
    // The existing load reconciles a terminal current session before establishing
    // the authoritative base index. Future sessions never advance that index.
    /** The current used by the authoritative operation. */
    const current = await getCurrentClassicRiddle.run({
      ...request,
      data: {...request.data, includeEvaluation: true},
    } as never);
    /** The user used by the authoritative operation. */
    const user = await getUser(request.auth.uid);
    if (!user) throw new HttpsError("not-found", "User data not found.");
    /** The confirmed classic index used by the authoritative operation. */
    const confirmedClassicIndex = user.progress?.classicIndex ?? 1;
    /** The locale used by the authoritative operation. */
    const locale = request.data?.locale ?? user.preferredLanguage ?? "en";
    /** The riddles used by the authoritative operation. */
    const riddles: Array<{
      /** The classic index used by the authoritative operation. */
      classicIndex: number;
      /** The expires at ms used by the authoritative operation. */
      expiresAtMs: number;
      /** The question used by the authoritative operation. */
      question: NonNullable<typeof current.challenge>["questions"][number];
    }> = [];

    /** The current question used by the authoritative operation. */
    const currentQuestion = current.challenge?.questions[0];
    if (currentQuestion) {
      /** The state used by the authoritative operation. */
      const state = await getIssuedAuthoritativeSession(request.auth.uid, currentQuestion.sessionToken, "classic", currentQuestion.riddleId);
      riddles.push({classicIndex: confirmedClassicIndex, expiresAtMs: state.expiresAt.toMillis(), question: currentQuestion});
    }
    for (let offset = 1; offset <= 2 && currentQuestion; offset += 1) {
      /** The classic index used by the authoritative operation. */
      const classicIndex = confirmedClassicIndex + offset;
      /** The playable used by the authoritative operation. */
      const playable = await getPlayableClassicRiddle(classicIndex, locale);
      if (!playable) break;
      /** The destructured result used by the authoritative operation. */
      const {riddle, contentLocale} = playable;
      /** The token used by the authoritative operation. */
      const token = await ensureAuthoritativeSession(
        request.auth.uid,
        "classic",
        riddle.riddleId,
        contentLocale,
        getSinglePlayerContentKey(riddle, "classic", contentLocale),
        getSinglePlayerCompletionKey("classic", classicIndex),
        riddle.answer,
        {classicIndex},
      );
      /** The state used by the authoritative operation. */
      const state = await getIssuedAuthoritativeSession(request.auth.uid, token, "classic", riddle.riddleId);
      /** The question used by the authoritative operation. */
      const question = buildSinglePlayerChallengeResponse(riddle, undefined, token, state, true).questions[0];
      riddles.push({classicIndex, expiresAtMs: state.expiresAt.toMillis(), question});
    }
    return ClassicRiddleBufferResponseSchema.parse({confirmedClassicIndex, riddles});
  },
);
