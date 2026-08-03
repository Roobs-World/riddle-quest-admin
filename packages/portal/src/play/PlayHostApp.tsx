import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {HostToGameMessage} from "@qwordly/core/bridge";
import {BRIDGE_PROTOCOL_VERSION} from "@qwordly/core/bridge/constants";
import {createHostMessageRouter} from "./bridgeRouter";
import {detectDeviceLanguage, tr, useLocale} from "./i18n";
import {createRequestId} from "./requestIds";
import {GameFrameApp} from "./GameFrameApp";
import {dispatchLocalBridge, GAME_TO_HOST_EVENT, HOST_TO_GAME_EVENT} from "./localBridge";
import {createHostServices, getHostConfigurationWarning, resolveHostServicesMode} from "./services";
import type {AuthSnapshot, CompletionResult, HostServices, ProductSummary, WebGameMode} from "./types";
import type {ListRaceCategoriesResponse} from "@qwordly/core/race";
import {SpinningWheelLoader} from "./SpinningWheelLoader";
import type {JestPlayerData, JestPlayerDataUpdate} from "../jest/types";
import {restoreJestProfileWhileServerLoads} from "../jest/playerData";
import {isRaceTo10Enabled} from "./race/logic/raceFeatureFlag";
import {trackEvent} from "../analytics/googleAnalytics";
type OperationName =
  | "loadRiddle"
  | "completeGame"
  | "hint"
  | "spendCoins"
  | "purchase"
  | "skip"
  | "profile"
  | "avatar"
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

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message).replace(/^Firebase:\s*/i, "");
  }
  return tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR");
};

const createHostMessage = <Message extends HostToGameMessage>(message: Message): Message => ({
  ...message,
  sentAt: Date.now(),
});

