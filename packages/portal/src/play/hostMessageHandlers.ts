import {BridgeParserLoadError, createHostMessageRouter, type HostMessageHandlers} from "./bridgeRouter";
import {trackEvent} from "../analytics/events";
import {tr} from "./i18n";
import {createRequestId} from "./requestIds";
import type {RaceOutcome} from "@qwordly/core/race";
import type {AuthSnapshot, CompletionResult, PurchaseResult, SinglePlayerGuessResult, WebGameMode} from "./types";
import type {HostAuthorityModules} from "./HostAuthorityModules";
import {captureBrowserException} from "../observability/browserErrorReporter";
import type {HostCompletionInput} from "./hostCompletionEffects";
/** Describes host operation name. */
export type HostOperationName =
  | "loadRiddle"
  | "guess"
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
  | "raceReady"
  | "raceGuess"
  | "raceHint"
  | "raceSkip"
  | "raceResume"
  | "raceAbandon"
  | "racePublish"
  | "raceInviteReserve"
  | "raceInviteCancel"
  | "raceEntry"
  | "raceChallenge"
  | "raceOutcome"
  | "raceInbox"
  | "raceBlock"
  | "raceReport";
/** Gets host error message. */
export const getHostErrorMessage = (error: unknown): string => {
  if (error instanceof BridgeParserLoadError) return tr("ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE");
  if (typeof error === "object" && error !== null && "code" in error &&
    /(?:^|\/)(deadline-exceeded|unauthenticated)$/.test(String(error.code)))
    return tr("ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE");
  if (
    typeof error === "object" &&
    error !== null &&
    (("name" in error && error.name === "ZodError") || ("issues" in error && Array.isArray(error.issues)))
  ) {
    return tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR");
  }
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message).replace(/^Firebase:\s*/i, "");
  }
  return tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR");
};
/** Translates server-provided locale keys while preserving already rendered notices. */
export const getHostNoticeMessage = (notice: string): string =>
  notice.startsWith("WebPortal.") || notice.startsWith("ErrorMessages.") ? tr(notice) : notice;
/** Reports a failed host operation before its safe message is returned to the game frame. */
const reportHostOperationError = (error: unknown, operation: HostOperationName): void => {
  captureBrowserException(error, {component: "play_host", operation});
};
/** Keeps ambiguous transport failures replayable with the original paid request ID. */
const coinActionErrorKind = (error: unknown): "retryable" | "rejected" => {
  /** Callable errors distinguish a definitive refusal from an unknown network outcome. */
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  return /(?:^|\/)(invalid-argument|permission-denied|failed-precondition|not-found|unauthenticated|resource-exhausted)$/.test(
    code,
  )
    ? "rejected"
    : "retryable";
};
/** Requires a capability-shaped authority module before crossing its seam. */
const requireAuthority = <Module>(module: Module | undefined, message: string): Module => {
  if (!module) throw new Error(message);
  return module;
};
/** Requires the race authority through one shared Capability Gap policy. */
const requireRaceAuthority = (authority: HostAuthorityModules): NonNullable<HostAuthorityModules["race"]> =>
  requireAuthority(authority.race, "host-race-capability-unavailable");
