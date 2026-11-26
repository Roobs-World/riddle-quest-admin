import {Suspense, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ComponentType} from "react";
import type {GameToHostMessage} from "../../platform/bridge/messages";
import {BRIDGE_PROTOCOL_VERSION} from "../../platform/bridge/constants";
import musicUrl from "../../../assets/audio-web/music.webm";
import {isFacebookWebTarget} from "../../platform/browser/webTargetEnvironment";
import {canDraftWhileConfirming, canEditCurrentGuess, createInitialGameSession, gameSessionReducer, isBlockingGameModal} from "../session/gameSession";
import {tr} from "../../localization/browser/i18n";
import {createRequestId} from "../session/requestIds";
import {dispatchLocalBridge, GAME_TO_HOST_EVENT} from "../../platform/bridge/browser/localBridge";
import {ShopSubscriptionContext} from "../../commerce/browser/ShopSubscriptionContext";
import {useProviderProfile} from "../../accounts/components/ProviderProfileContext";
import {GuidanceOverlay} from "../../onboarding/components/GuidanceOverlay";
import {SpinningWheel, SpinningWheelLoader} from "../../app/components/feedback/SpinningWheelLoader";
import type {
  ContextBoardCapability,
  MatchmakingCapability,
  NativeSocialCapability,
  OverlayCapability,
  SavedGame,
  TournamentCapability,
} from "../../platform/contracts/capabilities";
import {
  ForwardIcon,
  GameHeader,
  GuessBoard,
  HintIcon,
  Keyboard,
  MultiplayerIcon,
  ProfileIcon,
  SettingsIcon,
} from "./GameFrameControls";
import {useGameMessageRouter} from "../../platform/bridge/browser/useGameMessageRouter";
import {useOnlineStatus} from "../../platform/browser/useOnlineStatus";
import {useGameAudio} from "../hooks/browser/useGameAudio";
import {useAnswerKeyboard} from "../hooks/browser/useAnswerKeyboard";
import {useCompletionDelivery} from "../hooks/browser/useCompletionDelivery";
import {useGameMessageListener, useGameReadyReporter} from "../../platform/bridge/browser/useGameBridgeLifecycle";
import {useGameOperations} from "../hooks/browser/useGameOperations";
import {useGameSessionPersistence} from "../hooks/browser/useGameSessionPersistence";
import {useGameSurfaces} from "../../app/hooks/useGameSurfaces";
import {useOfflineDialog} from "../../app/hooks/useOfflineDialog";
import {useReferralReward} from "../../progression/hooks/useReferralReward";
import {useViewportFit} from "../../app/layout/hooks/useViewportFit";
import {getMobileCapabilities, shouldLoadDecorativeWebGl} from "../../app/performance/mobileCapabilities";
import type {ListRaceCategoriesResponse, RaceLocale} from "../../races/contracts/index";
import type {ActivePresenceState} from "../../presence/PlatformPresenceSession";
import {useGameSurfaceCoordination} from "../../app/hooks/useGameSurfaceCoordination";
import {useClassicQuestionPreparation} from "../hooks/browser/useClassicQuestionPreparation";
import {useAttemptRecovery} from "../hooks/browser/useAttemptRecovery";
import type {RaceTo10GameProps} from "../../races/components/recorded/RaceTo10Game.types.ts";
import type {AttemptRecoveryCapability} from "../../platform/contracts/capabilities";

import {DecorativeSolarSystem} from "../../scenery/solar/components/DecorativeSolarSystem";
import {GameSurfaceBoundary, GameSurfaceRecovery} from "../../app/components/recovery/GameSurfaceRecovery";
import {completionPresentationKey, getVisibleGameModal, isCompletionAdvancePending} from "../session/completion/completionPresentation";
import {isPlayerReducedMotionEnabled, subscribeToPlayerReducedMotion} from "../../settings/browser/playerPreferences";

