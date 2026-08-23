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

/** Describes startup state. */
type StartupState =
  | {status: "loading"; progress: number}
  | {status: "ready"; session: PlatformSession; playerData: PlayerData | null}
  | {status: "error"};

/** Facebook-only application composed by the Facebook target entry. */
export function FacebookPlatformEntry() {
  const hostServicesMode = useMemo(() => resolveHostServicesMode(), []);
  const hostServices = useMemo(() => createHostServices(hostServicesMode), [hostServicesMode]);
  const hostConfigurationWarning = getHostConfigurationWarning(hostServicesMode);
  const [startup, setStartup] = useState<StartupState>({status: "loading", progress: 5});
  const [presenceEnabled, setPresenceEnabled] = useState(false);
  const [presenceAvailable, setPresenceAvailable] = useState(false);
  const playerDataRef = useRef<PlayerData | null>(null);
  const preferencesRef = useRef<Awaited<ReturnType<PlatformSession["storage"]["readPreferences"]>>>({});
  const presenceRef = useRef<import("../presence/PlatformPresenceSession").PlatformPresenceSession | null>(null);
  const notificationPromptRef = useRef<FacebookNotificationPromptCoordinator | null>(null);
  const deletionGateRef = useRef(new LocalAccountDeletionGate());

  useEffect(() => {
    let active = true;
    let unsubscribePause: (() => void) | undefined;
    let unsubscribeResume: (() => void) | undefined;
    let unsubscribePreferences: (() => void) | undefined;
    let stopPresence: (() => Promise<void>) | undefined;
    void (async () => {
      try {
        const ageCategory = parseFacebookAgeCategory(import.meta.env.VITE_FACEBOOK_AGE_CATEGORY);
        const result = await new FacebookPlatformBootstrap(
          undefined,
          ageCategory,
        ).initialize((progress) => {
          if (active) setStartup({status: "loading", progress});
        });
        if (result.status !== "success") {
          throw new Error(result.status === "cancelled" ? "facebook-startup-cancelled" : result.message);
        }
        const session = result.value;
        const sdk = requireFacebookInstant();
        const userId = await authenticateFacebook(sdk);
        let ads = undefined;
        let tournaments = undefined;
        let notificationsEnabled = false;
        let referralsEnabled = false;
        let matchmakingEnabled = false;
        let presenceCapabilityEnabled = false;
        let configurationLoaded = false;
        let notificationLeaseApi: import("./FacebookNotificationPromptCoordinator").FacebookNotificationPromptLease |
          undefined;
        let contextBoardApi: undefined | {
          list: typeof import("./firebaseClient").listFacebookContextBoard;
          record: typeof import("./firebaseClient").recordFacebookContextRun;
        };
        try {
          const {
            getFacebookClientConfiguration,
            listFacebookTournament,
            recordFacebookTournament,
            listFacebookContextBoard,
            recordFacebookContextRun,
            claimFacebookNotificationPermissionPrompt,
            acceptFacebookNotificationPermissionPrompt,
          } = await import("./firebaseClient");
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
            clientConfiguration.interstitialsEnabled &&
            sdk.getSupportedAPIs().includes("getInterstitialAdAsync")
          ) {
            ads = createFacebookAdsCapability({
              sdk,
              placementId: import.meta.env.VITE_FACEBOOK_INTERSTITIAL_PLACEMENT_ID || "",
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
        const restoredPreferences = await session.storage.readPreferences();
        if (!active) return;
        const preferences = {...restoredPreferences, ...applyPlayerPreferences(restoredPreferences)};
        preferencesRef.current = preferences;
        unsubscribePreferences = subscribeToPlayerPreferenceChanges((change) => {
          if (!deletionGateRef.current.isOpen()) return;
          void deletionGateRef.current.run(async () => {
            const next = {...preferencesRef.current, ...change};
            await session.storage.writePreferences(next);
            await session.storage.flush();
            preferencesRef.current = next;
          }).catch((error) => {
            if (deletionGateRef.current.isOpen()) {
              captureBrowserException(error, {component: "facebook_preferences", operation: "persist"});
            }
          });
        });
        const contextCoordinator = matchmakingEnabled && session.capabilities.nativeSocial
          ? new FacebookContextCoordinator(session.capabilities.nativeSocial, getCurrentLocale)
          : undefined;
        if (contextCoordinator) {
          const contextResult = await contextCoordinator.synchronizeCurrent();
          if (contextResult.status === "retryable-failure") {
            captureBrowserException(new Error(contextResult.message), {
              component: "facebook_context", operation: "initial_sync",
            });
          }
        }
        const contextBoard = contextCoordinator && contextBoardApi
          ? {
            list: async (locale: import("@qwordly/core/race").RaceLocale) => {
              const current = contextCoordinator.currentContext();
              if (current.status !== "success") throw new Error("facebook-context-board-unavailable");
              return (await contextBoardApi!.list({contextId: current.value.contextId, locale})).data;
            },
            record: async (runId: string, locale: import("@qwordly/core/race").RaceLocale) => {
              const current = contextCoordinator.currentContext();
              if (current.status !== "success") throw new Error("facebook-context-board-unavailable");
              return (await contextBoardApi!.record({contextId: current.value.contextId, locale, runId})).data;
            },
          }
          : undefined;
        const baseCapabilities = {
          ...session.capabilities,
          ...(matchmakingEnabled ? {} : {nativeSocial: undefined}),
          ...(configurationLoaded ? {} : {overlay: undefined}),
        };
        const synchronizedSession = contextCoordinator
          ? {...session, capabilities: {
            ...baseCapabilities,
            nativeSocial: contextCoordinator,
            ...(ads ? {ads} : {}),
            ...(tournaments ? {tournaments} : {}),
            ...(contextBoard ? {contextBoard} : {}),
          }}
          : {...session, capabilities: {
            ...baseCapabilities,
            ...(ads ? {ads} : {}),
            ...(tournaments ? {tournaments} : {}),
          }};
        const notificationStorage = {
          readPreferences: () => deletionGateRef.current.run(() => session.storage.readPreferences()),
          writePreferences: (value: import("../platform/types").PlatformPreferences) =>
            deletionGateRef.current.run(() => session.storage.writePreferences(value)),
          readPlayerData: () => deletionGateRef.current.run(() => session.storage.readPlayerData()),
          writePlayerData: (value: PlayerData) => deletionGateRef.current.run(() => session.storage.writePlayerData(value)),
          clear: () => deletionGateRef.current.run(() => session.storage.clear()),
          flush: () => deletionGateRef.current.run(() => session.storage.flush()),
        };
        notificationPromptRef.current = notificationsEnabled && synchronizedSession.capabilities.notifications
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
          const [{FirebasePresenceTransport}, {PlatformPresenceSession}] = await Promise.all([
            import("../presence/FirebasePresenceTransport"),
            import("../presence/PlatformPresenceSession"),
          ]);
          const presence = new PlatformPresenceSession(
            new FirebasePresenceTransport(userId),
            {sessionId: crypto.randomUUID(), platform: "facebook"},
          );
          presenceRef.current = presence;
          await startOptionalPresence({
            enabled: preferences.presenceEnabled === true,
            canStart: document.visibilityState !== "hidden",
            start: () => presence.start(true),
            reportFailure: (error) => captureBrowserException(error, {
              component: "facebook_presence",
              operation: "initialize",
            }),
          });
          stopPresence = () => presence.stop();
          unsubscribeResume = session.capabilities.lifecycle?.onResume?.(() => settleFacebookPresenceResume({
            enabled: preferencesRef.current.presenceEnabled === true,
            startPresence: () => presence.start(true),
            reportFailure: (error) => captureBrowserException(error, {
              component: "facebook_lifecycle",
              operation: "resume_presence",
            }),
          }));
        }
        const playerData = await session.storage.readPlayerData();
        playerDataRef.current = playerData;
        unsubscribePause = session.capabilities.lifecycle?.onPause(() => settleFacebookPause({
          flushStorage: () => session.storage.flush(),
          stopPresence,
          reportFailure: ({operation, error}) => captureBrowserException(error, {
            component: "facebook_lifecycle",
            operation,
          }),
        }));
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

  const writePlayerData = useCallback(async (update: PlayerDataUpdate) => {
    if (startup.status !== "ready" || !deletionGateRef.current.isOpen()) return;
    await deletionGateRef.current.run(async () => {
      const next: PlayerData = {
        ...(playerDataRef.current ?? {}),
        ...update,
        schemaVersion: 1,
        updatedAt: Date.now(),
      };
      playerDataRef.current = next;
      await startup.session.storage.writePlayerData(next);
      await startup.session.storage.flush();
    });
  }, [startup]);

  const togglePresence = useCallback(() => {
    if (startup.status !== "ready" || !presenceRef.current || !deletionGateRef.current.isOpen()) return;
    const next = !presenceEnabled;
    void deletionGateRef.current.run(async () => {
      const preferences = {...preferencesRef.current, presenceEnabled: next};
      await startup.session.storage.writePreferences(preferences);
      await startup.session.storage.flush();
      const presence = presenceRef.current;
      await reconcilePresenceOptIn({
        enabled: next,
        canStart: true,
        start: async () => { await presence?.start(true); },
        stop: async () => { await presence?.stop(); },
        setConsent: async (enabled) => {
          const {setPresenceConsent} = await import("../firebase");
          await setPresenceConsent({enabled});
        },
      });
      preferencesRef.current = preferences;
      setPresenceEnabled(next);
    }).catch((error) => {
      if (deletionGateRef.current.isOpen()) {
        captureBrowserException(error, {component: "facebook_presence", operation: "toggle"});
      }
    });
  }, [presenceEnabled, startup]);

  const requestAccountDeletion = useCallback(async () => {
    if (startup.status !== "ready") return;
    deletionGateRef.current.close();
    await presenceRef.current?.stop();
    await startup.session.storage.flush();
  }, [startup]);

  const completeAccountDeletion = useCallback(async () => {
    if (startup.status !== "ready") return;
    await startup.session.storage.clear();
    clearBrowserPlayerState();
    playerDataRef.current = null;
    preferencesRef.current = {};
    setPresenceEnabled(false);
    setPresenceAvailable(false);
  }, [startup]);

  const setPresenceState = useCallback((state: import("../presence/PlatformPresenceSession").ActivePresenceState) => {
    void presenceRef.current?.setState(state).catch((error) => {
      captureBrowserException(error, {component: "facebook_presence", operation: "state"});
    });
  }, []);

  const showResultInterstitial = useCallback(async () => {
    if (startup.status !== "ready") return;
    const result = await startup.session.capabilities.ads?.showInterstitial("result");
    if (result?.status === "retryable-failure" || result?.status === "terminal-failure") {
      captureBrowserException(new Error(result.message), {
        component: "facebook_ads",
        operation: "show_result_interstitial",
      });
    }
  }, [startup]);

  const handleAuthoritativeCompletion = useCallback(async (
    _input: {riddleId: string; gameMode: import("../play/types").WebGameMode},
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
  }, []);

  const handleAuthoritativeRaceResult = useCallback(async (
    result: import("@qwordly/core/race").RaceOutcome,
  ) => {
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
        <SpinningWheelLoader message={tr("WebPortal.STARTUP_CONNECTING")} progress={startup.progress} />
      </main>
    );
  }
  return (
    <PlayHostApp
      hostServices={hostServices}
      hostConfigurationWarning={hostConfigurationWarning}
      platformCapabilities={startup.session.capabilities}
      platformPlayerId={startup.session.playerId}
      initialPlayerData={startup.playerData}
      onPlayerDataChange={(update) => void writePlayerData(update)}
      accountDeletionServiceGate={deletionGateRef.current}
      onAccountDeletionRequested={requestAccountDeletion}
      onAccountDeleted={completeAccountDeletion}
      presenceEnabled={presenceEnabled}
      onTogglePresence={presenceAvailable ? togglePresence : undefined}
      raceLocalePolicy="all"
      onPresenceStateChange={setPresenceState}
      onResultScreen={showResultInterstitial}
      onAuthoritativeComplete={handleAuthoritativeCompletion}
      onAuthoritativeRaceResult={handleAuthoritativeRaceResult}
    />
  );
}