export function PlayHostApp({
  initialGameMode,
  onPlayable,
  onAuthoritativeComplete,
  platformProducts,
  platformPurchase,
  platformPlayerRegistered,
  externalInteractionBlocked = false,
  initialPlayerData,
  onPlayerDataChange,
  registrationName,
  initialRaceChallengeId,
  initialRaceInbox = false,
}: {
  initialGameMode?: WebGameMode;
  onPlayable?: () => void;
  onAuthoritativeComplete?: (
    input: {riddleId: string; gameMode: WebGameMode; attempts: number; isCorrect: boolean},
    result: CompletionResult,
  ) => void | Promise<void>;
  platformProducts?: ProductSummary[];
  platformPurchase?: (productId: string) => Promise<import("./types").PurchaseResult>;
  platformPlayerRegistered?: boolean;
  externalInteractionBlocked?: boolean;
  initialPlayerData?: JestPlayerData | null;
  onPlayerDataChange?: (update: JestPlayerDataUpdate) => void;
  registrationName?: string;
  initialRaceChallengeId?: string;
  initialRaceInbox?: boolean;
} = {}) {
  const locale = useLocale();
  const sessionIdRef = useRef(createRequestId("session"));
  const servicesMode = useMemo(() => resolveHostServicesMode(), []);
  const baseServices = useMemo<HostServices>(() => createHostServices(servicesMode), [servicesMode]);
  const services = useMemo<HostServices>(
    () => ({
      ...baseServices,
      products: platformProducts ?? baseServices.products,
      requestPurchase: platformPurchase ?? baseServices.requestPurchase,
    }),
    [baseServices, platformProducts, platformPurchase],
  );
  const configurationWarning = getHostConfigurationWarning(servicesMode);
  const raceBuildEnabled = useMemo(
    () =>
      isRaceTo10Enabled({
        search: window.location.search,
        envValue: import.meta.env.VITE_RACE_TO_10_ENABLED,
      }),
    [],
  );

  const [authSnapshot, setAuthSnapshot] = useState<AuthSnapshot>({user: null, profile: null});
  const [prefetchedRaceCategories, setPrefetchedRaceCategories] = useState<ListRaceCategoriesResponse["categories"]>([]);
  const [frameReady, setFrameReady] = useState(false);
  const [gameMode, setGameMode] = useState<WebGameMode>(initialGameMode ?? "classic");
  const [notice, setNotice] = useState<string | null>(configurationWarning);
  const [pendingServerOperations, setPendingServerOperations] = useState(0);
  const [startupComplete, setStartupComplete] = useState(false);
  const serverInteractionActive = pendingServerOperations > 0 || externalInteractionBlocked || !startupComplete;
  const loadedUserIdRef = useRef<string | null>(null);
  const riddleLoadedRef = useRef(false);
  const playableReportedRef = useRef(false);
  const gameModeRef = useRef(gameMode);
  const classicIndexRef = useRef(authSnapshot.profile?.classicIndex);
  gameModeRef.current = gameMode;
  classicIndexRef.current = authSnapshot.profile?.classicIndex;
  const bridgeUser = useMemo(
    () => (authSnapshot.user ? {...authSnapshot.user, platformRegistered: platformPlayerRegistered} : null),
    [authSnapshot.user, platformPlayerRegistered],
  );

  const withServerActivity = useCallback(async <Result,>(operation: () => Promise<Result>): Promise<Result> => {
    const startedAt = Date.now();
    setPendingServerOperations((current) => current + 1);
    try {
      return await operation();
    } finally {
      const minimumVisibleTime = 180;
      const remainingTime = Math.max(0, minimumVisibleTime - (Date.now() - startedAt));
      window.setTimeout(() => {
        setPendingServerOperations((current) => Math.max(0, current - 1));
      }, remainingTime);
    }
  }, []);
  const saveActiveGame = useCallback(
    (activeGame: NonNullable<JestPlayerData["activeGame"]> | null) => onPlayerDataChange?.({activeGame}),
    [onPlayerDataChange],
  );

  useEffect(() => {
    detectDeviceLanguage(localStorage.getItem("appLanguage") ?? navigator.language);
  }, []);

  useEffect(
    () =>
      services.auth.subscribe((snapshot) => {
        setAuthSnapshot(restoreJestProfileWhileServerLoads(snapshot, initialPlayerData?.profile));
      }),
    [initialPlayerData?.profile, services],
  );

  useEffect(() => {
    if (authSnapshot.profile) {
      onPlayerDataChange?.({profile: authSnapshot.profile});
    }
  }, [authSnapshot.profile, onPlayerDataChange]);

  useEffect(() => {
    let cancelled = false;
    setPrefetchedRaceCategories([]);
    if (!raceBuildEnabled || !authSnapshot.user || locale !== "en") return;
    void services.getRaceAccess()
      .then(async (access) => {
        if (!access.enabled || cancelled) return;
        if (initialRaceChallengeId) return;
        try {
          const categories = await services.listRaceCategories("en");
          if (!cancelled) setPrefetchedRaceCategories(categories.categories);
        } catch (error) {
          console.warn("[riddle-quest-race-prefetch] Unable to preload categories", error);
        }
      })
      .catch((error) => {
        console.warn("[riddle-quest-race-access] Unable to load rollout access", error);
      });
    return () => {
      cancelled = true;
    };
  }, [authSnapshot.user, initialRaceChallengeId, locale, raceBuildEnabled, services]);

  const postToGame = useCallback((message: HostToGameMessage) => {
    dispatchLocalBridge(HOST_TO_GAME_EVENT, createHostMessage(message));
  }, []);

  const sendInit = useCallback(() => {
    postToGame({
      type: "host:init",
      requestId: createRequestId("init"),
      payload: {
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
        sessionId: sessionIdRef.current,
        locale,
        user: bridgeUser,
        profile: authSnapshot.profile,
        gameMode,
        products: services.products,
      },
    });
  }, [authSnapshot.profile, bridgeUser, gameMode, locale, postToGame, services.products]);
  const sendInitRef = useRef(sendInit);
  sendInitRef.current = sendInit;

  const postOperation = useCallback(
    (requestId: string | undefined, operation: OperationName, ok: boolean, data?: unknown, error?: string) => {
      postToGame({
        type: "host:operationResult",
        requestId,
        payload: {
          operation,
          ok,
          data,
          error,
        },
      });
    },
    [postToGame],
  );

  const applyPurchaseBalance = useCallback((result: import("./types").PurchaseResult) => {
    if (typeof result.newCoins !== "number") return;
    setAuthSnapshot((current) =>
      current.profile ? {...current, profile: {...current.profile, coins: result.newCoins!}} : current,
    );
  }, []);

  const runRaceOperation = useCallback(
    async (requestId: string | undefined, operation: OperationName, action: () => Promise<unknown>) => {
      const startedAt = performance.now();
      try {
        // The multiplayer surface owns its pending states. Using the global
        // server-activity wrapper here blocks the entire game behind an overlay
        // while a race request is in flight, including the initial screen open.
        postOperation(requestId, operation, true, await action());
        const durationMs = Math.round(performance.now() - startedAt);
        const report = durationMs >= 2_000 ? console.warn : console.info;
        report("[riddle-quest-race-latency]", operation, {
          ok: true,
          durationMs,
          slow: durationMs >= 2_000,
        });
      } catch (error) {
        postOperation(requestId, operation, false, undefined, getErrorMessage(error));
        console.warn("[riddle-quest-race-latency]", operation, {
          ok: false,
          durationMs: Math.round(performance.now() - startedAt),
        });
      }
    },
    [postOperation],
  );

  const syncRaceAchievementProgress = useCallback(
    async (result: {
      newlyUnlockedAchievementIds?: string[];
      newCoins?: number;
    }) => {
      if (typeof result.newCoins === "number") {
        setAuthSnapshot((current) =>
          current.profile ? {...current, profile: {...current.profile, coins: result.newCoins!}} : current,
        );
      }
      for (const achievementId of result.newlyUnlockedAchievementIds ?? []) {
        trackEvent("unlock_achievement", {achievement_id: achievementId, source: "multiplayer"});
      }
      const user = authSnapshot.user;
      if (!user) return;
      try {
        const profile = await services.loadProfile(user.uid);
        setAuthSnapshot((current) => ({...current, profile}));
        postToGame({
          type: "host:authState",
          requestId: createRequestId("race-profile"),
          payload: {user: bridgeUser, profile},
        });
      } catch (error) {
        console.warn("[riddle-quest-race-achievements] Profile refresh failed", error);
      }
    },
    [authSnapshot.user, bridgeUser, postToGame, services],
  );

  const loadAndPostRiddle = useCallback(
    async (input: {gameMode: WebGameMode; locale: string; classicIndex?: number}, requestId?: string) => {
      try {
        setGameMode(input.gameMode);
        const riddle = await withServerActivity(() => services.loadRiddle(input));
        riddleLoadedRef.current = true;
        postToGame({
          type: "host:riddleLoaded",
          requestId,
          payload: {
            riddle,
            profile: authSnapshot.profile,
          },
        });
        postOperation(requestId, "loadRiddle", true, {riddleId: riddle.riddleId});
        trackEvent("level_start", {
          game_mode: riddle.gameMode,
          level_name: riddle.index === undefined ? riddle.gameMode : `${riddle.gameMode}_${riddle.index}`,
          level_number: riddle.index,
        });
        setStartupComplete(true);
      } catch (error) {
        const message = getErrorMessage(error);
        setNotice(message);
        postOperation(requestId, "loadRiddle", false, undefined, message);
      }
    },
    [authSnapshot.profile, postOperation, postToGame, services, withServerActivity],
  );
  const loadAndPostRiddleRef = useRef(loadAndPostRiddle);
  loadAndPostRiddleRef.current = loadAndPostRiddle;

  useEffect(() => {
    postToGame({
      type: "host:authState",
      requestId: createRequestId("auth"),
      payload: {...authSnapshot, user: bridgeUser},
    });
  }, [authSnapshot, bridgeUser, postToGame]);

  const router = useMemo(
    () =>
      createHostMessageRouter({
        ready: async () => {
          setFrameReady(true);
          sendInit();
          if (authSnapshot.user) {
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
            postOperation(message.requestId, "completeGame", false, undefined, getErrorMessage(error));
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
            postOperation(message.requestId, "hint", false, undefined, getErrorMessage(error));
          }
        },
        spendCoins: async (message) => {
          try {
            if (message.payload.reason === "skip" && message.payload.riddleId && message.payload.gameMode) {
              const {riddleId, gameMode: skipGameMode} = message.payload;
              if (skipGameMode === "challenge") {
                throw new Error("Daily riddles cannot be skipped.");
              }
              const result = await withServerActivity(() =>
                services.skipRiddle({
                  riddleId,
                  gameMode: skipGameMode,
                }),
              );
              postOperation(message.requestId, "skip", true, result);
              trackEvent("riddle_skipped", {
                game_mode: skipGameMode,
                value: result.costDeducted,
              });
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
              getErrorMessage(error),
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
            postOperation(message.requestId, "purchase", false, undefined, getErrorMessage(error));
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
            postOperation(message.requestId, "leaderboard", false, undefined, getErrorMessage(error));
          }
        },
        updateUsername: async (message) => {
          try {
            const profile = await withServerActivity(() => services.updateUsername(message.payload.username));
            postOperation(message.requestId, "profile", true, {profile});
          } catch (error) {
            postOperation(message.requestId, "profile", false, undefined, getErrorMessage(error));
          }
        },
        updateAvatar: async (message) => {
          try {
            const profile = await withServerActivity(() => services.updateAvatar(message.payload.imageDataUrl));
            postOperation(message.requestId, "profile", true, {profile});
          } catch (error) {
            postOperation(message.requestId, "avatar", false, undefined, getErrorMessage(error));
          }
        },
        listRaceCategories: (message) =>
          runRaceOperation(message.requestId, "raceCategories", () =>
            services.listRaceCategories(message.payload.locale),
          ),
        startRace: (message) =>
          runRaceOperation(message.requestId, "raceStart", () => services.startRace(message.payload)),
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
          runRaceOperation(message.requestId, "raceChallenge", () =>
            services.getRaceChallenge(message.payload.challengeId),
          ),
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
        error: (message) => {
          setNotice(message.payload.message);
        },
      }),
    [
      applyPurchaseBalance,
      authSnapshot.profile,
      authSnapshot.user,
      gameMode,
      loadAndPostRiddle,
      locale,
      onAuthoritativeComplete,
      onPlayable,
      postOperation,
      runRaceOperation,
      sendInit,
      services,
      syncRaceAchievementProgress,
      withServerActivity,
    ],
  );

  useEffect(() => {
    const handleLocalMessage = (event: Event) => {
      void router((event as CustomEvent<unknown>).detail).catch((error) => setNotice(getErrorMessage(error)));
    };
    window.addEventListener(GAME_TO_HOST_EVENT, handleLocalMessage);
    return () => {
      window.removeEventListener(GAME_TO_HOST_EVENT, handleLocalMessage);
    };
  }, [router]);

  useEffect(() => {
    if (!authSnapshot.user) {
      loadedUserIdRef.current = null;
      riddleLoadedRef.current = false;
      return;
    }

    if (!frameReady || loadedUserIdRef.current === authSnapshot.user.uid) {
      return;
    }

    loadedUserIdRef.current = authSnapshot.user.uid;
    void loadAndPostRiddle({
      gameMode,
      locale,
      classicIndex: authSnapshot.profile?.classicIndex,
    });
  }, [authSnapshot.profile?.classicIndex, authSnapshot.user, frameReady, gameMode, loadAndPostRiddle, locale]);

  useEffect(() => {
    riddleLoadedRef.current = false;
    const user = authSnapshot.user;
    if (!user) return;

    const recoverHostAndRiddle = () => {
      sendInitRef.current();
      if (!riddleLoadedRef.current) {
        void loadAndPostRiddleRef.current({
          gameMode: gameModeRef.current,
          locale,
          classicIndex: classicIndexRef.current,
        });
      }
    };
    const initialTimer = window.setTimeout(recoverHostAndRiddle, 250);
    const recoveryTimer = window.setInterval(recoverHostAndRiddle, 2500);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(recoveryTimer);
    };
  }, [authSnapshot.user?.uid, locale]);

  useEffect(() => {
    const onVisibilityChange = () => {
      postToGame({
        type: document.visibilityState === "hidden" ? "host:pause" : "host:resume",
        requestId: createRequestId("visibility"),
        payload: {},
      });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [postToGame]);

  if (!authSnapshot.user) {
    return (
      <main className="route-loading" aria-live="polite">
        <SpinningWheelLoader message={tr("WebPortal.STARTUP_GAME")} progress={72} />
      </main>
    );
  }

  return (
    <main className="play-game-shell">
      {notice && <div className="play-alert game-shell-alert">{notice}</div>}
      <GameFrameApp
        localBridge
        interactionBlocked={serverInteractionActive}
        restoredGame={initialPlayerData?.activeGame}
        onSaveGame={saveActiveGame}
        registrationName={registrationName}
        initialRaceChallengeId={initialRaceChallengeId}
        initialRaceInbox={initialRaceInbox}
        raceFeatureEnabled={raceBuildEnabled}
        prefetchedRaceCategories={prefetchedRaceCategories}
      />
      {serverInteractionActive ? (
        <SpinningWheelLoader
          overlay
          message={!startupComplete ? tr("WebPortal.STARTUP_GAME") : undefined}
          progress={!startupComplete ? 88 : undefined}
        />
      ) : null}
    </main>
  );
}
