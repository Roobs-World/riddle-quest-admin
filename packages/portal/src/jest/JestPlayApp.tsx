import {useCallback, useEffect, useMemo, useState} from "react";
import {signInWithCustomToken} from "firebase/auth";
import {auth} from "../firebase";
import {PlayHostApp} from "../play/PlayHostApp";
import {JestBackendClient, type JestBackendPort} from "./backend";
import {JestSdkPlatform} from "./JestSdkPlatform";
import {JestPurchaseCoordinator} from "./purchases";
import {markJestPlayable, startJestSession} from "./startup";
import type {JestSession} from "./types";
import {tr} from "../play/i18n";
import {captureGameScreenshot, sizeCheckedScreenshotProvider} from "./screenshots";
import {scheduleEngagementReminders} from "./engagement";
import {MockJestPlatform} from "./MockJestPlatform";
import {recordAuthoritativeCompletion} from "./milestone";
import type {ProductSummary, PurchaseResult} from "../play/types";

export function JestPlayApp() {
  const mockRuntime = new URLSearchParams(window.location.search).get("harness") === "jest";
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
  const [engagementProgress, setEngagementProgress] = useState({level: 1, winStreak: 0});
  const [jestProducts, setJestProducts] = useState<ProductSummary[]>([]);
  const trackFunnel = useCallback((eventName: string, params: Record<string, string | number | boolean> = {}) => {
    console.info("[riddle-quest-funnel]", eventName, params);
  }, []);
  useEffect(() => {
    let active = true;
    void startJestSession(platform, backend, purchases, async (token) => { if (!mockRuntime) await signInWithCustomToken(auth, token); })
      .then((result) => {
        if (!active) return;
        if (result.status === "success") {
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

  useEffect(() => {
    if (!session) return;
    void purchases.getProducts(navigator.language).then((result) => {
      if (result.status === "success") setJestProducts(result.value);
      else trackFunnel("products_load_failed", {status: result.status});
    });
  }, [purchases, session, trackFunnel]);

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
      setShowRegistration(true);
      trackFunnel("registration_prompt_shown", {after: "authoritative_win"});
    }
  }, [platform, session, trackFunnel]);

  const dismissRegistration = useCallback(async () => {
    const dismissedAt = Date.now();
    setShowRegistration(false);
    if (session) {
      const preferences = {...session.preferences, registrationPromptDismissedAt: dismissedAt};
      await platform.writePreferences(preferences);
      setSession((current) => current ? {...current, preferences} : current);
    }
    trackFunnel("registration_prompt_dismissed");
  }, [platform, session, trackFunnel]);

  const register = useCallback(async () => {
    const result = await platform.login();
    if (result.status !== "success" || !result.value.registered) {
      await dismissRegistration();
      return;
    }
    const profile = await platform.getProfile();
    setSession((current) => current ? {...current, player: result.value, profile} : current);
    setShowRegistration(false);
    trackFunnel("registration_completed", {playerContinuity: result.value.playerId === session?.player.playerId});
  }, [dismissRegistration, platform, session?.player.playerId, trackFunnel]);

  useEffect(() => {
    const requestRegistration = () => {
      void register();
    };
    window.addEventListener("riddle-quest:register-player", requestRegistration);
    return () => window.removeEventListener("riddle-quest:register-player", requestRegistration);
  }, [register]);

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
    void scheduleEngagementReminders(platform, {
      title: tr("WebPortal.APP_TITLE"),
      dailyLabel: tr("WebPortal.PLAY_DAILY"),
      levelLabel: tr("Profile.HIGHEST_CLASSIC_LEVEL_STAT"),
      streakLabel: tr("StatsModal.CURRENT_STREAK"),
      ctaText: tr("Navigation.PLAY_BUTTON"),
      level: engagementProgress.level,
      winStreak: engagementProgress.winStreak,
      assetReference: import.meta.env.VITE_JEST_NOTIFICATION_ASSET_REFERENCE || undefined,
    });
  }, [engagementProgress.level, engagementProgress.winStreak, platform, session?.player.registered]);

  useEffect(() => {
    if (!session?.player.registered) return;
    void platform.listReferralsSigned().then((result) => {
      if (result.status === "success") {
        return backend.verifyReferrals(result.value, session.player.playerId);
      }
    });
  }, [backend, platform, session?.player.playerId, session?.player.registered]);

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
      void platform.shareReferral({
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
      }).then((result) => trackFunnel("friend_challenge_share_dialog", {
        status: result.status,
        gameMode,
        attempts: detail.attempts ?? 0,
      }));
    };
    window.addEventListener("riddle-quest:share-referral", share);
    return () => window.removeEventListener("riddle-quest:share-referral", share);
  }, [platform, session, trackFunnel]);

  if (error) return <main className="route-missing"><div><h1>Riddle Quest could not start</h1><p>{error}</p><button onClick={() => window.location.reload()}>Retry</button></div></main>;
  if (!session) return <main className="route-loading" aria-live="polite">Loading Riddle Quest…</main>;
  return <>
    {!session.player.registered && showRegistration ? <aside className="play-alert">
      <strong>{tr("Profile.GUEST_MODE_TITLE")}</strong>
      {session.entryIntent.customName ? <p>{session.entryIntent.customName}</p> : null}
      <p>{tr("Profile.GUEST_MODE_DESCRIPTION")}</p>
      <button className="play-primary compact" onClick={() => void register()}>{tr("Profile.GUEST_MODE_TITLE")}</button>
      <button className="play-text-button" onClick={() => void dismissRegistration()}>{tr("CommonAlerts.CLOSE_BUTTON")}</button>
    </aside> : null}
    <PlayHostApp
      initialGameMode={session.entryIntent.gameMode}
      onPlayable={() => markJestPlayable(platform)}
      onAuthoritativeComplete={(input, result) => void handleAuthoritativeComplete(input, result)}
      platformProducts={jestProducts}
      platformPurchase={purchaseProduct}
      platformPlayerRegistered={session.player.registered}
    />
  </>;
}
