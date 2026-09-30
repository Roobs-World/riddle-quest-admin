import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {SpinningWheelLoader} from "../play/SpinningWheelLoader";
import {PlayHostApp} from "../play/PlayHostApp";
import {getCurrentLocale, tr} from "../play/i18n";
import type {PlatformSession, PlayerData, PlayerDataUpdate} from "../platform/types";
import {FacebookPlatformBootstrap} from "./FacebookPlatformBootstrap";
import {authenticateFacebook} from "./authenticate";
import {requireFacebookInstant} from "./fbinstant";
import {captureBrowserException} from "../observability/browserErrorReporter";
import {bindFacebookEntryReferral} from "./referrals";
import {FacebookContextCoordinator} from "./contexts";
import {parseFacebookAgeCategory} from "./FacebookCapabilityPolicy";
import {createFacebookAdsCapability} from "./FacebookAdsCapability";
import {FacebookNotificationPromptCoordinator} from "./FacebookNotificationPromptCoordinator";
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
import {createHostedPlaySession} from "../play/HostedPlaySession";

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
    }
  | {
      /** Stores status. */
      status: "error";
    };

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

  useEffect(() => {
    /** Provides active behavior. */
    let active = true;
    /** Provides unsubscribe pause behavior. */
    let unsubscribePause: (() => void) | undefined;
    /** Provides unsubscribe resume behavior. */
    let unsubscribeResume: (() => void) | undefined;
    /** Provides unsubscribe preferences behavior. */
    let unsubscribePreferences: (() => void) | undefined;
    /** Stops presence. */
    let stopPresence: (() => Promise<void>) | undefined;
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
        /** Provides tournaments behavior. */
        let tournaments = undefined;
        /** Provides notifications enabled behavior. */
        let notificationsEnabled = false;
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
          } = await import("./firebaseClient");
          /** Provides client configuration behavior. */
          const clientConfiguration = (await getFacebookClientConfiguration()).data;
          configurationLoaded = true;
          notificationsEnabled = ageCategory === "13_plus" && clientConfiguration.notificationsEnabled;
          if (notificationsEnabled) {
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
              adFree: clientConfiguration.removeInterstitialAds,
            });
          }
          if (ageCategory === "13_plus" && clientConfiguration.tournamentsEnabled) {
            tournaments = {
              list: async (locale: import("@qwordly/core/race").RaceLocale) =>
                (await listFacebookTournament({locale})).data,
              record: async (runId: string, locale: import("@qwordly/core/race").RaceLocale) =>
                (await recordFacebookTournament({runId, locale})).data,
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
        /** Provides restored preferences behavior. */
        const restoredPreferences = await session.storage.readPreferences();
        if (!active) return;
        /** Provides preferences behavior. */
        const preferences = {...restoredPreferences, ...applyPlayerPreferences(restoredPreferences)};
        preferencesRef.current = preferences;
        unsubscribePreferences = subscribeToPlayerPreferenceChanges((change) => {
          if (!deletionGateRef.current.isOpen()) return;
          void deletionGateRef.current
            .run(async () => {
              /** Provides next behavior. */
              const next = await playerPersistenceRef.current?.updatePreferences(change);
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
            ? {
                list: async (locale: import("@qwordly/core/race").RaceLocale) => {
                  /** Provides current behavior. */
                  const current = await contextCoordinator.ensureCurrent();
                  if (current.status !== "success") throw new Error("facebook-context-board-unavailable");
                  return (await contextBoardApi!.list({contextId: current.value.contextId, locale})).data;
                },
                record: async (runId: string, locale: import("@qwordly/core/race").RaceLocale) => {
                  /** Provides current behavior. */
                  const current = await contextCoordinator.ensureCurrent();
                  if (current.status !== "success") throw new Error("facebook-context-board-unavailable");
                  return (await contextBoardApi!.record({contextId: current.value.contextId, locale, runId})).data;
                },
              }
            : undefined;
        /** Provides base capabilities behavior. */
        const baseCapabilities = {
          ...session.capabilities,
          ...(matchmakingEnabled ? {} : {nativeSocial: undefined}),
          ...(configurationLoaded ? {} : {overlay: undefined}),
        };
        /** Provides synchronized session behavior. */
        const synchronizedSession = contextCoordinator
          ? {
              ...session,
              capabilities: {
                ...baseCapabilities,
                nativeSocial: contextCoordinator,
                ...(ads ? {ads} : {}),
                ...(tournaments ? {tournaments} : {}),
                ...(contextBoard ? {contextBoard} : {}),
              },
            }
          : {
              ...session,
              capabilities: {
                ...baseCapabilities,
                ...(ads ? {ads} : {}),
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
        playerPersistenceRef.current = new PlayerProjectionPersistence(
          session.storage,
          playerData,
          preferencesRef.current,
        );
        unsubscribePause = session.capabilities.lifecycle?.onPause(() =>
          settleFacebookPause({
            flushStorage: () => session.storage.flush(),
            stopPresence,
            reportFailure: ({operation, error}) =>
              captureBrowserException(error, {
                component: "facebook_lifecycle",
                operation,
              }),
          }),
        );
        if (active) setStartup({status: "ready", session: synchronizedSession, playerData});
      } catch {
        if (active) setStartup({status: "error"});
      }
    })();
    return () => {
      active = false;
      unsubscribePause?.();
      unsubscribeResume?.();
      unsubscribePreferences?.();
      void stopPresence?.();
      presenceRef.current = null;
      notificationPromptRef.current = null;
    };
  }, []);

  /** Provides write player data behavior. */
  const writePlayerData = useCallback(
    async (update: PlayerDataUpdate) => {
      if (startup.status !== "ready" || !deletionGateRef.current.isOpen()) return;
      await deletionGateRef.current.run(async () => {
        /** Provides persistence behavior. */
        const persistence = playerPersistenceRef.current;
        if (!persistence) return;
        await persistence.update(update);
      });
    },
    [startup],
  );

  /** Provides toggle presence behavior. */
  const togglePresence = useCallback(() => {
    if (startup.status !== "ready" || !presenceRef.current || !deletionGateRef.current.isOpen()) return;
    /** Provides next behavior. */
    const next = !presenceEnabled;
    void deletionGateRef.current
      .run(async () => {
        /** Provides preferences behavior. */
        const preferences = {...preferencesRef.current, presenceEnabled: next};
        await playerPersistenceRef.current?.updatePreferences({presenceEnabled: next});
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
        preferencesRef.current = preferences;
        setPresenceEnabled(next);
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
        gameMode: import("../play/types").WebGameMode;
      },
      result: import("../play/types").CompletionResult,
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
  const handleAuthoritativeRaceResult = useCallback(async (result: import("@qwordly/core/race").RaceOutcome) => {
    try {
      await notificationPromptRef.current?.afterAuthoritativeCompletion(result.result === "player_win");
    } catch (error) {
      captureBrowserException(error, {
        component: "facebook_notifications",
        operation: "prompt_after_race_win",
      });
    }
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
    <PlayHostApp
      session={createHostedPlaySession({
        hostServices,
        hostConfigurationWarning,
        platformCapabilities: startup.session.capabilities,
        platformPlayerId: startup.session.playerId,
        initialPlayerData: startup.playerData,
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
  );
}
