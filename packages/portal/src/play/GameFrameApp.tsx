import {lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState} from "react";
import type {CSSProperties, Dispatch, FormEvent} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {BridgeLeaderboardEntrySchema, BridgeProfileSchema} from "@qwordly/core/bridge";
import {BRIDGE_PROTOCOL_VERSION} from "@qwordly/core/bridge/constants";
import {splitGraphemes, type Feedback} from "@qwordly/core/game";
import mascotUrl from "../../../../assets/images-web/riddlequest-r.webp";
import coinUrl from "../../../../assets/images/coin.svg";
import backspaceUrl from "../../../../assets/images/backspace-key.svg";
import musicUrl from "../../../../assets/audio-web/music.webm";
import treasureChestUrl from "../../../../assets/images-web/chest-open.webp";
import {createGameMessageRouter} from "./bridgeRouter";
import {
  createInitialGameSession,
  gameSessionReducer,
  type GameModal,
  type GameSessionState,
} from "./gameSession";
import {LANGUAGE_OPTIONS, setLocale, tr, type Locale} from "./i18n";
import {createRequestId} from "./requestIds";
import {dispatchLocalBridge, GAME_TO_HOST_EVENT, HOST_TO_GAME_EVENT} from "./localBridge";
import {ACHIEVEMENT_DEFINITIONS, type AchievementPlayerData} from "./achievements";
import {getNextRankForLevel, getRankForLevel, PLAYER_RANKS} from "./ranks";
import {GuidanceOverlay} from "./GuidanceOverlay";
import {SpinningWheel, SpinningWheelLoader} from "./SpinningWheelLoader";
import type {JestSavedGame} from "../jest/types";

const SolarSystem = lazy(() => import("./SolarSystem").then((module) => ({default: module.SolarSystem})));

const keyboardRows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

const getObjectData = (data: unknown): Record<string, unknown> =>
  typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};

