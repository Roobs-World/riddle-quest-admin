import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {SUPPORTED_LOCALES} from "@qwordly/core/validation";
import {ClassicRiddleBufferResponseSchema} from "@qwordly/core/validation/requestSchemas";
import {getUser} from "../gameplay/firestoreService";
import {getPlayableClassicRiddle} from "../gameplay/classicRiddleFallback";
import {getSinglePlayerCompletionKey, getSinglePlayerContentKey} from "../gameplay/singlePlayerAnswerPolicy";
import {ensureAuthoritativeSession, getIssuedAuthoritativeSession} from "../gameplay/singlePlayerSession";
import {buildSinglePlayerChallengeResponse} from "../gameplay/singlePlayerRiddleResponse";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {getCurrentClassicRiddle} from "./dailyChallenge";

/** Issues the current Classic question and at most three future session snapshots. */
export const getClassicRiddleBuffer = onCallWithSentry(
  "getClassicRiddleBuffer",
  browserCallableSecurityOptions,
  async (request: CallableRequest<{
    /** Requested content locale. */ locale?: string;
    /** Opts in to authoritative purchased hint recovery. */ includeHintRecovery?: boolean;
    /** Opts in to authoritative accepted guess recovery. */ includeGuessRecovery?: boolean;
  }>) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required.");
    /** Authenticated account owns every prepared session in this buffer. */
    const userId = request.auth.uid;
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
    const user = await getUser(userId);
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
      const state = await getIssuedAuthoritativeSession(userId, currentQuestion.sessionToken, "classic", currentQuestion.riddleId);
      riddles.push({classicIndex: confirmedClassicIndex, expiresAtMs: state.expiresAt.toMillis(), question: currentQuestion});
    }
    // Stop at the first catalog gap before issuing any later entitlement.
    /** Contiguous playable successors stop at the first catalog gap. */
    const upcoming: Array<{
      /** Canonical catalog position binds the prepared session entitlement. */
      classicIndex: number;
      /** Localized authored content selected for this canonical catalog position. */
      playable: NonNullable<Awaited<ReturnType<typeof getPlayableClassicRiddle>>>;
    }> = [];
    for (let offset = 1; offset <= 3 && currentQuestion; offset += 1) {
      /** Canonical catalog position binds the prepared session entitlement. */
      const classicIndex = confirmedClassicIndex + offset;
      /** Localized authored content selected for this canonical catalog position. */
      const playable = await getPlayableClassicRiddle(classicIndex, locale);
      if (!playable) break;
      upcoming.push({classicIndex, playable});
    }
    // Each canonical content key owns its binding/session transaction. Preparing
    // at most three independent sessions together avoids serial database trips.
    // Promise.all preserves catalog order even when later sessions finish first.
    /** Prepared successor sessions retain canonical catalog order. */
    const futureRiddles = await Promise.all(upcoming.map(async ({classicIndex, playable}) => {
      /** Extracts the fixture or authority fields required by this transition. */
      const {riddle, contentLocale} = playable;
      /** Issued session token authorizes recovery and later server mutations. */
      const token = await ensureAuthoritativeSession(
        userId,
        "classic",
        riddle.riddleId,
        contentLocale,
        getSinglePlayerContentKey(riddle, "classic", contentLocale),
        getSinglePlayerCompletionKey("classic", classicIndex),
        riddle.answer,
        {classicIndex},
      );
      /** Authoritative or observed state used to verify the current transition. */
      const state = await getIssuedAuthoritativeSession(userId, token, "classic", riddle.riddleId);
      /** Public question carries the issued session and negotiated recovery fields. */
      const question = buildSinglePlayerChallengeResponse(riddle, undefined, token, state, true, request.data?.includeHintRecovery === true, request.data?.includeGuessRecovery === true).questions[0];
      return {classicIndex, expiresAtMs: state.expiresAt.toMillis(), question};
    }));
    riddles.push(...futureRiddles);
    return ClassicRiddleBufferResponseSchema.parse({confirmedClassicIndex, riddles});
  },
);
