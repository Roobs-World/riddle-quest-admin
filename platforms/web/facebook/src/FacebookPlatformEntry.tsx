import {lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import type {ProductSummary, PurchaseResult} from "../../../../src/platform/contracts/hostServices";
import type {NotificationProvider} from "../../../../src/notifications/contracts/notificationProvider";
import {createNotificationProvider} from "../../../../src/notifications/controllers/notificationProvider";
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
import {createFacebookPlayerSettingsActions} from "./engagement/FacebookPlayerSettingsActions";
import {createFacebookHostEnvironment} from "./engagement/FacebookHostEnvironment";
import {createFacebookHaptics, type FacebookHaptics} from "./engagement/FacebookHaptics";
import {HapticFeedbackProvider} from "../../../../src/settings/components/HapticFeedbackSettings";
import {createFacebookNativeSocial, type FacebookNativeSocial} from "./social/FacebookNativeSocial";
import {FacebookNativeSocialProvider} from "./social/FacebookNativeSocialPanel";
import {createFacebookBanner, type FacebookBanner} from "./ads/FacebookBanner";
import {FacebookBannerLayout} from "./ads/FacebookBannerLayout";
import {PlayerSettingsActionsProvider} from "../../../../src/settings/components/PlayerSettingsActions";
import type {PlayerSettingsActionsCapability} from "../../../../src/settings/contracts/playerSettingsActions";
import {createFacebookLiveRaceSharing} from "./FacebookLiveRaceSharing";
import {createFacebookContextChallenges} from "./contextChallenges";
import {FacebookContextCoordinator} from "./contexts";
import {createFacebookContextBoard} from "./contextBoard";
import {createFacebookContextMatchmaking} from "./liveContextMatchmaking";
import {gateFacebookSessionCapabilities, parseFacebookAgeCategory} from "./FacebookCapabilityPolicy";
import {createFacebookAdsCapability} from "./FacebookAdsCapability";
import {createFacebookAdConfiguration} from "./FacebookAdConfiguration";
import {createFacebookSubscriptionEntitlement} from "./ads/FacebookSubscriptionEntitlement";
import {createFacebookAdPresentation} from "./ads/FacebookAdPresentation";
import {createFacebookInterstitialTrace} from "./ads/FacebookInterstitialTrace";
import {createFacebookLevelInterstitial} from "./FacebookLevelInterstitial";
import type {HostCompletionInput} from "../../../../src/progression/browser/hostCompletionEffects";
import type {CompletionResult} from "../../../../src/platform/contracts/hostServices";
import {FacebookCommerceSession, facebookPaymentsAvailable} from "./FacebookCommerceSession";
import {createFacebookRewardedContinue} from "./FacebookRewardedContinue";
import {LocalAccountDeletionGate} from "../../../../src/accounts/browser/deletion/LocalAccountDeletionGate";
import {
  applyPlayerPreferences,
  clearBrowserPlayerState,
  installBrowserPlayerStateMutationGuard,
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

/** Facebook multiplayer presentation loads only when the player opens it. */
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
      /** Optional user-initiated native player actions for this account. */
      settingsActions?: PlayerSettingsActionsCapability;
      haptics?: FacebookHaptics;
      nativeSocial?: FacebookNativeSocial;
      banner?: FacebookBanner;
      /** Settings owns the authenticated player's Facebook campaign consent. */
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
  const settingsActions = startup.status === "ready" ? startup.settingsActions : undefined;
  const subscribeSettingsActions = useCallback((listener: () => void) =>
    settingsActions?.subscribe(listener) ?? (() => undefined), [settingsActions]);
  const readQuitPending = useCallback(() => settingsActions?.getSnapshot().pendingAction === "quit", [settingsActions]);
  const quitPending = useSyncExternalStore(subscribeSettingsActions, readQuitPending, readQuitPending);
  /** Provides [presence enabled, set presence enabled] behavior. */
  const [presenceEnabled, setPresenceEnabled] = useState(false);
  /** Provides [presence available, set presence available] behavior. */
  const [presenceAvailable, setPresenceAvailable] = useState(false);
  const [, setAdPolicyVersion] = useState(0);
  const levelInterstitialRef = useRef<ReturnType<typeof createFacebookLevelInterstitial> | null>(null);
  const hostEnvironmentRef = useRef<ReturnType<typeof createFacebookHostEnvironment> | null>(null);
  const hapticsRef = useRef<FacebookHaptics | null>(null);
  const bannerRef = useRef<FacebookBanner | null>(null);
  const subscriptionEntitlementRef = useRef<ReturnType<typeof createFacebookSubscriptionEntitlement> | null>(null);
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
    let nativeSessionIsActive = () => active && deletionGateRef.current.isOpen();
    const removeBrowserStateGuard = installBrowserPlayerStateMutationGuard(
      () => nativeSessionIsActive(),
    );
    /** Disconnects native analytics when this authenticated session retires. */
    let stopAnalytics: (() => void) | undefined;
    /** Provides unsubscribe pause behavior. */
    let unsubscribePause: (() => void) | undefined;
    /** Provides unsubscribe resume behavior. */
    let unsubscribeResume: (() => void) | undefined;
    /** Removes the payment recovery listener when the account session retires. */
    let unsubscribeCommerceResume: (() => void) | undefined;
    let unsubscribeAdsResume: (() => void) | undefined;
    let removeVictoryListener: (() => void) | undefined;
    let levelInterstitial: ReturnType<typeof createFacebookLevelInterstitial> | undefined;
    let interstitialTrace: ReturnType<typeof createFacebookInterstitialTrace> | undefined;
    /** Payment lifecycle controller for the authenticated Facebook account. */
    let commerceSession: FacebookCommerceSession | undefined;
    let sessionNotifications: NotificationProvider | undefined;
    let settingsActions: PlayerSettingsActionsCapability | undefined;
    let hostEnvironment: ReturnType<typeof createFacebookHostEnvironment> | undefined;
    let haptics: FacebookHaptics | undefined;
    let nativeSocial: FacebookNativeSocial | undefined;
    let banner: FacebookBanner | undefined;
    let subscriptionEntitlement: ReturnType<typeof createFacebookSubscriptionEntitlement> | undefined;
    let adPresentation: ReturnType<typeof createFacebookAdPresentation> | undefined;
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
        const configuredAudience = parseFacebookAgeCategory(import.meta.env.VITE_FACEBOOK_AGE_CATEGORY);
        const bootstrap = new FacebookPlatformBootstrap(undefined, configuredAudience, () => nativeSessionIsActive());
        /** Provides result behavior. */
        const result = await bootstrap.initialize((progress) => {
          if (nativeSessionIsActive()) setStartup({status: "loading", progress});
        });
        if (!nativeSessionIsActive()) return;
        if (result.status !== "success") {
          throw new Error(result.status === "cancelled" ? "facebook-startup-cancelled" : result.message);
        }
        /** Provides session behavior. */
        const session = result.value;
        const ageCategory = bootstrap.resolvedAgeCategory;
        /** Provides sdk behavior. */
        const sdk = requireFacebookInstant();
        /** Provides r id. */
        const userId = await authenticateFacebook(sdk);
        const {auth} = await import("../../../../src/platform/firebase/browserClient");
        const accountOwner = auth.currentUser;
        if (!accountOwner || accountOwner.uid !== userId) throw new Error("facebook-authentication-owner-changed");
        const isAccountSessionActive = () => active && deletionGateRef.current.isOpen() && auth.currentUser === accountOwner;
        nativeSessionIsActive = isAccountSessionActive;
        /** Provides ads behavior. */
        let ads = undefined;
        /** Latest verified ad-removal entitlement passed to the ad adapter. */
        let removeInterstitialAds: boolean | undefined;
        /** Facebook-only continuation capability bound to the current authenticated session. */
        let attemptRecovery: import("../../../../src/platform/contracts/capabilities").AttemptRecoveryCapability | undefined;
        /** Settings is the only game surface that can grant Facebook campaign consent. */
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
            list facebook context board,
            record facebook context run,
          } behavior. */
          const {
            getFacebookClientConfiguration,
            listFacebookContextBoard,
            recordFacebookContextRun,
            grantFacebookRewardedContinue,
            grantFacebookPurchase,
          } = await import("./firebaseClient");
          /** Provides client configuration behavior. */
          const clientConfiguration = (await getFacebookClientConfiguration()).data;
          if (!isAccountSessionActive()) return;
          configurationLoaded = true;
          removeInterstitialAds = clientConfiguration.removeInterstitialAds;
          if (ageCategory === "13_plus" && clientConfiguration.commerceEnabled && facebookPaymentsAvailable(sdk)) {
            /** Payment session connected to this authenticated host and deletion gate. */
            const commerce = new FacebookCommerceSession({
              sdk,
              payments: sdk.payments,
              isActive: isAccountSessionActive,
              runBackground: operation => deletionGateRef.current.run(operation),
              grant: async input => (await grantFacebookPurchase(input)).data,
              readConfiguration: async () => (await getFacebookClientConfiguration()).data,
              onProducts: products => {
                if (isAccountSessionActive()) {
                  setCommercePresentation({products, purchase: commerce.requestPurchase});
                }
              },
              onEntitlement: value => {if (isAccountSessionActive()) removeInterstitialAds = value;},
              reportFailure: error => {
                if (isAccountSessionActive()) captureBrowserException(error, {component: "facebook_commerce", operation: "recovery"});
              },
              refreshProfile: () => isAccountSessionActive() ? hostServices.loadProfile(userId) : Promise.resolve(null),
            });
            commerceSession = commerce;
            commerce.start();
            unsubscribeCommerceResume = session.capabilities.lifecycle?.onResume?.(() => commerce.refresh());
          }
          if (ageCategory === "13_plus" && clientConfiguration.notificationsEnabled) {
            try {
              const {createFacebookCampaignNotifications} = await import("./FacebookCampaignNotifications");
              const notifications = await createFacebookCampaignNotifications(userId, deletionGateRef.current, isAccountSessionActive);
              if (!isAccountSessionActive()) return;
              notificationProvider = createNotificationProvider({platform: "facebook", hosted: () => notifications}) ?? undefined;
              sessionNotifications = notificationProvider;
            } catch (error) {
              if (!isAccountSessionActive()) return;
              captureBrowserException(error, {component: "facebook_notifications", operation: "initialize_preference"});
            }
          }
          referralsEnabled = ageCategory === "13_plus" && clientConfiguration.referralsEnabled;
          matchmakingEnabled = ageCategory === "13_plus" && clientConfiguration.matchmakingEnabled;
          presenceCapabilityEnabled = ageCategory === "13_plus" && clientConfiguration.presenceEnabled;
          if (matchmakingEnabled) {
            contextBoardApi = {list: listFacebookContextBoard, record: recordFacebookContextRun};
          }
          if (!isAccountSessionActive()) return;
          if (
            ageCategory === "13_plus" &&
            (sdk.getSupportedAPIs().includes("getInterstitialAdAsync") ||
              sdk.getSupportedAPIs().includes("getRewardedVideoAsync") ||
              sdk.getSupportedAPIs().includes("loadBannerAdAsync"))
          ) {
            const entitlement = createFacebookSubscriptionEntitlement({
              projectId: firebaseEnvironment.projectId,
              uid: accountOwner.uid,
              getIdToken: () => accountOwner.getIdToken(),
              getAppCheckToken: async () => (await import("./FacebookFirebaseAppCheck")).getFacebookAppCheckToken(),
              isActive: isAccountSessionActive,
            });
            subscriptionEntitlement = entitlement;
            subscriptionEntitlementRef.current = entitlement;
            const adConfiguration = createFacebookAdConfiguration({
              initial: clientConfiguration,
              isActive: isAccountSessionActive,
              read: async () => {
                const [configuration, hasActiveSubscription] = await Promise.all([
                  getFacebookClientConfiguration().then(result => result.data),
                  entitlement.read(),
                ]);
                if (isAccountSessionActive()) removeInterstitialAds = configuration.removeInterstitialAds;
                return {...configuration, hasActiveSubscription};
              },
              onChange: () => {setAdPolicyVersion(version => version + 1); banner?.refresh();},
              reportFailure: error => captureBrowserException(error, {component: "facebook_ads", operation: "refresh_configuration"}),
            });
            unsubscribeAdsResume = session.capabilities.lifecycle?.onResume?.(() => {void adConfiguration.refresh();});
            banner = createFacebookBanner({
              sdk, isActive: isAccountSessionActive,
              enabled: import.meta.env.VITE_FACEBOOK_BANNER_ENABLED === "true",
              placementId: import.meta.env.VITE_FACEBOOK_BANNER_PLACEMENT_ID || "",
              allowsBanner: () => adConfiguration.allows("interstitial"),
              refreshEligibility: () => adConfiguration.refreshEligibility("interstitial"),
              lifecycle: session.capabilities.lifecycle,
              reportFailure: operation => captureBrowserException(new Error("facebook-banner-failed"),
                {component: "facebook_banner", operation}),
            });
            bannerRef.current = banner ?? null;
            adPresentation = createFacebookAdPresentation(session.capabilities.lifecycle);
            const currentInterstitialTrace = createFacebookInterstitialTrace();
            interstitialTrace = currentInterstitialTrace;
            ads = createFacebookAdsCapability({
              sdk,
              isActive: isAccountSessionActive,
              capturePresentation: adPresentation.capture,
              captureInterstitialTrace: currentInterstitialTrace.capture,
              placementId: import.meta.env.VITE_FACEBOOK_INTERSTITIAL_PLACEMENT_ID || "",
              rewardedPlacementId: import.meta.env.VITE_FACEBOOK_REWARDED_PLACEMENT_ID || "",
              rewardedEnabled: () => adConfiguration.allows("rewarded"),
              rewardedOfferAvailable: () => adConfiguration.canOffer("rewarded"),
              adFree: () => removeInterstitialAds !== false || !adConfiguration.allows("interstitial"),
              refreshEligibility: adConfiguration.refreshEligibility,
            });
            void adConfiguration.refresh();
            attemptRecovery = createFacebookRewardedContinue({ads,
              isActive: isAccountSessionActive,
              claim: input => deletionGateRef.current.run(async () => (await grantFacebookRewardedContinue(input)).data),
            });
            const sessionAds = ads;
            const currentLevelInterstitial = createFacebookLevelInterstitial({
              isActive: isAccountSessionActive,
              trace: currentInterstitialTrace,
              show: async isCurrent => {
                if (!sessionAds) {
                  const trace = currentInterstitialTrace.capture();
                  trace?.record("format-unavailable");
                  trace?.record("unavailable");
                  trace?.record("finished");
                  return;
                }
                const result = await sessionAds.showInterstitial("result", () => isCurrent() && document.visibilityState === "visible");
                if (result?.status === "retryable-failure" || result?.status === "terminal-failure") {
                  captureBrowserException(new Error(result.message), {component: "facebook_ads", operation: "show_level_interstitial"});
                }
              },
            });
            levelInterstitial = currentLevelInterstitial;
            levelInterstitialRef.current = currentLevelInterstitial;
            const onVictoryDismissed = (event: Event): void => {
              if (!(event instanceof CustomEvent)) return;
              const detail: unknown = event.detail;
              if (typeof detail === "object" && detail !== null && "outcomeKey" in detail && typeof detail.outcomeKey === "string") {
                currentLevelInterstitial.dismiss(detail.outcomeKey);
              }
            };
            window.addEventListener("riddle-quest:victory-dismissed", onVictoryDismissed);
            removeVictoryListener = () => window.removeEventListener("riddle-quest:victory-dismissed", onVictoryDismissed);
          }
        } catch (configurationError) {
          if (!isAccountSessionActive()) return;
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
          sdk, enabled: configurationLoaded, referralsEnabled, ageCategory,
          isActive: isAccountSessionActive,
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
        if (!isAccountSessionActive()) return;
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
          unsubscribeContext = contextCoordinator.startObserving(isAccountSessionActive);
          /** Provides context result behavior. */
          const contextResult = await contextCoordinator.synchronizeCurrent();
          if (contextResult.status === "retryable-failure") {
            captureBrowserException(new Error(contextResult.message), {
              component: "facebook_context",
              operation: "initial_sync",
            });
          }
        }
        if (contextCoordinator && configurationLoaded && ageCategory === "13_plus") {
          nativeSocial = createFacebookNativeSocial({
            sdk, isActive: isAccountSessionActive,
            synchronizeContext: async () => {
              const result = await contextCoordinator.reconcileNativeContext();
              if (result.status === "retryable-failure" || result.status === "terminal-failure") {
                throw new Error("facebook-native-context-sync-failed");
              }
            },
            onContextChange: listener => contextCoordinator.onContextChange(listener),
          });
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
          isActive: isAccountSessionActive,
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
            isActive: isAccountSessionActive, getLocale: getCurrentLocale,
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
              },
            };
        if (!isAccountSessionActive()) return;
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
        if (!isAccountSessionActive()) return;
        /** Pause drains the checkpoint owner belonging to this provider session. */
        const playerPersistence = new PlayerProjectionPersistence(
          session.storage,
          playerData,
          preferencesRef.current,
          deletionGateRef.current,
        );
        playerPersistenceRef.current = playerPersistence;
        if (configurationLoaded && ageCategory === "13_plus") {
          haptics = createFacebookHaptics({sdk, isActive: isAccountSessionActive, lifecycle: session.capabilities.lifecycle});
          hapticsRef.current = haptics ?? null;
          hostEnvironment = createFacebookHostEnvironment({sdk, isActive: isAccountSessionActive});
          hostEnvironmentRef.current = hostEnvironment;
          hostEnvironment.setActivity("online");
          settingsActions = createFacebookPlayerSettingsActions({
            sdk,
            isActive: isAccountSessionActive,
            messengerBotEnabled: Boolean(notificationProvider) && import.meta.env.VITE_FACEBOOK_MESSENGER_BOT_ENABLED === "true",
            flushBeforeQuit: async trace => {
              trace("projection");
              await playerPersistence.flush();
              try {
                if (stopPresence) trace("presence");
                await stopPresence?.();
              } catch (error) {
                captureBrowserException(error, {component: "facebook_presence", operation: "quit"});
              }
            },
            reportFailure: ({action}) => captureBrowserException(new Error("facebook-player-action-failed"),
              {component: "facebook_engagement", operation: action, ...hostEnvironment?.getSnapshot()}),
          });
        }
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
        if (isAccountSessionActive()) {
          if (ageCategory === "13_plus" && configurationLoaded) {
            stopAnalytics = installFacebookAnalytics(sdk, isAccountSessionActive);
          }
          setStartup({status: "ready", session: synchronizedSession, playerData, referralSharing, settingsActions, haptics, nativeSocial, banner, notificationProvider, launch,
            analyticsAvailable: ageCategory === "13_plus" && configurationLoaded});
        }
      } catch {
        if (nativeSessionIsActive()) setStartup({status: "error"});
      }
    })();
    return () => {
      active = false;
      adPresentation?.retire();
      subscriptionEntitlement?.retire();
      if (subscriptionEntitlementRef.current === subscriptionEntitlement) subscriptionEntitlementRef.current = null;
      removeBrowserStateGuard();
      stopAnalytics?.();
      unsubscribePause?.();
      unsubscribeResume?.();
      unsubscribeCommerceResume?.();
      unsubscribeAdsResume?.();
      removeVictoryListener?.();
      levelInterstitial?.retire();
      interstitialTrace?.retire();
      if (levelInterstitialRef.current === levelInterstitial) levelInterstitialRef.current = null;
      commerceSession?.retire();
      sessionNotifications?.retire();
      settingsActions?.retire();
      hostEnvironment?.retire();
      haptics?.retire();
      nativeSocial?.retire();
      void banner?.retire().catch(() => undefined);
      if (bannerRef.current === banner) bannerRef.current = null;
      if (hapticsRef.current === haptics) hapticsRef.current = null;
      if (hostEnvironmentRef.current === hostEnvironment) hostEnvironmentRef.current = null;
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
    subscriptionEntitlementRef.current?.retire();
    startup.settingsActions?.retire();
    hostEnvironmentRef.current?.retire();
    hapticsRef.current?.retire();
    startup.nativeSocial?.retire();
    await startup.banner?.retire();
    await startup.notificationProvider?.setEnabled(false);
    startup.notificationProvider?.retire();
    await presenceRef.current?.stop();
    await playerPersistenceRef.current?.closeAndFlush();
  }, [startup]);

  /** Completes account deletion. */
  const completeAccountDeletion = useCallback(async () => {
    if (startup.status !== "ready") return;
    startup.settingsActions?.retire();
    startup.haptics?.retire();
    startup.nativeSocial?.retire();
    await startup.banner?.retire();
    hostEnvironmentRef.current?.retire();
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
    hostEnvironmentRef.current?.setActivity(state);
    bannerRef.current?.setActivity(state);
    void presenceRef.current?.setState(state).catch((error) => {
      captureBrowserException(error, {component: "facebook_presence", operation: "state"});
    });
  }, []);

  const onLevelCompleted = useCallback((input: HostCompletionInput, result: CompletionResult) => {
    void hapticsRef.current?.complete(input, result);
    return levelInterstitialRef.current?.complete(input, result);
  }, []);

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
    <PlayerSettingsActionsProvider capability={startup.settingsActions}>
    <HapticFeedbackProvider capability={startup.haptics}>
    <FacebookNativeSocialProvider capability={startup.nativeSocial}>
    <FacebookBannerLayout banner={startup.banner}>
    <div style={{display: "contents"}} inert={quitPending || undefined}>
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
          externalInteractionBlocked: quitPending,
          accountDeletionServiceGate: deletionGateRef.current,
          presenceEnabled,
          onTogglePresence: presenceAvailable ? togglePresence : undefined,
          raceLocalePolicy: "all",
          onPresenceStateChange: setPresenceState,
        })}
        onAccountDeletionRequested={requestAccountDeletion}
        onAccountDeleted={completeAccountDeletion}
        onAuthoritativeComplete={onLevelCompleted}
      />
    </div>
    </FacebookBannerLayout>
    </FacebookNativeSocialProvider>
    </HapticFeedbackProvider>
    </PlayerSettingsActionsProvider>
    </PlayerSaveRecoveryLayout>
    </GoogleAnalyticsConsent>
  );
}
