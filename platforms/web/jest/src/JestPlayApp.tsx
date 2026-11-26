import {PlayerSaveRecoveryLayout} from "../../../../src/accounts/components/recovery/PlayerSaveRecoveryLayout";
import {ProfileSubscriptionContext} from "../../../../src/accounts/browser/ProfileSubscriptionContext";
import {completionPresentationKey} from "../../../../src/gameplay/session/completion/completionPresentation";
import {ProviderProfileContext} from "../../../../src/accounts/components/ProviderProfileContext";
import {ShopSubscriptionContext} from "../../../../src/commerce/browser/ShopSubscriptionContext";
import {Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {PlayHostApp} from "../../../../src/app/components/PlayHostApp";
import {JestSdkPlatform} from "./JestSdkPlatform";
import {JestPurchaseCoordinator} from "./purchases";
import {
  JEST_SDK_INIT_TIMEOUT_MESSAGE,
  exposeJestStartupFailure,
  markJestPlayable,
  startJestSession,
  stopJestLoadingHeartbeat,
  type JestStartupUpdate,
} from "./startup";
import type {JestSession} from "./types";
import {tr, useLocale} from "../../../../src/localization/browser/i18n";
import {MockJestPlatform} from "./MockJestPlatform";
import {recordAuthoritativeCompletion, shouldPromptGuestRegistration} from "./milestone";
import {createNotificationOperationGate} from "./notifications/operationGate";
import {useJestSharing} from "./sharing/useJestSharing";
import {resolveJestRuntimeMode, shouldEnableJestSubscriptions} from "./runtimeMode";
import {configurePlatformAnalytics, trackScreen} from "../../../../src/observability/analytics/events";
import {GoogleAnalyticsConsent} from "../../../../src/observability/analytics/GoogleAnalyticsConsent";
import {firebaseEnvironment} from "../../../../src/platform/firebase/browserEnvironment";
import {hasTrustedTestHarnessMarker} from "../../../../src/app/services/testHarnessPolicy";
import {resolveRaceChallengeId} from "./entryIntent";
import {createJestBackend} from "./createJestBackend";
import {JestStartupError, JestStartupProgress} from "./JestSessionViews";
import {useJestProductCatalog} from "./useJestProductCatalog";
import {useJestPurchase} from "./useJestPurchase";
import {useJestPurchaseRecovery} from "./useJestPurchaseRecovery";
import {captureBrowserException} from "../../../../src/observability/browserErrorReporter";
import {
  ACCOUNT_DELETION_PENDING_PHASE,
  AccountDeletionCleanupError,
  completeTombstonedAccountDeletion,
  discardAccountDeletionForDifferentPlayer,
  getAccountDeletionPendingPhase,
  getAccountDeletionPendingUid,
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
import {createHostServices, getHostConfigurationWarning, resolveHostServicesMode} from "../../../../src/app/services/gameServices";
import {useJestFunnelTracking, useJestPlatformActivity} from "./useJestPlatformOperations";
import {useJestPresence} from "./useJestPresence";
import {useJestRegistration} from "./useJestRegistration";
import {createJestHostedPlaySession} from "./JestHostedPlaySession";
import {createJestRaceMatchmaking} from "./createJestRaceMatchmaking";
import {hasLiveRaceLobby} from "../../../../src/races/browser/storage/liveRaceLobbyHint";
import {createJestStartupRiddlePreload} from "./startupRiddlePreload";
import {firebaseStartupOrigins, preconnectStartupOrigins} from "../../../../src/app/startup/startupWarmup";
import type {NotificationRegistrationCommands} from "../../../../src/notifications/contracts/notificationProvider";
import {createManagerNotificationProvider} from "../../../../src/notifications/controllers/managerNotificationProvider";
import {isPlayerNotificationsEnabled, setPlayerNotificationsEnabled, subscribeToPlayerNotifications} from "../../../../src/settings/browser/playerPreferences";
import {JestNotifications} from "./notifications/JestNotifications";

/** Account-management controls load when Profile or Settings first renders them. */
const JestProfileSubscriptions = lazy(() => import("./JestProfileSubscriptions")
  .then(module => ({default: module.JestProfileSubscriptions})));

/** Guest registration controls load only when the player reaches a registration prompt. */
const JestRegistrationAlert = lazy(() => import("./JestRegistrationAlert")
  .then(module => ({default: module.JestRegistrationAlert})));

/**
 * Overlaps Firebase connection setup, SDK chunk downloads and App Check
 * attestation with Jest SDK initialization and the identity exchange, which
 * otherwise all wait for the custom token before starting.
 */
function warmJestFirebaseStartup(): void {
  try {
    preconnectStartupOrigins(firebaseStartupOrigins({
      identityExchangeBaseUrl: import.meta.env.VITE_JEST_FUNCTIONS_BASE_URL,
      functionsRegion: import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION,
      gameplayRegion: import.meta.env.VITE_FIREBASE_GAMEPLAY_REGION,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    }));
  } catch (error) {
    captureBrowserException(error, {component: "jest_startup_preconnect"});
  }
  // Warm-up failures are retried and reported by the authenticated startup path.
  void import("firebase/auth").catch(() => undefined);
  void import("../../../../src/platform/firebase/browserHostServices").catch(() => undefined);
  void import("./JestFirebaseAppCheck").then((module) => module.warmJestFirebaseAppCheck()).catch(() => undefined);
}

/** Provides jest play app behavior. */
export function JestPlayApp() {
  const [reset, setReset] = useState({generation: 0, deletedUid: undefined as string | undefined});
  const restartAfterDeletion = useCallback((deletedUid?: string) =>
    setReset(current => ({generation: current.generation + 1, deletedUid})), []);
  return <JestPlaySession key={reset.generation} freshStart={reset.generation > 0}
    deletedUid={reset.deletedUid} onAccountReset={restartAfterDeletion} />;
}

function JestPlaySession({freshStart, deletedUid, onAccountReset}: {
  freshStart: boolean; deletedUid?: string; onAccountReset: (deletedUid?: string) => void;
}) {
  const deletedUidRef = useRef(deletedUid);
  /** Continues the saved guest win count across Daily and Classic riddles. */
  const guestCompletedRiddlesRef = useRef<number | null>(null);
  /** Keeps completion counting and deduplication scoped to the active account. */
  const guestCompletionOwnerRef = useRef<string | null>(null);
  /** Prevents retried answers from counting the same win twice. */
  const countedGuestWinIdsRef = useRef(new Set<string>());
  /** Prevents concurrent completion callbacks from duplicating the first-milestone funnel event. */
  const firstMilestoneFunnelRecordedRef = useRef(false);
  /** Provides locale behavior. */
  const locale = useLocale();
  /** Provides host services mode behavior. */
  const hostServicesMode = useMemo(() => resolveHostServicesMode(), []);
  /** Provides host services behavior. */
  const startupRiddles = useMemo(() => createJestStartupRiddlePreload(createHostServices(hostServicesMode)), [hostServicesMode]);
  /** Target services reuse one prepared Classic fallback during startup. */
  const hostServices = startupRiddles.services;
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
  /** Provides [session, set session] behavior. */
  const [session, setSession] = useState<JestSession | null>(null);
  useLayoutEffect(() => {
    if (!session) return;
    const owner = JSON.stringify([session.player.playerId, session.firebaseUid]);
    if (guestCompletionOwnerRef.current === owner) return;
    guestCompletionOwnerRef.current = owner;
    guestCompletedRiddlesRef.current = session.playerData?.profile?.totalWins ??
      session.playerData?.profile?.wins ?? session.preferences.jestGuestCompletedRiddles ?? 0;
    countedGuestWinIdsRef.current.clear();
  }, [session]);
  /** Avoids duplicate avatar syncs while the same Jest session rerenders. */
  const syncedAvatarRef = useRef<string | null>(null);
  useEffect(() => {
    /** Provides avatar url behavior. */
    const avatarUrl = session?.player.registered ? session.profile?.avatarUrl : null;
    if (!avatarUrl || !session || authHarness || mockRuntime) return;
    /** Provides key behavior. */
    const key = `${session.firebaseUid}:${avatarUrl}`;
    if (syncedAvatarRef.current === key) return;
    syncedAvatarRef.current = key;
    void import("../../../../src/platform/firebase/browserClient")
      .then(({syncJestAvatar}) => syncJestAvatar({avatarUrl}))
      .catch((error) => {
        captureBrowserException(error, {component: "jest_avatar_sync"});
      });
  }, [authHarness, mockRuntime, session]);
  /** Registration preserves the active lobby; the account owner keys actual identity replacement. */
  const matchmaking = useMemo(() => !authHarness && !mockRuntime ? createJestRaceMatchmaking() : undefined,
    [authHarness, mockRuntime]);
  /** Keeps host authority assembly stable while player progress and SDK activity update. */
  const platformCapabilities = useMemo(
    () => ({
      ...(matchmaking ? {matchmaking} : {}),
      accountUpgrade: {
        state: session?.player.registered ? ("complete" as const) : ("available" as const),
        begin: async () => ({status: "unavailable" as const, message: "Use the Jest registration controls."}),
      },
    }),
    [matchmaking, session?.player.registered],
  );
  /** Provides [error, set error] behavior. */
  const [error, setError] = useState<string | null>(null);
  /** Provides [account deleted, set account deleted] behavior. */
  /** Provides [startup, set startup] behavior. */
  const [startup, setStartup] = useState<JestStartupUpdate>({stage: "connecting", progress: 5});
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
  /** Catalog reconciliation may award monthly coins even without a new checkout. */
  const purchases = useMemo(() => new JestPurchaseCoordinator(platform, backend, {
    captureSubscriptionGrantRefresh: playerId => {
      const owner = sessionRef.current;
      if (!owner || owner.player.playerId !== playerId || !notificationOperationGate.isOpen()) return undefined;
      return async () => {
        if (!notificationOperationGate.isOpen() || sessionRef.current?.player.playerId !== playerId ||
          sessionRef.current.firebaseUid !== owner.firebaseUid) return;
        // Subscription sync already holds the deletion gate; a nested lock could block cleanup.
        await hostServices.loadProfile(owner.firebaseUid);
      };
    },
  }), [backend, hostServices, notificationOperationGate, platform]);
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
    trackFailure: trackFunnel,
  });
  /** Provides account deletion quiesced behavior. */
  const accountDeletionQuiesced = useAccountDeletionQuiescence(notificationOperationGate);
  const analyticsLifetimeRef = useRef(new AbortController());
  const isAnalyticsSessionCurrent = useCallback(() => notificationOperationGate.isOpen(), [notificationOperationGate]);
  const notificationsDelegate = useMemo(() => {
    let active = false;
    let current: NotificationRegistrationCommands | null = null;
    const waiting = new Set<(capability: NotificationRegistrationCommands | null) => void>();
    const resolveWaiting = (capability: NotificationRegistrationCommands | null) => {
      waiting.forEach(resolve => resolve(capability)); waiting.clear();
    };
    return {
      async setEnabled(enabled: boolean) {
        if (!active) return false;
        const capability = current ?? await new Promise<NotificationRegistrationCommands | null>(resolve => waiting.add(resolve));
        return active && capability ? capability.setEnabled(enabled) : false;
      },
      install(capability: NotificationRegistrationCommands) {
        current = capability; if (active) resolveWaiting(capability);
        return () => {if (current === capability) current = null;};
      },
      activate() {active = true; if (current) resolveWaiting(current);},
      retire() {active = false; current = null; resolveWaiting(null);},
    };
  }, [platform, session?.firebaseUid, session?.player.playerId, session?.player.registered]);
  useLayoutEffect(() => {
    notificationsDelegate.activate();
    return () => notificationsDelegate.retire();
  }, [notificationsDelegate]);
  const notificationProvider = useMemo(() => createManagerNotificationProvider({
    preferences: {
      getEnabled: isPlayerNotificationsEnabled,
      setEnabled: setPlayerNotificationsEnabled,
      subscribe: subscribeToPlayerNotifications,
    },
    saveConsent: notificationsDelegate.setEnabled,
    available: Boolean(session?.player.registered && !authHarness && !mockRuntime),
  }), [authHarness, mockRuntime, notificationsDelegate, session?.player.registered]);
  /** Provides referral sharing behavior. */
  const referralSharing = useJestSharing({
    locale,
    session,
    platform,
    backend,
    sharingEnabled: notificationOperationGate.isOpen,
    withPlatformActivity,
    withBackgroundPlatformActivity,
    trackFunnel,
    authHarness,
  });
  /** Provides [jest products, set jest products] behavior. */
  const [jestProducts, setJestProducts, refreshProducts, catalogState, refreshBackgroundProducts] = useJestProductCatalog({
    purchases,
    session,
    subscriptionsEnabled,
    trackFunnel,
    withPlatformActivity: withBackgroundPlatformActivity,
  });
  /** Supplies shop operations through the Jest adapter. */
  const subscriptionActions = useMemo(
    () => ({
      products: jestProducts,
      catalogLoading: catalogState.loading,
      catalogError: catalogState.error,
      refresh: refreshProducts,
      cancel: async (sku: string): Promise<"success" | "cancelled" | "unavailable" | "error"> => {
        /** Waits for the provider cancellation confirmation. */
        const result = await withPlatformActivity(() => platform.cancelSubscription(sku));
        await refreshProducts();
        if (result.status === "unavailable" && result.message === "not_active") return "unavailable";
        return result.status === "success" || result.status === "cancelled" ? result.status : "error";
      },
    }),
    [platform, refreshProducts, withPlatformActivity, jestProducts, catalogState],
  );
  /** Provides purchase product behavior. */
  const purchaseProduct = useJestPurchase({
    products: jestProducts,
    purchases,
    session,
    setProducts: setJestProducts,
    subscriptionsEnabled,
    trackFunnel,
  });
  useJestPurchaseRecovery({
    purchases, session, sessionRef, gate: notificationOperationGate, refreshProducts, refreshBackgroundProducts, hostServices,
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
          import("../../../../src/platform/firebase/browserClient"),
          import("./JestFirebaseAppCheck"),
        ]);
        // Attestation is independent of identity; it usually completed during the startup warm-up.
        await Promise.all([signInWithCustomToken(auth, token), ensureJestFirebaseAppCheckReady()]);
      }
    },
    [authHarness, mockRuntime],
  );
  /** Completes tombstoned player cleanup. */
  const completeTombstonedPlayerCleanup = useCallback(
    async (playerSigned: string, deletedUid?: string) => {
      deletedUidRef.current = deletedUid ?? getAccountDeletionPendingUid();
      await completeTombstonedAccountDeletion(
        platform,
        playerSigned,
        notificationOperationGate,
        async (signed) => {
          /** Provides result behavior. */
          const result = await backend.retryAccountDeletion(signed, getAccountDeletionPendingUid());
          if (!result.accountDeleted) throw new Error("account-deletion-recovery-rejected");
          deletedUidRef.current = result.deletedUid ?? deletedUidRef.current;
          return result;
        },
        deletionCleanupOptions.clearFirebaseAuthentication,
        deletedUid,
      );
      notificationOperationGate.close();
      playerStateWrites.disable();
      sessionRef.current = null;
      setSession(null);
    },
    [backend, deletionCleanupOptions, notificationOperationGate, platform, playerStateWrites],
  );
  const resetDeletedRegistration = useCallback(async (playerSigned: string) => {
    await completeTombstonedPlayerCleanup(playerSigned);
    onAccountReset(deletedUidRef.current);
  }, [completeTombstonedPlayerCleanup, onAccountReset]);
  useEffect(() => {
    /** Provides active behavior. */
    let active = true;
    /** Disconnects this startup's native analytics when the session retires. */
    let stopAnalytics: (() => void) | undefined;
    startupRiddles.clear();
    playerStateWrites.disable();
    if (!authHarness && !mockRuntime) warmJestFirebaseStartup();
    /** Provides deletion recovery behavior. */
    void startJestSession(platform, backend, purchases, authenticateJestIdentity, setStartup, {
      freshStart,
      deletedUid,
      isCurrent: () => active && notificationOperationGate.isOpen(),
      onInitialized: () => {
        discardAccountDeletionForDifferentPlayer(platform.getPlayer().playerId);
        deletedUidRef.current = getAccountDeletionPendingUid() ?? deletedUidRef.current;
        return recoverPendingAccountDeletion(platform, "initialized", deletionCleanupOptions);
      },
      onAuthenticated: isAccountDeletionCleanupPending,
      onIdentityDeleted: completeTombstonedPlayerCleanup,
      deletionRecovery: () => getAccountDeletionPendingPhase() === ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion,
      recoverAccountDeletion: (playerSigned) =>
        recoverPendingAccountDeletion(platform, "signed", {
          clearFirebaseAuthentication: deletionCleanupOptions.clearFirebaseAuthentication,
          retryAuthoritativeDeletion: async () => {
            /** Provides result behavior. */
            const result = await backend.retryAccountDeletion(playerSigned, getAccountDeletionPendingUid());
            if (!result.accountDeleted) throw new Error("account-deletion-recovery-rejected");
            deletedUidRef.current = result.deletedUid ?? deletedUidRef.current;
            return result;
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
        onAccountReset(deletedUidRef.current);
        return;
      }
      if (result.status === "success") {
        try {
          if (!active || !notificationOperationGate.isOpen()) return;
          stopAnalytics = configurePlatformAnalytics((name, params) => {
            if (active && notificationOperationGate.isOpen()) platform.captureEvent(name, params);
          });
          await commitJestStartupSession({
            gate: notificationOperationGate,
            isActive: () => active,
            session: result.value,
            prepareSession: async (readySession, preparedLocale) => {
              if (hostServicesMode !== "firebase" || authHarness || mockRuntime) {
                if (active && notificationOperationGate.isOpen())
                  startupRiddles.preloadClassic(preparedLocale, readySession.playerData?.profile?.classicIndex ?? 1);
                return readySession;
              }
              // Start issued content while the server profile and translated copy load.
              // Identity, App Check, and purchase recovery have already succeeded.
              hostServices.preloadInitialRiddles?.(preparedLocale);
              /** Authoritative profile remains mandatory before showing the balance or enabling play. */
              const [{loadUserDocument}, {toBridgeProfile}] = await Promise.all([
                import("../../../../src/platform/firebase/browserClient"),
                import("../../../../src/accounts/profile/profileMapper"),
              ]);
              /** Profile created or restored by the authoritative identity exchange. */
              const profileData = await loadUserDocument(readySession.firebaseUid);
              if (!profileData) throw new Error("jest-initial-profile-unavailable");
              /** Server-owned balance and progression, never the local projection alone. */
              const profile = toBridgeProfile({
                uid: readySession.firebaseUid,
                displayName: undefined,
                email: undefined,
                isAnonymous: !readySession.player.registered,
              }, profileData);
              if (active && notificationOperationGate.isOpen())
                startupRiddles.preloadClassic(preparedLocale, profile.classicIndex ?? 1);
              return {...readySession,
                preferences: {...readySession.preferences,
                  ...(typeof profileData.notificationsEnabled === "boolean" ? {notificationsEnabled: profileData.notificationsEnabled} : {})},
                playerData: {...readySession.playerData,
                schemaVersion: 1, updatedAt: Date.now(), profile}};
            },
            enablePlayerStateWrites: playerStateWrites.enable,
            setSession,
            trackFunnel,
          });
        } catch (commitError) {
          captureBrowserException(commitError, {component: "jest_startup_commit"});
          exposeJestStartupFailure(platform);
          setError(tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR"));
        }
      } else {
        /** Provides message behavior. */
        const message = "message" in result ? result.message : tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN");
        setError(
          message === JEST_SDK_INIT_TIMEOUT_MESSAGE
            ? tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN")
            : tr("ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE"),
        );
      }
    });
    return () => {
      active = false;
      startupRiddles.clear();
      stopAnalytics?.();
      playerStateWrites.disable();
      stopJestLoadingHeartbeat(platform);
    };
  }, [
    authenticateJestIdentity,
    backend,
    completeTombstonedPlayerCleanup,
    deletionCleanupOptions,
    hostServices,
    startupRiddles,
    hostServicesMode,
    authHarness,
    mockRuntime,
    notificationOperationGate,
    platform,
    playerStateWrites,
    purchases,
    trackFunnel,
    freshStart,
    deletedUid,
    onAccountReset,
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
    onAccountReset(deletedUidRef.current);
  }, [deletionCleanupOptions, notificationOperationGate, onAccountReset, platform, playerStateWrites, trackFunnel]);
  /** Provides {
    show registration,
    registration pending,
    registration failure,
    open: open registration prompt,
    dismiss: dismiss registration,
    register,
  } behavior. */
  const {
    showRegistration,
    registrationPending,
    registrationFailure,
    open: openRegistrationPrompt,
    dismiss: dismissRegistration,
    register,
  } = useJestRegistration({
    platform,
    backend,
    sessionRef,
    setSession,
    setError,
    authenticateIdentity: authenticateJestIdentity,
    loadNotificationPreference: authHarness || mockRuntime ? undefined : async uid => {
      const {loadUserDocument} = await import("../../../../src/platform/firebase/browserClient");
      const user = await loadUserDocument(uid);
      if (!user) throw new Error("jest-registered-profile-unavailable");
      return typeof user.notificationsEnabled === "boolean" ? user.notificationsEnabled : undefined;
    },
    isCurrent: notificationOperationGate.isOpen,
    completeDeletedPlayerCleanup: resetDeletedRegistration,
    withPlatformActivity,
    trackFunnel,
  });
  /** Queues the guest prompt as soon as the correct answer is confirmed. */
  const handleAuthoritativeGuessWin = useCallback(
    (input: {
      /** Stores riddle id. */
      riddleId: string;
      /** Stores session token. */
      sessionToken: string;
      /** Stores game mode. */
      gameMode: "classic" | "challenge";
    }) => {
      /** Provides active session behavior. */
      const activeSession = sessionRef.current;
      if (
        !activeSession ||
        activeSession.player.registered ||
        countedGuestWinIdsRef.current.has(`${input.gameMode}:${input.riddleId}`)
      )
        return;
      countedGuestWinIdsRef.current.add(`${input.gameMode}:${input.riddleId}`);
      guestCompletedRiddlesRef.current = (guestCompletedRiddlesRef.current ?? 0) + 1;
      if (shouldPromptGuestRegistration(activeSession, guestCompletedRiddlesRef.current)) {
        openRegistrationPrompt("authoritative_win", true, completionPresentationKey(input));
      }
    },
    [openRegistrationPrompt],
  );
  /** Handles authoritative complete. */
  const handleAuthoritativeComplete = useCallback(
    async (
      input: {
        /** Stores game mode. */
        gameMode: "classic" | "challenge";
      },
      result: {
        /** Stores is correct. */
        isCorrect: boolean;
        /** Stores new win streak. */
        newWinStreak?: number;
      },
    ) => {
      if (!session || !result.isCorrect) return;
      trackFunnel("authoritative_puzzle_won", {
        gameMode: input.gameMode,
        winStreak: result.newWinStreak ?? 0,
      });
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
      if (recorded.value.milestoneMarked && !firstMilestoneFunnelRecordedRef.current) {
        firstMilestoneFunnelRecordedRef.current = true;
        trackFunnel("first_milestone_marked");
      }
    },
    [notificationOperationGate, platform, session, trackFunnel],
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
        : !session
            ? "startup_loading"
            : !session.player.registered && showRegistration
              ? "registration_prompt"
              : "game",
    );
  }, [error, session, showRegistration]);
  if (error) {
    return <JestStartupError message={error} />;
  }
  if (!session || accountDeletionQuiesced) {
    return <JestStartupProgress startup={startup} />;
  }
  return (
    <>
      <JestNotifications mockRuntime={mockRuntime} authHarness={authHarness}
        session={session} sessionRef={sessionRef} platform={platform}
        gate={notificationOperationGate} install={notificationsDelegate.install} />
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
        <Suspense fallback={null}>
          <JestRegistrationAlert
            blocked={pendingPlatformOperations > 0 || registrationPending}
            session={session}
            onRegister={register}
            onDismiss={dismissRegistration}
          />
        </Suspense>
      ) : null}
      <GoogleAnalyticsConsent
        platform="jest"
        measurementId={firebaseEnvironment.measurementId}
        available={firebaseEnvironment.production && hostServicesMode === "firebase" && !authHarness && !mockRuntime}
        isCurrent={isAnalyticsSessionCurrent}
        lifetimeSignal={analyticsLifetimeRef.current.signal}
      >
      <PlayerSaveRecoveryLayout recovery={playerStateWrites.recovery}>
      <ProviderProfileContext.Provider
        value={{username: session.profile?.username ?? null, avatarUrl: session.profile?.avatarUrl ?? null}}
      >
        <ShopSubscriptionContext.Provider value={subscriptionActions}>
          <ProfileSubscriptionContext.Provider value={subscriptionsEnabled ? <Suspense fallback={null}><JestProfileSubscriptions /></Suspense> : null}>
          <PlayHostApp
            session={createJestHostedPlaySession({
              hostServices,
              hostConfigurationWarning,
              initialGameMode: session.entryIntent.gameMode,
              initialRaceChallengeId: resolveRaceChallengeId(session.entryIntent),
              initialRaceInbox: session.entryIntent.challengeDestination === "inbox",
              initialRaceLobby: session.entryIntent.challengeDestination === "multiplayer" || hasLiveRaceLobby(session.firebaseUid, locale),
              registrationName: session.entryIntent.customName,
              registrationInviterName: session.entryIntent.inviterName,
              platformProducts: jestProducts,
              platformPurchase: purchaseProduct,
              raceAvailable: true,
              platformCapabilities,
              externalInteractionBlocked: pendingPlatformOperations > 0 || registrationPending || (!session.player.registered && showRegistration),
              initialPlayerData: session.playerData,
              onPlayerDataChange: playerStateWrites.savePlayerData,
              accountDeletionServiceGate: notificationOperationGate,
              presenceEnabled: session.preferences.presenceEnabled === true,
              onTogglePresence: togglePresence,
              onPresenceStateChange: setPresenceState,
              referralSharing,
              notificationProvider,
            })}
            onPlayable={() => markJestPlayable(platform)}
            onStartupUnavailable={() => markJestPlayable(platform)}
            onAuthoritativeGuessWin={handleAuthoritativeGuessWin}
            onAuthoritativeComplete={handleAuthoritativeComplete}
            onAccountDeletionRequested={() => {
              analyticsLifetimeRef.current.abort();
              deletedUidRef.current = session.firebaseUid;
              markAccountDeletionRequested(platform.getPlayer().playerId, session.firebaseUid);
            }}
            onAccountDeleted={clearPlayerState}
          />
          </ProfileSubscriptionContext.Provider>
        </ShopSubscriptionContext.Provider>
      </ProviderProfileContext.Provider>
      </PlayerSaveRecoveryLayout>
      </GoogleAnalyticsConsent>
    </>
  );
}
