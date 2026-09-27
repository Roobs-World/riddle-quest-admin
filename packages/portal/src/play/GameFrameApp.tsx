import {lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {BRIDGE_PROTOCOL_VERSION} from "@qwordly/core/bridge/constants";
import musicUrl from "../../../../assets/audio-web/music.webm";
import {isFacebookWebTarget} from "../platform/webTargetEnvironment";
import {canDraftWhileConfirming, canEditCurrentGuess, createInitialGameSession, gameSessionReducer} from "./gameSession";
import {tr} from "./i18n";
import {createRequestId} from "./requestIds";
import {dispatchLocalBridge, GAME_TO_HOST_EVENT} from "./localBridge";
import {GuidanceOverlay} from "./GuidanceOverlay";
import {SpinningWheel, SpinningWheelLoader} from "./SpinningWheelLoader";
import type {
  ContextBoardCapability,
  MatchmakingCapability,
  NativeSocialCapability,
  OverlayCapability,
  SavedGame,
  TournamentCapability,
} from "../platform/types";
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
import {useGameMessageRouter} from "./useGameMessageRouter";
import {useOnlineStatus} from "./useOnlineStatus";
import {
  useGameAudio,
  useAnswerKeyboard,
  useCompletionDelivery,
  useGameMessageListener,
  useGameOperations,
  useGameReadyReporter,
  useGameSessionPersistence,
  useGameSurfaces,
  useOfflineDialog,
  useReferralReward,
  useViewportFit,
} from "./game/hooks";
import {getMobileCapabilities, shouldLoadDecorativeWebGl} from "./performance/mobileCapabilities";
import type {ListRaceCategoriesResponse} from "@qwordly/core/race";
import type {ActivePresenceState} from "../presence/PlatformPresenceSession";
import {useGameSurfaceCoordination} from "./useGameSurfaceCoordination";

/** Renders the solar system interface. */
const SolarSystem = lazy(() => import("./SolarSystem").then((module) => ({default: module.SolarSystem})));

/** Provides game frame app behavior. */
export function GameFrameApp({
  localBridge = false,
  raceOwnerId,
  interactionBlocked = false,
  restoredGame,
  onSaveGame,
  registrationName,
  registrationInviterName,
  initialRaceChallengeId,
  initialRaceInbox = false,
  initialRaceLobby = false,
  raceFeatureEnabled = false,
  prefetchedRaceCategories = [],
  nativeSocial,
  matchmaking,
  playerOverlay,
  platformPlayerId,
  tournaments,
  contextBoard,
  raceLocalePolicy = "english-only",
  onPresenceStateChange,
}: {
  /** Stores local bridge. */
  localBridge?: boolean;
  /** Authenticated game account used to isolate race resume state. */
  raceOwnerId?: string;
  /** Stores interaction blocked. */
  interactionBlocked?: boolean;
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
  /** Stores race locale policy. */
  raceLocalePolicy?: "english-only" | "all";
  /** Stores on presence state change. */
  onPresenceStateChange?: (state: ActivePresenceState) => void;
} = {}) {
  /** Provides [state, dispatch] behavior. */
  const [state, dispatch] = useReducer(gameSessionReducer, undefined, createInitialGameSession);
  /** Provides {shell ref, content ref} behavior. */
  const {shellRef, contentRef} = useViewportFit();
  /** Provides {music ref, play feedback} behavior. */
  const {musicRef, playFeedback} = useGameAudio(state);
  /** Provides online behavior. */
  const online = useOnlineStatus();
  /** Provides [solar ready, set solar ready] behavior. */
  const [solarReady, setSolarReady] = useState(false);
  /** Provides [animated coin balance, set animated coin balance] behavior. */
  const [animatedCoinBalance, setAnimatedCoinBalance] = useState<number | null>(null);
  /** Overlay lifecycle, multiplayer eligibility, analytics, and presence coordination. */
  const {raceLocale, raceEnabled, raceOpen, setRaceOpen, guidanceActive, setGuidanceActive} =
    useGameSurfaceCoordination({
      session: state,
      raceFeatureEnabled,
      raceLocalePolicy,
      initialRaceChallengeId,
      initialRaceInbox,
      initialRaceLobby,
      onPresenceStateChange,
    });
  /** Provides offline dialog ref behavior. */
  const offlineDialogRef = useRef<HTMLDivElement | null>(null);
  /** Provides state ref behavior. */
  const stateRef = useRef(state);
  stateRef.current = state;

  useOfflineDialog(online, offlineDialogRef);

  /** Provides {game modal view, race to10 game} behavior. */
  const {GameModalView, RaceTo10Game} = useGameSurfaces(raceEnabled);

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
    canSubmit,
    bufferExhausted,
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
    if (!state.initialized || !shouldLoadDecorativeWebGl(getMobileCapabilities())) return;
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
      const handle = idleWindow.requestIdleCallback(() => setSolarReady(true), {timeout: 5_000});
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    /** Provides timer behavior. */
    const timer = window.setTimeout(() => setSolarReady(true), 2_500);
    return () => window.clearTimeout(timer);
  }, [state.initialized]);

  useGameReadyReporter({initialized: state.initialized, sendReady, postToHost});

  /** Handles completion result. */
  const handleCompletionResult = useCompletionDelivery({
    outcome: state.guessPending ? null : state.lastOutcome,
    dispatch,
    postToHost,
  });

  /** Achievement previews are recorded locally before the backend reward transaction returns. */
  const recordedAchievementOutcomeRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !state.lastOutcome ||
      state.optimisticAchievementIds.length === 0 ||
      recordedAchievementOutcomeRef.current === state.lastOutcome.id
    ) return;
    recordedAchievementOutcomeRef.current = state.lastOutcome.id;
    postToHost({
      type: "game:recordAchievements",
      payload: {achievementIds: state.optimisticAchievementIds},
    });
  }, [postToHost, state.lastOutcome, state.optimisticAchievementIds]);

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
    active: online && canEditCurrentGuess(state) && !guidanceActive && !raceOpen,
    onLetter: typeKeyboardLetter,
    onBackspace: deleteKeyboardLetter,
    onSubmit: submitGuess,
  });

  return (
    <main
      ref={shellRef}
      className={state.paused ? "game-app paused" : "game-app"}
      inert={interactionBlocked && online !== false ? true : undefined}
      data-analytics-screen={raceOpen ? "multiplayer" : state.modal ? `modal_${state.modal}` : `game_${state.gameMode}`}
    >
      {solarReady && (
        <Suspense fallback={null}>
          <SolarSystem paused={state.paused} />
        </Suspense>
      )}
      <audio ref={musicRef} loop preload="none" aria-hidden="true">
        <source src={musicUrl} type='audio/webm; codecs="opus"' />
      </audio>
      <div
        ref={contentRef}
        className="game-content"
        inert={state.modal !== null || guidanceActive || raceOpen || !online ? true : undefined}
        aria-hidden={state.modal !== null || guidanceActive || raceOpen || !online ? true : undefined}
      >
        <GameHeader
          state={state}
          displayedCoins={animatedCoinBalance ?? undefined}
          onOpenShop={() => dispatch({type: "openModal", modal: "shop"})}
          onToggleMute={() => dispatch({type: "toggleMute"})}
          commerceAvailable={state.products.length > 0}
        />

        {!state.riddle ? (
          <section className="game-loading" aria-hidden="true" />
        ) : (
          <>
            <section className="riddle-surface">
              <div className="riddle-card">
                <h1>{state.riddle.text}</h1>
                {state.notice && (
                  <div className="game-notice">
                    {state.notice.startsWith("WebPortal.") || state.notice.startsWith("ErrorMessages.")
                      ? tr(state.notice)
                      : state.notice}
                  </div>
                )}
              </div>
              <GuessBoard state={state} dispatch={dispatch} />
            </section>

            <Keyboard state={state} dispatch={dispatch} playFeedback={playFeedback} />

            <section className="game-input-actions" aria-label={tr("Navigation.GAME")}>
              <button data-tooltip="gameHint" disabled={state.guessPending && !canDraftWhileConfirming(state)} onClick={() => dispatch({type: "openModal", modal: "hint"})}>
                <HintIcon />
                {tr("Navigation.HINT_BUTTON")}
              </button>
              <button data-tooltip="submitAnswer" className="submit-action" onClick={submitGuess} disabled={!canSubmit}>
                {tr("GameScreenAlerts.SUBMIT_BUTTON")}
              </button>
              {state.gameMode === "classic" && (
                <button data-tooltip="gameSkip" disabled={state.guessPending && !canDraftWhileConfirming(state)} onClick={() => dispatch({type: "openModal", modal: "skip"})}>
                  <ForwardIcon />
                  {tr("GameScreenAlerts.SKIP_BUTTON")}
                </button>
              )}
            </section>

            <nav className="game-bottom-navigation" aria-label={tr("Navigation.GAME")}>
              <button
                onClick={() => dispatch({type: "openModal", modal: "settings"})}
                aria-label={tr("Navigation.SETTINGS_BUTTON")}
              >
                <SettingsIcon />
              </button>
              {raceEnabled && state.gameMode === "classic" && (
                <button
                  className="multiplayer-navigation-action"
                  onClick={() => setRaceOpen(true)}
                  aria-label={tr("RaceTo10.MULTIPLAYER_BUTTON")}
                >
                  <MultiplayerIcon />
                  <span>{tr("RaceTo10.MULTIPLAYER_BUTTON")}</span>
                </button>
              )}
              <button
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
      <div className="game-overlay-surfaces" inert={!online ? true : undefined}>
        {state.modal && (
          <Suspense fallback={<SpinningWheelLoader overlay className="game-modal-loading" />}>
            <GameModalView
              state={state}
              onCoinBalancePreview={setAnimatedCoinBalance}
              onClose={() => dispatch(state.modal === "continue" ? {type: "declineContinue"} : {type: "closeModal"})}
              onContinue={requestContinue}
              onPurchase={requestPurchase}
              onNext={requestRiddle}
              synchronizing={bufferExhausted}
              onOpenModal={(modal) => dispatch({type: "openModal", modal})}
              onToggleMute={() => dispatch({type: "toggleMute"})}
              commerceAvailable={state.products.length > 0}
              onRequestHint={requestHint}
              onRequestSkip={requestSkip}
              onRequestLeaderboard={requestLeaderboard}
              onUpdateUsername={updateUsername}
              onUpdateAvatar={updateAvatar}
              onDeleteAccount={deleteAccount}
            />
          </Suspense>
        )}
        <GuidanceOverlay
          state={state}
          modal={state.modal}
          onActiveChange={setGuidanceActive}
          registrationName={registrationName}
          registrationInviterName={registrationInviterName}
          interactionBlocked={interactionBlocked || !online}
        />
        {raceOpen && raceEnabled && (
          <Suspense fallback={<SpinningWheel />}>
            <RaceTo10Game
              key={raceOwnerId}
              ownerId={raceOwnerId}
              locale={raceLocale ?? "en"}
              challengeId={initialRaceChallengeId}
              openInbox={initialRaceInbox}
              initialCategories={prefetchedRaceCategories}
              coins={state.profile?.coins ?? 0}
              postToHost={postToHost}
              onClose={() => setRaceOpen(false)}
              nativeSocial={nativeSocial}
              matchmaking={matchmaking}
              playerOverlay={playerOverlay}
              platformPlayerId={platformPlayerId}
              tournaments={tournaments}
              contextBoard={contextBoard}
            />
          </Suspense>
        )}
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
          <section>
            <strong id="offline-dialog-title">{tr("CommonAlerts.OFFLINE_TITLE")}</strong>
            <p id="offline-dialog-message">{tr("CommonAlerts.OFFLINE_MESSAGE")}</p>
          </section>
        </div>
      )}
    </main>
  );
}
