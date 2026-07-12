import {useCallback, useEffect, useMemo, useReducer, useRef, useState} from "react";
import type {CSSProperties, Dispatch} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {BRIDGE_PROTOCOL_VERSION} from "@qwordly/core/bridge/constants";
import {splitGraphemes, type Feedback} from "@qwordly/core/game";
import logoUrl from "../assets/main-logo.webp";
import coinUrl from "../assets/coin.svg";
import hintUrl from "../assets/hint.svg";
import backspaceUrl from "../assets/backspace-key.svg";
import settingsUrl from "../assets/settings-icon.svg";
import profileUrl from "../assets/profile-icon.svg";
import {createGameMessageRouter} from "./bridgeRouter";
import {
  createInitialGameSession,
  gameSessionReducer,
  type GameModal,
  type GameSessionState,
} from "./gameSession";
import {tr} from "./i18n";
import {createRequestId} from "./requestIds";

const keyboardRows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

const postToHost = (message: GameToHostMessage) => {
  if (window.parent === window) {
    return;
  }
  window.parent.postMessage({...message, sentAt: Date.now()}, window.location.origin);
};

const getObjectData = (data: unknown): Record<string, unknown> =>
  typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};

const getString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const getNumber = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);

export function GameFrameApp() {
  const [state, dispatch] = useReducer(gameSessionReducer, undefined, createInitialGameSession);
  const [completedIds] = useState(() => new Set<string>());
  const stateRef = useRef(state);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastAudioOutcomeRef = useRef<string | null>(null);
  stateRef.current = state;

  const playTone = useCallback((frequency: number, durationSeconds = 0.08) => {
    if (stateRef.current.muted || typeof window === "undefined") {
      return;
    }

    const AudioContextCtor =
      window.AudioContext ?? (window as Window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const context = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = context;
    if (context.state === "suspended") {
      void context.resume();
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationSeconds);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + durationSeconds);
  }, []);

  const playFeedback = useCallback(
    (kind: "key" | "delete" | "submit" | "win" | "loss") => {
      const tones = {
        key: 523.25,
        delete: 220,
        submit: 329.63,
        win: 783.99,
        loss: 164.81,
      } as const;
      playTone(tones[kind], kind === "win" ? 0.16 : 0.08);
    },
    [playTone],
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
  }, []);

  const requestRiddle = useCallback((nextMode = stateRef.current.gameMode) => {
    postToHost({
      type: "game:loadRiddle",
      requestId: createRequestId("load"),
      payload: {
        gameMode: nextMode,
        locale: stateRef.current.locale,
        classicIndex: stateRef.current.profile?.classicIndex,
      },
    });
  }, []);

  useEffect(() => {
    sendReady();
    const reportSize = () => {
      postToHost({
        type: "game:resize",
        requestId: createRequestId("resize"),
        payload: {
          width: Math.ceil(document.documentElement.scrollWidth),
          height: Math.ceil(document.documentElement.scrollHeight),
        },
      });
    };
    reportSize();
    window.addEventListener("resize", reportSize);
    const observer = new ResizeObserver(reportSize);
    observer.observe(document.body);
    return () => {
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
            if (index !== undefined && revealedLetter) {
              dispatch({type: "applyHint", index, letter: revealedLetter, newCoins: getNumber(data.newCoins)});
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
            if (newCoins !== undefined) {
              dispatch({type: "coinsUpdated", newCoins});
            }
            dispatch({
              type: "setNotice",
              notice: tr("WebPortal.PURCHASE_COMPLETE", {coins: getNumber(data.coinsAwarded) ?? 0}),
            });
            return;
          }

          if (message.payload.operation === "rewardedAd") {
            const newCoins = getNumber(data.newCoins);
            if (newCoins !== undefined) {
              dispatch({type: "coinsUpdated", newCoins});
            }
            if (data.placement === "loss_continue") {
              dispatch({type: "continueGranted"});
            }
            return;
          }

          if (message.payload.operation === "completeGame") {
            const reward = getNumber(data.coinsEarned);
            if (reward && stateRef.current.profile) {
              dispatch({type: "setNotice", notice: tr("GameMessages.COINS_EARNED") + reward});
            }
          }
        },
        pause: () => dispatch({type: "pause"}),
        resume: () => dispatch({type: "resume"}),
      }),
    [],
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
    return () => window.removeEventListener("message", handleMessage);
  }, [router]);

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
    const outcome = state.lastOutcome;
    if (!outcome || lastAudioOutcomeRef.current === outcome.id) {
      return;
    }
    lastAudioOutcomeRef.current = outcome.id;
    playFeedback(outcome.kind);
  }, [playFeedback, state.lastOutcome]);

  const submitGuess = () => {
    playFeedback("submit");
    dispatch({type: "submitGuess"});
  };
  const currentAttempt = state.riddle
    ? Array.from({length: state.riddle.answerLength}, (_, index) => state.currentLetters[index] ?? "")
    : [];

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

  const requestRewardedAd = (placement: "loss_continue" | "coin_shop") => {
    postToHost({
      type: "game:requestRewardedAd",
      requestId: createRequestId("rewarded"),
      payload: {placement},
    });
  };

  const requestPurchase = (productId: string) => {
    postToHost({
      type: "game:requestPurchase",
      requestId: createRequestId("purchase"),
      payload: {productId},
    });
  };

  return (
    <main className={state.paused ? "game-app paused" : "game-app"}>
      <GameHeader
        state={state}
        requestRiddle={requestRiddle}
        onOpenModal={(modal) => dispatch({type: "openModal", modal})}
        onToggleMute={() => dispatch({type: "toggleMute"})}
      />

      {!state.riddle ? (
        <section className="game-loading">
          <img src={logoUrl} alt={tr("WebPortal.APP_TITLE")} />
          <p>{tr("WebPortal.HOST_STATUS_WAITING")}</p>
        </section>
      ) : (
        <>
          <section className="riddle-surface">
            <p className="game-mode-label">{state.riddle.gameMode === "challenge" ? tr("WebPortal.PLAY_DAILY") : tr("WebPortal.PLAY_CLASSIC")}</p>
            <h1>{state.riddle.text}</h1>
            {state.notice && <div className="game-notice">{state.notice.startsWith("WebPortal.") || state.notice.startsWith("ErrorMessages.") ? tr(state.notice) : state.notice}</div>}
            <GuessBoard state={state} />
          </section>

          <section className="game-actions" aria-label={tr("Navigation.GAME")}>
            <button onClick={requestHint}><img src={hintUrl} alt="" />{tr("Navigation.HINT_BUTTON")}</button>
            <button onClick={requestSkip}>{tr("GameScreenAlerts.SKIP_LEVEL_BUTTON")}</button>
            <button onClick={() => dispatch({type: "openModal", modal: "shop"})}><img src={coinUrl} alt="" />{tr("CoinShop.TITLE")}</button>
          </section>

          <Keyboard state={state} submitGuess={submitGuess} dispatch={dispatch} playFeedback={playFeedback} />
        </>
      )}

      {state.paused && <div className="pause-banner">{tr("WebPortal.PAUSED")}</div>}
      <GameModalView
        state={state}
        onClose={() => dispatch({type: "closeModal"})}
        onContinue={requestContinue}
        onRewardedAd={requestRewardedAd}
        onPurchase={requestPurchase}
        onNext={() => requestRiddle(state.gameMode)}
        onOpenModal={(modal) => dispatch({type: "openModal", modal})}
        onToggleMute={() => dispatch({type: "toggleMute"})}
      />
    </main>
  );
}

