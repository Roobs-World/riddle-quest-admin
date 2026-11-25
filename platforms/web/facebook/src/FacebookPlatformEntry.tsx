import {lazy, useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {ProductSummary, PurchaseResult} from "../../../../src/platform/contracts/hostServices";
import type {NotificationProvider} from "../../../../src/notifications/contracts/notificationProvider";
import {createNotificationProvider} from "../../../../src/notifications/controllers/notificationProvider";
import {createFirebaseNotificationEnrollment} from "../../../../src/notifications/browser/firebaseEnrollment";
import {createFirebaseEnrollmentBackend} from "../../../../src/notifications/browser/firebaseEnrollmentBackend";
import {createPlatformNotificationProvider} from "../../../../src/notifications/controllers/platformNotificationProvider";
import {SpinningWheelLoader} from "../../../../src/app/components/feedback/SpinningWheelLoader";
import {PlayHostApp} from "../../../../src/app/components/PlayHostApp";
import {getCurrentLocale, tr} from "../../../../src/localization/browser/i18n";
import type {PlatformSession, PlayerData, PlayerDataUpdate} from "../../../../src/platform/contracts/capabilities";
import {FacebookPlatformBootstrap} from "./FacebookPlatformBootstrap";
import {authenticateFacebook} from "./authenticate";
import {requireFacebookInstant} from "./fbinstant";
import {captureBrowserException} from "../../../../src/observability/browserErrorReporter";
import {bindFacebookEntryReferral, facebookLaunchFromEntryData} from "./referrals";
import {createFacebookReferralSharing} from "./FacebookReferralSharing";
import {createFacebookLiveRaceSharing} from "./FacebookLiveRaceSharing";
import {createFacebookContextChallenges} from "./contextChallenges";
import {createFacebookTournamentPresentation} from "./FacebookTournamentPresentation";
import {FacebookContextCoordinator} from "./contexts";
import {createFacebookContextBoard} from "./contextBoard";
import {createFacebookContextMatchmaking} from "./liveContextMatchmaking";
import {gateFacebookSessionCapabilities, parseFacebookAgeCategory} from "./FacebookCapabilityPolicy";
import {createFacebookAdsCapability} from "./FacebookAdsCapability";
import {FacebookCommerceSession, facebookPaymentsAvailable} from "./FacebookCommerceSession";
import {createFacebookRewardedContinue} from "./FacebookRewardedContinue";
import {LocalAccountDeletionGate} from "../../../../src/accounts/browser/deletion/LocalAccountDeletionGate";
import {
  applyPlayerPreferences,
  clearBrowserPlayerState,
  isPlayerNotificationsEnabled,
  setPlayerNotificationsEnabled,
  subscribeToPlayerNotifications,
  subscribeToPlayerPreferenceChanges,
} from "../../../../src/settings/browser/playerPreferences";
import {settleFacebookPause, settleFacebookPresenceResume} from "./settleFacebookPause";
import {reconcilePresenceOptIn} from "../../../../src/presence/reconcilePresenceOptIn";
import {startOptionalPresence} from "../../../../src/presence/startOptionalPresence";
import {createHostServices, getHostConfigurationWarning, resolveHostServicesMode} from "../../../../src/app/services/gameServices";
import {PlayerProjectionPersistence} from "../../../../src/accounts/browser/playerState/PlayerProjectionPersistence";
import {usePlayerProjectionRecovery} from "../../../../src/accounts/hooks/usePlayerProjectionRecovery";
import {PlayerSaveRecoveryLayout} from "../../../../src/accounts/components/recovery/PlayerSaveRecoveryLayout";
import {createHostedPlaySession} from "../../../../src/app/session/HostedPlaySession";
import {installFacebookAnalytics} from "./analytics";
import {trackEvent} from "../../../../src/observability/analytics/events";
import {GoogleAnalyticsConsent} from "../../../../src/observability/analytics/GoogleAnalyticsConsent";
import {firebaseEnvironment} from "../../../../src/platform/firebase/browserEnvironment";
import {firebaseStartupOrigins, preconnectStartupOrigins} from "../../../../src/app/startup/startupWarmup";

/** Native tournament presentation loads only when Facebook multiplayer opens. */
const FacebookRaceSurface = lazy(() => import("./FacebookRaceEntry").then(module => ({default: module.FacebookRaceEntry})));

/** Describes startup state. */
type StartupState =
  | {
      /** Stores status. */
      status: "loading"; /** Stores progress. */
      /** Stores progress. */
      progress: number;
    }
  | {
      /** Stores status. */
      status: "ready"; /** Stores session. */
      /** Stores session. */
      session: PlatformSession; /** Stores player data. */
      analyticsAvailable: boolean;
      /** Stores player data. */
      playerData: PlayerData | null;
      /** Target-owned native sharing, absent when Meta or the server disallows it. */
      referralSharing?: import("../../../../src/sharing/components/ReferralSharingCapability").ReferralSharingCapability;
      /** Settings owns the authenticated player's global notification preference. */
      notificationProvider?: NotificationProvider;
      /** Bounded launch hints; competitive authority remains on the server. */
      launch: ReturnType<typeof facebookLaunchFromEntryData>;
    }
  | {
      /** Stores status. */
      status: "error";
    };

/**
 * Overlaps Firebase connection setup and SDK chunk downloads with Instant Games
 * initialization; identity exchange, sign-in and the first profile read then
 * reuse warm connections instead of opening them serially.
 */
function warmFacebookFirebaseStartup(): void {
  try {
    preconnectStartupOrigins(firebaseStartupOrigins({
      identityExchangeBaseUrl: import.meta.env.VITE_FACEBOOK_FUNCTIONS_BASE_URL,
      functionsRegion: import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION,
      gameplayRegion: import.meta.env.VITE_FIREBASE_GAMEPLAY_REGION,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    }));
  } catch (error) {
    captureBrowserException(error, {component: "facebook_startup_preconnect"});
  }
  // Warm-up failures are retried and reported by the authenticated startup path.
  void import("firebase/auth").catch(() => undefined);
  void import("./FacebookFirebaseAppCheck").catch(() => undefined);
  void import("../../../../src/platform/firebase/browserHostServices").catch(() => undefined);
}

/** Facebook-only application composed by the Facebook target entry. */
export function FacebookPlatformEntry() {
  /** Provides host services mode behavior. */
  const hostServicesMode = useMemo(() => resolveHostServicesMode(), []);
  /** Provides host services behavior. */
  const hostServices = useMemo(() => createHostServices(hostServicesMode), [hostServicesMode]);
  /** Provides host configuration warning behavior. */
  const hostConfigurationWarning = getHostConfigurationWarning(hostServicesMode);
  /** Provides [startup, set startup] behavior. */
  const [startup, setStartup] = useState<StartupState>({status: "loading", progress: 5});
  /** Provides [presence enabled, set presence enabled] behavior. */
  const [presenceEnabled, setPresenceEnabled] = useState(false);
  /** Provides [presence available, set presence available] behavior. */
  const [presenceAvailable, setPresenceAvailable] = useState(false);
  /** Current SDK catalog and purchase callback exposed to hosted play. */
  const [commercePresentation, setCommercePresentation] = useState<{
    /** Visible Facebook product summaries for the authenticated account. */
    products: ProductSummary[];
    /** Checkout callback owned by the current commerce session. */
    purchase: (productId: string) => Promise<PurchaseResult>;
  }>();
  /** Provides player persistence ref behavior. */
  const playerPersistenceRef = useRef<PlayerProjectionPersistence | null>(null);
  /** Provides preferences ref behavior. */
  const preferencesRef = useRef<Awaited<ReturnType<PlatformSession["storage"]["readPreferences"]>>>({});
  /** Provides presence ref behavior. */
  const presenceRef = useRef<import("../../../../src/presence/PlatformPresenceSession").PlatformPresenceSession | null>(null);
  /** Provides deletion gate ref behavior. */
  const deletionGateRef = useRef(new LocalAccountDeletionGate());
  const analyticsLifetimeRef = useRef(new AbortController());
  const isAnalyticsSessionCurrent = useCallback(() => deletionGateRef.current.isOpen(), []);
  /** Recovery follows the initialized owner and rechecks the Facebook deletion epoch. */
  const saveRecovery = usePlayerProjectionRecovery(startup.status === "ready" ? playerPersistenceRef.current : null, {
    lifecycle: startup.status === "ready" ? startup.session.capabilities.lifecycle : undefined,
    canRecover: () => deletionGateRef.current.isOpen(),
  });

  useEffect(() => {
    /** Provides active behavior. */
    let active = true;
    /** Disconnects native analytics when this authenticated session retires. */
    let stopAnalytics: (() => void) | undefined;
    /** Provides unsubscribe pause behavior. */
    let unsubscribePause: (() => void) | undefined;
    /** Provides unsubscribe resume behavior. */
    let unsubscribeResume: (() => void) | undefined;
    /** Removes the payment recovery listener when the account session retires. */
    let unsubscribeCommerceResume: (() => void) | undefined;
    /** Payment lifecycle controller for the authenticated Facebook account. */
    let commerceSession: FacebookCommerceSession | undefined;
    let sessionNotifications: NotificationProvider | undefined;
    /** Provides unsubscribe preferences behavior. */
    let unsubscribePreferences: (() => void) | undefined;
    /** Native context events belong to this authenticated entry lifetime. */
    let unsubscribeContext: (() => void) | undefined;
    /** Stops presence. */
    let stopPresence: (() => Promise<void>) | undefined;
    if (hostServicesMode === "firebase") warmFacebookFirebaseStartup();
    void (async () => {
      try {
        /** Provides age category behavior. */
        const ageCategory = parseFacebookAgeCategory(import.meta.env.VITE_FACEBOOK_AGE_CATEGORY);
        /** Provides result behavior. */
        const result = await new FacebookPlatformBootstrap(undefined, ageCategory).initialize((progress) => {
          if (active) setStartup({status: "loading", progress});
        });
        if (result.status !== "success") {
          throw new Error(result.status === "cancelled" ? "facebook-startup-cancelled" : result.message);
        }
        /** Provides session behavior. */
        const session = result.value;
        /** Provides sdk behavior. */
        const sdk = requireFacebookInstant();
        /** Provides r id. */
        const userId = await authenticateFacebook(sdk);
        /** Provides ads behavior. */
        let ads = undefined;
        /** Latest verified ad-removal entitlement passed to the ad adapter. */
        let removeInterstitialAds: boolean | undefined;
        /** Facebook-only continuation capability bound to the current authenticated session. */
        let attemptRecovery: import("../../../../src/platform/contracts/capabilities").AttemptRecoveryCapability | undefined;
        /** Provides tournaments behavior. */
        let tournaments = undefined;
        /** Provides notifications enabled behavior. */
        let notificationsEnabled = false;
        /** Settings is the only game surface that can request notification permission. */
        let notificationProvider: NotificationProvider | undefined;
        /** Provides referrals enabled behavior. */
        let referralsEnabled = false;
        /** Provides matchmaking enabled behavior. */
        let matchmakingEnabled = false;
        /** Provides presence capability enabled behavior. */
        let presenceCapabilityEnabled = false;
        /** Provides configuration loaded behavior. */
        let configurationLoaded = false;
        /** Provides context board api behavior. */
        let contextBoardApi:
          | undefined
          | {
              /** Stores list. */
              list: typeof import("./firebaseClient").listFacebookContextBoard;
              /** Stores record. */
              record: typeof import("./firebaseClient").recordFacebookContextRun;
            };
        try {
          /** Provides {
            get facebook client configuration,
            list facebook tournament,
            record facebook tournament,
            list facebook context board,
            record facebook context run,
          } behavior. */
          const {
            getFacebookClientConfiguration,
            listFacebookTournament,
            recordFacebookTournament,
            listFacebookContextBoard,
            recordFacebookContextRun,
            grantFacebookRewardedContinue,
            grantFacebookPurchase,
          } = await import("./firebaseClient");
          /** Provides client configuration behavior. */
          const clientConfiguration = (await getFacebookClientConfiguration()).data;
          configurationLoaded = true;
          removeInterstitialAds = clientConfiguration.removeInterstitialAds;
          if (ageCategory === "13_plus" && clientConfiguration.commerceEnabled && facebookPaymentsAvailable(sdk)) {
            /** Payment session connected to this authenticated host and deletion gate. */
            const commerce = new FacebookCommerceSession({
              sdk,
              payments: sdk.payments,
              isActive: () => active && deletionGateRef.current.isOpen(),
              runBackground: operation => deletionGateRef.current.run(operation),
              grant: async input => (await grantFacebookPurchase(input)).data,
              readConfiguration: async () => (await getFacebookClientConfiguration()).data,
              onProducts: products => {
                if (active && deletionGateRef.current.isOpen()) {
                  setCommercePresentation({products, purchase: commerce.requestPurchase});
                }
              },
              onEntitlement: value => {removeInterstitialAds = value;},
              reportFailure: error => captureBrowserException(error, {component: "facebook_commerce", operation: "recovery"}),
              refreshProfile: () => hostServices.loadProfile(userId),
            });
            commerceSession = commerce;
            commerce.start();
            unsubscribeCommerceResume = session.capabilities.lifecycle?.onResume?.(() => commerce.refresh());
          }
          notificationsEnabled = ageCategory === "13_plus" && clientConfiguration.notificationsEnabled;
          if (notificationsEnabled) {
            const {auth, setNotificationPreference} = await import("../../../../src/platform/firebase/browserClient");
            const isAccountActive = () => active && deletionGateRef.current.isOpen() && auth.currentUser?.uid === userId;
            const applyEnabled = (enabled: boolean) => deletionGateRef.current.run(async () => {
              if (!isAccountActive() || isPlayerNotificationsEnabled() !== enabled) return false;
              await setNotificationPreference({enabled});
              return isAccountActive() && isPlayerNotificationsEnabled() === enabled;
            });
            const backend = createFirebaseEnrollmentBackend({expectedUid: userId, isCurrent: isAccountActive,
              run: operation => deletionGateRef.current.run(operation)});
            const enrollment = createFirebaseNotificationEnrollment({accountId: userId,
              managerOrigin: import.meta.env.VITE_NOTIFICATION_SERVICE_URL || "https://riddle-quest-admin.vercel.app",
              locale: getCurrentLocale, isCurrent: () => isAccountActive() && isPlayerNotificationsEnabled(),
              backend: {...backend, createEnrollment: async input => {
                if (!await applyEnabled(true)) throw new Error("notification-enrollment-preference-unavailable");
                return backend.createEnrollment(input);
              }},
            });
            const notifications = createPlatformNotificationProvider({
              preferences: {
                getEnabled: isPlayerNotificationsEnabled,
                setEnabled: setPlayerNotificationsEnabled,
                subscribe: subscribeToPlayerNotifications,
              },
              applyEnabled, applyPermission: enrollment.requestPermission, restoreDelivery: enrollment.restoreDelivery,
              getSetupLink: enrollment.getSetupLink,
            });
            notificationProvider = createNotificationProvider({platform: "facebook", hosted: () => ({...notifications,
              restore() {enrollment.activate(); return notifications.restore();},
              retire() {enrollment.retire(); notifications.retire();},
            })}) ?? undefined;
            sessionNotifications = notificationProvider;
          }
          referralsEnabled = ageCategory === "13_plus" && clientConfiguration.referralsEnabled;
          matchmakingEnabled = ageCategory === "13_plus" && clientConfiguration.matchmakingEnabled;
          presenceCapabilityEnabled = ageCategory === "13_plus" && clientConfiguration.presenceEnabled;
          if (matchmakingEnabled) {
            contextBoardApi = {list: listFacebookContextBoard, record: recordFacebookContextRun};
          }
          if (
            ageCategory === "13_plus" &&
            ((clientConfiguration.interstitialsEnabled && sdk.getSupportedAPIs().includes("getInterstitialAdAsync")) ||
              (clientConfiguration.rewardedAdsEnabled && sdk.getSupportedAPIs().includes("getRewardedVideoAsync")))
          ) {
            ads = createFacebookAdsCapability({
              sdk,
              isActive: () => active && deletionGateRef.current.isOpen(),
              placementId: clientConfiguration.interstitialsEnabled
                ? import.meta.env.VITE_FACEBOOK_INTERSTITIAL_PLACEMENT_ID || ""
                : "",
              rewardedPlacementId: import.meta.env.VITE_FACEBOOK_REWARDED_PLACEMENT_ID || "",
              rewardedEnabled: clientConfiguration.rewardedAdsEnabled,
              adFree: () => removeInterstitialAds !== false,
            });
            attemptRecovery = createFacebookRewardedContinue({ads,
              isActive: () => active && deletionGateRef.current.isOpen(),
              claim: input => deletionGateRef.current.run(async () => (await grantFacebookRewardedContinue(input)).data),
            });
          }
          if (ageCategory === "13_plus" && clientConfiguration.tournamentsEnabled) {
            /** Native standings remain an optional presentation of the official server board. */
            const presentation = createFacebookTournamentPresentation({sdk, enabled: true, ageCategory,
              isActive: () => active && deletionGateRef.current.isOpen(), getLocale: getCurrentLocale,
              list: async locale => (await listFacebookTournament({locale})).data,
              reportFailure: error => captureBrowserException(error, {component: "facebook_tournament", operation: "native_presentation"})});
            tournaments = {
              list: async (locale: import("../../../../src/races/contracts/index").RaceLocale) => {
                /** Validated official standings for the exact player locale and UTC window. */
                const board = (await listFacebookTournament({locale})).data;
                if (presentation) void presentation.projectBoard(board);
                return board;
              },
              record: async (runId: string, locale: import("../../../../src/races/contracts/index").RaceLocale) => {
                /** Official success is returned independently of provider score delivery. */
                const result = (await recordFacebookTournament({runId, locale})).data;
                if (presentation) void presentation.projectRecord(result);
                return result;
              },
              share: presentation?.share,
            };
          }
        } catch (configurationError) {
          captureBrowserException(configurationError, {
            component: "facebook_ads",
            operation: "load_configuration",
          });
        }
        if (referralsEnabled) {
          try {
            await bindFacebookEntryReferral(sdk);
          } catch (referralError) {
            captureBrowserException(referralError, {component: "facebook_referral", operation: "bind_entry"});
          }
        }
        /** Outbound referrals use Meta's native dialog and the canonical Facebook token issuer. */
        const referralSharing = createFacebookReferralSharing({
          sdk, enabled: referralsEnabled, ageCategory,
          isActive: () => active && deletionGateRef.current.isOpen(),
          reportFailure: (error) => captureBrowserException(error, {component: "facebook_referral", operation: "native_share"}),
        });
        /** Untrusted entry data can select a destination but cannot supply race results. */
        const launch = facebookLaunchFromEntryData(sdk.getEntryPointData?.());
        /** The account master preference overrides stale provider storage from another device. */
        const [storedPreferences, account] = await Promise.all([
          session.storage.readPreferences(),
          hostServicesMode === "firebase"
            ? import("../../../../src/platform/firebase/browserClient").then(({loadUserDocument}) => loadUserDocument(userId))
            : Promise.resolve(null),
        ]);
        const restoredPreferences = {
          ...storedPreferences,
          ...(typeof account?.notificationsEnabled === "boolean" ? {notificationsEnabled: account.notificationsEnabled} : {}),
        };
        if (!active) return;
        /** Provides preferences behavior. */
        const preferences = {...restoredPreferences, ...applyPlayerPreferences(restoredPreferences)};
        preferencesRef.current = preferences;
        unsubscribePreferences = subscribeToPlayerPreferenceChanges((change) => {
          if (!deletionGateRef.current.isOpen()) return;
          void playerPersistenceRef.current?.updatePreferences(change)
            .then(next => {
              if (!next) return;
              preferencesRef.current = next;
            })
            .catch((error) => {
              if (deletionGateRef.current.isOpen()) {
                captureBrowserException(error, {component: "facebook_preferences", operation: "persist"});
              }
            });
        });
        /** Provides context coordinator behavior. */
        const contextCoordinator =
          matchmakingEnabled && session.capabilities.nativeSocial
            ? new FacebookContextCoordinator(session.capabilities.nativeSocial, getCurrentLocale)
            : undefined;
        if (contextCoordinator) {
          unsubscribeContext = contextCoordinator.startObserving(() => active && deletionGateRef.current.isOpen());
          /** Provides context result behavior. */
          const contextResult = await contextCoordinator.synchronizeCurrent();
          if (contextResult.status === "retryable-failure") {
            captureBrowserException(new Error(contextResult.message), {
              component: "facebook_context",
              operation: "initial_sync",
            });
          }
        }
        /** Provides context board behavior. */
        const contextBoard =
          contextCoordinator && contextBoardApi
            ? createFacebookContextBoard(contextCoordinator, contextBoardApi)
            : undefined;
        /** Provides base capabilities behavior. */
        const baseCapabilities = gateFacebookSessionCapabilities(session.capabilities, {
          matchmakingEnabled,
          configurationLoaded,
        });
        /** Private native context selection uses the original authenticated join without retargeting. */
        const originalLiveJoin = baseCapabilities.matchmaking?.live?.join;
        if (baseCapabilities.matchmaking && contextCoordinator)
          baseCapabilities.matchmaking = createFacebookContextMatchmaking(baseCapabilities.matchmaking, contextCoordinator, getCurrentLocale);
        /** Native friend invitations remain independent of referral reward configuration. */
        const shareChallenge = createFacebookLiveRaceSharing({sdk, enabled: matchmakingEnabled, ageCategory,
          isActive: () => active && deletionGateRef.current.isOpen(),
          reportFailure: error => captureBrowserException(error, {component: "facebook_multiplayer", operation: "native_invite"})});
        if (baseCapabilities.matchmaking?.live && shareChallenge) {
          baseCapabilities.matchmaking = {...baseCapabilities.matchmaking,
            live: {...baseCapabilities.matchmaking.live, shareChallenge}};
        }
        if (baseCapabilities.matchmaking?.live && contextCoordinator && originalLiveJoin) {
          /** The artifact declares its update template explicitly, independently of native SDK support. */
          const chooseChallenge = createFacebookContextChallenges({sdk, coordinator: contextCoordinator,
            live: baseCapabilities.matchmaking.live, join: originalLiveJoin,
            template: import.meta.env.VITE_FACEBOOK_CONTEXT_CHALLENGE_TEMPLATE, enabled: matchmakingEnabled, ageCategory,
            isActive: () => active && deletionGateRef.current.isOpen(), getLocale: getCurrentLocale,
            reportFailure: error => captureBrowserException(error, {component: "facebook_multiplayer", operation: "context_invite"})});
          if (chooseChallenge) baseCapabilities.matchmaking = {...baseCapabilities.matchmaking,
            live: {...baseCapabilities.matchmaking.live, chooseChallenge}};
        }
        /** Provides synchronized session behavior. */
        const synchronizedSession = contextCoordinator
          ? {
              ...session,
              capabilities: {
                ...baseCapabilities,
                nativeSocial: contextCoordinator,
                ...(ads ? {ads} : {}),
                ...(commerceSession ? {commerce: commerceSession.capability} : {}),
                ...(attemptRecovery ? {attemptRecovery} : {}),
                ...(tournaments ? {tournaments} : {}),
                ...(contextBoard ? {contextBoard} : {}),
              },
            }
          : {
              ...session,
              capabilities: {
                ...baseCapabilities,
                ...(ads ? {ads} : {}),
                ...(commerceSession ? {commerce: commerceSession.capability} : {}),
                ...(attemptRecovery ? {attemptRecovery} : {}),
                ...(tournaments ? {tournaments} : {}),
              },
            };
        if (!active) return;
        setPresenceAvailable(presenceCapabilityEnabled);
        setPresenceEnabled(presenceCapabilityEnabled && preferences.presenceEnabled === true);
        if (presenceCapabilityEnabled) {
          /** Provides [{firebase presence transport}, {platform presence session}] behavior. */
          const [{FirebasePresenceTransport}, {PlatformPresenceSession}] = await Promise.all([
            import("../../../../src/presence/FirebasePresenceTransport"),
            import("../../../../src/presence/PlatformPresenceSession"),
          ]);
          /** Provides presence behavior. */
          const presence = new PlatformPresenceSession(new FirebasePresenceTransport(userId), {
            sessionId: crypto.randomUUID(),
            platform: "facebook",
          });
          presenceRef.current = presence;
          await startOptionalPresence({
            enabled: preferences.presenceEnabled === true,
            canStart: document.visibilityState !== "hidden",
            start: () => presence.start(true),
            reportFailure: (error) =>
              captureBrowserException(error, {
                component: "facebook_presence",
                operation: "initialize",
              }),
          });
          stopPresence = () => presence.stop();
          unsubscribeResume = session.capabilities.lifecycle?.onResume?.(() =>
            settleFacebookPresenceResume({
              enabled: preferencesRef.current.presenceEnabled === true,
              startPresence: () => presence.start(true),
              reportFailure: (error) =>
                captureBrowserException(error, {
                  component: "facebook_lifecycle",
                  operation: "resume_presence",
                }),
            }),
          );
        }
        /** Provides player data behavior. */
        const playerData = await session.storage.readPlayerData();
        if (!active) return;
        /** Pause drains the checkpoint owner belonging to this provider session. */
        const playerPersistence = new PlayerProjectionPersistence(
          session.storage,
          playerData,
          preferencesRef.current,
          deletionGateRef.current,
        );
        playerPersistenceRef.current = playerPersistence;
        unsubscribePause = session.capabilities.lifecycle?.onPause(() =>
          settleFacebookPause({
            flushStorage: () => playerPersistence.flush(),
            stopPresence,
            reportFailure: ({operation, error}) =>
              captureBrowserException(error, {
                component: "facebook_lifecycle",
                operation,
              }),
          }),
        );
        if (active) {
          if (ageCategory === "13_plus" && configurationLoaded) {
            stopAnalytics = installFacebookAnalytics(sdk, () => active && deletionGateRef.current.isOpen());
          }
          setStartup({status: "ready", session: synchronizedSession, playerData, referralSharing, notificationProvider, launch,
            analyticsAvailable: ageCategory === "13_plus" && configurationLoaded});
        }
      } catch {
        if (active) setStartup({status: "error"});
      }
    })();
    return () => {
      active = false;
      stopAnalytics?.();
      unsubscribePause?.();
      unsubscribeResume?.();
      unsubscribeCommerceResume?.();
      commerceSession?.retire();
      sessionNotifications?.retire();
      unsubscribePreferences?.();
      unsubscribeContext?.();
      void stopPresence?.();
      presenceRef.current = null;
    };
  }, []);

  /** Provides write player data behavior. */
  const writePlayerData = useCallback(
    async (update: PlayerDataUpdate) => {
      if (startup.status !== "ready" || !deletionGateRef.current.isOpen()) return;
      /** Accepts checkpoints synchronously; target ownership is checked when the merged batch executes. */
      try {
        await playerPersistenceRef.current?.update(update);
      } catch (error) {
        if (deletionGateRef.current.isOpen()) captureBrowserException(error, {component: "facebook_progress", operation: "persist"});
      }
    },
    [startup],
  );

  /** Provides toggle presence behavior. */
  const togglePresence = useCallback(() => {
    if (startup.status !== "ready" || !presenceRef.current || !deletionGateRef.current.isOpen()) return;
    /** Provides next behavior. */
    const next = !presenceEnabled;
    trackEvent("presence_preference_requested", {enabled: next});
    void playerPersistenceRef.current?.updatePreferences({presenceEnabled: next})
      .then(async preferences => {
        if (!preferences) return;
        preferencesRef.current = preferences;
        await deletionGateRef.current.run(async () => {
          /** Provides presence behavior. */
          const presence = presenceRef.current;
          await reconcilePresenceOptIn({
            enabled: next,
            canStart: true,
            start: async () => {
              await presence?.start(true);
            },
            stop: async () => {
              await presence?.stop();
            },
            setConsent: async (enabled) => {
              /** Provides {set presence consent} behavior. */
              const {setPresenceConsent} = await import("../../../../src/platform/firebase/browserClient");
              await setPresenceConsent({enabled});
            },
          });
          setPresenceEnabled(next);
          trackEvent("presence_preference_changed", {enabled: next});
        });
      })
      .catch((error) => {
        if (deletionGateRef.current.isOpen()) {
          trackEvent("presence_preference_failed", {enabled: next});
          captureBrowserException(error, {component: "facebook_presence", operation: "toggle"});
        }
      });
  }, [presenceEnabled, startup]);

  /** Requests account deletion. */
  const requestAccountDeletion = useCallback(async () => {
    if (startup.status !== "ready") return;
    analyticsLifetimeRef.current.abort();
    deletionGateRef.current.close();
    await startup.notificationProvider?.setEnabled(false);
    startup.notificationProvider?.retire();
    await presenceRef.current?.stop();
    await playerPersistenceRef.current?.closeAndFlush();
  }, [startup]);

  /** Completes account deletion. */
  const completeAccountDeletion = useCallback(async () => {
    if (startup.status !== "ready") return;
    startup.notificationProvider?.retire();
    await playerPersistenceRef.current?.clear();
    playerPersistenceRef.current = null;
    clearBrowserPlayerState();
    preferencesRef.current = {};
    setPresenceEnabled(false);
    setPresenceAvailable(false);
  }, [startup]);

  /** Sets presence state. */
  const setPresenceState = useCallback((state: import("../../../../src/presence/PlatformPresenceSession").ActivePresenceState) => {
    void presenceRef.current?.setState(state).catch((error) => {
      captureBrowserException(error, {component: "facebook_presence", operation: "state"});
    });
  }, []);

  /** Provides show result interstitial behavior. */
  const showResultInterstitial = useCallback(async () => {
    if (startup.status !== "ready") return;
    /** Provides result behavior. */
    const result = await startup.session.capabilities.ads?.showInterstitial("result");
    if (result?.status === "retryable-failure" || result?.status === "terminal-failure") {
      captureBrowserException(new Error(result.message), {
        component: "facebook_ads",
        operation: "show_result_interstitial",
      });
    }
  }, [startup]);

  if (startup.status === "error") {
    return (
      <main className="route-missing">
        <div role="alert">
          <h1>{tr("ErrorMessages.FATAL_STARTUP_TITLE")}</h1>
          <button onClick={() => window.location.reload()}>{tr("CommonButtons.RETRY")}</button>
        </div>
      </main>
    );
  }
  if (startup.status === "loading") {
    return (
      <main className="route-loading">
        <SpinningWheelLoader message={tr("Accessibility.LOADING")} progress={startup.progress} />
      </main>
    );
  }
  return (
    <GoogleAnalyticsConsent
      platform="facebook"
      measurementId={firebaseEnvironment.measurementId}
      available={firebaseEnvironment.production && hostServicesMode === "firebase" && startup.analyticsAvailable}
      isCurrent={isAnalyticsSessionCurrent}
      lifetimeSignal={analyticsLifetimeRef.current.signal}
    >
    <PlayerSaveRecoveryLayout recovery={saveRecovery}>
      <PlayHostApp
        raceSurface={FacebookRaceSurface}
        session={createHostedPlaySession({
          hostServices,
          hostConfigurationWarning,
          platformCapabilities: startup.session.capabilities,
          platformProducts: commercePresentation?.products,
          platformPurchase: commercePresentation?.purchase,
          platformPlayerId: startup.session.playerId,
          initialPlayerData: startup.playerData,
          ...startup.launch,
          referralSharing: startup.referralSharing,
          notificationProvider: startup.notificationProvider,
          onPlayerDataChange: (update) => void writePlayerData(update),
          accountDeletionServiceGate: deletionGateRef.current,
          presenceEnabled,
          onTogglePresence: presenceAvailable ? togglePresence : undefined,
          raceLocalePolicy: "all",
          onPresenceStateChange: setPresenceState,
        })}
        onAccountDeletionRequested={requestAccountDeletion}
        onAccountDeleted={completeAccountDeletion}
        onResultScreen={showResultInterstitial}
      />
    </PlayerSaveRecoveryLayout>
    </GoogleAnalyticsConsent>
  );
}
