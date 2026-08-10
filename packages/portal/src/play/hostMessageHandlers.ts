import type {HostMessageHandlers} from "./bridgeRouter";
import {trackEvent} from "../analytics/googleAnalytics";
import {tr} from "./i18n";
import {createRequestId} from "./requestIds";
import type {AuthSnapshot, CompletionResult, HostServices, PurchaseResult, WebGameMode} from "./types";

/** Describes host operation name. */
export type HostOperationName =
  | "loadRiddle"
  | "completeGame"
  | "hint"
  | "spendCoins"
  | "purchase"
  | "skip"
  | "profile"
  | "avatar"
  | "accountDeletion"
  | "leaderboard"
  | "raceCategories"
  | "raceStart"
  | "raceGuess"
  | "raceHint"
  | "raceSkip"
  | "raceResume"
  | "raceAbandon"
  | "racePublish"
  | "raceChallenge"
  | "raceOutcome"
  | "raceInbox";

/** Gets host error message. */
export const getHostErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message).replace(/^Firebase:\s*/i, "");
  }
  return tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR");
};

/** Describes load and post riddle. */
type LoadAndPostRiddle = (
  input: {gameMode: WebGameMode; locale: string; classicIndex?: number},
  requestId?: string,
) => Promise<void>;

/** Describes post operation. */
type PostOperation = (
  requestId: string | undefined,
  operation: HostOperationName,
  ok: boolean,
  data?: unknown,
  error?: string,
) => void;

/** Describes run race operation. */
type RunRaceOperation = (
  requestId: string | undefined,
  operation: HostOperationName,
  action: () => Promise<unknown>,
) => Promise<void>;

/** Describes with server activity. */
type WithServerActivity = <Result>(operation: () => Promise<Result>) => Promise<Result>;

/** Describes create host message handlers options. */
type CreateHostMessageHandlersOptions = {
  /** Stores auth snapshot. */
  authSnapshot: AuthSnapshot;
  /** Stores game mode. */
  gameMode: WebGameMode;
  /** Stores locale. */
  locale: string;
  /** Stores services. */
  services: HostServices;
  /** Stores loaded user id ref. */
  loadedUserIdRef: {current: string | null};
  /** Stores playable reported ref. */
  playableReportedRef: {current: boolean};
  /** Stores set frame ready. */
  setFrameReady: (ready: boolean) => void;
  /** Stores set notice. */
  setNotice: (notice: string) => void;
  /** Stores send init. */
  sendInit: () => void;
  /** Stores load and post riddle. */
  loadAndPostRiddle: LoadAndPostRiddle;
  /** Stores post operation. */
  postOperation: PostOperation;
  /** Stores run race operation. */
  runRaceOperation: RunRaceOperation;
  /** Stores with server activity. */
  withServerActivity: WithServerActivity;
  /** Stores apply purchase balance. */
  applyPurchaseBalance: (result: PurchaseResult) => void;
  /** Stores sync race achievement progress. */
  syncRaceAchievementProgress: (result: {newlyUnlockedAchievementIds?: string[]; newCoins?: number}) => Promise<void>;
  /** Stores on playable. */
  onPlayable?: () => void;
  /** Stores on authoritative complete. */
  onAuthoritativeComplete?: (
    input: {riddleId: string; gameMode: WebGameMode; attempts: number; isCorrect: boolean},
    result: CompletionResult,
  ) => void | Promise<void>;
  /** Stores on account deleted. */
  onAccountDeleted?: () => void | Promise<void>;
};