function GameHeader({
  state,
  requestRiddle,
  onOpenModal,
  onToggleMute,
}: {
  state: GameSessionState;
  requestRiddle: (mode?: "classic" | "challenge") => void;
  onOpenModal: (modal: Exclude<GameModal, null>) => void;
  onToggleMute: () => void;
}) {
  return (
    <header className="game-header">
      <button className="logo-button" onClick={() => requestRiddle(state.gameMode)} aria-label={tr("Accessibility.LOGO_BUTTON")}>
        <img src={logoUrl} alt="" />
      </button>
      <div className="coin-pill">
        <img src={coinUrl} alt="" />
        <strong>{(state.profile?.coins ?? 0).toLocaleString()}</strong>
      </div>
      <nav aria-label={tr("Navigation.GAME")}>
        <button onClick={() => requestRiddle("classic")} className={state.gameMode === "classic" ? "active" : ""}>{tr("WebPortal.PLAY_CLASSIC")}</button>
        <button onClick={() => requestRiddle("challenge")} className={state.gameMode === "challenge" ? "active" : ""}>{tr("WebPortal.PLAY_DAILY")}</button>
      </nav>
      <div className="icon-actions">
        <button className="sound-button" onClick={onToggleMute} aria-label={state.muted ? tr("Accessibility.UNMUTE_SOUND") : tr("Accessibility.MUTE_SOUND")}>
          {state.muted ? tr("Settings.TOGGLE_OFF") : tr("Settings.TOGGLE_ON")}
        </button>
        <button onClick={() => onOpenModal("profile")} aria-label={tr("Navigation.PROFILE_BUTTON")}><img src={profileUrl} alt="" /></button>
        <button onClick={() => onOpenModal("settings")} aria-label={tr("Navigation.SETTINGS_BUTTON")}><img src={settingsUrl} alt="" /></button>
      </div>
    </header>
  );
}

