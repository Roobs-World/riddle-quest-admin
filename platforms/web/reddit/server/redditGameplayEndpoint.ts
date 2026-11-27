import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {onRequestWithSentry} from "../../../../firebase-functions/src/shared/sentryHandlers";
import {getCurrentClassicRiddle, getCurrentDailyChallenge} from "../../../../firebase-functions/src/daily/dailyChallenge";
import {getClassicRiddleBuffer} from "../../../../firebase-functions/src/daily/classicRiddleBuffer";
import {submitSinglePlayerGuess} from "../../../../firebase-functions/src/gameplay/callables/submitSinglePlayerGuessCallable";
import {completeGame} from "../../../../firebase-functions/src/gameplay/callables/completeGameCallable";
import {getHint, skipRiddle, spendCoins} from "../../../../firebase-functions/src/gameplay/callables/gameLogic";
import {getLeaderboard} from "../../../../firebase-functions/src/gameplay/leaderboard";
import {getUser} from "../../../../firebase-functions/src/gameplay/firestoreService";
import {updateUsername} from "../../../../firebase-functions/src/profile/updateUsername";
import {runWithAccountOperationLease} from "../../../../firebase-functions/src/shared/accountDeletion";
import {
  consumeRedditGatewayNonce,
  consumeRedditRequestQuota,
  parseRedditGatewayEnvelope,
  REDDIT_APP_NAME,
  redditProviderIdentityId,
  resolveRedditProviderIdentity,
} from "./redditEndpoints";
import {verifyRedditGatewayAssertion} from "./redditSecurity";
import {isRedditCommerceEnabled, isRedditFeatureEnabled} from "./redditFeatureFlags";
import {
  FindRedditRaceMatchRequestSchema,
  ListFacebookTournamentRequestSchema,
  ListFacebookTournamentResponseSchema,
  RecordFacebookTournamentRunRequestSchema,
  RecordFacebookTournamentRunResponseSchema,
  classifyRaceMatchFailure,
  UpdateLiveRaceSchema,
} from "../../../../src/races/contracts/index.js";
import {joinLiveRace, retireLiveRaceJoin, confirmLiveGuessReceipt, updateLiveRace, listLiveRaceHistory, listLiveRaceChallenges, getLiveRaceChallenge} from "../../../../firebase-functions/src/race/api/raceLiveCallables";
import {liveRaceGatewayFailure} from "../../../../firebase-functions/src/race/live/raceLiveFailures";
import {findRedditRaceMatch} from "./redditMatchmaking";
import {assertRaceAccess} from "../../../../firebase-functions/src/race/access/raceRollout";
import {
  abandonRaceRun,
  getRaceAccess,
  getRaceChallenge,
  getRaceEntry,
  getRaceOutcome,
  listRaceCategories,
  listRaceInbox,
  publishRaceChallenge,
  requestRaceHint,
  resumeRaceRun,
  skipRaceRiddle,
  startRaceRun,
  readyRaceRun,
  submitRaceGuess,
} from "../../../../firebase-functions/src/race/api/raceCallables";
import {
  listRedditTournamentStandings,
  recordRedditTournamentRun,
  REDDIT_TOURNAMENT_SORT_ORDER,
} from "./race/redditTournament";
import {hydrateRedditLiveRaceProfile} from "./redditLiveRaceProfile";
import {hydrateRedditRaceSocialResult} from "./redditSocialProfile";
import {disconnectRedditPresence, pollRedditPresence} from "./redditPresence";
import {blockRival, reportRival} from "../../../../firebase-functions/src/social/socialSafetyCallables";
import {grantVerifiedRedditOrder, refundVerifiedRedditOrder} from "./redditCommerceLedger";
import {bindRedditReferralToken, issueRedditReferralToken} from "./redditReferrals";
import {SUPPORTED_LOCALES, type SupportedLocale} from "../../../../src/localization/locales.js";

