import {BridgeProfileSchema, BridgeRiddleSchema, type BridgeProfile, type BridgeUser} from "@qwordly/core/bridge";
import {
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
  AbandonRaceRunResponseSchema, ListRaceCategoriesResponseSchema, ListRaceInboxResponseSchema,
  PublishRaceChallengeResponseSchema, RaceAccessResponseSchema, RaceChallengePreviewSchema,
  RaceOutcomeSchema, RaceRunResponseSchema, RequestRaceHintResponseSchema,
  SkipRaceRiddleResponseSchema, SubmitRaceGuessResponseSchema,
} from "@qwordly/core/race";

/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Provides post behavior. */
const post = async (operation: string, body: unknown): Promise<unknown> => {
  const response = await fetch(`/api/game/${operation}`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json();
  if (!response.ok || !isRecord(payload) || payload.ok !== true || !("result" in payload)) {
    throw new Error("reddit-gameplay-request-failed");
  }
  return payload.result;
};

/** Provides unavailable behavior. */
const unavailable = async (): Promise<never> => { throw new Error("reddit-capability-unavailable"); };

/** Creates same-origin services for an authenticated Reddit account. */
export const createRedditHostServices = (accountGeneration = 1): HostServices => {
  if (!Number.isSafeInteger(accountGeneration) || accountGeneration < 1 || accountGeneration > 1_000_000) {
    throw new Error("invalid-reddit-account-generation");
  }
  const user: BridgeUser = {uid: "reddit-account", displayName: "Riddle Quest player", isAnonymous: false};
  let profile: BridgeProfile | null = null;
  const subscribers = new Set<(snapshot: AuthSnapshot) => void>();
  const emit = () => subscribers.forEach((subscriber) => subscriber({user, profile}));
  const reloadProfile = async () => {
    profile = BridgeProfileSchema.parse(await post("profile.load", {}));
    emit();
    return profile;
  };
  const mutate = async <T>(operation: string, input: unknown, parse: (value: unknown) => T): Promise<T> => {
    const result = parse(await post(operation, input));
    await reloadProfile();
    return result;
  };

  return {
    products: [],
    auth: {
      subscribe(listener) {
        subscribers.add(listener);
        listener({user, profile});
        if (!profile) void reloadProfile().catch(() => undefined);
        return () => subscribers.delete(listener);
      },
    },
    async loadRiddle(input) {
      const raw = GetCurrentDailyChallengeResponseSchema.parse(await post(
        input.gameMode === "classic" ? "riddle.classic" : "riddle.daily",
        input,
      ));
      const question = raw.challenge?.questions[0];
      if (!question || raw.error) throw new Error(raw.error ?? "reddit-riddle-unavailable");
      return BridgeRiddleSchema.parse({
        riddleId: question.riddleId,
        text: question.text,
        answerLength: question.answerLength,
        sessionToken: question.sessionToken,
        gameMode: input.gameMode,
        index: question.questionNumber,
        attemptsUsed: question.attemptsUsed,
        hasUsedContinue: question.hasUsedContinue,
        awaitingContinue: question.awaitingContinue,
      });
    },
    async loadProfile() { return reloadProfile(); },
    async completeGame(input) {
      return mutate("game.complete", input, (value) => CompleteGameResponseDataSchema.parse(value));
    },
    async submitGuess(input) {
      return SubmitSinglePlayerGuessResponseDataSchema.parse(await post("guess.submit", input));
    },
    async requestHint(input) {
      return mutate("hint.request", input, (value) => GetHintResponseSchema.parse(value));
    },
    async spendCoins(input) {
      return mutate("coins.spend", input, (value) => SpendCoinsResponseSchema.parse(value));
    },
    async skipRiddle(input) {
      return mutate("riddle.skip", input, (value) => SkipRiddleResponseSchema.parse(value));
    },
    async requestPurchase() { return unavailable(); },
    async loadLeaderboard(type) {
      return GetLeaderboardResponseSchema.parse(await post("leaderboard.list", {type, limit: 25})).entries;
    },
    async updateUsername(username) {
      await post("profile.username", {username});
      return reloadProfile();
    },
    async updateAvatar() { return unavailable(); },
    async deleteAccount() {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({accountGeneration}),
      });
      if (!response.ok) throw new Error("reddit-account-deletion-failed");
      profile = null;
      subscribers.forEach((subscriber) => subscriber({user: null, profile: null}));
    },
    async listRaceCategories(locale) {
      return ListRaceCategoriesResponseSchema.parse(await post("race.categories", {locale}));
    },
    async startRace(input) { return RaceRunResponseSchema.parse(await post("race.start", input)); },
    async submitRaceGuess(input) { return SubmitRaceGuessResponseSchema.parse(await post("race.guess", input)); },
    async requestRaceHint(input) { return RequestRaceHintResponseSchema.parse(await post("race.hint", input)); },
    async skipRaceRiddle(input) { return SkipRaceRiddleResponseSchema.parse(await post("race.skip", input)); },
    async resumeRace(runId) { return RaceRunResponseSchema.parse(await post("race.resume", {runId})); },
    async abandonRace(input) { return AbandonRaceRunResponseSchema.parse(await post("race.abandon", input)); },
    async publishRace(input) { return PublishRaceChallengeResponseSchema.parse(await post("race.publish", input)); },
    async getRaceChallenge(challengeId, locale) {
      return RaceChallengePreviewSchema.parse(await post("race.challenge", {challengeId, locale}));
    },
    async getRaceOutcome(runId) { return RaceOutcomeSchema.parse(await post("race.outcome", {runId})); },
    async listRaceInbox(input = {}) { return ListRaceInboxResponseSchema.parse(await post("race.inbox", input)); },
    async blockRival(targetUserId) {
      const result = await post("safety.block", {targetUserId});
      if (!isRecord(result) || result.blocked !== true || Object.keys(result).length !== 1) {
        throw new Error("invalid-reddit-block-response");
      }
      return {blocked: true};
    },
    async reportRival(input) {
      const result = await post("safety.report", input);
      if (!isRecord(result) || typeof result.reportId !== "string" || result.queued !== true ||
        Object.keys(result).length !== 2) throw new Error("invalid-reddit-report-response");
      return {reportId: result.reportId, queued: true};
    },
    async getRaceAccess() { return RaceAccessResponseSchema.parse(await post("race.access", {locale: "en"})); },
    recordRaceAnalytics: unavailable,
  };
};
