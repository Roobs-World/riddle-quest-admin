import {lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {BRIDGE_PROTOCOL_VERSION} from "@qwordly/core/bridge/constants";
import musicUrl from "../../../../assets/audio-web/music.webm";
import {createInitialGameSession, gameSessionReducer} from "./gameSession";
import {tr} from "./i18n";
import {createRequestId} from "./requestIds";
import {dispatchLocalBridge, GAME_TO_HOST_EVENT} from "./localBridge";
import {GuidanceOverlay} from "./GuidanceOverlay";
import {SpinningWheel, SpinningWheelLoader} from "./SpinningWheelLoader";
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
import {useGameMessageRouter} from "./useGameMessageRouter";
import {useOnlineStatus} from "./useOnlineStatus";
import {isRaceHarness} from "./race/logic/raceFeatureFlag";
import {
  useGameAudio,
  useAnswerKeyboard,
  useGameMessageListener,
  useGameReadyReporter,
  useGameSessionPersistence,
  useViewportFit,
} from "./game/hooks";
import {getMobileCapabilities, shouldLoadDecorativeWebGl} from "./performance/mobileCapabilities";
import {trackScreen} from "../analytics/googleAnalytics";
import type {ListRaceCategoriesResponse} from "@qwordly/core/race";
import {useCompletionDelivery} from "./game/hooks/useCompletionDelivery";
import {useOfflineDialog} from "./game/hooks/useOfflineDialog";

/** Stores the shared modal bundle request so preloading also resolves React.lazy. */
let gameModalViewPromise: Promise<{default: typeof import("./GameModalView").GameModalView}> | null = null;
/** Loads modal-only UI outside the initial gameplay dependency graph. */
const loadGameModalView = () => gameModalViewPromise ??=
  import("./GameModalView").then((module) => ({default: module.GameModalView}));
/** Renders modal-only UI after its asynchronous bundle is available. */
const GameModalView = lazy(loadGameModalView);
/** Stores the shared multiplayer bundle request so preloading also resolves React.lazy. */
let raceTo10GamePromise: Promise<{default: typeof import("./race/RaceTo10Game").RaceTo10Game}> | null = null;
/** Loads multiplayer UI outside the initial single-player dependency graph. */
const loadRaceTo10Game = () => raceTo10GamePromise ??=
  import("./race/RaceTo10Game").then((module) => ({default: module.RaceTo10Game}));
/** Renders multiplayer UI after its asynchronous bundle is available. */
const RaceTo10Game = lazy(loadRaceTo10Game);

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
}: {
  localBridge?: boolean;
  interactionBlocked?: boolean;
  restoredGame?: JestSavedGame | null;
  onSaveGame?: (game: JestSavedGame | null) => void;
  registrationName?: string;
  registrationInviterName?: string;
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
  /** Stores the resolved multiplayer component after its post-load preload completes. */
  const [preloadedRaceTo10Game, setPreloadedRaceTo10Game] = useState<
    typeof import("./race/RaceTo10Game").RaceTo10Game | null
  >(null);
  const guessRetryRef = useRef<{riddleId: string; guess: string; requestId: string} | null>(null);
  const hintRetryRef = useRef<{sessionToken: string; attempt: string; requestId: string} | null>(null);
  const continueRetryRef = useRef<{sessionToken: string; requestId: string} | null>(null);
  const skipRetryRef = useRef<{sessionToken: string; requestId: string} | null>(null);
  const offlineDialogRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useOfflineDialog(online, offlineDialogRef);

  useEffect(() => {
    let requestId: number | undefined;
    let timeoutId: number | undefined;
    const preloadAfterPageLoad = () => {
      if (raceEnabled) {
        void loadRaceTo10Game().then(({default: component}) => setPreloadedRaceTo10Game(() => component));
      }
      if (typeof window.requestIdleCallback === "function") {
        requestId = window.requestIdleCallback(() => void loadGameModalView(), {timeout: 2_000});
      } else {
        timeoutId = window.setTimeout(() => void loadGameModalView(), 250);
      }
    };
    if (document.readyState === "complete") {
      preloadAfterPageLoad();
    } else {
      window.addEventListener("load", preloadAfterPageLoad, {once: true});
    }
    return () => {
      window.removeEventListener("load", preloadAfterPageLoad);
      if (requestId !== undefined) window.cancelIdleCallback(requestId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [raceEnabled]);

  /** Uses the resolved component directly to avoid a Suspense reveal delay after preloading. */
  const ActiveRaceTo10Game = preloadedRaceTo10Game ?? RaceTo10Game;

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
        sessionToken: stateRef.current.riddle?.sessionToken ?? restoredGame?.sessionToken,
        riddleId: stateRef.current.riddle?.riddleId ?? restoredGame?.riddleId,
      },
    });
  }, [postToHost, restoredGame?.sessionToken]);

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

  useEffect(() => {
    type ReferralRewardDetail = {
      coinsAwarded?: unknown;
      newCoins?: unknown;
      conversions?: unknown;
    };
    const rewardWindow = window as Window & {
      __RIDDLE_QUEST_PENDING_REFERRAL_REWARD__?: ReferralRewardDetail;
    };
    const showReferralReward = (event: Event) => {
      const detail = (event as CustomEvent<ReferralRewardDetail>).detail;
      // Host initialization replaces the bootstrap session snapshot. Keep the
      // reward queued until that authoritative profile has been applied.
      if (!stateRef.current.initialized || !stateRef.current.riddle) return;
      delete rewardWindow.__RIDDLE_QUEST_PENDING_REFERRAL_REWARD__;
      const coinsAwarded = detail?.coinsAwarded;
      const newCoins = detail?.newCoins;
      if (
        typeof coinsAwarded !== "number" || !Number.isFinite(coinsAwarded) || coinsAwarded <= 0 ||
        typeof newCoins !== "number" || !Number.isFinite(newCoins) || newCoins < 0
      ) return;
      dispatch({type: "coinsUpdated", newCoins});
      dispatch({
        type: "showAuxiliaryFanfare",
        fanfare: {
          id: `referral-${Date.now()}`,
          kind: "referral",
          coinsAwarded,
          totalCoins: newCoins,
          achievementIds: [],
        },
      });
    };
    window.addEventListener("riddle-quest:referral-reward", showReferralReward);
    if (rewardWindow.__RIDDLE_QUEST_PENDING_REFERRAL_REWARD__) {
      showReferralReward(new CustomEvent("riddle-quest:referral-reward", {
        detail: rewardWindow.__RIDDLE_QUEST_PENDING_REFERRAL_REWARD__,
      }));
    }
    return () => window.removeEventListener("riddle-quest:referral-reward", showReferralReward);
  }, [state.initialized, state.riddle?.riddleId]);

  useGameMessageListener({router, postToHost});

  useGameSessionPersistence({state, stateRef, restoredGame, dispatch, onSaveGame});

  const currentAttempt = state.riddle
    ? Array.from({length: state.riddle.answerLength}, (_, index) => state.currentLetters[index] ?? "")
    : [];
  const canSubmit = !state.guessPending && currentAttempt.length > 0 && currentAttempt.every(Boolean);
  const submitGuess = useCallback(() => {
    if (!canSubmit || !state.riddle) {
      return;
    }
    const guess = currentAttempt.join("");
    const retry = guessRetryRef.current;
    const requestId = retry?.riddleId === state.riddle.riddleId && retry.guess === guess
      ? retry.requestId
      : createRequestId("guess");
    guessRetryRef.current = {riddleId: state.riddle.riddleId, guess, requestId};
    playFeedback("submit");
    dispatch({type: "guessRequested"});
    postToHost({
      type: "game:submitGuess",
      requestId,
      payload: {
        riddleId: state.riddle.riddleId,
        gameMode: state.riddle.gameMode,
        sessionToken: state.riddle.sessionToken,
        guess,
        requestId,
      },
    });
  }, [canSubmit, currentAttempt, playFeedback, postToHost, state.riddle]);

  useEffect(() => {
    guessRetryRef.current = null;
  }, [state.guesses.length]);

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

  const requestHint = () => {
    if (!state.riddle) return;
    const attempt = currentAttempt.join("");
    const retry = hintRetryRef.current;
    const requestId = retry?.sessionToken === state.riddle.sessionToken && retry.attempt === attempt
      ? retry.requestId
      : createRequestId("hint");
    hintRetryRef.current = {sessionToken: state.riddle.sessionToken, attempt, requestId};
    postToHost({
      type: "game:requestHint",
      requestId,
      payload: {
        riddleId: state.riddle.riddleId,
        gameMode: state.riddle.gameMode,
        sessionToken: state.riddle.sessionToken,
        requestId,
        currentAttempt,
      },
    });
  };

  useEffect(() => {
    hintRetryRef.current = null;
  }, [state.hintRevealedIndices.length]);

  const requestContinue = (amount?: number) => {
    if (!state.riddle) return;
    const retry = continueRetryRef.current;
    const requestId = retry?.sessionToken === state.riddle.sessionToken
      ? retry.requestId
      : createRequestId("continue");
    continueRetryRef.current = {sessionToken: state.riddle.sessionToken, requestId};
    postToHost({
      type: "game:spendCoins",
      requestId,
      payload: {
        reason: "continue",
        gameMode: state.riddle.gameMode,
        riddleId: state.riddle.riddleId,
        sessionToken: state.riddle.sessionToken,
        amount,
      },
    });
  };

  const requestSkip = () => {
    if (!state.riddle || state.riddle.gameMode !== "classic") return;
    const retry = skipRetryRef.current;
    const requestId = retry?.sessionToken === state.riddle.sessionToken
      ? retry.requestId
      : createRequestId("skip");
    skipRetryRef.current = {sessionToken: state.riddle.sessionToken, requestId};
    postToHost({
      type: "game:skipRiddle",
      requestId,
      payload: {
        riddleId: state.riddle.riddleId,
        gameMode: state.riddle.gameMode,
        sessionToken: state.riddle.sessionToken,
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

  /** Requests permanent deletion of the authenticated Riddle Quest account. */
  const deleteAccount = useCallback(() => {
    postToHost({
      type: "game:deleteAccount",
      requestId: createRequestId("delete-account"),
      payload: {},
    });
  }, [postToHost]);

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
            <ActiveRaceTo10Game
              locale="en"
              challengeId={initialRaceChallengeId}
              openInbox={initialRaceInbox}
              initialCategories={prefetchedRaceCategories}
              coins={state.profile?.coins ?? 0}
              postToHost={postToHost}
              onClose={() => setRaceOpen(false)}
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