/** Provides gateway secret behavior. */
const gatewaySecret = defineSecret("REDDIT_GATEWAY_SECRET");
/** Provides uid secret behavior. */
const uidSecret = defineSecret("REDDIT_UID_SECRET");
/** Every Reddit question, guess and race action shares this endpoint, so one warm instance avoids idle cold starts. */
const options = {secrets: [gatewaySecret, uidSecret], invoker: "public" as const, timeoutSeconds: 60, minInstances: 0};
/** Defines the max body bytes value. */
const MAX_BODY_BYTES = 80 * 1_024;

/** Defines the reddit gameplay operations value. */
export const REDDIT_GAMEPLAY_OPERATIONS = [
  "gameplay.profile.load",
  "gameplay.riddle.classic",
  "gameplay.riddle.classic-buffer",
  "gameplay.riddle.daily",
  "gameplay.guess.submit",
  "gameplay.game.complete",
  "gameplay.hint.request",
  "gameplay.coins.spend",
  "gameplay.riddle.skip",
  "gameplay.leaderboard.list",
  "gameplay.profile.username",
  "gameplay.race.access",
  "gameplay.race.categories",
  "gameplay.race.start",
  "gameplay.race.ready",
  "gameplay.race.guess",
  "gameplay.race.hint",
  "gameplay.race.skip",
  "gameplay.race.resume",
  "gameplay.race.abandon",
  "gameplay.race.publish",
  "gameplay.race.challenge",
  "gameplay.race.entry",
  "gameplay.race.outcome",
  "gameplay.race.inbox",
  "gameplay.race.match",
  "gameplay.race.live.join",
  "gameplay.race.live.retire",
  "gameplay.race.live.receipt",
  "gameplay.race.live.update",
  "gameplay.race.live.history",
  "gameplay.race.live.inbox",
  "gameplay.race.live.challenge",
  "gameplay.tournament.list",
  "gameplay.tournament.record",
  "gameplay.presence.poll",
  "gameplay.presence.disconnect",
  "gameplay.safety.block",
  "gameplay.safety.report",
  "gameplay.commerce.fulfill",
  "gameplay.commerce.refund",
  "gameplay.referral.issue",
  "gameplay.referral.bind",
] as const;
/** Describes reddit gameplay operation. */
export type RedditGameplayOperation = (typeof REDDIT_GAMEPLAY_OPERATIONS)[number];
/** Renders the operations interface. */
const OPERATIONS = new Set<string>(REDDIT_GAMEPLAY_OPERATIONS);
/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** Provides referral locale behavior. */
const referralLocale = (value: unknown): SupportedLocale => {
  if (typeof value !== "string" || !(SUPPORTED_LOCALES as readonly string[]).includes(value)) {
    throw new Error("invalid-reddit-referral-locale");
  }
  return value as SupportedLocale;
};

/** Parses reddit gameplay operation. */
export function parseRedditGameplayOperation(assertion: unknown): RedditGameplayOperation {
  /** Provides operation behavior. */
  const operation = isRecord(assertion) ? assertion.operation : undefined;
  if (typeof operation !== "string" || !OPERATIONS.has(operation)) throw new Error("invalid-reddit-gameplay-operation");
  return operation as RedditGameplayOperation;
}

/** Provides callable request behavior. */
const callableRequest = <T>(uid: string, data: T): CallableRequest<T> =>
  ({
    data,
    auth: {uid, token: {firebase: {sign_in_provider: "custom"}}},
  }) as CallableRequest<T>;

