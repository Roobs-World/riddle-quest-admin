import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {signInWithCustomToken} from "firebase/auth";
import {auth} from "../firebase";
import {PlayHostApp} from "../play/PlayHostApp";
import {JestBackendClient, type JestBackendPort} from "./backend";
import {JestSdkPlatform} from "./JestSdkPlatform";
import {JestPurchaseCoordinator} from "./purchases";
import {markJestPlayable, startJestSession, type JestStartupUpdate} from "./startup";
import type {JestPlayerData, JestPlayerDataUpdate, JestRegistrationOverlayHandle, JestSession} from "./types";
import {tr, useLocale} from "../play/i18n";
import {MockJestPlatform} from "./MockJestPlatform";
import {recordAuthoritativeCompletion} from "./milestone";
import type {ProductSummary, PurchaseResult} from "../play/types";
import {SpinningWheelLoader} from "../play/SpinningWheelLoader";
import {useJestNotifications} from "./notifications/useJestNotifications";
import {useJestSharing} from "./sharing/useJestSharing";
import {resolveJestRuntimeMode} from "./runtimeMode";

export function JestPlayApp() {
  const locale = useLocale();
  const searchParams = new URLSearchParams(window.location.search);
  const harness = searchParams.get("harness");
  const runtimeMode = resolveJestRuntimeMode({
    development: import.meta.env.DEV,
    embedded: window.parent !== window,
    harness,
  });
  const {authHarness, mockBackend: mockRuntime} = runtimeMode;
  const mockRegistered = searchParams.get("registered") === "1";
  const platform = useMemo(
    () =>
      runtimeMode.useSdkPlatform ? new JestSdkPlatform() : new MockJestPlatform(mockRegistered),
    [mockRegistered, runtimeMode.useSdkPlatform],
  );
  const backend = useMemo(
    () =>
      mockRuntime
        ? ({
            exchangeIdentity: async (playerSigned: string) => {
              const testState = authHarness
                ? (
                    window as typeof window & {
                      __RIDDLE_QUEST_JEST_AUTH_TEST__?: {
                        scenario?: string;
                        backendExchanges: string[];
                        firebaseTokens: string[];
                      };
                    }
                  ).__RIDDLE_QUEST_JEST_AUTH_TEST__
                : undefined;
              testState?.backendExchanges.push(playerSigned);
              const onceKey = "riddleQuest:jestAuthHarness:identityFailed";
              const shouldFailOnce =
                testState?.scenario === "identity-once-failure" && sessionStorage.getItem(onceKey) !== "1";
              if (shouldFailOnce) sessionStorage.setItem(onceKey, "1");
              if (testState?.scenario === "identity-failure" || shouldFailOnce) {
                throw new Error("Mock Jest identity exchange failed");
              }
              return {customToken: "mock", uid: "jest-mock-player"};
            },
            grantPurchase: async (_signed: string, _playerId: string, purchaseToken: string) => ({
              granted: true,
              purchaseToken,
              coinsAwarded: 250,
              newCoins: 550,
            }),
            verifyReferrals: async () => ({verified: true}),
            syncSubscriptions: async (subscriptionsSigned: string) => ({
              verified: true,
              activeSkus:
                subscriptionsSigned.includes(".active.") || subscriptionsSigned.includes(".subscription.")
                  ? ["com.roobsworld.riddlequest.premium.monthly"]
                  : [],
              blockedSkus: [],
            }),
          } satisfies JestBackendPort)
        : new JestBackendClient(import.meta.env.VITE_JEST_FUNCTIONS_BASE_URL || "/"),
    [authHarness, mockRuntime],
  );
  const purchases = useMemo(() => new JestPurchaseCoordinator(platform, backend), [backend, platform]);
  const [session, setSession] = useState<JestSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationPending, setRegistrationPending] = useState(false);
  const [jestProducts, setJestProducts] = useState<ProductSummary[]>([]);
  const [pendingPlatformOperations, setPendingPlatformOperations] = useState(0);
  const [startup, setStartup] = useState<JestStartupUpdate>({stage: "connecting", progress: 5});
  const [engagementProgress, setEngagementProgress] = useState({
    level: 1,
    winStreak: 0,
    wins: 0,
  });
  const playerDataRef = useRef<JestPlayerData | null>(null);
  const playerDataWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const sessionRef = useRef<JestSession | null>(null);
  const registrationHandleRef = useRef<JestRegistrationOverlayHandle | null>(null);
  const registrationCompletingRef = useRef(false);
  const registrationSourceRef = useRef("post_instructions");
  sessionRef.current = session;
  const withPlatformActivity = useCallback(async <Result,>(operation: () => Promise<Result>): Promise<Result> => {
    const startedAt = Date.now();
    setPendingPlatformOperations((current) => current + 1);
    try {
      return await operation();
    } finally {
      const remainingTime = Math.max(0, 180 - (Date.now() - startedAt));
      window.setTimeout(() => {
        setPendingPlatformOperations((current) => Math.max(0, current - 1));
      }, remainingTime);
    }
  }, []);
  const trackFunnel = useCallback((eventName: string, params: Record<string, string | number | boolean> = {}) => {
    const intent = sessionRef.current?.entryIntent;
    const attributedParams = {
      ...(intent?.campaign ? {campaign: intent.campaign} : {}),
      ...(intent?.reference ? {reference: intent.reference} : {}),
      ...(intent?.utmSource ? {utm_source: intent.utmSource} : {}),
      ...(intent?.utmMedium ? {utm_medium: intent.utmMedium} : {}),
      ...(intent?.utmCampaign ? {utm_campaign: intent.utmCampaign} : {}),
      ...(intent?.utmTerm ? {utm_term: intent.utmTerm} : {}),
      ...(intent?.utmContent ? {utm_content: intent.utmContent} : {}),
      ...params,
    };
    console.info("[riddle-quest-funnel]", eventName, attributedParams);
    platform.captureEvent(eventName, attributedParams);
  }, [platform]);
  useJestNotifications({
    locale,
    mockRuntime,
    session,
    engagementProgress,
    playerFallback: tr("WebPortal.NOTIFICATION_PLAYER_FALLBACK"),
    assetReference: import.meta.env.VITE_JEST_NOTIFICATION_ASSET_REFERENCE || undefined,
    platform,
    withPlatformActivity,
    trackFunnel,
  });
  useJestSharing({locale, session, platform, backend, withPlatformActivity, trackFunnel});
  const authenticateJestIdentity = useCallback(
    async (token: string) => {
      if (authHarness) {
        (
          window as typeof window & {
            __RIDDLE_QUEST_JEST_AUTH_TEST__?: {firebaseTokens: string[]};
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__?.firebaseTokens.push(token);
      } else if (!mockRuntime) {
        await signInWithCustomToken(auth, token);
      }
    },
    [authHarness, mockRuntime],
  );
  useEffect(() => {
    let active = true;
    void startJestSession(platform, backend, purchases, authenticateJestIdentity, setStartup).then((result) => {
      if (!active) return;
      if (result.status === "success") {
        playerDataRef.current = result.value.playerData;
        const savedProfile = result.value.playerData?.profile;
        setEngagementProgress({
          level: savedProfile?.level ?? 1,
          winStreak: savedProfile?.winStreak ?? 0,
          wins: savedProfile?.wins ?? 0,
        });
        setSession(result.value);
        trackFunnel("session_started", {
          registered: result.value.player.registered,
          campaign: result.value.entryIntent.campaign ?? "direct",
          reference: result.value.entryIntent.reference ?? "none",
          notificationTemplate: result.value.entryIntent.notificationTemplate ?? "none",
          notificationOffset: result.value.entryIntent.notificationOffset ?? "none",
          utm_source: result.value.entryIntent.utmSource ?? "none",
          utm_medium: result.value.entryIntent.utmMedium ?? "none",
          utm_campaign: result.value.entryIntent.utmCampaign ?? "none",
          utm_term: result.value.entryIntent.utmTerm ?? "none",
          utm_content: result.value.entryIntent.utmContent ?? "none",
        });
      } else setError("message" in result ? result.message : "Jest startup was cancelled");
    });
    return () => {
      active = false;
    };
  }, [authenticateJestIdentity, backend, platform, purchases, trackFunnel]);

  const savePlayerData = useCallback(
    (update: JestPlayerDataUpdate) => {
      if (!sessionRef.current) return;
      if (update.profile) {
        setEngagementProgress({
          level: update.profile.level,
          winStreak: update.profile.winStreak,
          wins: update.profile.wins,
        });
      }
      const next: JestPlayerData = {
        ...(playerDataRef.current ?? {}),
        schemaVersion: 1,
        updatedAt: Date.now(),
        ...update,
      };
      playerDataRef.current = next;
      const write = playerDataWriteQueueRef.current
        .catch(() => undefined)
        .then(() => platform.writePlayerData(next));
      playerDataWriteQueueRef.current = write;
      void write.catch((writeError) => {
        console.warn("[riddle-quest] Jest player data save failed", writeError);
        trackFunnel("player_data_save_failed");
      });
    },
    [platform, trackFunnel],
  );

  useEffect(() => {
    if (!session) return;
    void withPlatformActivity(async () => {
      const products = await purchases.getProducts(navigator.language);
      const subscriptions = session.player.registered
        ? await purchases.getSubscriptions(session.player.playerId, navigator.language)
        : ({status: "success", value: []} as const);
      return {products, subscriptions};
    }).then(({products, subscriptions}) => {
      const nextProducts = products.status === "success" ? products.value : [];
      const nextSubscriptions = subscriptions.status === "success" ? subscriptions.value : [];
      setJestProducts([...nextSubscriptions, ...nextProducts]);
      if (products.status !== "success") trackFunnel("products_load_failed", {status: products.status});
      if (subscriptions.status !== "success") {
        trackFunnel("subscriptions_load_failed", {status: subscriptions.status});
      }
    });
  }, [purchases, session?.player.playerId, session?.player.registered, trackFunnel, withPlatformActivity]);

  const completeRegistrationPrompt = useCallback(() => {
    if (registrationCompletingRef.current) return;
    registrationCompletingRef.current = true;
    void withPlatformActivity(async () => {
      const previousSession = sessionRef.current;
      let registered = false;
      try {
        const player = platform.getPlayer();
        registered = player.registered;
        if (registered) {
          const signed = await platform.getPlayerSigned();
          const identity = await backend.exchangeIdentity(signed.playerSigned);
          await authenticateJestIdentity(identity.customToken);
          let profile = previousSession?.profile ?? null;
          try {
            profile = await platform.getProfile();
          } catch (profileError) {
            console.warn("[riddle-quest] Jest profile refresh after registration failed", profileError);
          }
          setSession((current) => (current ? {...current, player, profile} : current));
          trackFunnel("registration_completed", {
            playerContinuity: player.playerId === previousSession?.player.playerId,
            source: registrationSourceRef.current,
          });
        } else if (previousSession) {
          const preferences = {
            ...previousSession.preferences,
            registrationPromptDismissedAt: Date.now(),
          };
          await platform.writePreferences(preferences);
          setSession((current) => (current ? {...current, preferences} : current));
          trackFunnel("registration_prompt_dismissed", {source: registrationSourceRef.current});
        }
      } catch (registrationError) {
        console.warn("[riddle-quest] Jest registration completion failed", registrationError);
        trackFunnel("registration_completion_failed", {source: registrationSourceRef.current});
      } finally {
        registrationHandleRef.current = null;
        registrationCompletingRef.current = false;
        setRegistrationPending(false);
        setShowRegistration(false);
        window.dispatchEvent(
          new CustomEvent("riddle-quest:registration-prompt-closed", {
            detail: {registered},
          }),
        );
      }
    });
  }, [authenticateJestIdentity, backend, platform, trackFunnel, withPlatformActivity]);

  const openRegistrationPrompt = useCallback(
    (source: "post_instructions" | "authoritative_win", showGamePrompt: boolean) => {
      const currentSession = sessionRef.current;
      if (!currentSession || currentSession.player.registered) {
        window.dispatchEvent(
          new CustomEvent("riddle-quest:registration-prompt-closed", {
            detail: {registered: true},
          }),
        );
        return;
      }
      registrationSourceRef.current = source;
      if (!registrationHandleRef.current) {
        const overlay = platform.showRegistrationOverlay({
          theme: "dark",
          entryPayload: {
            source,
            campaign: currentSession.entryIntent.campaign ?? "direct_to_game_registration_v2",
            reference: `registration_${source}_v1`,
            ...(currentSession.entryIntent.customName ? {customName: currentSession.entryIntent.customName} : {}),
          },
          onClose: completeRegistrationPrompt,
        });
        if (overlay.status === "success") {
          registrationHandleRef.current = overlay.value;
        } else {
          trackFunnel("registration_overlay_failed", {source, status: overlay.status});
        }
      }
      setShowRegistration(showGamePrompt);
      trackFunnel("registration_prompt_shown", {after: source});
    },
    [completeRegistrationPrompt, platform, trackFunnel],
  );

  const dismissRegistration = useCallback(() => {
    setRegistrationPending(true);
    const handle = registrationHandleRef.current;
    if (handle) {
      try {
        handle.closeButtonAction();
      } catch (registrationError) {
        console.warn("[riddle-quest] Jest registration close action failed", registrationError);
        completeRegistrationPrompt();
      }
      return;
    }
    completeRegistrationPrompt();
  }, [completeRegistrationPrompt]);

  const register = useCallback(() => {
    setRegistrationPending(true);
    const handle = registrationHandleRef.current;
    if (handle) {
      try {
        handle.loginButtonAction();
      } catch (registrationError) {
        console.warn("[riddle-quest] Jest registration login action failed", registrationError);
        completeRegistrationPrompt();
      }
      return;
    }
    void withPlatformActivity(async () => {
      await platform.login();
      completeRegistrationPrompt();
    });
  }, [completeRegistrationPrompt, platform, withPlatformActivity]);

  const login = useCallback(() => {
    setRegistrationPending(true);
    void withPlatformActivity(() => platform.login()).then((result) => {
      if (result.status !== "success") {
        setRegistrationPending(false);
        trackFunnel("login_failed", {status: result.status});
        return;
      }
      const handle = registrationHandleRef.current;
      if (handle) {
        try {
          handle.closeButtonAction();
        } catch (registrationError) {
          console.warn("[riddle-quest] Jest registration overlay close after login failed", registrationError);
          completeRegistrationPrompt();
        }
        return;
      }
      completeRegistrationPrompt();
    });
  }, [completeRegistrationPrompt, platform, trackFunnel, withPlatformActivity]);

  const handleAuthoritativeComplete = useCallback(
    async (
      input: {gameMode: "classic" | "challenge"; isCorrect: boolean},
      result: {newLevel?: number; newWinStreak?: number},
    ) => {
      if (!session || !input.isCorrect) return;
      trackFunnel("authoritative_puzzle_won", {
        gameMode: input.gameMode,
        winStreak: result.newWinStreak ?? 0,
      });
      setEngagementProgress((current) => ({
        level: result.newLevel ?? current.level,
        winStreak: result.newWinStreak ?? current.winStreak,
        wins: current.wins + 1,
      }));
      const recorded = await recordAuthoritativeCompletion(platform, session, {
        gameMode: input.gameMode,
        isCorrect: input.isCorrect,
        newWinStreak: result.newWinStreak,
      });
      if (recorded.status !== "success") {
        trackFunnel("first_milestone_failed", {status: recorded.status});
        return;
      }
      setSession((current) => (current ? {...current, preferences: recorded.value.preferences} : current));
      if (recorded.value.milestoneMarked) trackFunnel("first_milestone_marked");
      if (recorded.value.shouldPromptRegistration) {
        openRegistrationPrompt("authoritative_win", true);
      }
    },
    [openRegistrationPrompt, platform, session, trackFunnel],
  );

  useEffect(() => {
    const showPostInstructionsRegistration = () => {
      openRegistrationPrompt("post_instructions", false);
    };
    const requestRegistration = () => register();
    const requestLogin = () => login();
    const dismissRegistrationPrompt = () => dismissRegistration();
    window.addEventListener("riddle-quest:registration-prompt-opened", showPostInstructionsRegistration);
    window.addEventListener("riddle-quest:register-player", requestRegistration);
    window.addEventListener("riddle-quest:login-player", requestLogin);
    window.addEventListener("riddle-quest:dismiss-registration", dismissRegistrationPrompt);
    return () => {
      window.removeEventListener("riddle-quest:registration-prompt-opened", showPostInstructionsRegistration);
      window.removeEventListener("riddle-quest:register-player", requestRegistration);
      window.removeEventListener("riddle-quest:login-player", requestLogin);
      window.removeEventListener("riddle-quest:dismiss-registration", dismissRegistrationPrompt);
    };
  }, [dismissRegistration, login, openRegistrationPrompt, register]);

  const purchaseProduct = useCallback(
    async (productId: string): Promise<PurchaseResult> => {
      if (!session) throw new Error("Jest session is not ready.");
      const product = jestProducts.find((candidate) => candidate.productId === productId);
      if (product?.productType === "subscription") {
        if (!session.player.registered) throw new Error("Registration is required to subscribe.");
        if (product.subscriptionStatus === "active") {
          return {success: true, productId, purchaseType: "subscription"};
        }
        const subscribed = await purchases.subscribe(productId, session.player.playerId);
        if (subscribed.status !== "success") {
          throw new Error("message" in subscribed ? subscribed.message : "Subscription cancelled.");
        }
        setJestProducts((current) =>
          current
            .filter((candidate) => !subscribed.value.blockedSkus.includes(candidate.productId))
            .map((candidate) =>
              candidate.productType === "subscription"
                ? {
                    ...candidate,
                    subscriptionStatus: candidate.productId === productId ? "active" : candidate.subscriptionStatus,
                    trialEligible: false,
                  }
                : candidate,
            ),
        );
        trackFunnel("subscription_completed", {productId});
        return {success: true, productId, purchaseType: "subscription"};
      }
      const result = await purchases.purchase(productId, session.player.playerId);
      if (result.status !== "success") {
        throw new Error("message" in result ? result.message : "Purchase cancelled.");
      }
      trackFunnel("purchase_completed", {productId});
      return {
        success: true,
        productId,
        purchaseType: "consumable",
        coinsAwarded: result.value.coinsAwarded,
        newCoins: result.value.newCoins,
        newlyUnlockedAchievementIds: result.value.newlyUnlockedAchievementIds,
      };
    },
    [jestProducts, purchases, session, trackFunnel],
  );

  if (error)
    return (
      <main className="route-missing">
        <div>
          <h1>Riddle Quest could not start</h1>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </main>
    );
  if (!session) {
    const startupMessageKey = {
      connecting: "WebPortal.STARTUP_CONNECTING",
      player: "WebPortal.STARTUP_PLAYER",
      progress: "WebPortal.STARTUP_PROGRESS",
      game: "WebPortal.STARTUP_GAME",
    }[startup.stage];
    return (
      <main className="route-loading">
        <SpinningWheelLoader message={tr(startupMessageKey)} progress={startup.progress} />
      </main>
    );
  }
  return (
    <>
      {!session.player.registered && showRegistration ? (
        <aside
          className="play-alert jest-registration-alert"
          inert={pendingPlatformOperations > 0 || registrationPending ? true : undefined}
        >
          <strong>{tr("Profile.JEST_REGISTRATION_TITLE")}</strong>
          {session.entryIntent.customName ? (
            <p>
              {tr("Profile.JEST_REGISTRATION_GREETING", {
                name: session.entryIntent.customName,
              })}
            </p>
          ) : null}
          <p>{tr("Profile.JEST_REGISTRATION_DESCRIPTION")}</p>
          <button className="play-primary compact" onClick={register}>
            {tr("Profile.JEST_REGISTER_BUTTON")}
          </button>
          <button className="play-secondary compact" onClick={login}>
            {tr("Profile.JEST_LOGIN_BUTTON")}
          </button>
          <button className="play-text-button" onClick={dismissRegistration}>
            {tr("Profile.JEST_PLAY_AS_GUEST_BUTTON")}
          </button>
        </aside>
      ) : null}
      <PlayHostApp
        initialGameMode={session.entryIntent.gameMode}
        initialRaceChallengeId={session.entryIntent.challengeId}
        registrationName={session.entryIntent.customName}
        onPlayable={() => markJestPlayable(platform)}
        onAuthoritativeComplete={handleAuthoritativeComplete}
        platformProducts={jestProducts}
        platformPurchase={purchaseProduct}
        platformPlayerRegistered={session.player.registered}
        externalInteractionBlocked={pendingPlatformOperations > 0}
        initialPlayerData={session.playerData}
        onPlayerDataChange={savePlayerData}
      />
    </>
  );
}
