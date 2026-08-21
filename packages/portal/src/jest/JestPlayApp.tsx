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
import type {JestRegistrationOverlayHandle, JestSession} from "./types";
import {tr, useLocale} from "../play/i18n";
import {MockJestPlatform} from "./MockJestPlatform";
import {recordAuthoritativeCompletion} from "./milestone";
import {useJestNotifications} from "./notifications/useJestNotifications";
import {createNotificationOperationGate} from "./notifications/operationGate";
import {useJestSharing} from "./sharing/useJestSharing";
import {createRegistrationEntryPayload, type RegistrationSource} from "./registrationAttribution";
import {resolveJestRuntimeMode, shouldEnableJestSubscriptions} from "./runtimeMode";
import {trackScreen} from "../analytics/googleAnalytics";
import {hasTrustedTestHarnessMarker} from "../testHarness";
import {resolveRaceChallengeId} from "./entryIntent";
import {createJestBackend} from "./createJestBackend";
import {
  JestAccountDeleted,
  JestRegistrationAlert,
  JestStartupError,
  JestStartupProgress,
} from "./JestSessionViews";
import {useJestProductCatalog} from "./useJestProductCatalog";
import {useJestPurchase} from "./useJestPurchase";
import {captureBrowserException} from "../observability/sentry";
import {
  ACCOUNT_DELETION_PENDING_PHASE,
  AccountDeletionCleanupError,
  completeTombstonedAccountDeletion,
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
/** Provides jest play app behavior. */
export function JestPlayApp() {
  const locale = useLocale();
  const hostServicesMode = useMemo(() => resolveHostServicesMode(), []);
  const hostServices = useMemo(() => createHostServices(hostServicesMode), [hostServicesMode]);
  const hostConfigurationWarning = getHostConfigurationWarning(hostServicesMode);
  const searchParams = new URLSearchParams(window.location.search);
  const harness = searchParams.get("harness");
  const runtimeMode = resolveJestRuntimeMode({
    development: import.meta.env.DEV,
    embedded: window.parent !== window,
    harness,
    testHarnessEnabled: import.meta.env.DEV || hasTrustedTestHarnessMarker(),
  });
  const {authHarness, mockBackend: mockRuntime} = runtimeMode;
  // Subscription checkout is beta and currently stalls in Jest's live sandbox.
  // Keep the UI available in local development, but never expose it from an
  // uploaded production artifact until the release gate is deliberately changed.
  const subscriptionsEnabled = shouldEnableJestSubscriptions(import.meta.env.DEV);
  const mockRegistered = searchParams.get("registered") === "1";
  const platform = useMemo(
    () =>
      runtimeMode.useSdkPlatform ? new JestSdkPlatform() : new MockJestPlatform(mockRegistered),
    [mockRegistered, runtimeMode.useSdkPlatform],
  );
  const backend = useMemo(() => createJestBackend({authHarness, mockRuntime}), [authHarness, mockRuntime]);
  const purchases = useMemo(() => new JestPurchaseCoordinator(platform, backend), [backend, platform]);
  const [session, setSession] = useState<JestSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationPending, setRegistrationPending] = useState(false);
  const [registrationFailure, setRegistrationFailure] = useState<string | null>(null);
  const [accountDeleted, setAccountDeleted] = useState(false);
  const [startup, setStartup] = useState<JestStartupUpdate>({stage: "connecting", progress: 5});
  const [engagementProgress, setEngagementProgress] = useState({
    level: 1,
    winStreak: 0,
    wins: 0,
  });
  const [notificationOperationGate] = useState(createNotificationOperationGate);
  const deletionCleanupOptions = useMemo(() => ({
    clearFirebaseAuthentication: authHarness || mockRuntime ? undefined : clearJestFirebaseAuthentication,
    waitForPendingNotificationOperations: notificationOperationGate.waitForPending,
    withExclusiveNotificationAccess: notificationOperationGate.runExclusive,
  }), [authHarness, mockRuntime, notificationOperationGate]);
  const sessionRef = useRef<JestSession | null>(null);
  const registrationHandleRef = useRef<JestRegistrationOverlayHandle | null>(null);
  const registrationCompletingRef = useRef(false);
  const registrationSourceRef = useRef<RegistrationSource>("post_instructions");
  sessionRef.current = session;
  const {pendingPlatformOperations, withPlatformActivity, withBackgroundPlatformActivity} =
    useJestPlatformActivity(notificationOperationGate);
  const trackFunnel = useJestFunnelTracking({
    gate: notificationOperationGate,
    platform,
    sessionRef,
  });
  const playerStateWrites = useJestPlayerStateWrites({
    platform,
    gate: notificationOperationGate,
    sessionRef,
    setSession,
    setEngagementProgress,
    trackFailure: trackFunnel,
  });
  const accountDeletionQuiesced = useAccountDeletionQuiescence(notificationOperationGate);
  useJestNotifications({
    locale,
    mockRuntime,
    session,
    engagementProgress,
    playerFallback: tr("WebPortal.NOTIFICATION_PLAYER_FALLBACK"),
    assetReference: import.meta.env.VITE_JEST_NOTIFICATION_ASSET_REFERENCE || undefined,
    platform,
    notificationsEnabled: notificationOperationGate.isOpen,
    withPlatformActivity: notificationOperationGate.run,
    trackFunnel,
  });
  useJestSharing({
    locale,
    session,
    platform,
    backend,
    withPlatformActivity,
    withBackgroundPlatformActivity,
    trackFunnel,
  });
  const [jestProducts, setJestProducts] = useJestProductCatalog({
    purchases,
    session,
    subscriptionsEnabled,
    trackFunnel,
    withPlatformActivity: withBackgroundPlatformActivity,
  });
  const purchaseProduct = useJestPurchase({
    products: jestProducts,
    purchases,
    session,
    setProducts: setJestProducts,
    subscriptionsEnabled,
    trackFunnel,
  });
  const authenticateJestIdentity = useCallback(
    async (token: string) => {
      if (authHarness) {
        (
          window as typeof window & {
            __RIDDLE_QUEST_JEST_AUTH_TEST__?: {firebaseTokens: string[]};
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__?.firebaseTokens.push(token);
      } else if (!mockRuntime) {
        const [{signInWithCustomToken}, {auth, ensureFirebaseAppCheckReady}] = await Promise.all([
          import("firebase/auth"),
          import("../firebase"),
        ]);
        await signInWithCustomToken(auth, token);
        await ensureFirebaseAppCheckReady();
      }
    },
    [authHarness, mockRuntime],
  );
  const completeTombstonedPlayerCleanup = useCallback(async (playerSigned: string) => {
    await completeTombstonedAccountDeletion(
      platform,
      playerSigned,
        notificationOperationGate,
        async (signed) => {
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
  }, [backend, deletionCleanupOptions, notificationOperationGate, platform, playerStateWrites]);
  useEffect(() => {
    let active = true;
    playerStateWrites.disable();
    const deletionRecovery = getAccountDeletionPendingPhase() === ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion;
    void startJestSession(platform, backend, purchases, authenticateJestIdentity, setStartup, {
      onInitialized: () => recoverPendingAccountDeletion(platform, "initialized", deletionCleanupOptions),
      onAuthenticated: isAccountDeletionCleanupPending,
      onIdentityDeleted: completeTombstonedPlayerCleanup,
      deletionRecovery,
      recoverAccountDeletion: (playerSigned) => recoverPendingAccountDeletion(platform, "signed", {
        clearFirebaseAuthentication: deletionCleanupOptions.clearFirebaseAuthentication,
        retryAuthoritativeDeletion: async () => {
          const result = await backend.retryAccountDeletion(playerSigned);
          if (!result.accountDeleted) throw new Error("account-deletion-recovery-rejected");
        },
        waitForPendingNotificationOperations: notificationOperationGate.waitForPending,
      }).then((recovered) => {
        if (!recovered) throw new Error("account-deletion-recovery-state-changed");
      }),
      // Recovery owns the exclusive lock through identity, authority, and client purge.
      // Ordinary identity is shared work and is rechecked immediately after lock release.
      withIdentityOperation: (operation) => runAccountDeletionAwareIdentityOperation(
        deletionRecovery,
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
        const message = "message" in result
          ? result.message
          : tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN");
        setError(
          message === JEST_SDK_INIT_TIMEOUT_MESSAGE
            ? tr("Errors.CHECK_INTERNET_AND_TRY_AGAIN")
            : message,
        );
      }
    });
    return () => {
      active = false;
      playerStateWrites.disable();
      stopJestLoadingHeartbeat(platform);
    };
  }, [authenticateJestIdentity, backend, completeTombstonedPlayerCleanup, deletionCleanupOptions, notificationOperationGate, platform, playerStateWrites, purchases, trackFunnel]);
  /** Clears app-owned browser and Jest state only after server-side account deletion succeeds. */
  const clearPlayerState = useCallback(async () => {
    notificationOperationGate.close();
    await playerStateWrites.drainAndClear();
    try {
      await purgeDeletedPlayerState(platform, deletionCleanupOptions);
    } catch (clearError) {
      console.warn("[riddle-quest] Player-state clear failed after account deletion", clearError);
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
  const completeRegistrationPrompt = useCallback(() => {
    if (registrationCompletingRef.current) return;
    registrationCompletingRef.current = true;
    let authoritativeDeletedPlayerSigned: string | null = null;
    void withPlatformActivity(async () => {
      const previousSession = sessionRef.current;
      let registered = false;
      let completionSucceeded = false;
      try {
        const player = platform.getPlayer();
        registered = player.registered;
        if (registered) {
          const signed = await platform.getPlayerSigned();
          const identity = await backend.exchangeIdentity(signed.playerSigned);
          if (identity.status === "account-deleted") {
            authoritativeDeletedPlayerSigned = signed.playerSigned;
            return;
          }
          await authenticateJestIdentity(identity.customToken);
          let profile = previousSession?.profile ?? null;
          try {
            profile = await platform.getProfile();
          } catch (profileError) {
            console.warn("[riddle-quest] Jest profile refresh after registration failed", profileError);
          }
          setSession((current) => (current ? {...current, firebaseUid: identity.uid, player, profile} : current));
          trackFunnel("registration_completed", {
            playerContinuity: player.playerId === previousSession?.player.playerId,
            source: registrationSourceRef.current,
          });
          if (previousSession?.entryIntent.inviteKind) {
            trackFunnel("viral_invite_registered", {
              inviteKind: previousSession.entryIntent.inviteKind,
              campaign: previousSession.entryIntent.campaign ?? "unknown",
            });
          }
          completionSucceeded = true;
        } else if (previousSession) {
          const preferences = {
            ...previousSession.preferences,
            registrationPromptDismissedAt: Date.now(),
          };
          await platform.writePreferences(preferences);
          setSession((current) => (current ? {...current, preferences} : current));
          trackFunnel("registration_prompt_dismissed", {source: registrationSourceRef.current});
          completionSucceeded = true;
        }
      } catch (registrationError) {
        console.warn("[riddle-quest] Jest registration completion failed", registrationError);
        captureBrowserException(registrationError, {
          component: "jest_registration",
          operation: "synchronize_registered_identity",
        });
        trackFunnel("registration_completion_failed", {source: registrationSourceRef.current});
        setError(tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR"));
      } finally {
        registrationHandleRef.current = null;
        registrationCompletingRef.current = false;
        setRegistrationPending(false);
        setShowRegistration(false);
        window.dispatchEvent(
          new CustomEvent("riddle-quest:registration-prompt-closed", {
            detail: {registered: completionSucceeded && registered},
          }),
        );
      }
    }).then(async () => {
      if (authoritativeDeletedPlayerSigned) {
        await completeTombstonedPlayerCleanup(authoritativeDeletedPlayerSigned);
      }
    }).catch((registrationError) => {
      captureBrowserException(registrationError, {
        component: "jest_registration",
        operation: "deleted_identity_cleanup",
      });
      setError(tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR"));
    });
  }, [
    authenticateJestIdentity,
    backend,
    completeTombstonedPlayerCleanup,
    platform,
    trackFunnel,
    withPlatformActivity,
  ]);
  const openRegistrationPrompt = useCallback(
    (source: RegistrationSource, showGamePrompt: boolean) => {
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
          entryPayload: createRegistrationEntryPayload(source, currentSession.entryIntent),
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
    setRegistrationFailure(null);
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
    setRegistrationFailure(null);
    setRegistrationPending(true);
    const handle = registrationHandleRef.current;
    if (handle) {
      try {
        handle.loginButtonAction();
      } catch (registrationError) {
        console.warn("[riddle-quest] Jest registration login action failed", registrationError);
        setRegistrationPending(false);
        setRegistrationFailure(tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN"));
        trackFunnel("registration_login_failed", {
          source: registrationSourceRef.current,
          status: "failure",
        });
      }
      return;
    }
    const currentSession = sessionRef.current;
    void withPlatformActivity(() =>
      platform.login(
        createRegistrationEntryPayload(registrationSourceRef.current, currentSession?.entryIntent ?? {}),
      ),
    ).then((result) => {
      if (result.status !== "success") {
        setRegistrationPending(false);
        setRegistrationFailure(tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN"));
        trackFunnel("registration_login_failed", {
          source: registrationSourceRef.current,
          status: result.status,
        });
        return;
      }
      completeRegistrationPrompt();
    });
  }, [completeRegistrationPrompt, platform, trackFunnel, withPlatformActivity]);
  const login = useCallback(() => {
    setRegistrationFailure(null);
    setRegistrationPending(true);
    const currentSession = sessionRef.current;
    const entryPayload = createRegistrationEntryPayload(
      registrationSourceRef.current,
      currentSession?.entryIntent ?? {},
    );
    void withPlatformActivity(() => platform.login(entryPayload)).then((result) => {
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
      input: {gameMode: "classic" | "challenge"},
      result: {isCorrect: boolean; newLevel?: number; newWinStreak?: number},
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
      const recorded = await notificationOperationGate.run(() => recordAuthoritativeCompletion(platform, session, {
          gameMode: input.gameMode,
          isCorrect: result.isCorrect,
          newWinStreak: result.newWinStreak,
        }));
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
  const {setPresenceState, togglePresence} = useJestPresence({
    gate: notificationOperationGate,
    platform,
    session,
    sessionRef,
    setSession,
    trackFailure: trackFunnel,
  });
  useEffect(() => {
    trackScreen(error ? "startup_error" : accountDeleted ? "account_deleted" : !session ? "startup_loading" : !session.player.registered && showRegistration
      ? "registration_prompt"
      : "game");
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
      <PlayHostApp
        hostServices={hostServices}
        hostConfigurationWarning={hostConfigurationWarning}
        initialGameMode={session.entryIntent.gameMode}
        initialRaceChallengeId={resolveRaceChallengeId(session.entryIntent)}
        initialRaceInbox={session.entryIntent.challengeDestination === "inbox"}
        registrationName={session.entryIntent.customName}
        registrationInviterName={session.entryIntent.inviterName}
        onPlayable={() => markJestPlayable(platform)}
        onAuthoritativeComplete={handleAuthoritativeComplete}
        platformProducts={jestProducts}
        platformPurchase={purchaseProduct}
        platformCapabilities={{
          accountUpgrade: {
            state: session.player.registered ? "complete" : "available",
            begin: async () => ({status: "unavailable", message: "Use the Jest registration controls."}),
          },
        }}
        externalInteractionBlocked={pendingPlatformOperations > 0}
        initialPlayerData={session.playerData}
        onPlayerDataChange={playerStateWrites.savePlayerData}
        accountDeletionServiceGate={notificationOperationGate}
        onAccountDeletionRequested={markAccountDeletionRequested}
        onAccountDeleted={clearPlayerState}
        presenceEnabled={session.preferences.presenceEnabled === true}
        onTogglePresence={togglePresence}
        onPresenceStateChange={setPresenceState}
      />
    </>
  );
}