/** Provides public profile behavior. */
const publicProfile = async (uid: string) => {
  /** Provides r. */
  const user = await getUser(uid);
  if (!user) throw new Error("reddit-user-not-found");
  return {
    username: user.username,
    coins: user.coins,
    level: user.stats.level,
    xp: user.stats.xp,
    winStreak: user.stats.winStreak,
    gamesPlayed: user.stats.gamesPlayed,
    wins: user.stats.wins,
    achievements: user.unlockedAchievements.map((entry) => entry.achievementId),
    classicIndex: user.progress.classicIndex,
    ...(user.avatarUrl ? {avatarUrl: user.avatarUrl} : {}),
    dailyChallengeIndex: user.progress.dailyChallengeIndex,
    dailyChallengeCurrentQuestion: user.progress.dailyChallengeCurrentQuestion,
    dailyPuzzlesCompleted: user.stats.dailyPuzzlesCompleted,
    bestStreak: user.stats.bestStreak,
    totalWordsGuessed: user.stats.totalWordsGuessed,
    winRate: user.stats.winRate,
    averageGuesses: user.stats.averageGuesses,
    totalScore: user.stats.totalScore,
    highestLevelClassic: user.stats.highestLevelClassic,
    challengeWins: user.stats.challengeWins,
    totalWins: user.stats.totalWins,
    totalGuessesInWins: user.stats.totalGuessesInWins,
    totalHintsUsed: user.stats.totalHintsUsed,
    multiplayerGamesPlayed: user.stats.multiplayerGamesPlayed,
    multiplayerWins: user.stats.multiplayerWins,
    multiplayerChallengesCreated: user.stats.multiplayerChallengesCreated,
    hasPurchasedApp: user.hasPurchasedApp,
  };
};

