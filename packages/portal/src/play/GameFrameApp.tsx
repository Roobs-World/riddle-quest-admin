import {lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {BRIDGE_PROTOCOL_VERSION} from "@qwordly/core/bridge/constants";
import musicUrl from "../../../../assets/audio-web/music.webm";
import {createInitialGameSession, gameSessionReducer} from "./gameSession";
import {isSupportedLocale, tr} from "./i18n";
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
  SoundIcon,
} from "./GameFrameControls";
import {useGameMessageRouter} from "./useGameMessageRouter";
import {useOnlineStatus} from "./useOnlineStatus";
import {isRaceHarness} from "./race/logic/raceFeatureFlag";
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
import {trackScreen} from "../analytics/googleAnalytics";
import type {ListRaceCategoriesResponse} from "@qwordly/core/race";
import type {ActivePresenceState} from "../presence/PlatformPresenceSession";
import {resolveActivityPresence} from "../presence/activityPresence";

/** Renders the solar system interface. */
const SolarSystem = lazy(() => import("./SolarSystem").then((module) => ({default: module.SolarSystem})));

/** Provides game frame app behavior. */
export function GameFrameApp({
  localBridge = false,
  interactionBlocked = false,
  restoredGame,
  onSaveGame,
  registrationName,
  registrationInviterName,
  initialRaceChallengeId,
  initialRaceInbox = false,
  raceFeatureEnabled = false,
  prefetchedRaceCategories = [],
  presenceEnabled,
  onTogglePresence,
  nativeSocial,
  matchmaking,
  playerOverlay,
  platformPlayerId,
  tournaments,
  contextBoard,
  raceLocalePolicy = "english-only",
  onPresenceStateChange,
}: {
  localBridge?: boolean;
  interactionBlocked?: boolean;
  restoredGame?: SavedGame | null;
  onSaveGame?: (game: SavedGame | null) => void;
  registrationName?: string;
  registrationInviterName?: string;
  initialRaceChallengeId?: string;
  initialRaceInbox?: boolean;
  raceFeatureEnabled?: boolean;
  prefetchedRaceCategories?: ListRaceCategoriesResponse["categories"];
  presenceEnabled?: boolean;
  onTogglePresence?: () => void;
  nativeSocial?: NativeSocialCapability;
  matchmaking?: MatchmakingCapability;
  playerOverlay?: OverlayCapability;
  platformPlayerId?: string;
  tournaments?: TournamentCapability;
  contextBoard?: ContextBoardCapability;
  raceLocalePolicy?: "english-only" | "all";
  onPresenceStateChange?: (state: ActivePresenceState) => void;
} = {}) {
  const [state, dispatch] = useReducer(gameSessionReducer, undefined, createInitialGameSession);
  const {shellRef, contentRef} = useViewportFit();
  const {musicRef, playFeedback} = useGameAudio(state);
  const online = useOnlineStatus();
  const [solarReady, setSolarReady] = useState(false);
  const [guidanceActive, setGuidanceActive] = useState(false);
  const [animatedCoinBalance, setAnimatedCoinBalance] = useState<number | null>(null);
  const hasActiveRiddle = Boolean(state.riddle);
  const modalOpen = Boolean(state.modal);
  const raceLocale = isSupportedLocale(state.locale) ? state.locale : undefined;
  const raceEnabled =
    raceLocale !== undefined && (raceLocalePolicy === "all" || raceLocale === "en") &&
    (raceFeatureEnabled || isRaceHarness(typeof window === "undefined" ? "" : window.location.search));
  const [raceOpen, setRaceOpen] = useState(Boolean((initialRaceChallengeId || initialRaceInbox) && raceEnabled));
  const offlineDialogRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useOfflineDialog(online, offlineDialogRef);

  const {GameModalView, RaceTo10Game} = useGameSurfaces(raceEnabled);

  useEffect(() => {
    const screen = raceOpen
      ? "multiplayer"
      : guidanceActive
        ? "guidance"
        : state.modal
          ? `modal_${state.modal}`
          : state.riddle
            ? `game_${state.gameMode}`
            : "game_loading";
    trackScreen(screen, {game_mode: state.gameMode});
  }, [guidanceActive, raceOpen, state.gameMode, state.modal, state.riddle]);

  useEffect(() => {
    const nextPresenceState: ActivePresenceState = resolveActivityPresence({
      raceOpen,
      hasRiddle: hasActiveRiddle,
      modalOpen,
    });
    onPresenceStateChange?.(nextPresenceState);
  }, [hasActiveRiddle, modalOpen, onPresenceStateChange, raceOpen]);

  useEffect(() => {
    if (!raceEnabled) setRaceOpen(false);
    else if (initialRaceChallengeId || initialRaceInbox) setRaceOpen(true);
  }, [initialRaceChallengeId, initialRaceInbox, raceEnabled]);

  useEffect(() => {
    if (state.modal === null) setAnimatedCoinBalance(null);
  }, [state.modal]);

  const postToHost = useCallback(
    (message: GameToHostMessage) => {
      if (localBridge || window.parent === window) {
        dispatchLocalBridge(GAME_TO_HOST_EVENT, {...message, sentAt: Date.now()});
        return;
      }
      window.parent.postMessage({...message, sentAt: Date.now()}, window.location.origin);
    },
    [localBridge],
  );

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

  const {
    canSubmit,
    submitGuess,
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
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: {timeout: number}) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(() => setSolarReady(true), {timeout: 5_000});
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(() => setSolarReady(true), 2_500);
    return () => window.clearTimeout(timer);
  }, [state.initialized]);

  useGameReadyReporter({initialized: state.initialized, sendReady, postToHost});

  const handleCompletionResult = useCompletionDelivery({
    outcome: state.lastOutcome,
    dispatch,
    postToHost,
  });

  const router = useGameMessageRouter({
    dispatch,
    stateRef,
    postToHost,
    requestRiddle,
    onCompletionResult: handleCompletionResult,
  });

  useReferralReward(stateRef, dispatch, state.initialized, state.riddle?.riddleId);

  useGameMessageListener({router, postToHost});

  useGameSessionPersistence({state, stateRef, restoredGame, dispatch, onSaveGame});

  const typeKeyboardLetter = useCallback(
    (letter: string) => {
      playFeedback("key");
      dispatch({type: "typeLetter", letter});
    },
    [playFeedback],
  );
  const deleteKeyboardLetter = useCallback(() => {
    playFeedback("delete");
    dispatch({type: "backspace"});
  }, [playFeedback]);
  useAnswerKeyboard({
    active: online && !state.paused && !state.modal && !state.guessPending && !guidanceActive && !raceOpen,
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
          commerceAvailable={state.products.length > 0}
        />

        {!state.riddle ? (
          <section className="game-loading" aria-hidden="true" />
        ) : (
          <>
            <section className="riddle-surface">
              <div className="riddle-card">
                <button
                  className="riddle-sound-button"
                  onClick={() => dispatch({type: "toggleMute"})}
                  aria-label={state.muted ? tr("Accessibility.UNMUTE_SOUND") : tr("Accessibility.MUTE_SOUND")}
                >
                  <SoundIcon muted={state.muted} />
                </button>
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
              <button data-tooltip="gameHint" onClick={() => dispatch({type: "openModal", modal: "hint"})}>
                <HintIcon />
                {tr("Navigation.HINT_BUTTON")}
              </button>
              <button data-tooltip="submitAnswer" className="submit-action" onClick={submitGuess} disabled={!canSubmit}>
                {tr("GameScreenAlerts.SUBMIT_BUTTON")}
              </button>
              {state.gameMode === "classic" && (
                <button data-tooltip="gameSkip" onClick={() => dispatch({type: "openModal", modal: "skip"})}>
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
              onOpenModal={(modal) => dispatch({type: "openModal", modal})}
              onToggleMute={() => dispatch({type: "toggleMute"})}
              presenceEnabled={presenceEnabled}
              onTogglePresence={onTogglePresence}
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
