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
type OperationName =
  "loadRiddle" | "completeGame" | "hint" | "spendCoins" | "purchase" | "skip" | "profile" | "leaderboard";

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
}: {
  initialGameMode?: WebGameMode;
  onPlayable?: () => void;
  onAuthoritativeComplete?: (
    input: {riddleId: string; gameMode: WebGameMode; attempts: number; isCorrect: boolean},
    result: CompletionResult,
  ) => void;
  platformProducts?: ProductSummary[];
  platformPurchase?: (productId: string) => Promise<import("./types").PurchaseResult>;
  platformPlayerRegistered?: boolean;
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

  const [authSnapshot, setAuthSnapshot] = useState<AuthSnapshot>({user: null, profile: null});
  const [frameReady, setFrameReady] = useState(false);
  const [gameMode, setGameMode] = useState<WebGameMode>(initialGameMode ?? "classic");
  const [notice, setNotice] = useState<string | null>(configurationWarning);
  const loadedUserIdRef = useRef<string | null>(null);
  const riddleLoadedRef = useRef(false);
  const playableReportedRef = useRef(false);
  const gameModeRef = useRef(gameMode);
  const classicIndexRef = useRef(authSnapshot.profile?.classicIndex);
  gameModeRef.current = gameMode;
  classicIndexRef.current = authSnapshot.profile?.classicIndex;
  const bridgeUser = useMemo(
    () =>
      authSnapshot.user
        ? {...authSnapshot.user, platformRegistered: platformPlayerRegistered}
        : null,
    [authSnapshot.user, platformPlayerRegistered],
  );

  useEffect(() => {
    detectDeviceLanguage(localStorage.getItem("appLanguage") ?? navigator.language);
  }, []);

  useEffect(() => services.auth.subscribe(setAuthSnapshot), [services]);

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
    setAuthSnapshot((current) =>
      current.profile ? {...current, profile: {...current.profile, coins: result.newCoins}} : current,
    );
  }, []);

  const loadAndPostRiddle = useCallback(
    async (input: {gameMode: WebGameMode; locale: string; classicIndex?: number}, requestId?: string) => {
      try {
        setGameMode(input.gameMode);
        const riddle = await services.loadRiddle(input);
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
      } catch (error) {
        const message = getErrorMessage(error);
        setNotice(message);
        postOperation(requestId, "loadRiddle", false, undefined, message);
      }
    },
    [authSnapshot.profile, postOperation, postToGame, services],
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
          await loadAndPostRiddle(message.payload, message.requestId);
        },
        completeGame: async (message) => {
          try {
            const result = await services.completeGame(message.payload);
            postOperation(message.requestId, "completeGame", true, result);
            onAuthoritativeComplete?.(message.payload, result);
          } catch (error) {
            postOperation(message.requestId, "completeGame", false, undefined, getErrorMessage(error));
          }
        },
        requestHint: async (message) => {
          try {
            const result = await services.requestHint(message.payload);
            postOperation(message.requestId, "hint", true, result);
          } catch (error) {
            postOperation(message.requestId, "hint", false, undefined, getErrorMessage(error));
          }
        },
        spendCoins: async (message) => {
          try {
            if (message.payload.reason === "skip" && message.payload.riddleId && message.payload.gameMode) {
              const result = await services.skipRiddle({
                riddleId: message.payload.riddleId,
                gameMode: message.payload.gameMode,
              });
              postOperation(message.requestId, "skip", true, result);
              await loadAndPostRiddle({
                gameMode: message.payload.gameMode,
                locale,
                classicIndex: result.newProgress?.classicIndex ?? authSnapshot.profile?.classicIndex,
              });
              return;
            }

            const result = await services.spendCoins(message.payload);
            postOperation(message.requestId, "spendCoins", true, result);
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
            const result = await services.requestPurchase(message.payload.productId);
            applyPurchaseBalance(result);
            setNotice(tr("WebPortal.PURCHASE_COMPLETE", {coins: result.coinsAwarded}));
            postOperation(message.requestId, "purchase", true, result);
          } catch (error) {
            postOperation(message.requestId, "purchase", false, undefined, getErrorMessage(error));
          }
        },
        loadLeaderboard: async (message) => {
          try {
            const entries = await services.loadLeaderboard(message.payload.leaderboardType);
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
            const profile = await services.updateUsername(message.payload.username);
            postOperation(message.requestId, "profile", true, {profile});
          } catch (error) {
            postOperation(message.requestId, "profile", false, undefined, getErrorMessage(error));
          }
        },
        analytics: (message) => {
          console.info("[riddle-quest-web]", message.payload.eventName, message.payload.params ?? {});
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
      sendInit,
      services,
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
        {tr("WebPortal.HOST_STATUS_WAITING")}
      </main>
    );
  }

  return (
    <main className="play-game-shell">
      {notice && <div className="play-alert game-shell-alert">{notice}</div>}
      <GameFrameApp localBridge />
    </main>
  );
}