/** Provides dispatch behavior. */
const dispatch = async (
  operation: RedditGameplayOperation,
  uid: string,
  payload: unknown,
  trustedContext?: {
    /** Stores post id. */
    postId: string;
  },
): Promise<unknown> => {
  switch (operation) {
    case "gameplay.profile.load":
      if (!isRecord(payload) || Object.keys(payload).length !== 0) throw new Error("invalid-reddit-profile-payload");
      return runWithAccountOperationLease(uid, 60, () => publicProfile(uid));
    case "gameplay.riddle.classic":
      return getCurrentClassicRiddle.run(callableRequest(uid, payload) as never);
    case "gameplay.riddle.classic-buffer":
      return getClassicRiddleBuffer.run(callableRequest(uid, payload) as never);
    case "gameplay.riddle.daily":
      return getCurrentDailyChallenge.run(callableRequest(uid, payload) as never);
    case "gameplay.guess.submit":
      return submitSinglePlayerGuess.run(callableRequest(uid, payload) as never);
    case "gameplay.game.complete":
      return completeGame.run(callableRequest(uid, payload) as never);
    case "gameplay.hint.request":
      return getHint.run(callableRequest(uid, payload) as never);
    case "gameplay.coins.spend":
      return spendCoins.run(callableRequest(uid, payload) as never);
    case "gameplay.riddle.skip":
      return skipRiddle.run(callableRequest(uid, payload) as never);
    case "gameplay.leaderboard.list":
      return getLeaderboard.run(callableRequest(uid, payload));
    case "gameplay.profile.username":
      return updateUsername.run(callableRequest(uid, payload));
    case "gameplay.race.access":
      return getRaceAccess.run(callableRequest(uid, payload) as never);
    case "gameplay.race.categories":
      return listRaceCategories.run(callableRequest(uid, payload) as never);
    case "gameplay.race.ready":
      return readyRaceRun.run(callableRequest(uid, payload) as never);
    case "gameplay.race.start":
      return startRaceRun.run(callableRequest(uid, payload) as never);
    case "gameplay.race.guess":
      return submitRaceGuess.run(callableRequest(uid, payload) as never);
    case "gameplay.race.hint":
      return requestRaceHint.run(callableRequest(uid, payload) as never);
    case "gameplay.race.skip":
      return skipRaceRiddle.run(callableRequest(uid, payload) as never);
    case "gameplay.race.resume":
      return resumeRaceRun.run(callableRequest(uid, payload) as never);
    case "gameplay.race.abandon":
      return abandonRaceRun.run(callableRequest(uid, payload) as never);
    case "gameplay.race.publish":
      return publishRaceChallenge.run(callableRequest(uid, payload) as never);
    case "gameplay.race.entry":
      return getRaceEntry.run(callableRequest(uid, payload) as never);
    case "gameplay.race.challenge":
      return getRaceChallenge.run(callableRequest(uid, payload) as never);
    case "gameplay.race.outcome":
      return getRaceOutcome.run(callableRequest(uid, payload) as never);
    case "gameplay.race.inbox":
      return listRaceInbox.run(callableRequest(uid, payload) as never);
    case "gameplay.race.live.join":
      return joinLiveRace.run(callableRequest(uid, payload) as never);
    case "gameplay.race.live.retire":
      return retireLiveRaceJoin.run(callableRequest(uid, payload) as never);
    case "gameplay.race.live.receipt":
      // Pure observation bypasses mutation admission inside its callable; signed nonce and quota remain enforced.
      return confirmLiveGuessReceipt.run(callableRequest(uid, payload) as never);
    case "gameplay.race.live.update":
      return updateLiveRace.run(callableRequest(uid, payload) as never);
    case "gameplay.race.live.history":
      return listLiveRaceHistory.run(callableRequest(uid, payload) as never);
    case "gameplay.race.live.inbox":
      return listLiveRaceChallenges.run(callableRequest(uid, payload) as never);
    case "gameplay.race.live.challenge":
      return getLiveRaceChallenge.run(callableRequest(uid, payload) as never);
    case "gameplay.race.match": {
      /** Provides input behavior. */
      const input = FindRedditRaceMatchRequestSchema.parse(payload);
      await assertRaceAccess(uid, input.locale);
      return findRedditRaceMatch(uid, input);
    }
    case "gameplay.tournament.list": {
      /** Provides input behavior. */
      const input = ListFacebookTournamentRequestSchema.parse(payload);
      await assertRaceAccess(uid, input.locale);
      return ListFacebookTournamentResponseSchema.parse(await listRedditTournamentStandings(uid, input.locale));
    }
    case "gameplay.tournament.record": {
      /** Provides input behavior. */
      const input = RecordFacebookTournamentRunRequestSchema.parse(payload);
      await assertRaceAccess(uid, input.locale);
      /** Provides {entry, improved} behavior. */
      const {entry, improved} = await runWithAccountOperationLease(uid, options.timeoutSeconds,
        () => recordRedditTournamentRun(uid, input));
      return RecordFacebookTournamentRunResponseSchema.parse({
        tournamentId: entry.tournamentId,
        locale: entry.locale,
        runId: entry.runId,
        adjustedTimeMs: entry.adjustedTimeMs,
        completedAtMs: entry.completedAtMs,
        improved,
        sortOrder: REDDIT_TOURNAMENT_SORT_ORDER,
        rewardsEnabled: false,
      });
    }
    case "gameplay.presence.poll": {
      if (!isRecord(payload) || Object.keys(payload).some((key) => !["sessionId", "state", "enabled"].includes(key))) {
        throw new Error("invalid-reddit-presence-payload");
      }
      return pollRedditPresence(
        uid,
        payload as {
          /** Stores session id. */
          sessionId: string; /** Stores state. */
          /** Stores state. */
          state: "online" | "playing" | "racing"; /** Stores enabled. */
          /** Stores enabled. */
          enabled: boolean;
        },
      );
    }
    case "gameplay.presence.disconnect": {
      if (!isRecord(payload) || Object.keys(payload).length !== 1 || typeof payload.sessionId !== "string") {
        throw new Error("invalid-reddit-presence-payload");
      }
      await disconnectRedditPresence(uid, payload.sessionId);
      return {success: true};
    }
    case "gameplay.safety.block":
      return blockRival.run(callableRequest(uid, payload) as never);
    case "gameplay.safety.report":
      return reportRival.run(callableRequest(uid, payload) as never);
    case "gameplay.commerce.fulfill": {
      if (
        !isRecord(payload) ||
        Object.keys(payload).length !== 4 ||
        typeof payload.orderId !== "string" ||
        typeof payload.productId !== "string" ||
        (payload.environment !== "sandbox" && payload.environment !== "production") ||
        typeof payload.purchasedAtMs !== "number"
      )
        throw new Error("invalid-reddit-commerce-payload");
      return grantVerifiedRedditOrder(admin.firestore(), {
        uid,
        orderId: payload.orderId,
        productId: payload.productId,
        environment: payload.environment,
        purchasedAtMs: payload.purchasedAtMs,
      });
    }
    case "gameplay.commerce.refund": {
      if (
        !isRecord(payload) ||
        Object.keys(payload).length !== 4 ||
        typeof payload.orderId !== "string" ||
        typeof payload.productId !== "string" ||
        (payload.environment !== "sandbox" && payload.environment !== "production") ||
        typeof payload.refundedAtMs !== "number"
      )
        throw new Error("invalid-reddit-commerce-payload");
      return refundVerifiedRedditOrder(admin.firestore(), {
        orderId: payload.orderId,
        productId: payload.productId,
        environment: payload.environment,
        refundedAtMs: payload.refundedAtMs,
      });
    }
    case "gameplay.referral.issue": {
      if (
        !isRecord(payload) ||
        Object.keys(payload).length !== 2 ||
        typeof payload.locale !== "string" ||
        (payload.environment !== "sandbox" && payload.environment !== "production") ||
        !trustedContext
      )
        throw new Error("invalid-reddit-referral-payload");
      return issueRedditReferralToken(uid, Date.now(), undefined, admin.firestore(), {
        locale: referralLocale(payload.locale),
        postId: trustedContext.postId,
        environment: payload.environment,
      });
    }
    case "gameplay.referral.bind": {
      if (
        !isRecord(payload) ||
        Object.keys(payload).length !== 3 ||
        typeof payload.token !== "string" ||
        typeof payload.locale !== "string" ||
        (payload.environment !== "sandbox" && payload.environment !== "production") ||
        !trustedContext
      ) {
        throw new Error("invalid-reddit-referral-payload");
      }
      return bindRedditReferralToken(uid, payload.token, Date.now(), admin.firestore(), {
        locale: referralLocale(payload.locale),
        postId: trustedContext.postId,
        environment: payload.environment,
      });
    }
  }
};

