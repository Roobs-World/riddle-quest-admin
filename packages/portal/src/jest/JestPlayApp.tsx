import {ProviderProfileContext} from "../play/ProviderProfileContext";
import {ShopSubscriptionContext} from "../play/modalPages/commerce/ShopSubscriptionContext";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {PlayHostApp} from "../play/PlayHostApp";
import {JestSdkPlatform} from "./JestSdkPlatform";
import {JestPurchaseCoordinator} from "./purchases";
import {
  JEST_SDK_INIT_TIMEOUT_MESSAGE,
  markJestPlayable,
  startJestSession,
  stopJestLoadingHeartbeat,
  type JestStartupUpdate,
} from "./startup";
import type {JestSession} from "./types";
import {tr, useLocale} from "../play/i18n";
import {MockJestPlatform} from "./MockJestPlatform";
import {recordAuthoritativeCompletion} from "./milestone";
import {useJestNotifications} from "./notifications/useJestNotifications";
import type {NotificationCopy} from "./notifications/copy";
import {createNotificationOperationGate} from "./notifications/operationGate";
import {useJestSharing} from "./sharing/useJestSharing";
import {resolveJestRuntimeMode, shouldEnableJestSubscriptions} from "./runtimeMode";
import {trackScreen} from "../analytics/events";
import {hasTrustedTestHarnessMarker} from "../testHarness";
import {resolveRaceChallengeId} from "./entryIntent";
import {createJestBackend} from "./createJestBackend";
import {JestAccountDeleted, JestRegistrationAlert, JestStartupError, JestStartupProgress} from "./JestSessionViews";
import {useJestProductCatalog} from "./useJestProductCatalog";
import {useJestPurchase} from "./useJestPurchase";
import {captureBrowserException} from "../observability/browserErrorReporter";
import {
  ACCOUNT_DELETION_PENDING_PHASE,
  AccountDeletionCleanupError,
  completeTombstonedAccountDeletion,
  discardAccountDeletionForDifferentPlayer,
  getAccountDeletionPendingPhase,
  isAccountDeletionCleanupPending,
  markAccountDeletionRequested,
  purgeDeletedPlayerState,
  recoverPendingAccountDeletion,
  runAccountDeletionAwareIdentityOperation,
} from "./accountDeletionCleanup";
import {useJestPlayerStateWrites} from "./useJestPlayerStateWrites";
import {useAccountDeletionQuiescence} from "./useAccountDeletionQuiescence";
import {commitJestStartupSession} from "./commitJestStartupSession";
import {clearJestFirebaseAuthentication} from "./clearJestFirebaseAuthentication";
import {createHostServices, getHostConfigurationWarning, resolveHostServicesMode} from "../play/services";
import {useJestFunnelTracking, useJestPlatformActivity} from "./useJestPlatformOperations";
import {useJestPresence} from "./useJestPresence";
import {useJestRegistration} from "./useJestRegistration";
import {createHostedPlaySession} from "../play/HostedPlaySession";
/** Provides jest play app behavior. */
export function JestPlayApp() {
  /** Provides locale behavior. */
  const locale = useLocale();
  /** Provides host services mode behavior. */
  const hostServicesMode = useMemo(() => resolveHostServicesMode(), []);
  /** Provides host services behavior. */
  const hostServices = useMemo(() => createHostServices(hostServicesMode), [hostServicesMode]);
  /** Provides host configuration warning behavior. */
  const hostConfigurationWarning = getHostConfigurationWarning(hostServicesMode);
  /** Provides search params behavior. */
  const searchParams = new URLSearchParams(window.location.search);
  /** Provides harness behavior. */
  const harness = searchParams.get("harness");
  /** Provides runtime mode behavior. */
  const runtimeMode = resolveJestRuntimeMode({
    development: import.meta.env.DEV,
    embedded: window.parent !== window,
    harness,
    testHarnessEnabled: import.meta.env.DEV || hasTrustedTestHarnessMarker(),
  });
  /** Provides {auth harness, mock backend: mock runtime} behavior. */
  const {authHarness, mockBackend: mockRuntime} = runtimeMode;
  /** Provides subscriptions enabled behavior. */
  const subscriptionsEnabled = shouldEnableJestSubscriptions(import.meta.env.DEV);
  /** Provides mock registered behavior. */
  const mockRegistered = searchParams.get("registered") === "1";
  /** Provides platform behavior. */
  const platform = useMemo(
    () => (runtimeMode.useSdkPlatform ? new JestSdkPlatform() : new MockJestPlatform(mockRegistered)),
    [mockRegistered, runtimeMode.useSdkPlatform],
  );
  /** Provides backend behavior. */
  const backend = useMemo(() => createJestBackend({authHarness, mockRuntime}), [authHarness, mockRuntime]);
  /** Provides purchases behavior. */
  const purchases = useMemo(() => new JestPurchaseCoordinator(platform, backend), [backend, platform]);
  /** Provides [session, set session] behavior. */
  const [session, setSession] = useState<JestSession | null>(null);
  /** Keeps host authority assembly stable while player progress and SDK activity update. */
  const platformCapabilities = useMemo(() => ({
    accountUpgrade: {
      state: session?.player.registered ? "complete" as const : "available" as const,
      begin: async () => ({status: "unavailable" as const, message: "Use the Jest registration controls."}),
    },
  }), [session?.player.registered]);
  /** Provides [error, set error] behavior. */
  const [error, setError] = useState<string | null>(null);
  /** Provides [account deleted, set account deleted] behavior. */
  const [accountDeleted, setAccountDeleted] = useState(false);
  /** Provides [startup, set startup] behavior. */
  const [startup, setStartup] = useState<JestStartupUpdate>({stage: "connecting", progress: 5});
  /** Provides [engagement progress, set engagement progress] behavior. */
  const [engagementProgress, setEngagementProgress] = useState({
    level: 1,
    winStreak: 0,
    wins: 0,
  });
  /** Provides [notification operation gate] behavior. */
  const [notificationOperationGate] = useState(createNotificationOperationGate);
  /** Provides deletion cleanup options behavior. */
  const deletionCleanupOptions = useMemo(
    () => ({
      clearFirebaseAuthentication: authHarness || mockRuntime ? undefined : clearJestFirebaseAuthentication,
      waitForPendingNotificationOperations: notificationOperationGate.waitForPending,
      withExclusiveNotificationAccess: notificationOperationGate.runExclusive,
    }),
    [authHarness, mockRuntime, notificationOperationGate],
  );
  /** Provides session ref behavior. */
  const sessionRef = useRef<JestSession | null>(null);
  sessionRef.current = session;
  /** Provides {pending platform operations, with platform activity, with background platform activity} behavior. */
  const {pendingPlatformOperations, withPlatformActivity, withBackgroundPlatformActivity} =
    useJestPlatformActivity(notificationOperationGate);
  /** Tracks funnel. */
  const trackFunnel = useJestFunnelTracking({
    gate: notificationOperationGate,
    platform,
    sessionRef,
  });
  /** Provides player state writes behavior. */
  const playerStateWrites = useJestPlayerStateWrites({
    platform,
    gate: notificationOperationGate,
    sessionRef,
    setSession,
    setEngagementProgress,
    trackFailure: trackFunnel,
  });
  /** Provides account deletion quiesced behavior. */
  const accountDeletionQuiesced = useAccountDeletionQuiescence(notificationOperationGate);
  /** Bundled locale copy keeps the Jest notification lifecycle independent of remote configuration availability. */
  const notificationFallbackCopy = useMemo<NotificationCopy>(
    () => ({
      dailyBody: tr("WebPortal.NOTIFICATION_DAILY_BODY"),
      dailyCta: tr("WebPortal.NOTIFICATION_DAILY_CTA"),
      streakBody: tr("WebPortal.NOTIFICATION_STREAK_BODY"),
      streakCta: tr("WebPortal.NOTIFICATION_STREAK_CTA"),
      weeklyBody: tr("WebPortal.NOTIFICATION_WEEKLY_BODY"),
      weeklyCta: tr("WebPortal.NOTIFICATION_WEEKLY_CTA"),
      raceTitle: tr("RaceTo10.TITLE"),
      raceBody: tr("RaceTo10.RESULTS_NOTIFICATION_BODY"),
      raceCta: tr("RaceTo10.CHECK_RESULTS"),
    }),
    [locale],
  );
  useJestNotifications({
    locale,
    mockRuntime,
    session,
    engagementProgress,
    gameTitle: tr("WebPortal.JEST_APP_TITLE"),
    playerFallback: tr("WebPortal.NOTIFICATION_PLAYER_FALLBACK"),
    fallbackCopy: notificationFallbackCopy,
    assetReference: import.meta.env.VITE_JEST_NOTIFICATION_ASSET_REFERENCE || undefined,
    platform,
    notificationsEnabled: notificationOperationGate.isOpen,
    withPlatformActivity: notificationOperationGate.run,
    trackFunnel,
  });
  /** Provides referral sharing behavior. */
  const referralSharing = useJestSharing({
    locale,
    session,
    platform,
    backend,
    withPlatformActivity,
    withBackgroundPlatformActivity,
    trackFunnel,
    authHarness,
  });
  /** Provides [jest products, set jest products] behavior. */
  const [jestProducts, setJestProducts, refreshProducts] = useJestProductCatalog({
    purchases,
    session,
    subscriptionsEnabled,
    trackFunnel,
    withPlatformActivity: withBackgroundPlatformActivity,
  });
  /** Supplies shop operations through the Jest adapter. */
  const subscriptionActions = useMemo(() => ({
    refresh: refreshProducts,
    cancel: async (sku: string): Promise<"success" | "cancelled" | "error"> => {
      /** Waits for the provider cancellation confirmation. */
      const result = await withPlatformActivity(() => platform.cancelSubscription(sku));
      await refreshProducts();
      return result.status === "success" || result.status === "cancelled" ? result.status : "error";
    },
  }), [platform, refreshProducts, withPlatformActivity]);
  /** Provides purchase product behavior. */
  const purchaseProduct = useJestPurchase({
    products: jestProducts,
    purchases,
    session,
    setProducts: setJestProducts,
    subscriptionsEnabled,
    trackFunnel,
  });
  /** Provides authenticate jest identity behavior. */
  const authenticateJestIdentity = useCallback(
    async (token: string) => {
      if (authHarness) {
        (
          window as typeof window & {
            /** Stores riddle quest jest auth test. */
            __RIDDLE_QUEST_JEST_AUTH_TEST__?: {
              /** Stores firebase tokens. */
              firebaseTokens: string[];
            };
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__?.firebaseTokens.push(token);
      } else if (!mockRuntime) {
        /** Provides [{sign in with custom token}, {auth}, {ensure jest firebase app check ready}] behavior. */
        const [{signInWithCustomToken}, {auth}, {ensureJestFirebaseAppCheckReady}] = await Promise.all([
          import("firebase/auth"),
          import("../firebase"),
          import("./JestFirebaseAppCheck"),
        ]);
        await signInWithCustomToken(auth, token);
        await ensureJestFirebaseAppCheckReady();
      }
    },
    [authHarness, mockRuntime],
  );
  /** Completes tombstoned player cleanup. */
  const completeTombstonedPlayerCleanup = useCallback(
    async (playerSigned: string) => {
      await completeTombstonedAccountDeletion(
        platform,
        playerSigned,
        notificationOperationGate,
        async (signed) => {
          /** Provides result behavior. */
          const result = await backend.retryAccountDeletion(signed);
          if (!result.accountDeleted) throw new Error("account-deletion-recovery-rejected");
        },
        deletionCleanupOptions.clearFirebaseAuthentication,
      );
      notificationOperationGate.close();
      playerStateWrites.disable();
      sessionRef.current = null;
      setSession(null);
      setAccountDeleted(true);
    },
    [backend, deletionCleanupOptions, notificationOperationGate, platform, playerStateWrites],
  );
  useEffect(() => {
    /** Provides active behavior. */
    let active = true;
    playerStateWrites.disable();
    /** Provides deletion recovery behavior. */
    void startJestSession(platform, backend, purchases, authenticateJestIdentity, setStartup, {
      onInitialized: () => {
        discardAccountDeletionForDifferentPlayer(platform.getPlayer().playerId);
        return recoverPendingAccountDeletion(platform, "initialized", deletionCleanupOptions);
      },
      onAuthenticated: isAccountDeletionCleanupPending,
      onIdentityDeleted: completeTombstonedPlayerCleanup,
      deletionRecovery: () =>
        getAccountDeletionPendingPhase() === ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion,
      recoverAccountDeletion: (playerSigned) =>
        recoverPendingAccountDeletion(platform, "signed", {
          clearFirebaseAuthentication: deletionCleanupOptions.clearFirebaseAuthentication,
          retryAuthoritativeDeletion: async () => {
            /** Provides result behavior. */
            const result = await backend.retryAccountDeletion(playerSigned);
            if (!result.accountDeleted) throw new Error("account-deletion-recovery-rejected");
          },
          waitForPendingNotificationOperations: notificationOperationGate.waitForPending,
        }).then((recovered) => {
          if (!recovered) throw new Error("account-deletion-recovery-state-changed");
        }),
      // Recovery owns the exclusive lock through identity, authority, and client purge.
      // Ordinary identity is shared work and is rechecked immediately after lock release.
      withIdentityOperation: (operation) =>
        runAccountDeletionAwareIdentityOperation(
          getAccountDeletionPendingPhase() === ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion,
          notificationOperationGate,
          operation,
        ),
      withAccountOperation: notificationOperationGate.run,
    }).then(async (result) => {
      if (!active) return;
      if (result.status === "account-deleted") {
        notificationOperationGate.close();
        setAccountDeleted(true);
        return;
      }
      if (result.status === "success") {
        try {
          await commitJestStartupSession({
            gate: notificationOperationGate,
            isActive: () => active,
            session: result.value,
            enablePlayerStateWrites: playerStateWrites.enable,
            setEngagementProgress,
            setSession,
            trackFunnel,
          });
        } catch (commitError) {
          captureBrowserException(commitError, {component: "jest_startup_commit"});
          setError(tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR"));
        }
      } else {
        /** Provides message behavior. */
        const message = "message" in result ? result.message : tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN");
        setError(message === JEST_SDK_INIT_TIMEOUT_MESSAGE ? tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN") : message);
      }
    });
    return () => {
      active = false;
      playerStateWrites.disable();
      stopJestLoadingHeartbeat(platform);
    };
  }, [
    authenticateJestIdentity,
    backend,
    completeTombstonedPlayerCleanup,
    deletionCleanupOptions,
    notificationOperationGate,
    platform,
    playerStateWrites,
    purchases,
    trackFunnel,
  ]);
  /** Clears app-owned browser and Jest state only after server-side account deletion succeeds. */
  const clearPlayerState = useCallback(async () => {
    notificationOperationGate.close();
    await playerStateWrites.drainAndClear();
    try {
      await purgeDeletedPlayerState(platform, deletionCleanupOptions);
    } catch (clearError) {
      console.warn("[riddle-quest] Player-state clear failed after account deletion", clearError);
      /** Provides cleanup error behavior. */
      const cleanupError = clearError instanceof AccountDeletionCleanupError ? clearError : undefined;
      trackFunnel("player_state_clear_failed", {
        notifications: cleanupError?.notificationsFailed ?? true,
        platform: cleanupError?.platformFailed ?? true,
        browser: cleanupError?.browserFailed ?? true,
      });
      throw clearError;
    }
    sessionRef.current = null;
    setSession(null);
    setAccountDeleted(true);
  }, [deletionCleanupOptions, notificationOperationGate, platform, playerStateWrites, trackFunnel]);
  /** Provides {
    show registration,
    registration pending,
    registration failure,
    open: open registration prompt,
    dismiss: dismiss registration,
    register,
    login,
  } behavior. */
  const {
    showRegistration,
    registrationPending,
    registrationFailure,
    open: openRegistrationPrompt,
    dismiss: dismissRegistration,
    register,
    login,
  } = useJestRegistration({
    platform,
    backend,
    sessionRef,
    setSession,
    setError,
    authenticateIdentity: authenticateJestIdentity,
    completeDeletedPlayerCleanup: completeTombstonedPlayerCleanup,
    withPlatformActivity,
    trackFunnel,
  });
  /** Handles authoritative complete. */
  const handleAuthoritativeComplete = useCallback(
    async (
      input: {
        /** Stores game mode. */
        gameMode: "classic" | "challenge";
      },
      result: {
        /** Stores is correct. */
        isCorrect: boolean; /** Stores new level. */
        /** Stores new level. */
        newLevel?: number; /** Stores new win streak. */
        /** Stores new win streak. */
        newWinStreak?: number;
      },
    ) => {
      if (!session || !result.isCorrect) return;
      trackFunnel("authoritative_puzzle_won", {
        gameMode: input.gameMode,
        winStreak: result.newWinStreak ?? 0,
      });
      setEngagementProgress((current) => ({
        level: result.newLevel ?? current.level,
        winStreak: result.newWinStreak ?? current.winStreak,
        wins: current.wins + 1,
      }));
      /** Records ed. */
      const recorded = await notificationOperationGate.run(() =>
        recordAuthoritativeCompletion(platform, session, {
          gameMode: input.gameMode,
          isCorrect: result.isCorrect,
          newWinStreak: result.newWinStreak,
        }),
      );
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
    [notificationOperationGate, openRegistrationPrompt, platform, session, trackFunnel],
  );
  /** Provides {set presence state, toggle presence} behavior. */
  const {setPresenceState, togglePresence} = useJestPresence({
    gate: notificationOperationGate,
    platform,
    session,
    sessionRef,
    setSession,
    trackFailure: trackFunnel,
  });
  useEffect(() => {
    trackScreen(
      error
        ? "startup_error"
        : accountDeleted
          ? "account_deleted"
          : !session
            ? "startup_loading"
            : !session.player.registered && showRegistration
              ? "registration_prompt"
              : "game",
    );
  }, [accountDeleted, error, session, showRegistration]);
  if (error) {
    return <JestStartupError message={error} />;
  }
  if (accountDeleted) {
    return <JestAccountDeleted />;
  }
  if (!session || accountDeletionQuiesced) {
    return <JestStartupProgress startup={startup} />;
  }
  return (
    <>
      {registrationFailure ? (
        <div
          className="play-alert game-shell-alert"
          role="alert"
          style={{top: "auto", bottom: "max(12px, env(safe-area-inset-bottom))"}}
        >
          {registrationFailure}
        </div>
      ) : null}
      {!session.player.registered && showRegistration ? (
        <JestRegistrationAlert
          blocked={pendingPlatformOperations > 0 || registrationPending}
          session={session}
          onRegister={register}
          onLogin={login}
          onDismiss={dismissRegistration}
        />
      ) : null}
      <ProviderProfileContext.Provider value={{username: session.profile?.username ?? null, avatarUrl: session.profile?.avatarUrl ?? null}}>
      <ShopSubscriptionContext.Provider value={subscriptionsEnabled ? subscriptionActions : null}>
        <PlayHostApp
          session={createHostedPlaySession({
            hostServices,
            hostConfigurationWarning,
            initialGameMode: session.entryIntent.gameMode,
            initialRaceChallengeId: resolveRaceChallengeId(session.entryIntent),
            initialRaceInbox: session.entryIntent.challengeDestination === "inbox",
            initialRaceLobby: session.entryIntent.challengeDestination === "multiplayer",
            registrationName: session.entryIntent.customName,
            registrationInviterName: session.entryIntent.inviterName,
            platformProducts: jestProducts,
            platformPurchase: purchaseProduct,
            raceAvailable: true,
            platformCapabilities,
            externalInteractionBlocked: pendingPlatformOperations > 0,
            initialPlayerData: session.playerData,
            onPlayerDataChange: playerStateWrites.savePlayerData,
            accountDeletionServiceGate: notificationOperationGate,
            presenceEnabled: session.preferences.presenceEnabled === true,
            onTogglePresence: togglePresence,
            onPresenceStateChange: setPresenceState,
            referralSharing,
          })}
          onPlayable={() => markJestPlayable(platform)}
          onAuthoritativeComplete={handleAuthoritativeComplete}
          onAccountDeletionRequested={() => markAccountDeletionRequested(platform.getPlayer().playerId)}
          onAccountDeleted={clearPlayerState}
        />
      </ShopSubscriptionContext.Provider>
      </ProviderProfileContext.Provider>
    </>
  );
}