/** Provides game frame app behavior. */
export function GameFrameApp({
  raceSurface,
  localBridge = false,
  economyAvailable = true,
  prepareClassicQuestions = false,
  raceOwnerId,
  onLiveRaceBalance,
  interactionBlocked = false,
  startupError,
  restoredGame,
  onSaveGame,
  registrationName,
  registrationInviterName,
  initialRaceChallengeId,
  initialRaceInbox = false,
  initialRaceLobby = false,
  initialRaceTournamentLocale,
  raceFeatureEnabled = false,
  prefetchedRaceCategories = [],
  nativeSocial,
  matchmaking,
  playerOverlay,
  platformPlayerId,
  tournaments,
  contextBoard,
  attemptRecovery,
  raceLocalePolicy = "english-only",
  onPresenceStateChange,
}: {
  /** Target-owned multiplayer presentation; provider modules stay outside shared imports. */
  raceSurface?: ComponentType<RaceTo10GameProps>;
  /** Stores local bridge. */
  localBridge?: boolean;
  /** Presentation exposes paid actions only when the host has an economy authority. */
  economyAvailable?: boolean;
  /** Hosted authorities may silently prepare the successor during Classic victory. */
  prepareClassicQuestions?: boolean;
  /** Authenticated game account used to isolate race resume state. */
  raceOwnerId?: string;
  /** Applies a transport-confirmed terminal balance to the owning host profile. */
  onLiveRaceBalance?: (coins: number, ownerId: string) => void;
  /** Stores interaction blocked. */
  interactionBlocked?: boolean;
  /** Failed initial content load, shown with a usable Settings recovery control. */
  startupError?: string;
  /** Stores restored game. */
  restoredGame?: SavedGame | null;
  /** Stores on save game. */
  onSaveGame?: (game: SavedGame | null) => void;
  /** Stores registration name. */
  registrationName?: string;
  /** Stores registration inviter name. */
  registrationInviterName?: string;
  /** Stores initial race challenge id. */
  initialRaceChallengeId?: string;
  /** Stores initial race inbox. */
  initialRaceInbox?: boolean;
  /** Opens the multiplayer lobby for an incoming platform invitation. */
  initialRaceLobby?: boolean;
  /** Incoming native tournament language; never changes the selected content locale. */
  initialRaceTournamentLocale?: RaceLocale;
  /** Stores race feature enabled. */
  raceFeatureEnabled?: boolean;
  /** Stores prefetched race categories. */
  prefetchedRaceCategories?: ListRaceCategoriesResponse["categories"];
  /** Stores native social. */
  nativeSocial?: NativeSocialCapability;
  /** Stores matchmaking. */
  matchmaking?: MatchmakingCapability;
  /** Stores player overlay. */
  playerOverlay?: OverlayCapability;
  /** Stores platform player id. */
  platformPlayerId?: string;
  /** Stores tournaments. */
  tournaments?: TournamentCapability;
  /** Stores context board. */
  contextBoard?: ContextBoardCapability;
  /** Optional target-owned continuation; never supplied to non-Facebook builds. */
  attemptRecovery?: AttemptRecoveryCapability;
  /** Stores race locale policy. */
  raceLocalePolicy?: "english-only" | "all";
  /** Stores on presence state change. */
  onPresenceStateChange?: (state: ActivePresenceState) => void;
} = {}) {
  /** Provides [state, dispatch] behavior. */
  const [state, dispatch] = useReducer(gameSessionReducer, undefined, createInitialGameSession);
  /** Presentation waits for the receipt while reducer ownership still protects the solved round. */
  const visibleModal = getVisibleGameModal(state);
  const victoryPending = state.modal === "victory" && visibleModal === null;
  const providerProfile = useProviderProfile();
  /** Keeps catalog recovery reachable when the provider read failed before any offers loaded. */
  const shopCatalog = useContext(ShopSubscriptionContext);
  /** Existing offers or a retryable catalog error keep the shop entry available. */
  const commerceAvailable = state.products.length > 0 || Boolean(shopCatalog?.catalogError);
  /** Terminal receipts belong to the exact account generation that opened the race. */
  const raceAccount = useMemo(() => ({ownerId: raceOwnerId, generation: state.user?.accountGeneration}), [raceOwnerId, state.user?.accountGeneration]);
  /** Retired race callbacks cannot change the replacement account's display. */
  const currentRaceAccount = useRef(raceAccount);
  currentRaceAccount.current = raceAccount;
  /** Keep the server-confirmed balance visible while the independent profile refresh is pending. */
  const acceptLiveRaceBalance: NonNullable<RaceTo10GameProps["onLiveResult"]> = (view) => {
    if (currentRaceAccount.current !== raceAccount || !raceOwnerId || raceOwnerId !== state.user?.uid ||
      view.phase !== "result" || typeof view.newCoins !== "number" || !Number.isInteger(view.newCoins) || view.newCoins < 0) return;
    onLiveRaceBalance?.(view.newCoins, raceOwnerId);
    dispatch({type: "coinsUpdated", newCoins: view.newCoins});
  };
  /** Provides {shell ref, content ref} behavior. */
  const {shellRef, contentRef} = useViewportFit();
  /** Provides {music ref, play feedback} behavior. */
  const {musicRef, playFeedback} = useGameAudio(state);
  /** Provides online behavior. */
  const online = useOnlineStatus();
  /** Provides [solar ready, set solar ready] behavior. */
  const [solarReady, setSolarReady] = useState(false);
  /** Accessibility choices update the optional scene without waiting for another gameplay event. */
  const reducedMotion = useSyncExternalStore(subscribeToPlayerReducedMotion, isPlayerReducedMotionEnabled, () => false);
  /** Provides [animated coin balance, set animated coin balance] behavior. */
  const [animatedCoinBalance, setAnimatedCoinBalance] = useState<number | null>(null);
  /** Overlay lifecycle, multiplayer eligibility, analytics, and presence coordination. */
  const {raceLocale, raceEnabled, raceOpen, setRaceOpen, raceChallengeId, raceInbox, raceTournamentLocale, guidanceActive, setGuidanceActive} =
    useGameSurfaceCoordination({
      session: {...state, modal: visibleModal},
      raceFeatureEnabled,
      raceLocalePolicy,
      initialRaceChallengeId,
      initialRaceInbox,
      initialRaceLobby,
      initialRaceTournamentLocale: tournaments ? initialRaceTournamentLocale : undefined,
      onPresenceStateChange,
    });
  /** Provides offline dialog ref behavior. */
  const offlineDialogRef = useRef<HTMLDivElement | null>(null);
  /** Provides state ref behavior. */
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Current target continuation hook supplies modal pending state and its guarded action. */
  const recovery = useAttemptRecovery({capability: isFacebookWebTarget ? attemptRecovery : undefined, state, dispatch});

  useOfflineDialog(online, offlineDialogRef);

  /** Provides {game modal view, race to10 game} behavior. */
  const {GameModalView, RaceTo10Game: SharedRaceTo10Game} = useGameSurfaces(raceEnabled && raceSurface === undefined);
  /** Supplied by the target entry rather than imported across platform boundaries. */
  const RaceTo10Game = raceSurface ?? SharedRaceTo10Game;
  /** Exact account visit owning interactive surface retirement. */
  const surfaceOwner = JSON.stringify([state.user?.uid ?? null, state.user?.accountGeneration ?? null]);
  /** Failed modal code must not leave an acknowledged outcome without its Next action. */
  const [failedModalOwner, setFailedModalOwner] = useState<string | null>(null);
  /** Terminal recovery belongs only to the visit whose modal code failed. */
  const terminalSurfaceRecovery = failedModalOwner === surfaceOwner && state.lastOutcome?.kind === "win";
  useEffect(() => {
    if (state.modal === null) setAnimatedCoinBalance(null);
  }, [state.modal]);

  /** Provides post to host behavior. */
  const postToHost = useCallback(
    (message: GameToHostMessage) => {
      // Facebook's host communication belongs to FBInstant. Its game shell uses
      // the local bridge, so remove the iframe fallback from that artifact.
      if (isFacebookWebTarget || localBridge || window.parent === window) {
        dispatchLocalBridge(GAME_TO_HOST_EVENT, {...message, sentAt: Date.now()});
        return;
      }
      window.parent.postMessage({...message, sentAt: Date.now()}, window.location.origin);
    },
    [localBridge],
  );

  useClassicQuestionPreparation({enabled: prepareClassicQuestions, state, postToHost});

  /** Sends ready. */
  const sendReady = useCallback(() => {
    postToHost({
      type: "game:ready",
      requestId: createRequestId("ready"),
      payload: {
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
        surface: "html5",
      },
    });
  }, [postToHost]);

  /** Provides {
    can submit,
    submit guess,
    request riddle,
    request hint,
    request continue,
    request skip,
    request purchase,
    request leaderboard,
    update username,
    update avatar,
    delete account,
  } behavior. */
  const {
    inputReady,
    waitingForSkippedRiddle,
    coinActionsReady,
    canSubmit,
    submitPending,
    submitGuess,
    handleQueuedGuessResult,
    acceptRiddleResult,
    requestRiddle,
    requestHint,
    requestContinue,
    requestSkip,
    requestPurchase,
    requestLeaderboard,
    updateUsername,
    updateAvatar,
    deleteAccount,
  } = useGameOperations({state, stateRef, restoredGame, dispatch, postToHost, playFeedback});

  useEffect(() => {
    if (!state.initialized || solarReady || reducedMotion || raceOpen || state.paused ||
      !shouldLoadDecorativeWebGl(getMobileCapabilities())) return;
    /** Canceled native idle and fallback timer callbacks cannot start a retired scene load. */
    let active = true;
    /** Rechecks synchronous preference writes before React has committed their subscription update. */
    const loadScene = () => {
      if (active && !isPlayerReducedMotionEnabled()) setSolarReady(true);
    };
    /** Provides idle window behavior. */
    const idleWindow = window as Window & {
      /** Stores request idle callback. */
      requestIdleCallback?: (
        callback: () => void,
        options?: {
          /** Stores timeout. */
          timeout: number;
        },
      ) => number;
      /** Stores cancel idle callback. */
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      /** Provides handle behavior. */
      const handle = idleWindow.requestIdleCallback(loadScene, {timeout: 5_000});
      return () => { active = false; idleWindow.cancelIdleCallback?.(handle); };
    }
    /** Provides timer behavior. */
    const timer = window.setTimeout(loadScene, 2_500);
    return () => { active = false; window.clearTimeout(timer); };
  }, [state.initialized, solarReady, reducedMotion, raceOpen, state.paused]);

  useGameReadyReporter({initialized: state.initialized, sendReady, postToHost});

  /** Unread completion receipts remain owned after the visible question advances. */
  const retainedCompletionOutcomes = useMemo(() => state.completionMilestones.map(entry => entry.outcome), [state.completionMilestones]);
  /** Handles completion result. */
  const handleCompletionResult = useCompletionDelivery({
    ownerKey: state.user ? JSON.stringify([state.user.uid, state.user.accountGeneration ?? null]) : undefined,
    outcome: state.lastOutcome,
    retainedOutcomes: retainedCompletionOutcomes,
    dispatch,
    postToHost,
  });

  /** Provides router behavior. */
  const router = useGameMessageRouter({
    dispatch,
    stateRef,
    postToHost,
    requestRiddle,
    onCompletionResult: handleCompletionResult,
    onGuessResult: handleQueuedGuessResult,
    acceptRiddleResult,
  });

  useReferralReward(stateRef, dispatch, state.initialized, state.riddle?.riddleId);

  useGameMessageListener({router, postToHost});

  useGameSessionPersistence({state, stateRef, restoredGame, dispatch, onSaveGame});

  /** Hosted answer edits wait for the synchronous journal; utility navigation stays available. */
  const answerInputReady = !onSaveGame || inputReady;

  /** Provides type keyboard letter behavior. */
  const typeKeyboardLetter = useCallback(
    (letter: string) => {
      playFeedback("key");
      dispatch({type: "typeLetter", letter});
    },
    [playFeedback],
  );
  /** Deletes keyboard letter. */
  const deleteKeyboardLetter = useCallback(() => {
    playFeedback("delete");
    dispatch({type: "backspace"});
  }, [playFeedback]);
  useAnswerKeyboard({
    locale: state.riddle?.evaluation?.locale ?? state.locale,
    active: answerInputReady && online && !interactionBlocked && canEditCurrentGuess(state) && !guidanceActive && !raceOpen,
    onLetter: typeKeyboardLetter,
    onBackspace: deleteKeyboardLetter,
    onSubmit: submitGuess,
  });

  return (
    <main
      ref={shellRef}
      className={state.paused ? "game-app paused" : "game-app"}
      inert={interactionBlocked && online !== false ? true : undefined}
      data-analytics-screen={raceOpen ? "multiplayer" : visibleModal ? `modal_${visibleModal}` : `game_${state.gameMode}`}
    >
      {solarReady && <DecorativeSolarSystem enabled={!reducedMotion} paused={state.paused || raceOpen} />}
      <audio ref={musicRef} loop preload="none" aria-hidden="true">
        <source src={musicUrl} type='audio/webm; codecs="opus"' />
      </audio>
      <div
        ref={contentRef}
        className="game-content"
        inert={isBlockingGameModal(state.modal) || terminalSurfaceRecovery || guidanceActive || raceOpen || !online ? true : undefined}
        aria-hidden={isBlockingGameModal(state.modal) || terminalSurfaceRecovery || guidanceActive || raceOpen || !online ? true : undefined}
      >
        <GameHeader
          state={state}
          displayedCoins={animatedCoinBalance ?? undefined}
          onOpenShop={() => dispatch({type: "openModal", modal: "shop"})}
          onToggleMute={() => dispatch({type: "toggleMute"})}
          commerceAvailable={commerceAvailable}
        />

        {!state.riddle || waitingForSkippedRiddle ? (
          startupError || waitingForSkippedRiddle ? (
            <section className="game-loading">
              {(startupError || state.notice) && <p role="status">{startupError ?? (
                state.notice!.startsWith("WebPortal.") || state.notice!.startsWith("ErrorMessages.")
                  ? tr(state.notice!) : state.notice
              )}</p>}
              <button onClick={() => dispatch({type: "openModal", modal: "settings"})}>
                {tr("Navigation.SETTINGS_BUTTON")}
              </button>
            </section>
          ) : <section className="game-loading" aria-hidden="true" />
        ) : (
          <>
            <section className="riddle-surface">
              <div className="riddle-card">
                <h1>{state.riddle.text}</h1>
              </div>
              <GuessBoard state={state} dispatch={dispatch} disabled={!answerInputReady} />
            </section>

            <Keyboard state={state} dispatch={dispatch} playFeedback={playFeedback} disabled={!answerInputReady} />

            <section className="game-input-actions" aria-label={tr("Navigation.GAME")}>
              {economyAvailable && <button data-tooltip="gameHint" disabled={state.guessPending && !canDraftWhileConfirming(state)} onClick={() => dispatch({type: "openModal", modal: "hint"})}>
                <HintIcon />
                {tr("Navigation.HINT_BUTTON")}
              </button>}
              <button data-tooltip="submitAnswer" className="submit-action" onClick={submitGuess}
                aria-busy={submitPending || undefined} disabled={!answerInputReady || !canSubmit}>
                {tr(submitPending ? "Accessibility.LOADING" : "GameScreenAlerts.SUBMIT_BUTTON")}
              </button>
              {(economyAvailable || state.gameMode === "challenge") && (
                <button data-tooltip="gameSkip"
                  disabled={state.guessPending && (state.gameMode === "challenge" || !canDraftWhileConfirming(state))}
                  onClick={() => dispatch({type: "openModal", modal: "skip"})}>
                  <ForwardIcon />
                  {tr("GameScreenAlerts.SKIP_BUTTON")}
                </button>
              )}
            </section>

            {state.notice && (
              <div className="game-notice" role="status" aria-live="polite">
                {state.notice.startsWith("WebPortal.") || state.notice.startsWith("ErrorMessages.")
                  ? tr(state.notice)
                  : state.notice}
              </div>
            )}

            <nav className="game-bottom-navigation" aria-label={tr("Navigation.GAME")}>
              <button
                onClick={() => dispatch({type: "openModal", modal: "settings"})}
                aria-label={tr("Navigation.SETTINGS_BUTTON")}
              >
                <SettingsIcon />
              </button>
              {raceEnabled && (
                <button
                  className="multiplayer-navigation-action"
                  data-tooltip="gameMultiplayer"
                  onClick={() => setRaceOpen(true)}
                  aria-label={tr("RaceTo10.MULTIPLAYER_BUTTON")}
                >
                  <MultiplayerIcon />
                  <span>{tr("RaceTo10.MULTIPLAYER_BUTTON")}</span>
                </button>
              )}
              <button
                data-tooltip="achievementEarned"
                onClick={() => dispatch({type: "openModal", modal: "profile"})}
                aria-label={tr("Navigation.PROFILE_BUTTON")}
              >
                <ProfileIcon />
              </button>
            </nav>
          </>
        )}

        {state.paused && <div className="pause-banner">{tr("WebPortal.PAUSED")}</div>}
      </div>
      <div className="game-completion-status" role="status">
        {victoryPending ? tr("Accessibility.LOADING") : ""}
      </div>
      <div className="game-overlay-surfaces" inert={!online ? true : undefined}>
        <GameSurfaceBoundary key={`modal-${surfaceOwner}`} surface="modal" visible={Boolean((visibleModal || terminalSurfaceRecovery || state.completionMilestones.some(entry => entry.confirmed)) && !raceOpen)}
          onUnavailable={() => setFailedModalOwner(surfaceOwner)}
          recovery={<GameSurfaceRecovery
            onClose={() => {if (!recovery.isPending() && !stateRef.current.pendingCoinSpend) dispatch(stateRef.current.modal === "continue" ? {type: "declineContinue"} : {type: "closeModal"});}}
            closeBlocked={state.lastOutcome?.kind === "win" || (state.modal === "continue" && (state.guessPending || recovery.pending || Boolean(state.pendingCoinSpend)))}
            onNext={state.lastOutcome?.kind === "win" ? () => {
              /** Explicit Next releases the normal victory-load guard before asking authority. */
              const current = stateRef.current;
              if (!current.lastOutcome || current.guessPending || current.pendingCoinSpend || recovery.isPending() ||
                isCompletionAdvancePending(current)) return;
              dispatch({type: "closeModal"});
              if (current.lastOutcome.kind === "win") window.dispatchEvent(new CustomEvent("riddle-quest:victory-dismissed", {
                detail: {outcomeKey: completionPresentationKey(current.lastOutcome)},
              }));
              requestRiddle();
            } : undefined}
            nextBlocked={state.guessPending || isCompletionAdvancePending(state)}
            continuation={state.modal === "continue" ? {
              economyAvailable,
              onDecline: () => {if (!recovery.isPending() && !stateRef.current.guessPending && !stateRef.current.pendingCoinSpend) dispatch({type: "declineContinue"});},
              balance: state.profile?.coins ?? 0,
              onContinue: (amount) => {if (!recovery.isPending()) requestContinue(amount);},
              onRecoverAttempt: isFacebookWebTarget && attemptRecovery ? recovery.request : undefined,
              pending: recovery.pending || !coinActionsReady,
              recoveryPending: state.guessPending,
              onSkip: () => {if (!recovery.isPending()) requestSkip();},
              onOpenModal: (modal) => dispatch({type: "openModal", modal}),
              commerceAvailable: false,
            } : undefined}
            coinAction={state.modal === "hint" || state.modal === "skip" ? {
              kind: state.modal,
              gameMode: state.gameMode,
              balance: state.profile?.coins ?? 0,
              pending: recovery.pending || !coinActionsReady || (state.modal === "hint" && Boolean(state.engineSnapshot?.gameOver)),
              onClose: () => dispatch({type: "closeModal"}),
              onRequestAction: () => {if (!recovery.isPending()) state.modal === "hint" ? requestHint() : requestSkip();},
              onOpenModal: (modal) => dispatch({type: "openModal", modal}),
              commerceAvailable: false,
            } : undefined}
          />}
        >
          <Suspense fallback={<SpinningWheelLoader overlay className="game-modal-loading" />}>
            <GameModalView
              interactionBlocked={interactionBlocked || !online}
              state={state}
              onCoinBalancePreview={setAnimatedCoinBalance}
              onCompletionMilestonesPresented={outcomeKey => dispatch({type: "completionMilestonesPresented", outcomeKey})}
              onClose={() => {if (!recovery.isPending()) dispatch(state.modal === "continue" ? {type: "declineContinue"} : {type: "closeModal"});}}
              onContinue={(amount) => {if (!recovery.isPending()) requestContinue(amount);}}
              onRecoverAttempt={isFacebookWebTarget && attemptRecovery ? recovery.request : undefined}
              continuationPending={recovery.pending || !coinActionsReady}
              onPurchase={requestPurchase}
              onNext={requestRiddle}
              onOpenModal={(modal) => dispatch({type: "openModal", modal})}
              onToggleMute={() => dispatch({type: "toggleMute"})}
              commerceAvailable={commerceAvailable}
              economyAvailable={economyAvailable}
              onRequestHint={requestHint}
              onRequestSkip={() => {if (!recovery.isPending()) requestSkip();}}
              onRequestLeaderboard={requestLeaderboard}
              onUpdateUsername={updateUsername}
              onUpdateAvatar={updateAvatar}
              onDeleteAccount={deleteAccount}
            />
          </Suspense>
        </GameSurfaceBoundary>
        <GuidanceOverlay
          state={state}
          economyAvailable={economyAvailable}
          commerceAvailable={commerceAvailable}
          multiplayerAvailable={raceEnabled}
          modal={state.modal}
          suspended={raceOpen || (failedModalOwner === surfaceOwner && Boolean(state.modal || terminalSurfaceRecovery))}
          onActiveChange={setGuidanceActive}
          registrationName={registrationName}
          registrationInviterName={registrationInviterName}
          interactionBlocked={interactionBlocked || !online}
        />
        <GameSurfaceBoundary key={`multiplayer-${surfaceOwner}`} surface="multiplayer" visible={raceOpen && raceEnabled}
          recovery={<GameSurfaceRecovery onClose={() => setRaceOpen(false)} />}
        >
          <Suspense fallback={<SpinningWheel />}>
            <RaceTo10Game
              key={raceOwnerId}
              ownerId={raceOwnerId}
              localPlayer={{
                displayName: state.profile?.username ?? providerProfile?.username ?? state.user?.displayName ?? tr("Profile.GUEST_USERNAME"),
                avatarUrl: providerProfile ? providerProfile.avatarUrl : state.profile?.avatarUrl ?? state.user?.photoURL ?? null,
                level: state.profile?.level ?? 1,
                bot: false,
              }}
              locale={raceLocale ?? "en"}
              challengeId={raceChallengeId}
              openInbox={raceInbox}
              tournamentLocale={tournaments ? raceTournamentLocale : undefined}
              initialCategories={prefetchedRaceCategories}
              coins={state.profile?.coins ?? 0}
              postToHost={postToHost}
              onLiveResult={acceptLiveRaceBalance}
              onClose={() => setRaceOpen(false)}
              nativeSocial={nativeSocial}
              matchmaking={matchmaking}
              playerOverlay={playerOverlay}
              platformPlayerId={platformPlayerId}
              tournaments={tournaments}
              contextBoard={contextBoard}
            />
          </Suspense>
        </GameSurfaceBoundary>
      </div>
      {!online && (
        <div
          ref={offlineDialogRef}
          className="offline-backdrop"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="offline-dialog-title"
          aria-describedby="offline-dialog-message"
          tabIndex={-1}
        >
          <SpinningWheel />
          <div className="offline-card">
            <strong id="offline-dialog-title">{tr("CommonAlerts.OFFLINE_TITLE")}</strong>
            <p id="offline-dialog-message">{tr("CommonAlerts.OFFLINE_MESSAGE")}</p>
          </div>
        </div>
      )}
    </main>
  );
}
