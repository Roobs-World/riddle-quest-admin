import {RaceEntryResponseSchema} from "@qwordly/core/race";
import {BridgeProfileSchema, BridgeRiddleSchema, type BridgeProfile, type BridgeUser} from "@qwordly/core/bridge";
import {
  ClassicRiddleBufferResponseSchema,
  CompleteGameResponseDataSchema,
  GetCurrentDailyChallengeResponseSchema,
  GetHintResponseSchema,
  GetLeaderboardResponseSchema,
  SkipRiddleResponseSchema,
  SpendCoinsResponseSchema,
  SubmitSinglePlayerGuessResponseDataSchema,
} from "@qwordly/core/validation";
import type {AuthSnapshot, HostServices} from "../play/types";
import {
  AbandonRaceRunResponseSchema,
  ListRaceCategoriesResponseSchema,
  ListRaceInboxResponseSchema,
  PublishRaceChallengeResponseSchema,
  RaceAccessResponseSchema,
  RaceChallengePreviewSchema,
  RaceOutcomeSchema,
  RaceRunResponseSchema,
  RequestRaceHintResponseSchema,
  SkipRaceRiddleResponseSchema,
  SubmitRaceGuessResponseSchema,
} from "@qwordly/core/race";

/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Provides post behavior. */
const post = async (operation: string, body: unknown): Promise<unknown> => {
  /** Provides response behavior. */
  const response = await fetch(`/api/game/${operation}`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body),
  });
  /** Provides payload behavior. */
  const payload: unknown = await response.json();
  if (!response.ok || !isRecord(payload) || payload.ok !== true || !("result" in payload)) {
    /** The error used by the current operation. */
    const error = new Error("reddit-gameplay-request-failed") as Error & {
      /** Structured rejection code for host classification. */ code?: string;
    };
    if (isRecord(payload) && payload.error === "guess-rejected") error.code = "failed-precondition";
    throw error;
  }
  return payload.result;
};

/** Provides unavailable behavior. */
const unavailable = async (): Promise<never> => {
  throw new Error("reddit-capability-unavailable");
};

