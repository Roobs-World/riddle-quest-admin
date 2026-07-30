import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {signInWithCustomToken} from "firebase/auth";
import {auth} from "../firebase";
import {PlayHostApp} from "../play/PlayHostApp";
import {JestBackendClient, type JestBackendPort} from "./backend";
import {JestSdkPlatform} from "./JestSdkPlatform";
import {JestPurchaseCoordinator} from "./purchases";
import {markJestPlayable, startJestSession, type JestStartupUpdate} from "./startup";
import type {
  JestPlayerData,
  JestPlayerDataUpdate,
  JestRegistrationOverlayHandle,
  JestSession,
} from "./types";
import {tr} from "../play/i18n";
import {captureGameScreenshot, sizeCheckedScreenshotProvider} from "./screenshots";
import {scheduleEngagementReminders} from "./engagement";
import {MockJestPlatform} from "./MockJestPlatform";
import {recordAuthoritativeCompletion} from "./milestone";
import type {ProductSummary, PurchaseResult} from "../play/types";
import {SpinningWheelLoader} from "../play/SpinningWheelLoader";

export function JestPlayApp() {
  const harness = new URLSearchParams(window.location.search).get("harness");
  const mockRuntime = import.meta.env.DEV || harness === "jest" || harness === "dev";
  const platform = useMemo(() => mockRuntime ? new MockJestPlatform() : new JestSdkPlatform(), [mockRuntime]);
  const backend = useMemo(() => mockRuntime ? {
    exchangeIdentity: async () => ({customToken: "mock", uid: "jest-mock-player"}),
    grantPurchase: async (_signed: string, _playerId: string, purchaseToken: string) => ({
      granted: true,
      purchaseToken,
      coinsAwarded: 250,
      newCoins: 550,
    }),
    verifyReferrals: async () => ({verified: true}),
  } satisfies JestBackendPort : new JestBackendClient(import.meta.env.VITE_JEST_FUNCTIONS_BASE_URL || "/"), [mockRuntime]);
  const purchases = useMemo(() => new JestPurchaseCoordinator(platform, backend), [backend, platform]);
  const [session, setSession] = useState<JestSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationPending, setRegistrationPending] = useState(false);
  const [engagementProgress, setEngagementProgress] = useState({level: 1, winStreak: 0});
  const [jestProducts, setJestProducts] = useState<ProductSummary[]>([]);
  const [pendingPlatformOperations, setPendingPlatformOperations] = useState(0);
  const [startup, setStartup] = useState<JestStartupUpdate>({stage: "connecting", progress: 5});
  const playerDataRef = useRef<JestPlayerData | null>(null);
  const playerDataWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const sessionRef = useRef<JestSession | null>(null);
  const registrationHandleRef = useRef<JestRegistrationOverlayHandle | null>(null);
  const registrationCompletingRef = useRef(false);
  const registrationSourceRef = useRef("post_instructions");
  sessionRef.current = session;
  const withPlatformActivity = useCallback(async <Result,>(
    operation: () => Promise<Result>,
  ): Promise<Result> => {
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
    console.info("[riddle-quest-funnel]", eventName, params);
  }, []);
  useEffect(() => {
    let active = true;
    void startJestSession(
      platform,
      backend,
      purchases,
      async (token) => { if (!mockRuntime) await signInWithCustomToken(auth, token); },
      setStartup,
    )
      .then((result) => {
        if (!active) return;
        if (result.status === "success") {
          playerDataRef.current = result.value.playerData;
          setSession(result.value);
          trackFunnel("session_started", {
            registered: result.value.player.registered,
            campaign: result.value.entryIntent.campaign ?? "direct",
            reference: result.value.entryIntent.reference ?? "none",
          });
        }
        else setError("message" in result ? result.message : "Jest startup was cancelled");
      });
    return () => { active = false; };
  }, [backend, mockRuntime, platform, purchases, trackFunnel]);

  const savePlayerData = useCallback((update: JestPlayerDataUpdate) => {
    const next: JestPlayerData = {
      ...(playerDataRef.current ?? {}),
      schemaVersion: 1,
      updatedAt: Date.now(),
      ...update,
    };
    playerDataRef.current = next;
    const write = playerDataWriteQueueRef.current
      .catch(() => undefined)
      .then(() => withPlatformActivity(() => platform.writePlayerData(next)));
    playerDataWriteQueueRef.current = write;
    void write.catch((writeError) => {
      console.warn("[riddle-quest] Jest player data save failed", writeError);
      trackFunnel("player_data_save_failed");
    });
  }, [platform, trackFunnel, withPlatformActivity]);

  useEffect(() => {
    if (!session) return;
    void withPlatformActivity(() => purchases.getProducts(navigator.language)).then((result) => {
      if (result.status === "success") setJestProducts(result.value);
      else trackFunnel("products_load_failed", {status: result.status});
    });
  }, [purchases, session, trackFunnel, withPlatformActivity]);

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
          let profile = previousSession?.profile ?? null;
          try {
            profile = await platform.getProfile();
          } catch (profileError) {
            console.warn("[riddle-quest] Jest profile refresh after registration failed", profileError);
          }
          setSession((current) => current ? {...current, player, profile} : current);
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
          setSession((current) => current ? {...current, preferences} : current);
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
        window.dispatchEvent(new CustomEvent("riddle-quest:registration-prompt-closed", {
          detail: {registered},
        }));
      }
    });
  }, [platform, trackFunnel, withPlatformActivity]);

  const openRegistrationPrompt = useCallback((
    source: "post_instructions" | "authoritative_win",
    showGamePrompt: boolean,
  ) => {
    const currentSession = sessionRef.current;
    if (!currentSession || currentSession.player.registered) {
      window.dispatchEvent(new CustomEvent("riddle-quest:registration-prompt-closed", {
        detail: {registered: true},
      }));
      return;
    }
    registrationSourceRef.current = source;
    if (!registrationHandleRef.current) {
      const overlay = platform.showRegistrationOverlay({
        theme: "dark",
        entryPayload: {source},
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
  }, [completeRegistrationPrompt, platform, trackFunnel]);

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

  const handleAuthoritativeComplete = useCallback(async (
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
    setSession((current) => current ? {...current, preferences: recorded.value.preferences} : current);
    if (recorded.value.milestoneMarked) trackFunnel("first_milestone_marked");
    if (recorded.value.shouldPromptRegistration) {
      openRegistrationPrompt("authoritative_win", true);
    }
  }, [openRegistrationPrompt, platform, session, trackFunnel]);

  useEffect(() => {
    const showPostInstructionsRegistration = () => {
      openRegistrationPrompt("post_instructions", false);
    };
    const requestRegistration = () => register();
    const dismissRegistrationPrompt = () => dismissRegistration();
    window.addEventListener("riddle-quest:registration-prompt-opened", showPostInstructionsRegistration);
    window.addEventListener("riddle-quest:register-player", requestRegistration);
    window.addEventListener("riddle-quest:dismiss-registration", dismissRegistrationPrompt);
    return () => {
      window.removeEventListener("riddle-quest:registration-prompt-opened", showPostInstructionsRegistration);
      window.removeEventListener("riddle-quest:register-player", requestRegistration);
      window.removeEventListener("riddle-quest:dismiss-registration", dismissRegistrationPrompt);
    };
  }, [dismissRegistration, openRegistrationPrompt, register]);

  const purchaseProduct = useCallback(async (productId: string): Promise<PurchaseResult> => {
    if (!session) throw new Error("Jest session is not ready.");
    const result = await purchases.purchase(productId, session.player.playerId);
    if (result.status !== "success") {
      throw new Error("message" in result ? result.message : "Purchase cancelled.");
    }
    trackFunnel("purchase_completed", {productId});
    return {
      success: true,
      productId,
      coinsAwarded: result.value.coinsAwarded,
      newCoins: result.value.newCoins,
      newlyUnlockedAchievementIds: result.value.newlyUnlockedAchievementIds,
    };
  }, [purchases, session, trackFunnel]);

  useEffect(() => {
    if (!session) return;
    platform.setScreenshotProvider(sizeCheckedScreenshotProvider(captureGameScreenshot));
    return () => platform.setScreenshotProvider(null);
  }, [platform, session?.player.playerId]);

  useEffect(() => {
    if (!session?.player.registered) return;
    void withPlatformActivity(() => scheduleEngagementReminders(platform, {
      title: tr("WebPortal.APP_TITLE"),
      dailyLabel: tr("WebPortal.PLAY_DAILY"),
      levelLabel: tr("Profile.HIGHEST_CLASSIC_LEVEL_STAT"),
      streakLabel: tr("StatsModal.CURRENT_STREAK"),
      ctaText: tr("Navigation.PLAY_BUTTON"),
      level: engagementProgress.level,
      winStreak: engagementProgress.winStreak,
      assetReference: import.meta.env.VITE_JEST_NOTIFICATION_ASSET_REFERENCE || undefined,
    }));
  }, [engagementProgress.level, engagementProgress.winStreak, platform, session?.player.registered, withPlatformActivity]);

  useEffect(() => {
    if (!session?.player.registered) return;
    void withPlatformActivity(async () => {
      const result = await platform.listReferralsSigned();
      if (result.status === "success") {
        await backend.verifyReferrals(result.value, session.player.playerId);
      }
    });
  }, [backend, platform, session?.player.playerId, session?.player.registered, withPlatformActivity]);

  useEffect(() => {
    if (!session) return;
    const share = (event: Event) => {
      const detail = (event as CustomEvent<{
        gameMode?: "classic" | "challenge";
        challengeId?: string;
        attempts?: number;
      }>).detail ?? {};
      const inviterName = session.profile?.username ?? "Riddle Quest player";
      const gameMode = detail.gameMode === "challenge" ? "challenge" : "classic";
      void withPlatformActivity(() => platform.shareReferral({
        reference: "riddle_quest_friend_challenge_v2",
        title: tr("WebPortal.APP_TITLE"),
        text: `${inviterName}: ${tr("VictoryModal.SHARE_TEXT")}`,
        onboardingSlug: "friend-challenge",
        entryPayload: {
          campaign: "friend_challenge_v2",
          reference: "victory_friend_challenge_v2",
          gameMode,
          challengeDestination: detail.challengeId ?? gameMode,
          challengeId: detail.challengeId ?? gameMode,
          inviterName,
          customName: tr("WebPortal.APP_TITLE"),
        },
      })).then((result) => trackFunnel("friend_challenge_share_dialog", {
        status: result.status,
        gameMode,
        attempts: detail.attempts ?? 0,
      }));
    };
    window.addEventListener("riddle-quest:share-referral", share);
    return () => window.removeEventListener("riddle-quest:share-referral", share);
  }, [platform, session, trackFunnel, withPlatformActivity]);

  if (error) return <main className="route-missing"><div><h1>Riddle Quest could not start</h1><p>{error}</p><button onClick={() => window.location.reload()}>Retry</button></div></main>;
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
  return <>
    {!session.player.registered && showRegistration ? <aside
      className="play-alert jest-registration-alert"
      inert={pendingPlatformOperations > 0 || registrationPending ? true : undefined}
    >
      <strong>{tr("Profile.GUEST_MODE_TITLE")}</strong>
      {session.entryIntent.customName ? <p>{session.entryIntent.customName}</p> : null}
      <p>{tr("Profile.GUEST_MODE_DESCRIPTION")}</p>
      <button className="play-primary compact" onClick={register}>{tr("Profile.GUEST_MODE_TITLE")}</button>
      <button className="play-text-button" onClick={dismissRegistration}>{tr("CommonAlerts.CLOSE_BUTTON")}</button>
    </aside> : null}
    <PlayHostApp
      initialGameMode={session.entryIntent.gameMode}
      onPlayable={() => markJestPlayable(platform)}
      onAuthoritativeComplete={handleAuthoritativeComplete}
      platformProducts={jestProducts}
      platformPurchase={purchaseProduct}
      platformPlayerRegistered={session.player.registered}
      externalInteractionBlocked={pendingPlatformOperations > 0}
      initialPlayerData={session.playerData}
      onPlayerDataChange={savePlayerData}
    />
  </>;
}
