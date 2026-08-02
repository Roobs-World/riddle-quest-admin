import {lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {BRIDGE_PROTOCOL_VERSION} from "@qwordly/core/bridge/constants";
import musicUrl from "../../../../assets/audio-web/music.webm";
import {createInitialGameSession, gameSessionReducer} from "./gameSession";
import {tr} from "./i18n";
import {createRequestId} from "./requestIds";
import {dispatchLocalBridge, GAME_TO_HOST_EVENT} from "./localBridge";
import {GuidanceOverlay} from "./GuidanceOverlay";
import {SpinningWheel} from "./SpinningWheelLoader";
import {prepareAvatarImage} from "./avatarImage";
import type {JestSavedGame} from "../jest/types";
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
import {GameModalView} from "./GameModalView";
import {useGameMessageRouter} from "./useGameMessageRouter";
import {useOnlineStatus} from "./useOnlineStatus";
import {isRaceHarness} from "./race/raceFeatureFlag";
import {useGameAudio, useGameMessageListener, useGameReadyReporter, useViewportFit} from "./game/hooks";
import {getMobileCapabilities, shouldLoadDecorativeWebGl} from "./performance/mobileCapabilities";
import {trackScreen} from "../analytics/googleAnalytics";
import type {ListRaceCategoriesResponse} from "@qwordly/core/race";
import {RaceTo10Game} from "./race/RaceTo10Game";

const SolarSystem = lazy(() => import("./SolarSystem").then((module) => ({default: module.SolarSystem})));

export function GameFrameApp({
  localBridge = false,
  interactionBlocked = false,
  restoredGame,
  onSaveGame,
  registrationName,
  initialRaceChallengeId,
  initialRaceInbox = false,
  raceFeatureEnabled = false,
  prefetchedRaceCategories = [],
}: {
  localBridge?: boolean;
  interactionBlocked?: boolean;
  restoredGame?: JestSavedGame | null;
  onSaveGame?: (game: JestSavedGame | null) => void;
  registrationName?: string;
  initialRaceChallengeId?: string;
  initialRaceInbox?: boolean;
  raceFeatureEnabled?: boolean;
  prefetchedRaceCategories?: ListRaceCategoriesResponse["categories"];
} = {}) {
  const [state, dispatch] = useReducer(gameSessionReducer, undefined, createInitialGameSession);
  const {shellRef, contentRef} = useViewportFit();
  const {musicRef, playFeedback} = useGameAudio(state);
  const online = useOnlineStatus();
  const [solarReady, setSolarReady] = useState(false);
  const [guidanceActive, setGuidanceActive] = useState(false);
  const [animatedCoinBalance, setAnimatedCoinBalance] = useState<number | null>(null);
  const raceEnabled =
    state.locale === "en" &&
    (raceFeatureEnabled || isRaceHarness(typeof window === "undefined" ? "" : window.location.search));
  const [raceOpen, setRaceOpen] = useState(Boolean((initialRaceChallengeId || initialRaceInbox) && raceEnabled));
  const [completedIds] = useState(() => new Set<string>());
  const stateRef = useRef(state);
  const lastClearedOutcomeRef = useRef<string | null>(null);
  const lastServerCheckpointRef = useRef<{riddleId: string; signature: string} | null>(null);
  stateRef.current = state;

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
    if (!raceEnabled) setRaceOpen(false);
    else if (initialRaceChallengeId || initialRaceInbox) setRaceOpen(true);
  }, [initialRaceChallengeId, initialRaceInbox, raceEnabled]);

  useEffect(() => {
    if (state.modal === null) setAnimatedCoinBalance(null);
  }, [state.modal]);

  const getSavedGame = useCallback((): JestSavedGame | null => {
    const current = stateRef.current;
    if (!current.riddle || !current.engineSnapshot || current.lastOutcome) {
      return null;
    }
    return {
      schemaVersion: 1,
      savedAt: Date.now(),
      riddleId: current.riddle.riddleId,
      gameMode: current.gameMode,
      currentLetters: current.currentLetters,
      activeSlotIndex: current.activeSlotIndex,
      hintRevealedIndices: current.hintRevealedIndices,
      guesses: current.guesses,
      engineSnapshot: current.engineSnapshot,
      letterStates: current.letterStates,
    };
  }, []);

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

  const requestRiddle = useCallback(() => {
    postToHost({
      type: "game:loadRiddle",
      requestId: createRequestId("load"),
      payload: {
        gameMode: stateRef.current.gameMode,
        locale: stateRef.current.locale,
        classicIndex: stateRef.current.profile?.classicIndex,
      },
    });
  }, [postToHost]);

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

  const router = useGameMessageRouter({dispatch, stateRef, postToHost, requestRiddle});

  useGameMessageListener({router, postToHost});

  useEffect(() => {
    const outcome = state.lastOutcome;
    if (!outcome || completedIds.has(outcome.id)) {
      return;
    }

    completedIds.add(outcome.id);
    postToHost({
      type: "game:completeGame",
      requestId: createRequestId("complete"),
      payload: {
        riddleId: outcome.riddleId,
        gameMode: outcome.gameMode,
        attempts: outcome.attempts,
        isCorrect: outcome.isCorrect,
      },
    });
  }, [completedIds, state.lastOutcome]);

  useEffect(() => {
    if (!state.riddle || restoredGame?.riddleId !== state.riddle.riddleId) {
      return;
    }
    dispatch({
      type: "restoreSession",
      currentLetters: restoredGame.currentLetters,
      activeSlotIndex: restoredGame.activeSlotIndex,
      hintRevealedIndices: restoredGame.hintRevealedIndices,
      guesses: restoredGame.guesses,
      engineSnapshot: restoredGame.engineSnapshot,
      letterStates: restoredGame.letterStates,
    });
  }, [restoredGame, state.riddle?.riddleId]);

  useEffect(() => {
    if (state.lastOutcome) {
      if (lastClearedOutcomeRef.current !== state.lastOutcome.id) {
        lastClearedOutcomeRef.current = state.lastOutcome.id;
        onSaveGame?.(null);
      }
      return;
    }
    const savedGame = getSavedGame();
    if (!savedGame) return;
    const signature = JSON.stringify({
      currentLetters: savedGame.currentLetters,
      activeSlotIndex: savedGame.activeSlotIndex,
      guesses: savedGame.guesses.length,
      hints: savedGame.hintRevealedIndices,
      attemptsUsed: savedGame.engineSnapshot.attemptsUsed,
      hasUsedContinue: savedGame.engineSnapshot.hasUsedContinue,
    });
    if (lastServerCheckpointRef.current?.riddleId !== savedGame.riddleId) {
      lastServerCheckpointRef.current = {riddleId: savedGame.riddleId, signature};
      return;
    }
    if (lastServerCheckpointRef.current.signature === signature) return;
    lastServerCheckpointRef.current = {riddleId: savedGame.riddleId, signature};
    onSaveGame?.(savedGame);
  }, [
    getSavedGame,
    onSaveGame,
    state.activeSlotIndex,
    state.currentLetters,
    state.engineSnapshot,
    state.guesses,
    state.hintRevealedIndices,
    state.lastOutcome,
    state.riddle?.riddleId,
  ]);

  useEffect(() => {
    const saveBeforeBackgrounding = () => {
      if (document.visibilityState !== "hidden") return;
      const savedGame = getSavedGame();
      if (savedGame) onSaveGame?.(savedGame);
    };
    document.addEventListener("visibilitychange", saveBeforeBackgrounding);
    return () => document.removeEventListener("visibilitychange", saveBeforeBackgrounding);
  }, [getSavedGame, onSaveGame]);

  const currentAttempt = state.riddle
    ? Array.from({length: state.riddle.answerLength}, (_, index) => state.currentLetters[index] ?? "")
    : [];
  const canSubmit = currentAttempt.length > 0 && currentAttempt.every(Boolean);
  const submitGuess = useCallback(() => {
    if (!canSubmit) {
      return;
    }
    playFeedback("submit");
    dispatch({type: "submitGuess"});
  }, [canSubmit, playFeedback]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editing =
        target instanceof HTMLElement &&
        (target.isContentEditable || target.matches("input, textarea, select, [role='textbox']"));
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        state.paused ||
        state.modal ||
        guidanceActive ||
        raceOpen ||
        editing
      )
        return;
      if (/^[a-z]$/i.test(event.key)) {
        event.preventDefault();
        playFeedback("key");
        dispatch({type: "typeLetter", letter: event.key.toUpperCase()});
      } else if (event.key === "Backspace") {
        event.preventDefault();
        playFeedback("delete");
        dispatch({type: "backspace"});
      } else if (event.key === "Enter") {
        event.preventDefault();
        submitGuess();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [guidanceActive, playFeedback, raceOpen, state.modal, state.paused, submitGuess]);

  const requestHint = () => {
    if (!state.riddle) return;
    postToHost({
      type: "game:requestHint",
      requestId: createRequestId("hint"),
      payload: {
        riddleId: state.riddle.riddleId,
        gameMode: state.riddle.gameMode,
        currentAttempt,
      },
    });
  };

  const requestContinue = (amount?: number) => {
    postToHost({
      type: "game:spendCoins",
      requestId: createRequestId("continue"),
      payload: {
        reason: "continue",
        gameMode: state.riddle?.gameMode,
        amount,
      },
    });
  };

  const requestSkip = () => {
    if (!state.riddle || state.riddle.gameMode !== "classic") return;
    postToHost({
      type: "game:spendCoins",
      requestId: createRequestId("skip"),
      payload: {
        reason: "skip",
        riddleId: state.riddle.riddleId,
        gameMode: state.riddle.gameMode,
      },
    });
  };

  const requestPurchase = (productId: string) => {
    postToHost({
      type: "game:requestPurchase",
      requestId: createRequestId("purchase"),
      payload: {productId},
    });
  };

  const requestLeaderboard = useCallback(
    (leaderboardType: "xp" | "totalWins" | "bestStreak") => {
      dispatch({type: "leaderboardRequested", leaderboardType});
      postToHost({
        type: "game:loadLeaderboard",
        requestId: createRequestId("leaderboard"),
        payload: {leaderboardType},
      });
    },
    [postToHost],
  );

  const updateUsername = useCallback(
    (username: string) => {
      postToHost({
        type: "game:updateUsername",
        requestId: createRequestId("username"),
        payload: {username},
      });
    },
    [postToHost],
  );

  const updateAvatar = useCallback(
    async (file: File) => {
      const imageDataUrl = await prepareAvatarImage(file);
      postToHost({
        type: "game:updateAvatar",
        requestId: createRequestId("avatar"),
        payload: {imageDataUrl},
      });
    },
    [postToHost],
  );

  return (
    <main
      ref={shellRef}
      className={state.paused ? "game-app paused" : "game-app"}
      inert={interactionBlocked ? true : undefined}
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
        inert={state.modal !== null || guidanceActive || raceOpen ? true : undefined}
        aria-hidden={state.modal !== null || guidanceActive || raceOpen ? true : undefined}
      >
        <GameHeader
          state={state}
          displayedCoins={animatedCoinBalance ?? undefined}
          onOpenShop={() => dispatch({type: "openModal", modal: "shop"})}
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
      <GameModalView
        state={state}
        onCoinBalancePreview={setAnimatedCoinBalance}
        onClose={() => dispatch(state.modal === "continue" ? {type: "declineContinue"} : {type: "closeModal"})}
        onContinue={requestContinue}
        onPurchase={requestPurchase}
        onNext={requestRiddle}
        onOpenModal={(modal) => dispatch({type: "openModal", modal})}
        onToggleMute={() => dispatch({type: "toggleMute"})}
        onRequestHint={requestHint}
        onRequestSkip={requestSkip}
        onRequestLeaderboard={requestLeaderboard}
        onUpdateUsername={updateUsername}
        onUpdateAvatar={updateAvatar}
      />
      <GuidanceOverlay
        state={state}
        modal={state.modal}
        onActiveChange={setGuidanceActive}
        registrationName={registrationName}
      />
      {raceOpen && raceEnabled && (
        <RaceTo10Game
          locale="en"
          challengeId={initialRaceChallengeId}
          openInbox={initialRaceInbox}
          initialCategories={prefetchedRaceCategories}
          coins={state.profile?.coins ?? 0}
          postToHost={postToHost}
          onClose={() => setRaceOpen(false)}
        />
      )}
      {!online && (
        <div className="offline-backdrop" role="alertdialog" aria-modal="true">
          <SpinningWheel />
          <section>
            <strong>{tr("CommonAlerts.OFFLINE_TITLE")}</strong>
            <p>{tr("CommonAlerts.OFFLINE_MESSAGE")}</p>
          </section>
        </div>
      )}
    </main>
  );
}