/** Creates same-origin services for an authenticated Reddit account. */
export const createRedditHostServices = (accountGeneration = 1): HostServices => {
  if (!Number.isSafeInteger(accountGeneration) || accountGeneration < 1 || accountGeneration > 1_000_000) {
    throw new Error("invalid-reddit-account-generation");
  }
  /** Provides r. */
  const user: BridgeUser = {uid: "reddit-account", accountGeneration, displayName: "Riddle Quest player", isAnonymous: false};
  /** Provides profile behavior. */
  let profile: BridgeProfile | null = null;
  /** The classic buffer used by the current operation. */
  let classicBuffer: {
    /** Content locale. */ locale: string;
    /** Server-issued buffer. */ data: ReturnType<typeof ClassicRiddleBufferResponseSchema.parse>;
  } | null = null;
  /** Shared same-origin request that fills the Classic queue. */
  let classicBufferInFlight: {
    /** Requested content locale. */ locale: string;
    /** Pending response. */ promise: Promise<ReturnType<typeof ClassicRiddleBufferResponseSchema.parse>>;
  } | null = null;
  /** Daily response retained until progress changes or the UTC day rolls over. */
  let dailyPreload: {
    /** Requested content locale. */ locale: string;
    /** UTC challenge day. */ day: string;
    /** Pending or completed response. */ promise: Promise<ReturnType<typeof GetCurrentDailyChallengeResponseSchema.parse>>;
  } | null = null;
  /** Loads and retains the Daily response for this UTC day. */
  const preloadDaily = (locale: string) => {
    /** UTC day associated with the cached Daily response. */
    const day = new Date().toISOString().slice(0, 10);
    if (dailyPreload?.locale === locale && dailyPreload.day === day) return dailyPreload.promise;
    /** Request shared by concurrent callers. */
    const promise = post("riddle.daily", {gameMode: "challenge", locale, includeEvaluation: true})
      .then((value) => GetCurrentDailyChallengeResponseSchema.parse(value)).catch((error: unknown) => {
        if (dailyPreload?.promise === promise) dailyPreload = null;
        throw error;
      });
    dailyPreload = {locale, day, promise};
    return promise;
  };
  /** Fetches issued Classic sessions without replacing newer confirmed progress. */
  const refreshClassicBuffer = (locale: string, force = false) => {
    if (!force && classicBufferInFlight?.locale === locale) return classicBufferInFlight.promise;
    /** Request shared by concurrent callers. */
    const promise = post("riddle.classic-buffer", {locale}).then((value) => {
      /** Validated riddle response from the host. */
      const data = ClassicRiddleBufferResponseSchema.parse(value);
      if (classicBuffer?.locale !== locale || data.confirmedClassicIndex >= classicBuffer.data.confirmedClassicIndex)
        classicBuffer = {locale, data};
      return data;
    }).finally(() => {
      if (classicBufferInFlight?.promise === promise) classicBufferInFlight = null;
    });
    classicBufferInFlight = {locale, promise};
    return promise;
  };
  /** Provides subscribers behavior. */
  const subscribers = new Set<(snapshot: AuthSnapshot) => void>();
  /** Provides emit behavior. */
  const emit = () => subscribers.forEach((subscriber) => subscriber({user, profile}));
  /** Provides reload profile behavior. */
  const reloadProfile = async () => {
    profile = BridgeProfileSchema.parse(await post("profile.load", {}));
    emit();
    return profile;
  };
  /** Provides mutate behavior. */
  const mutate = async <T>(operation: string, input: unknown, parse: (value: unknown) => T): Promise<T> => {
    /** Provides result behavior. */
    const result = parse(await post(operation, input));
    await reloadProfile();
    return result;
  };

  return {
    products: [],
    /** Starts Daily and Classic downloads when the player session is ready. */
    preloadInitialRiddles(locale) {
      void refreshClassicBuffer(locale).catch(() => undefined);
      void preloadDaily(locale).catch(() => undefined);
    },
    auth: {
      /** Provides subscribe behavior. */
      subscribe(listener) {
        subscribers.add(listener);
        listener({user, profile});
        if (!profile) void reloadProfile().catch(() => undefined);
        return () => subscribers.delete(listener);
      },
    },
    /** Loads riddle. */
    async loadRiddle(input) {
      if (input.gameMode === "classic" && input.authoritative) {
        /** The data used by the current operation. */
        const data = await refreshClassicBuffer(input.locale);
        /** The issued used by the current operation. */
        const issued = data.riddles.find((item) => item.classicIndex === data.confirmedClassicIndex);
        if (!issued) throw new Error("classic-buffer-unavailable");
        /** The question used by the current operation. */
        const question = issued.question;
        return BridgeRiddleSchema.parse({
          riddleId: question.riddleId, text: question.text, answerLength: question.answerLength,
          ...(question.evaluation ? {evaluation: question.evaluation} : {}),
    ...(question.revealedHints ? {revealedHints: question.revealedHints} : {}),
    ...(question.acceptedGuesses ? {acceptedGuesses: question.acceptedGuesses} : {}),
          sessionToken: question.sessionToken, gameMode: "classic", index: issued.classicIndex,
          attemptsUsed: question.attemptsUsed, hasUsedContinue: question.hasUsedContinue,
          awaitingContinue: question.awaitingContinue,
        });
      }
      /** Classic question index requested by the game. */
      const requestedIndex = input.classicIndex ?? profile?.classicIndex ?? 1;
      /** Finds an unexpired issued Classic question. */
      const findCached = () => input.gameMode === "classic" && classicBuffer?.locale === input.locale
        ? classicBuffer.data.riddles.find((item) =>
            item.classicIndex === requestedIndex && item.expiresAtMs > Date.now() + 30_000,
          )
        : undefined;
      /** Unexpired issued question matching the requested index. */
      let cached = !input.sessionToken && !input.riddleId ? findCached() : undefined;
      if (!cached && input.gameMode === "classic" && !input.sessionToken && !input.riddleId) {
        /** Background request that may fill the Classic queue. */
        const pending = refreshClassicBuffer(input.locale);
        if (requestedIndex > (profile?.classicIndex ?? 1)) {
          try {
            await pending;
            cached = findCached();
          } catch {
            // A current riddle can still load if buffer issuance is temporarily unavailable.
          }
        } else {
          // Show the current question while its three successors download.
          void pending.catch(() => undefined);
        }
      }
      /** Provides raw behavior. */
      const raw = cached && !input.sessionToken && !input.riddleId
        ? GetCurrentDailyChallengeResponseSchema.parse({challenge: {questions: [cached.question], totalQuestions: 1}})
        : input.gameMode === "challenge" && !input.sessionToken && !input.riddleId
          ? await preloadDaily(input.locale)
        : GetCurrentDailyChallengeResponseSchema.parse(
            await post(input.gameMode === "classic" ? "riddle.classic" : "riddle.daily", {...input, includeEvaluation: true}),
          );
      if (input.gameMode === "classic") void refreshClassicBuffer(input.locale).catch(() => undefined);
      /** Provides question behavior. */
      const question = raw.challenge?.questions[0];
      if (!question || raw.error) throw new Error(raw.error ?? "reddit-riddle-unavailable");
      return BridgeRiddleSchema.parse({
        riddleId: question.riddleId,
        text: question.text,
        answerLength: question.answerLength,
        ...(question.evaluation ? {evaluation: question.evaluation} : {}),
    ...(question.revealedHints ? {revealedHints: question.revealedHints} : {}),
    ...(question.acceptedGuesses ? {acceptedGuesses: question.acceptedGuesses} : {}),
        sessionToken: question.sessionToken,
        gameMode: input.gameMode,
        index: input.gameMode === "classic" ? cached?.classicIndex ?? input.classicIndex ?? profile?.classicIndex ?? 1 : question.questionNumber,
        attemptsUsed: question.attemptsUsed,
        hasUsedContinue: question.hasUsedContinue,
        awaitingContinue: question.awaitingContinue,
      });
    },
    /** Loads profile. */
    async loadProfile() {
      return reloadProfile();
    },
    /** Completes game. */
    async completeGame(input) {
      /** Validated result of the current host operation. */
      const result = await mutate("game.complete", input, (value) => CompleteGameResponseDataSchema.parse(value));
      if (input.gameMode === "challenge") dailyPreload = null;
      return result;
    },
    /** Submits guess. */
    async submitGuess(input) {
      /** The result used by the current operation. */
      const result = SubmitSinglePlayerGuessResponseDataSchema.parse(await post("guess.submit", input));
      if (result.gameOver) {
        if (input.gameMode === "challenge") dailyPreload = null;
        void reloadProfile().catch(() => undefined);
        if (input.gameMode === "classic" && classicBuffer)
          void refreshClassicBuffer(classicBuffer.locale, true).catch(() => undefined);
      }
      return result;
    },
    /** Requests hint. */
    async requestHint(input) {
      /** Validated result of the current host operation. */
      const result = GetHintResponseSchema.parse(await post("hint.request", input));
      void reloadProfile().catch(() => undefined);
      return result;
    },
    /** Provides spend coins behavior. */
    async spendCoins(input) {
      return mutate("coins.spend", input, (value) => SpendCoinsResponseSchema.parse(value));
    },
    /** Provides skip riddle behavior. */
    async skipRiddle(input) {
      /** Validated result of the current host operation. */
      const result = SkipRiddleResponseSchema.parse(await post("riddle.skip", input));
      void reloadProfile().catch(() => undefined);
      if (classicBuffer) void refreshClassicBuffer(classicBuffer.locale, true).catch(() => undefined);
      return result;
    },
    /** Requests purchase. */
    async requestPurchase() {
      return unavailable();
    },
    /** Loads leaderboard. */
    async loadLeaderboard(type) {
      return GetLeaderboardResponseSchema.parse(await post("leaderboard.list", {type, limit: 25})).entries;
    },
    /** Updates username. */
    async updateUsername(username) {
      await post("profile.username", {username});
      return reloadProfile();
    },
    /** Updates avatar. */
    async updateAvatar() {
      return unavailable();
    },
    /** Deletes account. */
    async deleteAccount() {
      /** Provides response behavior. */
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({accountGeneration}),
      });
      if (!response.ok) throw new Error("reddit-account-deletion-failed");
      profile = null;
      subscribers.forEach((subscriber) => subscriber({user: null, profile: null}));
    },
    /** Lists race categories. */
    async listRaceCategories(locale) {
      return ListRaceCategoriesResponseSchema.parse(await post("race.categories", {locale}));
    },
    /** Starts race. */
    /** Keeps readiness traffic on the authenticated same-origin gateway. */
    async readyRace(input) { return RaceRunResponseSchema.parse(await post("race.ready", input)); },
    /** Starts race. */
    async startRace(input) {
      return RaceRunResponseSchema.parse(await post("race.start", input));
    },
    /** Submits race guess. */
    async submitRaceGuess(input) {
      return SubmitRaceGuessResponseSchema.parse(await post("race.guess", input));
    },
    /** Requests race hint. */
    async requestRaceHint(input) {
      return RequestRaceHintResponseSchema.parse(await post("race.hint", input));
    },
    /** Provides skip race riddle behavior. */
    async skipRaceRiddle(input) {
      return SkipRaceRiddleResponseSchema.parse(await post("race.skip", input));
    },
    /** Provides resume race behavior. */
    async resumeRace(runId) {
      return RaceRunResponseSchema.parse(await post("race.resume", {runId, includeEvaluation: true, includeGuessHistory: true}));
    },
    /** Provides abandon race behavior. */
    async abandonRace(input) {
      return AbandonRaceRunResponseSchema.parse(await post("race.abandon", input));
    },
    /** Publishes race. */
    async publishRace(input) {
      return PublishRaceChallengeResponseSchema.parse(await post("race.publish", input));
    },
    /** Reads typed readiness only through the same-origin gateway. */
    async getRaceEntry(challengeId, locale) {return RaceEntryResponseSchema.parse(await post("race.entry", {challengeId, locale}));},
    /** Gets race challenge. */
    async getRaceChallenge(challengeId, locale) {
      return RaceChallengePreviewSchema.parse(await post("race.challenge", {challengeId, locale}));
    },
    /** Gets race outcome. */
    async getRaceOutcome(runId) {
      return RaceOutcomeSchema.parse(await post("race.outcome", {runId}));
    },
    /** Lists race inbox. */
    async listRaceInbox(input = {}) {
      return ListRaceInboxResponseSchema.parse(await post("race.inbox", input));
    },
    /** Provides block rival behavior. */
    async blockRival(targetUserId) {
      /** Provides result behavior. */
      const result = await post("safety.block", {targetUserId});
      if (!isRecord(result) || result.blocked !== true || Object.keys(result).length !== 1) {
        throw new Error("invalid-reddit-block-response");
      }
      return {blocked: true};
    },
    /** Provides report rival behavior. */
    async reportRival(input) {
      /** Provides result behavior. */
      const result = await post("safety.report", input);
      if (
        !isRecord(result) ||
        typeof result.reportId !== "string" ||
        result.queued !== true ||
        Object.keys(result).length !== 2
      )
        throw new Error("invalid-reddit-report-response");
      return {reportId: result.reportId, queued: true};
    },
    /** Gets race access. */
    async getRaceAccess() {
      return RaceAccessResponseSchema.parse(await post("race.access", {locale: "en"}));
    },
    recordRaceAnalytics: unavailable,
  };
};
