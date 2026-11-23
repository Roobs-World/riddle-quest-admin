import {lazy, useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {LiveRaceView} from "@riddle-quest/core/race";
import type {ProductSummary, PurchaseResult} from "@riddle-quest/hosted/hostTypes";
import type {RaceTo10GameProps} from "../play/race/RaceTo10Game.types";
import {SpinningWheelLoader} from "../play/SpinningWheelLoader";
import {PlayHostApp} from "../play/PlayHostApp";
import {getCurrentLocale, tr} from "../play/i18n";
import type {PlatformSession, PlayerData, PlayerDataUpdate} from "../platform/types";
import {FacebookPlatformBootstrap} from "./FacebookPlatformBootstrap";
import {authenticateFacebook} from "./authenticate";
import {requireFacebookInstant} from "./fbinstant";
import {captureBrowserException} from "../observability/browserErrorReporter";
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
import {FacebookNotificationPromptCoordinator} from "./FacebookNotificationPromptCoordinator";
import {createFacebookNotificationCapability} from "./FacebookNotificationCapability";
import {LocalAccountDeletionGate} from "../play/LocalAccountDeletionGate";
import {
  applyPlayerPreferences,
  clearBrowserPlayerState,
  subscribeToPlayerPreferenceChanges,
} from "../play/playerPreferences";
import {settleFacebookPause, settleFacebookPresenceResume} from "./settleFacebookPause";
import {reconcilePresenceOptIn} from "../presence/reconcilePresenceOptIn";
import {startOptionalPresence} from "../presence/startOptionalPresence";
import {createHostServices, getHostConfigurationWarning, resolveHostServicesMode} from "../play/services";
import {PlayerProjectionPersistence} from "../platform/PlayerProjectionPersistence";
import {usePlayerProjectionRecovery} from "../platform/usePlayerProjectionRecovery";
import {PlayerSaveRecoveryLayout} from "../play/PlayerSaveRecoveryLayout";
import {createHostedPlaySession} from "../play/HostedPlaySession";
import {installFacebookAnalytics} from "./analytics";
import {firebaseStartupOrigins, preconnectStartupOrigins} from "../platform/startupWarmup";

/** Native tournament presentation loads only when Facebook multiplayer opens. */
const FacebookRaceSurface = lazy(() => import("./FacebookRaceEntry").then(module => ({default: module.FacebookRaceEntry})));

/** Binds one stable Facebook-only result callback without changing shared platform behavior. */
function createFacebookRaceSurface(onLiveResult: NonNullable<RaceTo10GameProps["onLiveResult"]>) {
  return function FacebookScopedRaceSurface(props: RaceTo10GameProps) {
    return <FacebookRaceSurface {...props} onLiveResult={onLiveResult} />;
  };
}

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
      /** Stores player data. */
      playerData: PlayerData | null;
      /** Target-owned native sharing, absent when Meta or the server disallows it. */
      referralSharing?: import("../play/sharing/ReferralSharingCapability").ReferralSharingCapability;
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
  void import("../play/firebaseServices").catch(() => undefined);
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
  const [commercePresentation, setCommercePresentation] = useState<{
    products: ProductSummary[];
    purchase: (productId: string) => Promise<PurchaseResult>;
  }>();
  /** Provides player persistence ref behavior. */
  const playerPersistenceRef = useRef<PlayerProjectionPersistence | null>(null);
  /** Provides preferences ref behavior. */
  const preferencesRef = useRef<Awaited<ReturnType<PlatformSession["storage"]["readPreferences"]>>>({});
  /** Provides presence ref behavior. */
  const presenceRef = useRef<import("../presence/PlatformPresenceSession").PlatformPresenceSession | null>(null);
  /** Provides notification prompt ref behavior. */
  const notificationPromptRef = useRef<FacebookNotificationPromptCoordinator | null>(null);
  /** Provides deletion gate ref behavior. */
  const deletionGateRef = useRef(new LocalAccountDeletionGate());
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
    let unsubscribeCommerceResume: (() => void) | undefined;
    let commerceSession: FacebookCommerceSession | undefined;
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
        let removeInterstitialAds: boolean | undefined;
        /** Facebook-only continuation capability bound to the current authenticated session. */
        let attemptRecovery: import("../platform/types").AttemptRecoveryCapability | undefined;
        /** Provides tournaments behavior. */
        let tournaments = undefined;
        /** Provides notifications enabled behavior. */
        let notificationsEnabled = false;
        /** Meta-owned subscription capability, composed only after authenticated server gates. */
        let notifications = undefined;
        /** Provides referrals enabled behavior. */
        let referralsEnabled = false;
        /** Provides matchmaking enabled behavior. */
        let matchmakingEnabled = false;
        /** Provides presence capability enabled behavior. */
        let presenceCapabilityEnabled = false;
        /** Provides configuration loaded behavior. */
        let configurationLoaded = false;
        /** Provides notification lease api behavior. */
        let notificationLeaseApi:
          import("./FacebookNotificationPromptCoordinator").FacebookNotificationPromptLease | undefined;
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
            claim facebook notification permission prompt,
            accept facebook notification permission prompt,
          } behavior. */
          const {
            getFacebookClientConfiguration,
            listFacebookTournament,
            recordFacebookTournament,
            listFacebookContextBoard,
            recordFacebookContextRun,
            claimFacebookNotificationPermissionPrompt,
            acceptFacebookNotificationPermissionPrompt,
            grantFacebookRewardedContinue,
            grantFacebookPurchase,
          } = await import("./firebaseClient");
          /** Provides client configuration behavior. */
          const clientConfiguration = (await getFacebookClientConfiguration()).data;
          configurationLoaded = true;
          removeInterstitialAds = clientConfiguration.removeInterstitialAds;
          if (ageCategory === "13_plus" && clientConfiguration.commerceEnabled && facebookPaymentsAvailable(sdk)) {
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
            notifications = createFacebookNotificationCapability(sdk);
            notificationLeaseApi = {
              claim: async () => (await claimFacebookNotificationPermissionPrompt()).data,
              accept: acceptFacebookNotificationPermissionPrompt,
            };
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
              list: async (locale: import("@riddle-quest/core/race").RaceLocale) => {
                /** Validated official standings for the exact player locale and UTC window. */
                const board = (await listFacebookTournament({locale})).data;
                if (presentation) void presentation.projectBoard(board);
                return board;
              },
              record: async (runId: string, locale: import("@riddle-quest/core/race").RaceLocale) => {
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
        /** Provides restored preferences behavior. */
        const restoredPreferences = await session.storage.readPreferences();
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
                ...(notifications ? {notifications} : {}),
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
                ...(notifications ? {notifications} : {}),
                ...(tournaments ? {tournaments} : {}),
              },
            };
        /** Provides notification storage behavior. */
        const notificationStorage = {
          readPreferences: () => deletionGateRef.current.run(() => session.storage.readPreferences()),
          writePreferences: (value: import("../platform/types").PlatformPreferences) =>
            deletionGateRef.current.run(() => session.storage.writePreferences(value)),
          readPlayerData: () => deletionGateRef.current.run(() => session.storage.readPlayerData()),
          writePlayerData: (value: PlayerData) =>
            deletionGateRef.current.run(() => session.storage.writePlayerData(value)),
          clear: () => deletionGateRef.current.run(() => session.storage.clear()),
          flush: () => deletionGateRef.current.run(() => session.storage.flush()),
        };
        notificationPromptRef.current =
          notificationsEnabled && synchronizedSession.capabilities.notifications
            ? new FacebookNotificationPromptCoordinator(
                notificationStorage,
                synchronizedSession.capabilities.notifications,
                undefined,
                undefined,
                notificationLeaseApi,
              )
            : null;
        if (!active) return;
        setPresenceAvailable(presenceCapabilityEnabled);
        setPresenceEnabled(presenceCapabilityEnabled && preferences.presenceEnabled === true);
        if (presenceCapabilityEnabled) {
          /** Provides [{firebase presence transport}, {platform presence session}] behavior. */
          const [{FirebasePresenceTransport}, {PlatformPresenceSession}] = await Promise.all([
            import("../presence/FirebasePresenceTransport"),
            import("../presence/PlatformPresenceSession"),
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
          setStartup({status: "ready", session: synchronizedSession, playerData, referralSharing, launch});
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
      unsubscribePreferences?.();
      unsubscribeContext?.();
      void stopPresence?.();
      presenceRef.current = null;
      notificationPromptRef.current = null;
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
              const {setPresenceConsent} = await import("../firebase");
              await setPresenceConsent({enabled});
            },
          });
          setPresenceEnabled(next);
        });
      })
      .catch((error) => {
        if (deletionGateRef.current.isOpen()) {
          captureBrowserException(error, {component: "facebook_presence", operation: "toggle"});
        }
      });
  }, [presenceEnabled, startup]);

  /** Requests account deletion. */
  const requestAccountDeletion = useCallback(async () => {
    if (startup.status !== "ready") return;
    deletionGateRef.current.close();
    await presenceRef.current?.stop();
    await playerPersistenceRef.current?.closeAndFlush();
  }, [startup]);

  /** Completes account deletion. */
  const completeAccountDeletion = useCallback(async () => {
    if (startup.status !== "ready") return;
    await playerPersistenceRef.current?.clear();
    playerPersistenceRef.current = null;
    clearBrowserPlayerState();
    preferencesRef.current = {};
    setPresenceEnabled(false);
    setPresenceAvailable(false);
  }, [startup]);

  /** Sets presence state. */
  const setPresenceState = useCallback((state: import("../presence/PlatformPresenceSession").ActivePresenceState) => {
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

  /** Handles authoritative completion. */
  const handleAuthoritativeCompletion = useCallback(
    async (
      _input: {
        /** Stores riddle id. */
        riddleId: string; /** Stores game mode. */
        /** Stores game mode. */
        gameMode: import("@riddle-quest/hosted/hostTypes").WebGameMode;
      },
      result: import("@riddle-quest/hosted/hostTypes").CompletionResult,
    ) => {
      try {
        await notificationPromptRef.current?.afterAuthoritativeCompletion(result.isCorrect);
      } catch (error) {
        captureBrowserException(error, {
          component: "facebook_notifications",
          operation: "prompt_after_win",
        });
      }
    },
    [],
  );

  /** Handles authoritative race result. */
  const handleAuthoritativeRaceResult = useCallback(async (result: import("@riddle-quest/core/race").RaceOutcome) => {
    try {
      await notificationPromptRef.current?.afterAuthoritativeCompletion(result.result === "player_win");
    } catch (error) {
      captureBrowserException(error, {
        component: "facebook_notifications",
        operation: "prompt_after_race_win",
      });
    }
  }, []);

  /** Live snapshots reach the same leased, age/API-gated consent policy as solo wins. */
  const handleAuthoritativeLiveRaceResult = useCallback((view: LiveRaceView) => {
    if (view.phase !== "result" || !deletionGateRef.current.isOpen()) return;
    void notificationPromptRef.current?.afterAuthoritativeCompletion(view.result === "win").catch(error => {
      captureBrowserException(error, {component: "facebook_notifications", operation: "prompt_after_live_win"});
    });
  }, []);
  /** The component identity remains stable while the host profile and coins refresh. */
  const raceSurface = useMemo(() => createFacebookRaceSurface(handleAuthoritativeLiveRaceResult), [handleAuthoritativeLiveRaceResult]);

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
    <PlayerSaveRecoveryLayout recovery={saveRecovery}>
      <PlayHostApp
        raceSurface={raceSurface}
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
        onAuthoritativeComplete={handleAuthoritativeCompletion}
        onAuthoritativeRaceResult={handleAuthoritativeRaceResult}
      />
    </PlayerSaveRecoveryLayout>
  );
}