/** Same-origin Reddit server gateway for existing server-authoritative single-player handlers. */
export const redditGameplay = onRequestWithSentry("redditGameplay", options, async (request, response) => {
  /** The verified guess used by the authoritative operation. */
  let verifiedGuess = false;
  /** Only authenticated matchmaking failures expose the portable recovery contract. */
  let verifiedMatch = false;
  /** Safe live command categories are exposed only after provider identity resolution. */
  let verifiedLive = false;
  response.set("Cache-Control", "no-store");
  response.set("X-Content-Type-Options", "nosniff");
  if (request.method !== "POST") {
    response.status(405).json({error: "method-not-allowed"});
    return;
  }
  if (request.rawBody && request.rawBody.byteLength > MAX_BODY_BYTES) {
    response.status(413).json({error: "payload-too-large"});
    return;
  }
  if (!isRedditFeatureEnabled("identity")) {
    response.status(503).json({error: "reddit-feature-disabled:identity"});
    return;
  }
  if (!isRedditFeatureEnabled("gameplay")) {
    response.status(503).json({error: "reddit-feature-disabled:gameplay"});
    return;
  }
  try {
    /** Provides envelope behavior. */
    const envelope = parseRedditGatewayEnvelope(request.body);
    /** Provides operation behavior. */
    const operation = parseRedditGameplayOperation(envelope.assertion);
    if (operation.startsWith("gameplay.race.") && !isRedditFeatureEnabled("matchmaking")) {
      response.status(503).json({error: "reddit-feature-disabled:matchmaking"});
      return;
    }
    if (operation.startsWith("gameplay.tournament.") && !isRedditFeatureEnabled("tournaments")) {
      response.status(503).json({error: "reddit-feature-disabled:tournaments"});
      return;
    }
    if (operation.startsWith("gameplay.presence.") && !isRedditFeatureEnabled("presence")) {
      response.status(503).json({error: "reddit-feature-disabled:presence"});
      return;
    }
    if (operation.startsWith("gameplay.commerce.")) {
      /** Provides environment behavior. */
      const environment = isRecord(envelope.payload) ? envelope.payload.environment : undefined;
      if ((environment !== "sandbox" && environment !== "production") || !isRedditCommerceEnabled(environment)) {
        response.status(503).json({error: "reddit-feature-disabled:commerce"});
        return;
      }
    }
    if (operation.startsWith("gameplay.referral.") && !isRedditFeatureEnabled("referrals")) {
      response.status(503).json({error: "reddit-feature-disabled:referrals"});
      return;
    }
    /** Asserts ion. */
    const assertion = await verifyRedditGatewayAssertion(
      envelope.assertion,
      request.get("x-riddle-quest-reddit-signature") ?? "",
      {
        gatewaySecret: gatewaySecret.value(),
        expectedAppName: REDDIT_APP_NAME,
        expectedOperation: operation,
        expectedPayload: envelope.payload,
        consumeNonce: consumeRedditGatewayNonce,
      },
    );
    verifiedGuess = operation === "gameplay.guess.submit";
    verifiedMatch = operation === "gameplay.race.match";
    /** Malformed inputs stay in the existing quota so rejection cannot bypass request accounting. */
    const liveUpdate = operation === "gameplay.race.live.update" ? UpdateLiveRaceSchema.safeParse(envelope.payload) : undefined;
    /** Only a schema-valid signed player command receives its separate bounded budget. */
    const quotaOperation = liveUpdate?.success && liveUpdate.data.action !== "poll" ? `${operation}.command` : assertion.operation;
    if (
      !(await consumeRedditRequestQuota(
        `${assertion.appName}\0${assertion.userId}\0${quotaOperation}`,
        gatewaySecret.value(),
      ))
    ) {
      response.status(429).json({error: "rate-limited"});
      return;
    }
    /** Provides provider behavior. */
    const provider = await admin
      .firestore()
      .collection("providerIdentities")
      .doc(redditProviderIdentityId(assertion.appName, assertion.userId))
      .get();
    /** Provides identity behavior. */
    const identity = resolveRedditProviderIdentity(provider.data(), {
      appName: assertion.appName,
      userId: assertion.userId,
      uidSecret: uidSecret.value(),
    });
    if (identity.needsUidRepair) throw new Error("reddit-session-refresh-required");
    verifiedLive = operation === "gameplay.race.live.join" || operation === "gameplay.race.live.update" || operation === "gameplay.race.live.retire" || operation === "gameplay.race.live.receipt";
    /** Provides result behavior. */
    const result = await dispatch(operation, identity.uid, envelope.payload, {postId: assertion.postId});
    response.json({
      ok: true,
      result: operation === "gameplay.race.live.join" || operation === "gameplay.race.live.update"
        ? await hydrateRedditLiveRaceProfile(result, admin.firestore(), Date.now())
        : operation.startsWith("gameplay.race.")
          ? await hydrateRedditRaceSocialResult(operation, envelope.payload, result)
          : result,
    });
  } catch (error) {
    if (verifiedLive) {
      /** Safe rejection semantics permit stale-question recovery through the approved gateway. */
      const failure = liveRaceGatewayFailure(error);
      response.status(failure.status).json(failure.body);
      return;
    }
    if (verifiedMatch) {
      /** No raw exception details, player IDs or answer-bearing payloads reach the gateway. */
      const matchmaking = classifyRaceMatchFailure(error);
      /** Portable recovery policy remains intact through the same-origin Devvit proxy. */
      const status = matchmaking.reason === "access-denied" ? 403 : matchmaking.reason === "invalid-request" ? 400 :
        matchmaking.reason === "search-budget-exceeded" ? 429 : matchmaking.recovery === "new-intent" ? 409 : 503;
      response.status(status).json({error: "race-matchmaking-failed", matchmaking});
      return;
    }
    if (verifiedGuess) {
      /** The code used by the authoritative operation. */
      const code = error instanceof HttpsError ? error.code : "unknown";
      /** The rejected used by the authoritative operation. */
      const rejected = ["invalid-argument", "permission-denied", "failed-precondition", "not-found", "unauthenticated"].includes(code);
      response.status(rejected ? 409 : 503).json({error: rejected ? "guess-rejected" : "guess-retryable"});
      return;
    }
    response.status(401).json({error: "invalid-request"});
  }
});