const getString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const getNumber = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);
const getStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function GameFrameApp({
  localBridge = false,
  interactionBlocked = false,
  restoredGame,
  onSaveGame,
}: {
  localBridge?: boolean;
  interactionBlocked?: boolean;
  restoredGame?: JestSavedGame | null;
  onSaveGame?: (game: JestSavedGame | null) => void;
} = {}) {
  const shellRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [state, dispatch] = useReducer(gameSessionReducer, undefined, createInitialGameSession);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [solarReady, setSolarReady] = useState(false);
  const [guidanceActive, setGuidanceActive] = useState(false);
  const [completedIds] = useState(() => new Set<string>());
  const stateRef = useRef(state);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const musicFadeTokenRef = useRef(0);
  const lastAudioOutcomeRef = useRef<string | null>(null);
  const lastAudioGuessCountRef = useRef(0);
  const lastClearedOutcomeRef = useRef<string | null>(null);
  const lastServerCheckpointRef = useRef<{riddleId: string; signature: string} | null>(null);
  stateRef.current = state;

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

  const postToHost = useCallback((message: GameToHostMessage) => {
    if (localBridge || window.parent === window) {
      dispatchLocalBridge(GAME_TO_HOST_EVENT, {...message, sentAt: Date.now()});
      return;
    }
    window.parent.postMessage({...message, sentAt: Date.now()}, window.location.origin);
  }, [localBridge]);

  const unlockMusic = useCallback(() => {
    if (stateRef.current.muted) {
      return;
    }
    audioUnlockedRef.current = true;
    const music = musicRef.current;
    if (music && !stateRef.current.paused) {
      music.volume = 1;
      void music.play().catch(() => undefined);
    }
  }, []);

  const playFeedback = useCallback(
    (kind: "key" | "delete" | "submit" | "wrong" | "win" | "loss") => {
      unlockMusic();
      if (kind !== "wrong" && kind !== "loss") {
        return;
      }
      const music = musicRef.current;
      if (!music || stateRef.current.muted) {
        return;
      }
      const token = ++musicFadeTokenRef.current;
      const wait = (milliseconds: number) =>
        new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
      const fade = async (from: number, to: number, duration: number) => {
        const steps = 12;
        for (let step = 0; step <= steps; step += 1) {
          if (musicFadeTokenRef.current !== token || stateRef.current.muted) {
            return false;
          }
          const progress = step / steps;
          music.volume = from + (to - from) * progress;
          if (step < steps) {
            await wait(duration / steps);
          }
        }
        return true;
      };
      void (async () => {
        const startingVolume = music.volume;
        if (!(await fade(startingVolume, 0, 150))) {
          return;
        }
        await fade(0, 1, kind === "loss" ? 1000 : 700);
      })();
    },
    [unlockMusic],
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
    if (!state.initialized) {
      return;
    }
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: {timeout: number}) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(() => setSolarReady(true), {timeout: 800});
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(() => setSolarReady(true), 250);
    return () => window.clearTimeout(timer);
  }, [state.initialized]);

  useEffect(() => {
    const shell = shellRef.current;
    const content = contentRef.current;
    if (!shell || !content) {
      return;
    }

    let animationFrame = 0;
    const fitContent = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const availableHeight = shell.clientHeight;
        const naturalHeight = content.scrollHeight;
        const scale = availableHeight > 0 && naturalHeight > availableHeight
          ? availableHeight / naturalHeight
          : 1;
        const nextScale = Math.max(0.01, Math.min(1, scale));
        const nextWidth = `${100 / nextScale}%`;
        const nextTransform = `scale(${nextScale}) translateX(-50%)`;

        if (content.style.width !== nextWidth) {
          content.style.width = nextWidth;
        }
        if (content.style.transform !== nextTransform) {
          content.style.transform = nextTransform;
        }
        content.dataset.viewportScale = nextScale.toFixed(4);
      });
    };

    fitContent();
    window.addEventListener("resize", fitContent);
    const observer = new ResizeObserver(fitContent);
    observer.observe(shell);
    observer.observe(content);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", fitContent);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const readyTimer = window.setTimeout(sendReady, 0);
    const readyInterval = window.setInterval(() => {
      if (!stateRef.current.initialized) {
        sendReady();
      }
    }, 750);
    const reportSize = () => {
      postToHost({
        type: "game:resize",
        requestId: createRequestId("resize"),
        payload: {
          width: Math.ceil(document.documentElement.clientWidth),
          height: Math.ceil(document.documentElement.clientHeight),
        },
      });
    };
    reportSize();
    window.addEventListener("resize", reportSize);
    const observer = new ResizeObserver(reportSize);
    observer.observe(document.body);
    return () => {
      window.clearTimeout(readyTimer);
      window.clearInterval(readyInterval);
      window.removeEventListener("resize", reportSize);
      observer.disconnect();
    };
  }, [sendReady]);

  const router = useMemo(
    () =>
      createGameMessageRouter({
        init: (message) => {
          dispatch({
            type: "hostInit",
            locale: message.payload.locale,
            gameMode: message.payload.gameMode,
            user: message.payload.user,
            profile: message.payload.profile,
            products: message.payload.products,
          });
        },
        authState: (message) => {
          dispatch({type: "authState", user: message.payload.user, profile: message.payload.profile});
        },
        riddleLoaded: (message) => {
          dispatch({type: "loadRiddle", riddle: message.payload.riddle, profile: message.payload.profile});
        },
        operationResult: (message) => {
          if (!message.payload.ok) {
            dispatch({type: "setNotice", notice: message.payload.error ?? "ErrorMessages.GENERIC_UNEXPECTED_ERROR"});
            return;
          }

          const data = getObjectData(message.payload.data);
          if (message.payload.operation === "hint") {
            const index = getNumber(data.index);
            const revealedLetter = getString(data.revealedLetter);
            const achievementIds = getStringArray(data.newlyUnlockedAchievementIds);
            if (index !== undefined && revealedLetter) {
              dispatch({type: "applyHint", index, letter: revealedLetter, newCoins: getNumber(data.newCoins)});
            }
            if (achievementIds.length > 0) {
              dispatch({
                type: "showAuxiliaryFanfare",
                fanfare: {
                  id: `hint-${Date.now()}`,
                  kind: "achievement",
                  coinsAwarded: 0,
                  totalCoins: getNumber(data.newCoins) ?? stateRef.current.profile?.coins ?? 0,
                  achievementIds,
                },
              });
            }
            return;
          }

          if (message.payload.operation === "spendCoins") {
            const newCoins = getNumber(data.newCoins);
            if (newCoins !== undefined) {
              dispatch({type: "coinsUpdated", newCoins});
            }
            if (stateRef.current.modal === "continue") {
              dispatch({type: "continueGranted"});
            }
            return;
          }

          if (message.payload.operation === "skip") {
            dispatch({type: "closeModal"});
            return;
          }

          if (message.payload.operation === "purchase") {
            const newCoins = getNumber(data.newCoins);
            const coinsAwarded = getNumber(data.coinsAwarded) ?? 0;
            if (newCoins !== undefined) {
              dispatch({type: "coinsUpdated", newCoins});
            }
            dispatch({
              type: "showAuxiliaryFanfare",
              fanfare: {
                id: `purchase-${Date.now()}`,
                kind: "purchase",
                coinsAwarded,
                totalCoins: newCoins ?? stateRef.current.profile?.coins ?? coinsAwarded,
                achievementIds: getStringArray(data.newlyUnlockedAchievementIds),
              },
            });
            return;
          }

          if (message.payload.operation === "completeGame") {
            const reward = getNumber(data.coinsEarned);
            const completedOutcome = stateRef.current.lastOutcome;
            dispatch({
              type: "completionReward",
              reward: {
                coinsEarned: reward ?? 0,
                newXp: getNumber(data.newXp),
                newLevel: getNumber(data.newLevel),
                leveledUp: data.leveledUp === true,
                newWinStreak: getNumber(data.newWinStreak),
                newlyUnlockedAchievementIds: Array.isArray(data.newlyUnlockedAchievementIds)
                  ? data.newlyUnlockedAchievementIds.filter(
                      (achievementId): achievementId is string => typeof achievementId === "string",
                    )
                  : [],
              },
            });
            if (reward && stateRef.current.profile) {
              dispatch({type: "setNotice", notice: tr("GameMessages.COINS_EARNED") + reward});
            }
            if (completedOutcome?.kind === "loss") {
              requestRiddle();
            }
            return;
          }

          if (message.payload.operation === "leaderboard") {
            const entries = Array.isArray(data.entries)
              ? data.entries.flatMap((entry) => {
                  const parsed = BridgeLeaderboardEntrySchema.safeParse(entry);
                  return parsed.success ? [parsed.data] : [];
                })
              : [];
            const leaderboardType =
              data.type === "totalWins" || data.type === "bestStreak" ? data.type : "xp";
            dispatch({type: "leaderboardLoaded", leaderboardType, entries});
            return;
          }

          if (message.payload.operation === "profile") {
            const parsed = BridgeProfileSchema.safeParse(data.profile);
            if (parsed.success) {
              dispatch({type: "profileUpdated", profile: parsed.data});
              dispatch({type: "openModal", modal: "profile"});
            }
          }
        },
        pause: () => dispatch({type: "pause"}),
        resume: () => dispatch({type: "resume"}),
      }),
    [postToHost, requestRiddle],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) {
        return;
      }

      void router(event.data).catch((error) => {
        postToHost({
          type: "game:error",
          requestId: createRequestId("parse-error"),
          payload: {
            message: error instanceof Error ? error.message : tr("WebPortal.BRIDGE_ERROR"),
          },
        });
      });
    };

    window.addEventListener("message", handleMessage);
    const handleLocalMessage = (event: Event) => {
      void router((event as CustomEvent<unknown>).detail).catch((error) => {
        postToHost({type: "game:error", requestId: createRequestId("local-parse-error"), payload: {message: error instanceof Error ? error.message : tr("WebPortal.BRIDGE_ERROR")}});
      });
    };
    window.addEventListener(HOST_TO_GAME_EVENT, handleLocalMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener(HOST_TO_GAME_EVENT, handleLocalMessage);
    };
  }, [postToHost, router]);

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
    if (!state.riddle) {
      return;
    }
    const key = `riddleQuest:session:${state.user?.uid ?? "anonymous"}:${state.riddle.riddleId}`;
    try {
      const raw = localStorage.getItem(key);
      const saved = restoredGame?.riddleId === state.riddle.riddleId
        ? restoredGame
        : raw
          ? JSON.parse(raw) as Record<string, unknown>
          : null;
      if (!saved) {
        return;
      }
      if (
        Array.isArray(saved.currentLetters) &&
        saved.currentLetters.every((letter) => typeof letter === "string") &&
        typeof saved.activeSlotIndex === "number" &&
        Array.isArray(saved.hintRevealedIndices) &&
        Array.isArray(saved.guesses) &&
        typeof saved.engineSnapshot === "object" &&
        saved.engineSnapshot !== null &&
        typeof saved.letterStates === "object" &&
        saved.letterStates !== null
      ) {
        dispatch({
          type: "restoreSession",
          currentLetters: saved.currentLetters,
          activeSlotIndex: saved.activeSlotIndex,
          hintRevealedIndices: saved.hintRevealedIndices.filter(
            (index): index is number => typeof index === "number",
          ),
          guesses: saved.guesses as GameSessionState["guesses"],
          engineSnapshot: saved.engineSnapshot as NonNullable<GameSessionState["engineSnapshot"]>,
          letterStates: saved.letterStates as GameSessionState["letterStates"],
        });
      }
    } catch {
      localStorage.removeItem(key);
    }
  }, [restoredGame, state.riddle?.riddleId, state.user?.uid]);

  useEffect(() => {
    if (!state.riddle || !state.engineSnapshot) {
      return;
    }
    const key = `riddleQuest:session:${state.user?.uid ?? "anonymous"}:${state.riddle.riddleId}`;
    if (state.lastOutcome) {
      localStorage.removeItem(key);
      return;
    }
    const savedGame = getSavedGame();
    if (!savedGame) return;
    localStorage.setItem(key, JSON.stringify(savedGame));
  }, [
    getSavedGame,
    state.activeSlotIndex,
    state.currentLetters,
    state.engineSnapshot,
    state.guesses,
    state.hintRevealedIndices,
    state.lastOutcome,
    state.letterStates,
    state.riddle,
    state.user?.uid,
  ]);

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

  useEffect(() => {
    const outcome = state.lastOutcome;
    if (!outcome || lastAudioOutcomeRef.current === outcome.id) {
      return;
    }
    lastAudioOutcomeRef.current = outcome.id;
    playFeedback(outcome.kind);
  }, [playFeedback, state.lastOutcome]);

  useEffect(() => {
    if (
      state.guesses.length > lastAudioGuessCountRef.current &&
      state.lastOutcome === null
    ) {
      playFeedback("wrong");
    }
    lastAudioGuessCountRef.current = state.guesses.length;
  }, [playFeedback, state.guesses.length, state.lastOutcome]);

  useEffect(
    () => () => {
      musicFadeTokenRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    localStorage.setItem("riddleQuest:soundEnabled", state.muted ? "false" : "true");
    const music = musicRef.current;
    if (!music) {
      return;
    }
    if (state.muted || state.paused || document.hidden) {
      music.pause();
      return;
    }
    if (audioUnlockedRef.current) {
      void music.play().catch(() => undefined);
    }
  }, [state.muted, state.paused]);

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
      if (event.ctrlKey || event.metaKey || event.altKey || state.paused || state.modal) return;
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
  }, [playFeedback, state.modal, state.paused, submitGuess]);

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
    if (!state.riddle) return;
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

  const requestLeaderboard = useCallback((leaderboardType: "xp" | "totalWins" | "bestStreak") => {
    postToHost({
      type: "game:loadLeaderboard",
      requestId: createRequestId("leaderboard"),
      payload: {leaderboardType},
    });
  }, [postToHost]);

  const updateUsername = useCallback((username: string) => {
    postToHost({
      type: "game:updateUsername",
      requestId: createRequestId("username"),
      payload: {username},
    });
  }, [postToHost]);

  return (
    <main
      ref={shellRef}
      className={state.paused ? "game-app paused" : "game-app"}
      inert={interactionBlocked ? true : undefined}
    >
      {solarReady && (
        <Suspense fallback={null}>
          <SolarSystem paused={state.paused} />
        </Suspense>
      )}
      <audio ref={musicRef} src={musicUrl} loop preload="metadata" aria-hidden="true" />
      <div
        ref={contentRef}
        className="game-content"
        inert={state.modal !== null || guidanceActive ? true : undefined}
        aria-hidden={state.modal !== null || guidanceActive ? true : undefined}
      >
        <GameHeader
          state={state}
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
                {state.notice && <div className="game-notice">{state.notice.startsWith("WebPortal.") || state.notice.startsWith("ErrorMessages.") ? tr(state.notice) : state.notice}</div>}
              </div>
              <GuessBoard state={state} dispatch={dispatch} />
            </section>

            <Keyboard state={state} dispatch={dispatch} playFeedback={playFeedback} />

            <section className="game-input-actions" aria-label={tr("Navigation.GAME")}>
              <button data-tooltip="gameHint" onClick={() => dispatch({type: "openModal", modal: "hint"})}>
                <HintIcon />
                {tr("Navigation.HINT_BUTTON")}
              </button>
              <button
                data-tooltip="submitAnswer"
                className="submit-action"
                onClick={submitGuess}
                disabled={!canSubmit}
              >
                {tr("GameScreenAlerts.SUBMIT_BUTTON")}
              </button>
              <button data-tooltip="gameSkip" onClick={() => dispatch({type: "openModal", modal: "skip"})}>
                <ForwardIcon />
                {tr("GameScreenAlerts.NEXT_BUTTON")}
              </button>
            </section>

            <nav className="game-bottom-navigation" aria-label={tr("Navigation.GAME")}>
              <button onClick={() => dispatch({type: "openModal", modal: "settings"})} aria-label={tr("Navigation.SETTINGS_BUTTON")}><SettingsIcon /></button>
              <button onClick={() => dispatch({type: "openModal", modal: "profile"})} aria-label={tr("Navigation.PROFILE_BUTTON")}><ProfileIcon /></button>
            </nav>
          </>
        )}

        {state.paused && <div className="pause-banner">{tr("WebPortal.PAUSED")}</div>}
      </div>
      <GameModalView
        state={state}
        onClose={() =>
          dispatch(state.modal === "continue" ? {type: "declineContinue"} : {type: "closeModal"})
        }
        onContinue={requestContinue}
        onPurchase={requestPurchase}
        onNext={requestRiddle}
        onOpenModal={(modal) => dispatch({type: "openModal", modal})}
        onToggleMute={() => dispatch({type: "toggleMute"})}
        onRequestHint={requestHint}
        onRequestSkip={requestSkip}
        onRequestLeaderboard={requestLeaderboard}
        onUpdateUsername={updateUsername}
      />
      <GuidanceOverlay state={state} modal={state.modal} onActiveChange={setGuidanceActive} />
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