/** Builds the schema-routed commands that connect the game frame to authoritative host services. */
export const createPlayHostMessageHandlers = ({
  authSnapshot,
  gameMode,
  locale,
  services,
  loadedUserIdRef,
  playableReportedRef,
  setFrameReady,
  setNotice,
  sendInit,
  loadAndPostRiddle,
  postOperation,
  runRaceOperation,
  withServerActivity,
  applyPurchaseBalance,
  syncRaceAchievementProgress,
  onPlayable,
  onAuthoritativeComplete,
  onAccountDeleted,
}: CreateHostMessageHandlersOptions): HostMessageHandlers => ({
  ready: async () => {
    setFrameReady(true);
    sendInit();
    if (!authSnapshot.user) return;

    loadedUserIdRef.current = authSnapshot.user.uid;
    await loadAndPostRiddle({
      gameMode,
      locale,
      classicIndex: authSnapshot.profile?.classicIndex,
    });
    if (!playableReportedRef.current) {
      playableReportedRef.current = true;
      onPlayable?.();
    }
  },
  resize: () => undefined,
  loadRiddle: async (message) => {
    await loadAndPostRiddle({...message.payload, gameMode}, message.requestId);
  },
  completeGame: async (message) => {
    try {
      const result = await withServerActivity(async () => {
        const completion = await services.completeGame(message.payload);
        await onAuthoritativeComplete?.(message.payload, completion);
        return completion;
      });
      postOperation(message.requestId, "completeGame", true, result);
      trackEvent("level_end", {
        game_mode: message.payload.gameMode,
        success: message.payload.isCorrect,
        attempts: message.payload.attempts,
        level: result.newLevel,
        xp: result.newXp,
        win_streak: result.newWinStreak,
      });
      if (result.leveledUp) trackEvent("level_up", {level: result.newLevel});
      for (const achievementId of result.newlyUnlockedAchievementIds) {
        trackEvent("unlock_achievement", {achievement_id: achievementId});
      }
    } catch (error) {
      postOperation(message.requestId, "completeGame", false, undefined, getHostErrorMessage(error));
    }
  },
  requestHint: async (message) => {
    try {
      const result = await withServerActivity(() => services.requestHint(message.payload));
      postOperation(message.requestId, "hint", true, result);
      trackEvent("spend_virtual_currency", {
        virtual_currency_name: "coins",
        item_name: "hint",
        value: result?.coinsCost,
        game_mode: message.payload.gameMode,
      });
    } catch (error) {
      postOperation(message.requestId, "hint", false, undefined, getHostErrorMessage(error));
    }
  },
  spendCoins: async (message) => {
    try {
      if (message.payload.reason === "skip" && message.payload.riddleId && message.payload.gameMode) {
        const {riddleId, gameMode: skipGameMode} = message.payload;
        if (skipGameMode === "challenge") throw new Error("Daily riddles cannot be skipped.");

        const result = await withServerActivity(() => services.skipRiddle({riddleId, gameMode: skipGameMode}));
        postOperation(message.requestId, "skip", true, result);
        trackEvent("riddle_skipped", {game_mode: skipGameMode, value: result.costDeducted});
        await loadAndPostRiddle({
          gameMode: skipGameMode,
          locale,
          classicIndex: result.newProgress?.classicIndex ?? authSnapshot.profile?.classicIndex,
        });
        return;
      }

      const result = await withServerActivity(() => services.spendCoins(message.payload));
      postOperation(message.requestId, "spendCoins", true, result);
      trackEvent("spend_virtual_currency", {
        virtual_currency_name: "coins",
        item_name: message.payload.reason,
        value: message.payload.amount,
        game_mode: message.payload.gameMode,
      });
    } catch (error) {
      postOperation(
        message.requestId,
        message.payload.reason === "skip" ? "skip" : "spendCoins",
        false,
        undefined,
        getHostErrorMessage(error),
      );
    }
  },
  requestPurchase: async (message) => {
    try {
      const result = await withServerActivity(() => services.requestPurchase(message.payload.productId));
      applyPurchaseBalance(result);
      setNotice(
        result.purchaseType === "subscription"
          ? tr("CoinShop.SUBSCRIPTION_ACTIVE_NOTICE")
          : tr("WebPortal.PURCHASE_COMPLETE", {coins: result.coinsAwarded ?? 0}),
      );
      postOperation(message.requestId, "purchase", true, result);
    } catch (error) {
      postOperation(message.requestId, "purchase", false, undefined, getHostErrorMessage(error));
    }
  },
  loadLeaderboard: async (message) => {
    try {
      const entries = await withServerActivity(() => services.loadLeaderboard(message.payload.leaderboardType));
      postOperation(message.requestId, "leaderboard", true, {
        type: message.payload.leaderboardType,
        entries,
      });
    } catch (error) {
      postOperation(message.requestId, "leaderboard", false, undefined, getHostErrorMessage(error));
    }
  },
  updateUsername: async (message) => {
    try {
      const profile = await withServerActivity(() => services.updateUsername(message.payload.username));
      postOperation(message.requestId, "profile", true, {profile});
    } catch (error) {
      postOperation(message.requestId, "profile", false, undefined, getHostErrorMessage(error));
    }
  },
  updateAvatar: async (message) => {
    try {
      const profile = await withServerActivity(() => services.updateAvatar(message.payload.imageDataUrl));
      postOperation(message.requestId, "profile", true, {profile});
    } catch (error) {
      postOperation(message.requestId, "avatar", false, undefined, getHostErrorMessage(error));
    }
  },
  deleteAccount: async (message) => {
    try {
      await withServerActivity(() => services.deleteAccount());
      await onAccountDeleted?.();
      postOperation(message.requestId, "accountDeletion", true, {success: true});
    } catch (error) {
      postOperation(message.requestId, "accountDeletion", false, undefined, getHostErrorMessage(error));
    }
  },
  listRaceCategories: (message) =>
    runRaceOperation(message.requestId, "raceCategories", () => services.listRaceCategories(message.payload.locale)),
  startRace: (message) => runRaceOperation(message.requestId, "raceStart", () => services.startRace(message.payload)),
  submitRaceGuess: (message) =>
    runRaceOperation(message.requestId, "raceGuess", () => services.submitRaceGuess(message.payload)),
  requestRaceHint: (message) =>
    runRaceOperation(message.requestId, "raceHint", () => services.requestRaceHint(message.payload)),
  skipRaceRiddle: (message) =>
    runRaceOperation(message.requestId, "raceSkip", () => services.skipRaceRiddle(message.payload)),
  resumeRace: (message) =>
    runRaceOperation(message.requestId, "raceResume", () => services.resumeRace(message.payload.runId)),
  abandonRace: (message) =>
    runRaceOperation(message.requestId, "raceAbandon", () => services.abandonRace(message.payload)),
  publishRace: (message) =>
    runRaceOperation(message.requestId, "racePublish", async () => {
      const result = await services.publishRace(message.payload);
      await syncRaceAchievementProgress(result);
      return result;
    }),
  getRaceChallenge: (message) =>
    runRaceOperation(message.requestId, "raceChallenge", () => services.getRaceChallenge(message.payload.challengeId)),
  getRaceOutcome: (message) =>
    runRaceOperation(message.requestId, "raceOutcome", async () => {
      const result = await services.getRaceOutcome(message.payload.runId);
      await syncRaceAchievementProgress(result);
      return result;
    }),
  listRaceInbox: (message) =>
    runRaceOperation(message.requestId, "raceInbox", () => services.listRaceInbox(message.payload)),
  analytics: (message) => {
    console.info("[riddle-quest-web]", message.payload.eventName, message.payload.params ?? {});
    trackEvent(message.payload.eventName, message.payload.params);
    void services
      .recordRaceAnalytics({
        eventId: message.requestId ?? createRequestId("race-analytics"),
        eventName: message.payload.eventName,
        params: message.payload.params,
      })
      .catch((error) => console.warn("[riddle-quest-race-analytics] Event was not persisted", error));
  },
  error: (message) => setNotice(message.payload.message),
});