function GuessBoard({state}: {state: GameSessionState}) {
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
    <div className="guess-board" style={{"--answer-length": state.riddle.answerLength} as CSSProperties}>
      {rows.map((row, rowIndex) => (
        <div className="guess-row" key={rowIndex}>
          {Array.from({length: state.riddle!.answerLength}, (_, cellIndex) => (
            <span className={row.feedback[cellIndex] ? `cell ${row.feedback[cellIndex]}` : "cell"} key={cellIndex}>
              {row.guess[cellIndex] ?? ""}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Keyboard({
  state,
  submitGuess,
  dispatch,
  playFeedback,
}: {
  state: GameSessionState;
  submitGuess: () => void;
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
      <button className="submit-key" onClick={submitGuess}>{tr("GameScreenAlerts.SUBMIT_BUTTON")}</button>
    </section>
  );
}

function GameModalView({
  state,
  onClose,
  onContinue,
  onRewardedAd,
  onPurchase,
  onNext,
  onOpenModal,
  onToggleMute,
}: {
  state: GameSessionState;
  onClose: () => void;
  onContinue: (amount?: number) => void;
  onRewardedAd: (placement: "loss_continue" | "coin_shop") => void;
  onPurchase: (productId: string) => void;
  onNext: () => void;
  onOpenModal: (modal: Exclude<GameModal, null>) => void;
  onToggleMute: () => void;
}) {
  if (!state.modal) {
    return null;
  }

  const title =
    state.modal === "victory"
      ? tr("VictoryModal.TITLE")
      : state.modal === "loss" || state.modal === "continue"
        ? tr("LossModal.TITLE")
        : state.modal === "shop"
          ? tr("CoinShop.TITLE")
          : state.modal === "profile"
            ? tr("Profile.TITLE")
            : state.modal === "leaderboard"
              ? tr("Leaderboard.TITLE")
              : state.modal === "achievements"
                ? tr("Achievements.MODAL_TITLE")
                : tr("Settings.TITLE");

  return (
    <div className="game-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="game-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>{tr("CommonAlerts.CLOSE_BUTTON")}</button>
        <h2>{title}</h2>

        {state.modal === "victory" && (
          <>
            <p>{tr("VictoryModal.YOU_WON_TITLE")}</p>
            <button className="play-primary" onClick={onNext}>{tr("VictoryModal.NEXT_LEVEL_BUTTON")}</button>
            <button className="play-secondary" onClick={() => onOpenModal("achievements")}>{tr("Achievements.MODAL_TITLE")}</button>
          </>
        )}

        {state.modal === "continue" && (
          <>
            <p>{tr("LossModal.EXTRA_GO_PROMPT")}</p>
            <button className="play-primary" onClick={() => onContinue(50)}>{tr("LossModal.USE_COINS_PREFIX")}50{tr("LossModal.USE_COINS_SUFFIX")}</button>
            <button className="play-secondary" onClick={() => onRewardedAd("loss_continue")}>{tr("LossModal.WATCH_AD_BUTTON")}</button>
          </>
        )}

        {state.modal === "loss" && (
          <>
            <p>{tr("LossModal.ANSWER_PREFIX")}{state.riddle?.answer.toUpperCase()}</p>
            <button className="play-primary" onClick={onNext}>{tr("LossModal.NEXT_LEVEL_BUTTON")}</button>
          </>
        )}

        {state.modal === "shop" && (
          <div className="game-shop-grid">
            {state.products.map((product) => (
              <article key={product.productId}>
                <strong>{product.name}</strong>
                <span>{product.coins.toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}</span>
                <button className="play-primary compact" onClick={() => onPurchase(product.productId)}>
                  {tr("CoinShop.PURCHASE_BUTTON")} {product.displayPrice}
                </button>
              </article>
            ))}
            <button className="play-secondary" onClick={() => onRewardedAd("coin_shop")}>{tr("RewardedAdPrompts.WATCH_AD_BUTTON")}</button>
          </div>
        )}

        {state.modal === "profile" && (
          <dl className="profile-stats">
            <div><dt>{tr("Profile.USERNAME_LABEL")}</dt><dd>{state.profile?.username ?? tr("Profile.GUEST_USERNAME")}</dd></div>
            <div><dt>{tr("Profile.TOTAL_COINS_LABEL")}</dt><dd>{state.profile?.coins ?? 0}</dd></div>
            <div><dt>{tr("Profile.TOTAL_WINS_STAT")}</dt><dd>{state.profile?.wins ?? 0}</dd></div>
          </dl>
        )}

        {state.modal === "settings" && (
          <>
            <button className="play-secondary" onClick={onToggleMute}>
              {tr("Settings.SOUND_TOGGLE")}: {state.muted ? tr("Settings.TOGGLE_OFF") : tr("Settings.TOGGLE_ON")}
            </button>
            <button className="play-secondary" onClick={() => onOpenModal("shop")}>{tr("Navigation.BUY_COINS_BUTTON")}</button>
          </>
        )}

        {state.modal === "achievements" && (
          <div className="achievement-list">
            {(state.profile?.achievements.length ? state.profile.achievements : [tr("WebPortal.ACHIEVEMENTS_EMPTY")]).map((achievement) => (
              <span key={achievement}>{achievement}</span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