function GameHeader({
  state,
  onOpenShop,
}: {
  state: GameSessionState;
  onOpenShop: () => void;
}) {
  return (
    <header className="game-header">
      <img className="game-logo" src={mascotUrl} alt={tr("Accessibility.LOGO_BUTTON")} />
      <div className="game-mode-label">
        {state.gameMode === "challenge" ? tr("WebPortal.PLAY_DAILY") : tr("WebPortal.PLAY_CLASSIC")}
      </div>
      <button
        type="button"
        className="coin-pill"
        data-tooltip="gameCoins"
        aria-label={tr("Navigation.BUY_COINS_BUTTON")}
        onClick={onOpenShop}
      >
        <strong>{(state.profile?.coins ?? 0).toLocaleString()}</strong>
        <img src={coinUrl} alt="" />
      </button>
    </header>
  );
}

function SoundIcon({muted}: {muted: boolean}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      {!muted && <path d="M16 8.5c1.3 1.3 1.3 5.7 0 7M18.8 6c3.3 3.3 3.3 8.7 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      {muted && <path d="m16 9 5 6m0-6-5 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}

function HintIcon() {
  return (
    <svg className="native-control-icon" viewBox="0 0 25 24" aria-hidden="true">
      <path d="M21.65 6.17C21.24 5.95 20.38 5.72 19.21 6.54L17.74 7.58C17.63 4.47 16.28 3.25 13 3.25H7C3.58 3.25 2.25 4.58 2.25 8V16C2.25 18.3 3.5 20.75 7 20.75H13C16.28 20.75 17.63 19.53 17.74 16.42L19.21 17.46C19.83 17.9 20.37 18.04 20.8 18.04C21.17 18.04 21.46 17.93 21.65 17.83C22.06 17.62 22.75 17.05 22.75 15.62V8.38C22.75 6.95 22.06 6.38 21.65 6.17ZM11.5 11.38C10.47 11.38 9.62 10.54 9.62 9.5C9.62 8.46 10.47 7.62 11.5 7.62C12.53 7.62 13.38 8.46 13.38 9.5C13.38 10.54 12.53 11.38 11.5 11.38Z" />
    </svg>
  );
}

function ForwardIcon() {
  return (
    <svg className="native-control-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 8.34032V15.6603C2 17.1603 3.63 18.1003 4.93 17.3503L8.1 15.5203L11.27 13.6903L11.76 13.4103V10.5903L11.27 10.3103L8.1 8.48032L4.93 6.65032C3.63 5.90032 2 6.84032 2 8.34032Z" />
      <path d="M11.7598 8.34032V15.6603C11.7598 17.1603 13.3898 18.1003 14.6798 17.3503L17.8598 15.5203L21.0298 13.6903C22.3198 12.9403 22.3198 11.0603 21.0298 10.3103L17.8598 8.48032L14.6798 6.65032C13.3898 5.90032 11.7598 6.84032 11.7598 8.34032Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="native-navigation-icon" viewBox="0 0 25 24" aria-hidden="true">
      <path d="M20.6 9.22043C18.79 9.22043 18.05 7.94042 18.95 6.37042C19.47 5.46042 19.16 4.30042 18.25 3.78042L16.52 2.79042C15.73 2.32042 14.71 2.60042 14.24 3.39042L14.13 3.58042C13.23 5.15042 11.75 5.15042 10.84 3.58042L10.73 3.39042C10.28 2.60042 9.26 2.32042 8.47 2.79042L6.74 3.78042C5.83 4.30042 5.52 5.47042 6.04 6.38042C6.95 7.94042 6.21 9.22043 4.4 9.22043C3.36 9.22043 2.5 10.0704 2.5 11.1204V12.8804C2.5 13.9204 3.35 14.7804 4.4 14.7804C6.21 14.7804 6.95 16.0604 6.04 17.6304C5.52 18.5404 5.83 19.7004 6.74 20.2204L8.47 21.2104C9.26 21.6804 10.28 21.4004 10.75 20.6104L10.86 20.4204C11.76 18.8504 13.24 18.8504 14.15 20.4204L14.26 20.6104C14.73 21.4004 15.75 21.6804 16.54 21.2104L18.27 20.2204C19.18 19.7004 19.49 18.5304 18.97 17.6304C18.06 16.0604 18.8 14.7804 20.61 14.7804C21.65 14.7804 22.51 13.9304 22.51 12.8804V11.1204C22.5 10.0804 21.65 9.22043 20.6 9.22043ZM12.5 15.2504C10.71 15.2504 9.25 13.7904 9.25 12.0004C9.25 10.2104 10.71 8.75042 12.5 8.75042C14.29 8.75042 15.75 10.2104 15.75 12.0004C15.75 13.7904 14.29 15.2504 12.5 15.2504Z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="native-navigation-icon" viewBox="0 0 25 24" aria-hidden="true">
      <path d="M12.5 2C9.88 2 7.75 4.13 7.75 6.75C7.75 9.32 9.76 11.4 12.38 11.49C12.46 11.48 12.54 11.48 12.6 11.49C12.62 11.49 12.63 11.49 12.65 11.49C12.66 11.49 12.66 11.49 12.67 11.49C15.23 11.4 17.24 9.32 17.25 6.75C17.25 4.13 15.12 2 12.5 2Z" />
      <path d="M17.58 14.1499C14.79 12.2899 10.24 12.2899 7.42996 14.1499C6.15996 14.9999 5.45996 16.1499 5.45996 17.3799C5.45996 18.6099 6.15996 19.7499 7.41996 20.5899C8.81996 21.5299 10.66 21.9999 12.5 21.9999C14.34 21.9999 16.18 21.5299 17.58 20.5899C18.84 19.7399 19.54 18.5999 19.54 17.3599C19.53 16.1299 18.84 14.9899 17.58 14.1499Z" />
    </svg>
  );
}

function GuessBoard({
  state,
  dispatch,
}: {
  state: GameSessionState;
  dispatch: Dispatch<Parameters<typeof gameSessionReducer>[1]>;
}) {
  if (!state.riddle) {
    return null;
  }

  const rows = Array.from({length: 5}, (_, index) => {
    if (state.guesses[index]) {
      return state.guesses[index];
    }
    if (index === state.guesses.length) {
      return {guess: state.currentLetters, feedback: []};
    }
    return {guess: [], feedback: []};
  });

  return (
    <div
      className="guess-board"
      style={{
        "--answer-length": state.riddle.answerLength,
        "--board-max-width": `${state.riddle.answerLength * 66 - 8}px`,
      } as CSSProperties}
    >
      {rows.map((row, rowIndex) => (
        <div className="guess-row" key={rowIndex}>
          {Array.from({length: state.riddle!.answerLength}, (_, cellIndex) => (
            <button
              type="button"
              disabled={rowIndex !== state.guesses.length || state.hintRevealedIndices.includes(cellIndex)}
              aria-label={`${tr("Accessibility.LETTER_PREFIX")}${cellIndex + 1}${
                row.guess[cellIndex] ? `: ${row.guess[cellIndex]}` : ""
              }`}
              aria-current={
                rowIndex === state.guesses.length && cellIndex === state.activeSlotIndex ? "true" : undefined
              }
              onClick={() => dispatch({type: "selectSlot", index: cellIndex})}
              className={[
                "cell",
                row.feedback[cellIndex] ??
                  (rowIndex === state.guesses.length && state.hintRevealedIndices.includes(cellIndex)
                    ? "green"
                    : ""),
                rowIndex === state.guesses.length && cellIndex === state.activeSlotIndex ? "active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={cellIndex}
            >
              {row.guess[cellIndex] ?? ""}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function Keyboard({
  state,
  dispatch,
  playFeedback,
}: {
  state: GameSessionState;
  dispatch: Dispatch<Parameters<typeof gameSessionReducer>[1]>;
  playFeedback: (kind: "key" | "delete" | "submit" | "win" | "loss") => void;
}) {
  const keyClass = (letter: string): string => {
    const feedback = state.letterStates[letter.toLowerCase()];
    return feedback ? `key ${feedback}` : "key";
  };

  return (
    <section className="keyboard" aria-label={tr("Accessibility.SUBMIT_GUESS")}>
      {keyboardRows.map((row) => (
        <div key={row}>
          {splitGraphemes(row).map((letter) => (
            <button
              className={keyClass(letter)}
              key={letter}
              onClick={() => {
                playFeedback("key");
                dispatch({type: "typeLetter", letter});
              }}
            >
              {letter}
            </button>
          ))}
          {row === "ZXCVBNM" && (
            <button
              className="key utility"
              onClick={() => {
                playFeedback("delete");
                dispatch({type: "backspace"});
              }}
              aria-label={tr("Accessibility.BACKSPACE")}
            >
              <img src={backspaceUrl} alt="" />
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

function GameModalView({
  state,
  onClose,
  onContinue,
  onPurchase,
  onNext,
  onOpenModal,
  onToggleMute,
  onRequestHint,
  onRequestSkip,
  onRequestLeaderboard,
  onUpdateUsername,
}: {
  state: GameSessionState;
  onClose: () => void;
  onContinue: (amount?: number) => void;
  onPurchase: (productId: string) => void;
  onNext: () => void;
  onOpenModal: (modal: Exclude<GameModal, null>) => void;
  onToggleMute: () => void;
  onRequestHint: () => void;
  onRequestSkip: () => void;
  onRequestLeaderboard: (type: "xp" | "totalWins" | "bestStreak") => void;
  onUpdateUsername: (username: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [victoryStepIndex, setVictoryStepIndex] = useState(0);
  const [rewardStepIndex, setRewardStepIndex] = useState(0);
  const modalRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (state.modal === "leaderboard") {
      onRequestLeaderboard(state.leaderboardType);
    }
  }, [onRequestLeaderboard, state.leaderboardType, state.modal]);

  useEffect(() => {
    if (!state.modal) {
      return;
    }
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;
    modal?.scrollTo({top: 0, left: 0});
    modal?.parentElement?.scrollTo({top: 0, left: 0});
    const externalNotice = document.querySelector<HTMLElement>(".play-alert");
    if (externalNotice) {
      externalNotice.inert = true;
      externalNotice.setAttribute("aria-hidden", "true");
    }
    const getFocusable = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ) ?? [],
      );
    window.requestAnimationFrame(() => getFocusable()[0]?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (state.modal !== "victory") {
          onCloseRef.current();
        }
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
      if (externalNotice) {
        externalNotice.inert = false;
        externalNotice.removeAttribute("aria-hidden");
      }
    };
  }, [state.lastRewards, state.modal]);

  useEffect(() => {
    setVictoryStepIndex(0);
  }, [state.lastOutcome?.id]);

  useEffect(() => {
    setRewardStepIndex(0);
  }, [state.auxiliaryFanfare?.id]);

  if (!state.modal) {
    return null;
  }

  type FanfareStep =
    | {kind: "achievement"; achievementId: string}
    | {kind: "victory"}
    | {kind: "level"}
    | {kind: "rank"}
    | {kind: "purchase"};
  const victoryLevel = state.lastRewards?.newLevel;
  const reachedNewRank =
    state.lastRewards?.leveledUp === true &&
    victoryLevel !== undefined &&
    getRankForLevel(Math.max(1, victoryLevel - 1)).id !== getRankForLevel(victoryLevel).id;
  const victorySteps: FanfareStep[] = state.lastRewards
    ? [
        ...state.lastRewards.newlyUnlockedAchievementIds.map(
          (achievementId): FanfareStep => ({kind: "achievement", achievementId}),
        ),
        {kind: "victory"},
        ...(state.lastRewards.leveledUp ? ([{kind: "level"}] as FanfareStep[]) : []),
        ...(reachedNewRank ? ([{kind: "rank"}] as FanfareStep[]) : []),
      ]
    : [];
  const auxiliarySteps: FanfareStep[] = state.auxiliaryFanfare
    ? [
        ...(state.auxiliaryFanfare.kind === "purchase" ? ([{kind: "purchase"}] as FanfareStep[]) : []),
        ...state.auxiliaryFanfare.achievementIds.map(
          (achievementId): FanfareStep => ({kind: "achievement", achievementId}),
        ),
      ]
    : [];
  const activeVictoryStep = victorySteps[Math.min(victoryStepIndex, Math.max(0, victorySteps.length - 1))];
  const activeRewardStep = auxiliarySteps[Math.min(rewardStepIndex, Math.max(0, auxiliarySteps.length - 1))];

  const titles: Record<Exclude<GameModal, null>, string> = {
    victory: tr("VictoryModal.TITLE"),
    continue: tr("LossModal.OUT_OF_ATTEMPTS"),
    shop: tr("CoinShop.TITLE"),
    profile: tr("Profile.TITLE"),
    settings: tr("Settings.TITLE"),
    leaderboard: tr("Leaderboard.TITLE"),
    achievements: tr("Achievements.MODAL_TITLE"),
    statistics: tr("StatsModal.TITLE"),
    ranks: tr("Ranks.TITLE"),
    instructions: tr("Instructions.GOAL_TITLE"),
    credits: tr("Credits.TITLE"),
    about: tr("AboutLegal.TITLE"),
    hint: tr("GameScreenAlerts.HINT_MODAL_TITLE"),
    skip: tr("GameScreenAlerts.SKIP_MODAL_TITLE"),
    username: tr("Profile.UPDATE_USERNAME_TITLE"),
    treasure: tr("Profile.TREASURE_CHEST_TITLE"),
    reward: tr("CoinPurchase.TITLE"),
  };
  const activeFanfareStep = state.modal === "victory" ? activeVictoryStep : activeRewardStep;
  if (activeFanfareStep?.kind === "achievement") {
    titles[state.modal] = tr("Achievements.FANFARE_TITLE");
  } else if (activeFanfareStep?.kind === "level") {
    titles.victory = tr("LevelUpFanfare.TITLE");
  } else if (activeFanfareStep?.kind === "rank") {
    titles.victory = tr("RankUpFanfare.TITLE");
  }

  const profile = state.profile;
  const rank = getRankForLevel(profile?.level ?? 1);
  const nextRank = getNextRankForLevel(profile?.level ?? 1);
  const xpForLevel = (level: number) => {
    const completed = Math.max(0, level - 1);
    return completed * 100 + ((completed - 1) * completed * 10) / 2;
  };
  const currentThreshold = xpForLevel(profile?.level ?? 1);
  const nextThreshold = xpForLevel((profile?.level ?? 1) + 1);
  const xpProgress = Math.min(
    100,
    Math.max(0, (((profile?.xp ?? 0) - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)) * 100),
  );
  const achievementPlayer: AchievementPlayerData = {
    coins: profile?.coins ?? 0,
    hasPurchasedApp: profile?.hasPurchasedApp ?? false,
    progress: {
      classicIndex: profile?.classicIndex ?? 1,
      dailyChallengeIndex: profile?.dailyChallengeIndex ?? 0,
      dailyChallengeCurrentQuestion: profile?.dailyChallengeCurrentQuestion ?? 0,
    },
    stats: {
      xp: profile?.xp ?? 0,
      level: profile?.level ?? 1,
      dailyPuzzlesCompleted: profile?.dailyPuzzlesCompleted ?? 0,
      bestStreak: profile?.bestStreak ?? 0,
      totalWordsGuessed: profile?.totalWordsGuessed ?? 0,
      winRate: profile?.winRate ?? 0,
      averageGuesses: profile?.averageGuesses ?? 0,
      totalScore: profile?.totalScore ?? 0,
      highestLevelClassic: profile?.highestLevelClassic ?? 0,
      gamesPlayed: profile?.gamesPlayed ?? 0,
      wins: profile?.wins ?? 0,
      challengeWins: profile?.challengeWins ?? 0,
      winStreak: profile?.winStreak ?? 0,
      totalWins: profile?.totalWins ?? profile?.wins ?? 0,
      totalGuessesInWins: profile?.totalGuessesInWins ?? 0,
      totalHintsUsed: profile?.totalHintsUsed ?? 0,
    },
  };
  const submitUsername = (event: FormEvent) => {
    event.preventDefault();
    const normalized = username.trim();
    if (normalized.length < 3) {
      return;
    }
    onUpdateUsername(normalized);
    setUsername("");
  };
  const skipCost = state.gameMode === "challenge" ? 150 : 100;
  const isMandatoryOutcome = state.modal === "victory";
  const advanceVictoryFanfare = () => {
    if (victoryStepIndex + 1 < victorySteps.length) {
      setVictoryStepIndex((index) => index + 1);
      return;
    }
    onClose();
    window.setTimeout(onNext, 220);
  };
  const advanceRewardFanfare = () => {
    if (rewardStepIndex + 1 < auxiliarySteps.length) {
      setRewardStepIndex((index) => index + 1);
      return;
    }
    onClose();
  };

  return (
    <div
      className="game-modal-backdrop"
      role="presentation"
      onMouseDown={isMandatoryOutcome ? undefined : onClose}
    >
      {state.modal !== "profile" ? <SpinningWheel /> : null}
      <section
        ref={modalRef}
        className={`game-modal modal-${state.modal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {!isMandatoryOutcome && (
          <button className="modal-x" onClick={onClose} aria-label={tr("CommonAlerts.CLOSE_BUTTON")}>
            ×
          </button>
        )}
        <h2 id="game-modal-title">{titles[state.modal]}</h2>

        {state.modal === "victory" && (
          <div className="fanfare-content">
            <div className="fanfare-burst" aria-hidden="true">✦</div>
            {!activeVictoryStep ? (
              <p aria-live="polite">{tr("WebPortal.HOST_STATUS_WAITING")}</p>
            ) : activeVictoryStep.kind === "achievement" ? (
              <AchievementFanfare achievementId={activeVictoryStep.achievementId} />
            ) : activeVictoryStep.kind === "level" ? (
              <div className="reward-summary">
                <span className="fanfare-emblem">✦</span>
                <strong>{tr("LevelUpFanfare.LEVEL_PREFIX")}{victoryLevel}</strong>
                <span>{tr("LevelUpFanfare.PROFILE_GUIDANCE")}</span>
              </div>
            ) : activeVictoryStep.kind === "rank" ? (
              <div className="reward-summary">
                <span
                  className="rank-emblem large"
                  style={{background: getRankForLevel(victoryLevel ?? 1).color}}
                >
                  ✦
                </span>
                <strong>{tr(getRankForLevel(victoryLevel ?? 1).nameKey)}</strong>
                <span>{tr("RankUpFanfare.SUBTITLE")}</span>
              </div>
            ) : (
              <>
                <strong className="fanfare-title">{tr("VictoryModal.YOU_WON_TITLE")}</strong>
                <div className="reward-summary">
                  <span>+{state.lastRewards?.coinsEarned ?? 0} {tr("VictoryModal.COINS_SUFFIX")}</span>
                  {state.lastRewards?.newXp !== undefined && <span>{state.lastRewards.newXp} {tr("StatsModal.XP")}</span>}
                  {state.lastRewards?.newWinStreak !== undefined && <span>🔥 {state.lastRewards.newWinStreak}</span>}
                </div>
                <button
                  className="play-secondary"
                  onClick={() => window.dispatchEvent(new CustomEvent("riddle-quest:share-referral", {
                    detail: {
                      gameMode: state.riddle?.gameMode,
                      challengeId: state.riddle?.riddleId,
                      attempts: state.guesses.length,
                    },
                  }))}
                >
                  {tr("VictoryModal.SHARE_TEXT")}
                </button>
              </>
            )}
            {activeVictoryStep && (
              <>
                <small className="sequence-progress">
                  {victoryStepIndex + 1}/{victorySteps.length}
                </small>
                <button className="play-primary" onClick={advanceVictoryFanfare}>
                  {victoryStepIndex + 1 < victorySteps.length
                    ? tr("GameScreenAlerts.NEXT_BUTTON")
                    : tr("VictoryModal.NEXT_LEVEL_BUTTON")}
                </button>
              </>
            )}
          </div>
        )}

        {state.modal === "reward" && state.auxiliaryFanfare && (
          <div className="fanfare-content">
            <div className="fanfare-burst" aria-hidden="true">✦</div>
            {activeRewardStep?.kind === "purchase" ? (
              <div className="reward-summary">
                <img className="reward-coin" src={coinUrl} alt="" />
                <strong>+{state.auxiliaryFanfare.coinsAwarded}{tr("CoinPurchase.COINS_SUFFIX")}</strong>
                <span>{state.auxiliaryFanfare.totalCoins.toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}</span>
              </div>
            ) : activeRewardStep?.kind === "achievement" ? (
              <AchievementFanfare achievementId={activeRewardStep.achievementId} />
            ) : null}
            <small className="sequence-progress">
              {rewardStepIndex + 1}/{Math.max(1, auxiliarySteps.length)}
            </small>
            <button className="play-primary" onClick={advanceRewardFanfare}>
              {rewardStepIndex + 1 < auxiliarySteps.length
                ? tr("GameScreenAlerts.NEXT_BUTTON")
                : tr("CoinPurchase.AWESOME_BUTTON")}
            </button>
          </div>
        )}

        {state.modal === "continue" && (
          <div className="modal-actions continue-actions">
            <p>{tr("LossModal.EXTRA_GO_PROMPT")}</p>
            <div className="continue-balance">
              <img src={treasureChestUrl} alt="" />
              <strong>{tr("Profile.TOTAL_COINS_LABEL")}</strong>
              <span>{(profile?.coins ?? 0).toLocaleString()}</span>
            </div>
            <button
              className="play-primary"
              disabled={(profile?.coins ?? 0) < 100}
              onClick={() => onContinue(100)}
            >
              {tr("LossModal.USE_COINS_PREFIX")}100{tr("LossModal.USE_COINS_SUFFIX")}
            </button>
            {(profile?.coins ?? 0) < 100 && (
              <p>{tr("GameScreenAlerts.CONTINUE_NOT_ENOUGH_COINS_MESSAGE")}</p>
            )}
            <button className="play-primary" onClick={() => onOpenModal("shop")}>
              {tr("LossModal.OPEN_SHOP_BUTTON")}
            </button>
            <button className="play-primary" onClick={() => onOpenModal("skip")}>
              {tr("LossModal.SKIP_PUZZLE_BUTTON")}
            </button>
          </div>
        )}

        {state.modal === "shop" && (
          <div>
            <div className="shop-balance">
              <img src={coinUrl} alt="" />
              <span>{tr("CoinShop.YOUR_BALANCE")}</span>
              <strong>{(profile?.coins ?? 0).toLocaleString()}</strong>
            </div>
            <div className="game-shop-grid">
              {state.products.length === 0 && <p>{tr("CoinShop.NO_PACKS_AVAILABLE")}</p>}
              {state.products.map((product) => (
                <article key={product.productId}>
                  {product.featuredBadge && <em>{product.featuredBadge}</em>}
                  <img className="shop-product-coins" src={coinUrl} alt="" />
                  <strong className="shop-product-name">{product.name}</strong>
                  <span className="shop-product-amount">
                    {product.coins.toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}
                  </span>
                  <small className="shop-product-description">{product.description}</small>
                  <button className="play-primary compact" onClick={() => onPurchase(product.productId)}>
                    <span className="shop-purchase-label">{tr("CoinShop.PURCHASE_BUTTON")} </span>
                    {product.displayPrice}
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        {state.modal === "profile" && (
          <div className="profile-page">
            <div className="profile-hero">
              <div className="profile-identity" data-tooltip="profileIdentity">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <div className="profile-avatar-fallback" aria-hidden="true">
                    {(profile?.username ?? tr("Profile.GUEST_USERNAME")).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <strong>{profile?.username ?? tr("Profile.GUEST_USERNAME")}</strong>
                  <button className="play-text-button" onClick={() => onOpenModal("username")}>
                    {tr("Profile.EDIT_BUTTON")}
                  </button>
                </div>
              </div>
              <section className="rank-card" data-tooltip="profileProgression">
                <span className="rank-emblem" style={{background: rank.color}}>✦</span>
                <div>
                  <small>{tr("Ranks.CURRENT_RANK")}</small>
                  <strong>{tr(rank.nameKey)}</strong>
                  <p>{tr(rank.descriptionKey)}</p>
                </div>
              </section>
              <div className="xp-progress">
                <span>{tr("Profile.XP_LEVEL_PREFIX")}{profile?.level ?? 1}</span>
                <div><i style={{width: `${xpProgress}%`}} /></div>
                <span>{profile?.xp ?? 0} {tr("StatsModal.XP")}</span>
              </div>
              {nextRank && (
                <p className="next-rank">{tr("Ranks.NEXT_RANK_PREFIX")} {tr(nextRank.nameKey)} {tr("Ranks.AT_LEVEL_PREFIX")} {nextRank.minimumLevel}</p>
              )}
            </div>
            <dl className="profile-stats" data-tooltip="profileStats">
              <div data-tooltip="profileCoins"><dt>{tr("Profile.TOTAL_COINS_LABEL")}</dt><dd>{profile?.coins ?? 0}</dd></div>
              <div><dt>{tr("Profile.TOTAL_WINS_STAT")}</dt><dd>{profile?.totalWins ?? profile?.wins ?? 0}</dd></div>
              <div><dt>{tr("Profile.BEST_STREAK_STAT")}</dt><dd>{profile?.bestStreak ?? 0}</dd></div>
              <div data-tooltip="profileDailyPuzzles"><dt>{tr("Profile.DAILY_PUZZLES_STAT")}</dt><dd>{profile?.dailyPuzzlesCompleted ?? 0}</dd></div>
            </dl>
            <div className="profile-links">
              <button data-tooltip="profileStatistics" onClick={() => onOpenModal("statistics")}>{tr("StatsModal.TITLE")}</button>
              <button data-tooltip="profileAchievements" onClick={() => onOpenModal("achievements")}>{tr("Achievements.MODAL_TITLE")}</button>
              <button
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenModal("ranks");
                }}
              >
                {tr("Ranks.TITLE")}
              </button>
              <button data-tooltip="profileLeaderboard" onClick={() => onOpenModal("leaderboard")}>{tr("Leaderboard.TITLE")}</button>
              <button onClick={() => onOpenModal("treasure")}>{tr("Profile.TREASURE_CHEST_TITLE")}</button>
            </div>
          </div>
        )}

        {state.modal === "settings" && (
          <div className="settings-page">
            <button className="settings-row" onClick={onToggleMute}>
              <span>{tr("Settings.SOUND_TOGGLE")}</span>
              <strong>{state.muted ? tr("Settings.TOGGLE_OFF") : tr("Settings.TOGGLE_ON")}</strong>
            </button>
            <label className="settings-row">
              <span>{tr("Settings.LANGUAGE_LABEL")}</span>
              <select
                value={state.locale}
                onChange={(event) => {
                  const locale = event.target.value as Locale;
                  localStorage.setItem("appLanguage", locale);
                  setLocale(locale);
                }}
              >
                {LANGUAGE_OPTIONS.map((language) => (
                  <option key={language.code} value={language.code}>{language.label}</option>
                ))}
              </select>
            </label>
            <button className="settings-row" onClick={() => onOpenModal("instructions")}>
              <span>{tr("Settings.HELP_BUTTON")}</span><strong>›</strong>
            </button>
            <button className="settings-row" onClick={() => onOpenModal("credits")}>
              <span>{tr("Settings.CREDITS_BUTTON")}</span><strong>›</strong>
            </button>
            <button className="settings-row" onClick={() => onOpenModal("about")}>
              <span>{tr("Settings.ABOUT_BUTTON")}</span><strong>›</strong>
            </button>
            <button className="settings-row" onClick={() => onOpenModal("shop")}>
              <span>{tr("Navigation.BUY_COINS_BUTTON")}</span><strong>›</strong>
            </button>
          </div>
        )}

        {state.modal === "achievements" && (
          <div className="achievement-grid">
            {ACHIEVEMENT_DEFINITIONS.map((achievement) => {
              const unlocked = profile?.achievements.includes(achievement.id) ?? false;
              const progress = unlocked
                ? achievement.threshold
                : Math.min(achievement.threshold, achievement.getProgress(achievementPlayer));
              return (
                <article className={unlocked ? "unlocked" : ""} key={achievement.id}>
                  <span className="achievement-icon">{achievement.icon}</span>
                  <div>
                    <strong>{achievement.name}</strong>
                    <p>{achievement.description}</p>
                    <div className="achievement-progress">
                      <i style={{width: `${(progress / achievement.threshold) * 100}%`}} />
                    </div>
                    <small>{progress}/{achievement.threshold}</small>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {state.modal === "statistics" && (
          <dl className="full-stat-grid">
            {[
              [tr("StatsModal.GAMES_PLAYED"), profile?.gamesPlayed ?? 0],
              [tr("StatsModal.TOTAL_WINS"), profile?.totalWins ?? profile?.wins ?? 0],
              [tr("StatsModal.CHALLENGE_WINS"), profile?.challengeWins ?? 0],
              [tr("StatsModal.CURRENT_STREAK"), profile?.winStreak ?? 0],
              [tr("StatsModal.BEST_STREAK"), profile?.bestStreak ?? 0],
              [tr("StatsModal.DAILY_PUZZLES"), profile?.dailyPuzzlesCompleted ?? 0],
              [tr("StatsModal.TOTAL_WORDS_GUESSED"), profile?.totalWordsGuessed ?? 0],
              [tr("StatsModal.WIN_RATE"), `${Math.round(profile?.winRate ?? 0)}%`],
              [tr("StatsModal.AVG_GUESSES"), (profile?.averageGuesses ?? 0).toFixed(1)],
              [tr("StatsModal.TOTAL_SCORE"), profile?.totalScore ?? 0],
              [tr("StatsModal.HIGHEST_CLASSIC_LEVEL"), profile?.highestLevelClassic ?? 0],
              [tr("StatsModal.HINTS_USED"), profile?.totalHintsUsed ?? 0],
              [tr("StatsModal.XP"), profile?.xp ?? 0],
              [tr("Profile.XP_LEVEL_PREFIX"), profile?.level ?? 1],
            ].map(([label, value]) => (
              <div key={String(label)}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        )}

        {state.modal === "ranks" && (
          <div className="rank-list">
            {PLAYER_RANKS.map((item) => (
              <article className={item.id === rank.id ? "current" : ""} key={item.id}>
                <span className="rank-emblem" style={{background: item.color}}>✦</span>
                <div><strong>{tr(item.nameKey)}</strong><p>{tr(item.descriptionKey)}</p></div>
                <small>{tr("Ranks.LEVEL_REQUIREMENT_PREFIX")}{item.minimumLevel}</small>
              </article>
            ))}
          </div>
        )}

        {state.modal === "leaderboard" && (
          <div>
            <div className="leaderboard-tabs">
              {(["xp", "totalWins", "bestStreak"] as const).map((type) => (
                <button
                  className={state.leaderboardType === type ? "active" : ""}
                  key={type}
                  onClick={() => onRequestLeaderboard(type)}
                >
                  {tr(type === "xp" ? "Leaderboard.TAB_XP" : type === "totalWins" ? "Leaderboard.TAB_WINS" : "Leaderboard.TAB_STREAK")}
                </button>
              ))}
            </div>
            <ol className="leaderboard-list">
              {state.leaderboard.length === 0 && <li>{tr("Leaderboard.NO_SCORES_YET")}</li>}
              {state.leaderboard.map((entry, index) => (
                <li key={entry.userId}>
                  <b>{index + 1}</b><span>{entry.username}</span>
                  <strong>{state.leaderboardType === "xp" ? entry.xp : state.leaderboardType === "totalWins" ? entry.totalWins : entry.bestStreak}</strong>
                </li>
              ))}
            </ol>
          </div>
        )}

        {state.modal === "instructions" && (
          <div className="instructions-page">
            <p>{tr("Instructions.GOAL_DESCRIPTION")}</p>
            <h3>{tr("Instructions.COLOR_CLUES_TITLE")}</h3>
            <p><i className="clue green">A</i>{tr("Instructions.COLOR_CORRECT")}</p>
            <p><i className="clue yellow">B</i>{tr("Instructions.COLOR_MISPLACED")}</p>
            <p><i className="clue red">C</i>{tr("Instructions.COLOR_WRONG")}</p>
            <h3>{tr("Instructions.TIPS_TITLE")}</h3>
            <p>{tr("Instructions.TIPS_DESCRIPTION")}</p>
            <button className="play-primary" onClick={onClose}>{tr("Instructions.GOT_IT_BUTTON")}</button>
          </div>
        )}

        {state.modal === "hint" && (
          <div className="modal-actions">
            <p>{tr("GameScreenAlerts.COST_COINS_PREFIX")}50{tr("GameScreenAlerts.COST_COINS_SUFFIX")}</p>
            {(profile?.coins ?? 0) >= 50 ? (
              <button className="play-primary" onClick={() => { onRequestHint(); onClose(); }}>
                {tr("GameScreenAlerts.HINT_SHOW_BUTTON")}
              </button>
            ) : (
              <>
                <p>{tr("GameScreenAlerts.HINT_NOT_ENOUGH_COINS_MESSAGE")}</p>
                <button className="play-primary" onClick={() => onOpenModal("shop")}>
                  {tr("LossModal.OPEN_SHOP_BUTTON")}
                </button>
              </>
            )}
          </div>
        )}

        {state.modal === "skip" && (
          <div className="modal-actions">
            <p>{tr("GameScreenAlerts.COST_COINS_PREFIX")}{skipCost}{tr("GameScreenAlerts.COST_COINS_SUFFIX")}</p>
            {(profile?.coins ?? 0) >= skipCost ? (
              <button className="play-primary" onClick={() => { onRequestSkip(); onClose(); }}>
                {tr("GameScreenAlerts.SKIP_LEVEL_BUTTON")}
              </button>
            ) : (
              <>
                <p>{tr("GameScreenAlerts.SKIP_NOT_ENOUGH_COINS_MESSAGE")}</p>
                <button className="play-primary" onClick={() => onOpenModal("shop")}>
                  {tr("LossModal.OPEN_SHOP_BUTTON")}
                </button>
              </>
            )}
          </div>
        )}

        {state.modal === "username" && (
          <form className="username-form" onSubmit={submitUsername}>
            <label>
              {tr("Profile.USERNAME_LABEL")}
              <input
                autoFocus
                minLength={3}
                maxLength={24}
                value={username}
                placeholder={tr("Profile.ENTER_NEW_USERNAME_PLACEHOLDER")}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <button className="play-primary" disabled={username.trim().length < 3}>
              {tr("Profile.SAVE_BUTTON")}
            </button>
          </form>
        )}

        {state.modal === "credits" && (
          <div className="credits-list">
            <p>{tr("Credits.SUBTITLE")}</p>
            {[
              ["Craig Beswetherick", "Lead Developer & Game Design"],
              ["Reuben Beswetherick", "Inspiration"],
              ["Mike Hawkyard", "Game Designer, Publisher, Overall Hero"],
              ["Gavin Harrison", "Sound Design"],
              ["Nathalia", "Design"],
              ["Mr Ben", "Design"],
            ].map(([name, role]) => <article key={name}><strong>{name}</strong><span>{role}</span></article>)}
            <h3>{tr("Credits.THANK_YOU_TITLE")}</h3>
            <p>{tr("Credits.THANK_YOU_TEXT")}</p>
          </div>
        )}

        {state.modal === "about" && (
          <div className="about-list">
            {[
              "RIDDLE_QUEST_WEBSITE",
              "PRIVACY_POLICY",
              "TERMS_OF_USE",
              "ACCOUNT_DELETION",
              "DATA_EXPORT",
              "THIRD_PARTY_LICENSES",
              "SUPPORT",
            ].map((key) => <div key={key}>{tr(`AboutLegal.${key}`)}</div>)}
          </div>
        )}

        {state.modal === "treasure" && (
          <div className="treasure-chest">
            <img src={treasureChestUrl} alt="" />
            <strong>{(profile?.coins ?? 0).toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}</strong>
            <button className="play-primary" onClick={() => onOpenModal("shop")}>
              {tr("Navigation.BUY_COINS_BUTTON")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function AchievementFanfare({achievementId}: {achievementId: string}) {
  const achievement = ACHIEVEMENT_DEFINITIONS.find((item) => item.id === achievementId);
  return (
    <div className="achievement-unlock">
      <span className="achievement-icon large" aria-hidden="true">{achievement?.icon ?? "🏆"}</span>
      <strong>{achievement?.name ?? achievementId}</strong>
      {achievement?.description && <p>{achievement.description}</p>}
    </div>
  );
}