/** Describes load and post riddle. */
type LoadAndPostRiddle = (
  input: {
    /** Optional read-only preparation never delivers a question before explicit Next. */
    prepareNext?: true;
    /** Stores game mode. */
    gameMode: WebGameMode;
    /** Stores locale. */
    locale: string;
    /** Stores classic index. */
    classicIndex?: number;
    /** Stores session token. */
    authoritative?: boolean;
    /** Stores session token. */
    sessionToken?: string;
    /** Stores riddle id. */
    riddleId?: string;
  },
  requestId?: string,
) => Promise<boolean>;
/** Describes post operation. */
type PostOperation = (
  requestId: string | undefined,
  operation: HostOperationName,
  ok: boolean,
  data?: unknown,
  error?: string,
  errorKind?: "retryable" | "rejected",
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
export type CreateHostMessageHandlersOptions = {
  /** Stores auth snapshot. */
  authSnapshot: AuthSnapshot;
  /** Stores game mode. */
  gameMode: WebGameMode;
  /** Stores locale. */
  locale: string;
  /** Capability-shaped authority modules available to this session. */
  authority: HostAuthorityModules;
  /** Stores loaded user id ref. */
  loadedUserIdRef: {
    /** Stores current. */
    current: string | null;
  };
  /** Stores playable reported ref. */
  playableReportedRef: {
    /** Stores current. */
    current: boolean;
  };
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
  syncRaceAchievementProgress: (result: {
    /** Stores newly unlocked achievement ids. */
    newlyUnlockedAchievementIds?: string[];
    /** Stores new coins. */
    newCoins?: number;
  }) => Promise<boolean | void>;
  /** Writes an optimistic achievement projection only to target-owned local storage. */
  persistAchievementProjection: (achievementIds: string[]) => void;
  /** Stores on playable. */
  onPlayable?: () => void;
  /** Runs optional account-owned effects after an accepted single-player guess. */
  onAuthoritativeGuess?: (input: HostCompletionInput, result: SinglePlayerGuessResult) => void | Promise<void>;
  /** Stores on authoritative complete. */
  onAuthoritativeComplete?: (
    input: HostCompletionInput,
    result: CompletionResult,
  ) => void | Promise<void>;
  /** Notifies the platform after an authoritative race result has loaded. */
  onAuthoritativeRaceResult?: (result: RaceOutcome) => void | Promise<void>;
  /** Stores on account deleted. */
  onAccountDeleted?: () => void | Promise<void>;
  /** Persists account-deletion intent before the authoritative request starts. */
  onAccountDeletionRequested?: () => void | Promise<void>;
  /** Remembers authoritative deletion across handler recreation and client-cleanup retries. */
  accountDeletionCompletedRef: {
    /** Stores current. */
    current: boolean;
  };
};
/** Builds the schema-routed commands that connect the game frame to authoritative host services. */
export const createPlayHostMessageHandlers = ({
  authSnapshot,
  gameMode,
  locale,
  authority,
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
  persistAchievementProjection,
  onPlayable,
  onAuthoritativeGuess,
  onAuthoritativeComplete,
  onAuthoritativeRaceResult,
  onAccountDeleted,
  onAccountDeletionRequested,
  accountDeletionCompletedRef,
}: CreateHostMessageHandlersOptions): HostMessageHandlers => ({
  ready: async () => {
    setFrameReady(true);
    sendInit();
    if (!authSnapshot.user) return;

    loadedUserIdRef.current = authSnapshot.user.uid;
    /** Loads ed. */
    const loaded = await loadAndPostRiddle({
      gameMode,
      locale,
      classicIndex: authSnapshot.profile?.classicIndex,
    });
    if (loaded && !playableReportedRef.current) {
      playableReportedRef.current = true;
      onPlayable?.();
    }
  },
  resize: () => undefined,
  recordAchievements: (message) => persistAchievementProjection(message.payload.achievementIds),
  loadRiddle: async (message) => {
    await loadAndPostRiddle({...message.payload, gameMode}, message.requestId);
  },
  submitGuess: async (message) => {
    try {
      /** Provides result behavior. */
      const result = await authority.gameplay.submitGuess(message.payload);
      postOperation(message.requestId, "guess", true, result);
      void Promise.resolve()
        .then(() => onAuthoritativeGuess?.(message.payload, result))
        .catch((error) => reportHostOperationError(error, "guess"));
    } catch (error) {
      reportHostOperationError(error, "guess");
      /** The code used by the current operation. */
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      /** The rejected used by the current operation. */
      const rejected =
        /(?:^|\/)(invalid-argument|permission-denied|failed-precondition|not-found|unauthenticated)$/.test(code);
      postOperation(
        message.requestId,
        "guess",
        false,
        undefined,
        getHostErrorMessage(error),
        rejected ? "rejected" : "retryable",
      );
    }
  },
  completeGame: async (message) => {
    try {
      /** Provides result behavior. */
      const result = await authority.gameplay.completeGame(message.payload);
      postOperation(message.requestId, "completeGame", true, result);
      // Rewards are already authoritative. Optional notification/storage work must
      // neither delay their presentation nor turn a completed win into an error.
      void Promise.resolve()
        .then(() => onAuthoritativeComplete?.(message.payload, result))
        .catch((error) => reportHostOperationError(error, "completeGame"));
    } catch (error) {
      reportHostOperationError(error, "completeGame");
      postOperation(message.requestId, "completeGame", false, undefined, getHostErrorMessage(error));
    }
  },
  requestHint: async (message) => {
    try {
      /** Provides result behavior. */
      const economy = requireAuthority(authority.economy, "host-economy-capability-unavailable");
      /** Provides result behavior. */
      const result = await economy.requestHint(message.payload);
      postOperation(message.requestId, "hint", true, result);
      trackEvent("spend_virtual_currency", {
        virtual_currency_name: "coins",
        item_name: "hint",
        value: result?.coinsCost,
        game_mode: message.payload.gameMode,
      });
    } catch (error) {
      reportHostOperationError(error, "hint");
      postOperation(
        message.requestId,
        "hint",
        false,
        undefined,
        getHostErrorMessage(error),
        coinActionErrorKind(error),
      );
    }
  },
  spendCoins: async (message) => {
    try {
      /** Provides result behavior. */
      const economy = requireAuthority(authority.economy, "host-economy-capability-unavailable");
      /** Provides result behavior. */
      const result = await withServerActivity(() =>
        economy.spendCoins({
          ...message.payload,
          requestId: message.requestId ?? createRequestId("continue"),
        }),
      );
      postOperation(message.requestId, "spendCoins", true, result);
      trackEvent("spend_virtual_currency", {
        virtual_currency_name: "coins",
        item_name: message.payload.reason,
        value: message.payload.amount,
        game_mode: message.payload.gameMode,
      });
    } catch (error) {
      reportHostOperationError(error, "spendCoins");
      postOperation(
        message.requestId,
        "spendCoins",
        false,
        undefined,
        getHostErrorMessage(error),
        coinActionErrorKind(error),
      );
    }
  },
  skipRiddle: async (message) => {
    /** Payment and content delivery have distinct authoritative outcomes. */
    const {riddleId, gameMode: skipGameMode, sessionToken} = message.payload;
    /** The committed receipt remains successful if subsequent delivery fails. */
    let result: Awaited<ReturnType<typeof authority.gameplay.skipRiddle>>;
    try {
      result = await authority.gameplay.skipRiddle({
        riddleId,
        gameMode: skipGameMode,
        sessionToken,
        requestId: message.requestId ?? createRequestId("skip"),
      });
    } catch (error) {
      reportHostOperationError(error, "skip");
      postOperation(
        message.requestId,
        "skip",
        false,
        undefined,
        getHostErrorMessage(error),
        coinActionErrorKind(error),
      );
      return;
    }
    postOperation(message.requestId, "skip", true, result);
    try {
      trackEvent("riddle_skipped", {game_mode: skipGameMode, value: result.costDeducted});
    } catch (error) {
      reportHostOperationError(error, "skip");
    }
    try {
      await loadAndPostRiddle({gameMode: skipGameMode, locale,
        classicIndex: result.newProgress?.classicIndex ?? authSnapshot.profile?.classicIndex}, message.requestId);
    } catch (error) {
      reportHostOperationError(error, "loadRiddle");
      setNotice(getHostErrorMessage(error));
      postOperation(message.requestId, "loadRiddle", false, undefined, getHostErrorMessage(error));
    }
  },
  requestPurchase: async (message) => {
    try {
      /** Provides result behavior. */
      const commerce = requireAuthority(authority.commerce, "host-commerce-capability-unavailable");
      /** Provides result behavior. */
      const result = await withServerActivity(() => commerce.requestPurchase(message.payload.productId));
      if (!result.success) {
        postOperation(message.requestId, "purchase", true, result);
        return;
      }
      applyPurchaseBalance(result);
      setNotice(
        result.purchaseType === "subscription"
          ? tr("CoinShop.SUBSCRIPTION_ACTIVE_NOTICE")
          : tr("WebPortal.PURCHASE_COMPLETE", {coins: result.coinsAwarded ?? 0}),
      );
      postOperation(message.requestId, "purchase", true, result);
    } catch (error) {
      reportHostOperationError(error, "purchase");
      postOperation(message.requestId, "purchase", false, undefined, getHostErrorMessage(error));
    }
  },
  loadLeaderboard: async (message) => {
    try {
      /** Provides entries behavior. */
      const entries = await authority.leaderboard.loadLeaderboard(message.payload.leaderboardType);
      postOperation(message.requestId, "leaderboard", true, {
        type: message.payload.leaderboardType,
        entries,
      });
    } catch (error) {
      reportHostOperationError(error, "leaderboard");
      postOperation(message.requestId, "leaderboard", false, undefined, getHostErrorMessage(error));
    }
  },
  updateUsername: async (message) => {
    try {
      /** Provides profile behavior. */
      const updateUsername = requireAuthority(authority.account?.updateUsername, "host-account-capability-unavailable");
      /** Provides profile behavior. */
      const profile = await withServerActivity(() => updateUsername(message.payload.username));
      postOperation(message.requestId, "profile", true, {profile});
    } catch (error) {
      reportHostOperationError(error, "profile");
      postOperation(message.requestId, "profile", false, undefined, getHostErrorMessage(error));
    }
  },
  updateAvatar: async (message) => {
    try {
      /** Provides profile behavior. */
      const updateAvatar = requireAuthority(authority.account?.updateAvatar, "host-account-capability-unavailable");
      /** Provides profile behavior. */
      const profile = await withServerActivity(() => updateAvatar(message.payload.imageDataUrl));
      postOperation(message.requestId, "profile", true, {profile});
    } catch (error) {
      reportHostOperationError(error, "avatar");
      postOperation(message.requestId, "avatar", false, undefined, getHostErrorMessage(error));
    }
  },
  deleteAccount: async (message) => {
    try {
      if (!accountDeletionCompletedRef.current) {
        /** Check authority before any callback closes the player's operation gate. */
        const deleteAccount = requireAuthority(authority.account?.deleteAccount, "host-account-capability-unavailable");
        await onAccountDeletionRequested?.();
        /** Provides account behavior. */
        await withServerActivity(() => deleteAccount());
        accountDeletionCompletedRef.current = true;
      }
      await onAccountDeleted?.();
      postOperation(message.requestId, "accountDeletion", true, {success: true});
    } catch (error) {
      captureBrowserException(error, {
        component: "play_host",
        operation: "accountDeletion",
        phase: accountDeletionCompletedRef.current ? "client_cleanup" : "server_deletion",
      });
      postOperation(message.requestId, "accountDeletion", false, undefined, getHostErrorMessage(error));
    }
  },
  listRaceCategories: (message) =>
    runRaceOperation(message.requestId, "raceCategories", () => {
      /** Provides race behavior. */
      const race = requireRaceAuthority(authority);
      return race.listRaceCategories(message.payload.locale);
    }),
  /** Schedules an owned prepared run through the active authority adapter. */
  readyRace: (message) => runRaceOperation(message.requestId, "raceReady", () => requireRaceAuthority(authority).readyRace(message.payload)),
  startRace: (message) =>
    runRaceOperation(message.requestId, "raceStart", () => {
      /** Provides race behavior. */
      const race = requireRaceAuthority(authority);
      return race.startRace(message.payload);
    }),
  submitRaceGuess: (message) =>
    runRaceOperation(message.requestId, "raceGuess", () => {
      /** Provides race behavior. */
      const race = requireRaceAuthority(authority);
      return race.submitRaceGuess(message.payload);
    }),
  requestRaceHint: (message) =>
    runRaceOperation(message.requestId, "raceHint", () => {
      /** Provides race behavior. */
      const race = requireRaceAuthority(authority);
      return race.requestRaceHint(message.payload);
    }),
  skipRaceRiddle: (message) =>
    runRaceOperation(message.requestId, "raceSkip", () => {
      /** Provides race behavior. */
      const race = requireRaceAuthority(authority);
      return race.skipRaceRiddle(message.payload);
    }),
  resumeRace: (message) =>
    runRaceOperation(message.requestId, "raceResume", () => {
      /** Provides race behavior. */
      const race = requireRaceAuthority(authority);
      return race.resumeRace(message.payload.runId);
    }),
  abandonRace: (message) =>
    runRaceOperation(message.requestId, "raceAbandon", () => {
      /** Provides race behavior. */
      const race = requireRaceAuthority(authority);
      return race.abandonRace(message.payload);
    }),
  publishRace: (message) =>
    runRaceOperation(message.requestId, "racePublish", async () => {
      /** Provides result behavior. */
      const race = requireRaceAuthority(authority);
      /** Provides result behavior. */
      const result = await race.publishRace(message.payload);
      void Promise.resolve()
        .then(() => syncRaceAchievementProgress(result))
        .catch((error) => reportHostOperationError(error, "racePublish"));
      return result;
    }),
  reserveRaceInvite: (message) =>
    runRaceOperation(message.requestId, "raceInviteReserve", () => {
      /** Authoritative race service used to reserve the provider invite. */
      const race = requireRaceAuthority(authority);
      if (!race.reserveRaceInvite) throw new Error("Race invite lobbies are unavailable.");
      return race.reserveRaceInvite(message.payload);
    }),
  getRaceEntry: (message) => runRaceOperation(message.requestId, "raceEntry", () => {
    /** Target race authority must provide the typed lifecycle contract. */
    const race = requireRaceAuthority(authority);
    if (!race.getRaceEntry) throw new Error("Race entry lifecycle is unavailable.");
    return race.getRaceEntry(message.payload.challengeId, message.payload.locale);
  }),
  cancelRaceInvite: (message) => runRaceOperation(message.requestId, "raceInviteCancel", () => {
    /** Cancellation is a target capability, never a simulated success. */
    const race = requireRaceAuthority(authority);
    if (!race.cancelRaceInvite) throw new Error("Race invitation cancellation is unavailable.");
    return race.cancelRaceInvite(message.payload);
  }),
  getRaceChallenge: (message) =>
    runRaceOperation(message.requestId, "raceChallenge", () => {
      /** Provides race behavior. */
      const race = requireRaceAuthority(authority);
      return race.getRaceChallenge(message.payload.challengeId, message.payload.locale);
    }),
  getRaceOutcome: (message) =>
    runRaceOperation(message.requestId, "raceOutcome", async () => {
      /** Provides result behavior. */
      const race = requireRaceAuthority(authority);
      /** Provides result behavior. */
      const result = await race.getRaceOutcome(message.payload.runId);
      // Present the confirmed outcome while optional profile and platform work finishes.
      void Promise.resolve()
        .then(async () => {
          if (await syncRaceAchievementProgress(result) !== false) await onAuthoritativeRaceResult?.(result);
        })
        .catch((error) => reportHostOperationError(error, "raceOutcome"));
      return result;
    }),
  listRaceInbox: (message) =>
    runRaceOperation(message.requestId, "raceInbox", () => {
      /** Provides race behavior. */
      const race = requireRaceAuthority(authority);
      return race.listRaceInbox(message.payload);
    }),
  blockRival: (message) =>
    runRaceOperation(message.requestId, "raceBlock", () => {
      /** Provides race behavior. */
      const race = requireRaceAuthority(authority);
      return race.blockRival(message.payload.targetUserId);
    }),
  reportRival: (message) =>
    runRaceOperation(message.requestId, "raceReport", () => {
      /** Provides race behavior. */
      const race = requireRaceAuthority(authority);
      return race.reportRival({
        ...message.payload,
        requestId: message.requestId ?? createRequestId("race-report"),
      });
    }),
  analytics: (message) => {
    console.info("[riddle-quest-web]", message.payload.eventName, message.payload.params ?? {});
    trackEvent(message.payload.eventName, message.payload.params);
    if (!authority.race) return;
    void authority.race
      .recordRaceAnalytics({
        eventId: message.requestId ?? createRequestId("race-analytics"),
        eventName: message.payload.eventName,
        params: message.payload.params,
      })
      .catch((error) => console.warn("[riddle-quest-race-analytics] Event was not persisted", error));
  },
  error: (message) => setNotice(message.payload.message),
});

/** Parses and executes untrusted game commands through the hosted-play handlers. */
export function createHostedPlayCommandModule(options: CreateHostMessageHandlersOptions) {
  return {execute: createHostMessageRouter(createPlayHostMessageHandlers(options))};
}
