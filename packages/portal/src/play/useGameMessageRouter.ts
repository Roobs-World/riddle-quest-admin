import {useLayoutEffect, useMemo, useRef} from "react";
import type {Dispatch, MutableRefObject} from "react";
import type {GameToHostMessage, HostToGameMessage} from "@qwordly/core/bridge";
import {createGameMessageRouter} from "./bridgeRouter";
import {gameSessionReducer, type GameSessionState} from "./gameSession";
import {tr} from "./i18n";

/** Gets object. */
const getObject = (data: unknown): Record<string, unknown> =>
  typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
/** Gets string. */
const getString = (value: unknown) => (typeof value === "string" ? value : undefined);
/** Gets number. */
const getNumber = (value: unknown) => (typeof value === "number" ? value : undefined);
/** Gets string array. */
const getStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
/** Parses canonical guess feedback returned by the backend. */
const getGuessFeedback = (
  value: unknown,
): Array<{
  /** Stores letter. */
  letter: string[];
  /** Stores feedback. */
  feedback: Array<"green" | "yellow" | "red">;
}> =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        /** Provides entry behavior. */
        const entry = getObject(item);
        /** Provides letter behavior. */
        const letter = getString(entry.letter);
        /** Provides status behavior. */
        const status = entry.status;
        return letter && (status === "green" || status === "yellow" || status === "red")
          ? [{letter: [letter.toUpperCase()], feedback: [status]}]
          : [];
      })
    : [];

/** Describes game dispatch. */
type GameDispatch = Dispatch<Parameters<typeof gameSessionReducer>[1]>;

/** Provides game message router. */
export function useGameMessageRouter({
  dispatch,
  stateRef,
  postToHost,
  requestRiddle,
  onCompletionResult,
  onGuessResult,
  acceptRiddleResult,
}: {
  /** Stores dispatch. */
  dispatch: GameDispatch;
  /** Stores state ref. */
  stateRef: MutableRefObject<GameSessionState>;
  /** Stores post to host. */
  postToHost: (message: GameToHostMessage) => void;
  /** Stores request riddle. */
  requestRiddle: () => void;
  /** Stores on completion result. */
  onCompletionResult?: (ok: boolean, requestId?: string) => boolean;
  /** Handles an optimistic guess before the default single-response reducer path. */
  onGuessResult?: (message: Extract<HostToGameMessage, {
    /** Correlated result discriminator. */ type: "host:operationResult";
  }>) => boolean;
  /** Rejects stale question deliveries from replayed paid actions. */
  acceptRiddleResult?: (message: Extract<HostToGameMessage, {
    /** Correlated question result. */ type: "host:riddleLoaded";
  }>) => boolean;
}) {
  /** Rendered outcome is captured separately from the mutable operation state ref. */
  const outcome = stateRef.current.lastOutcome;
  /** Completion presentation follows the visible question while replacement rendering is suspended. */
  const committedOutcomeRef = useRef(outcome);
  useLayoutEffect(() => {committedOutcomeRef.current = outcome;}, [outcome]);
  return useMemo(
    () =>
      createGameMessageRouter({
        init: (message) =>
          dispatch({
            type: "hostInit",
            locale: message.payload.locale,
            gameMode: message.payload.gameMode,
            user: message.payload.user,
            profile: message.payload.profile,
            products: message.payload.products,
          }),
        authState: (message) =>
          dispatch({type: "authState", user: message.payload.user, profile: message.payload.profile}),
        riddleLoaded: (message) => {
          if (acceptRiddleResult && !acceptRiddleResult(message)) return;
          dispatch({type: "loadRiddle", riddle: message.payload.riddle,
            profile: message.requestId?.startsWith("skip-") ? undefined : message.payload.profile,
            preserveNotice: message.requestId?.startsWith("reconcile-")});
        },
        operationResult: async (message, isCurrent) => {
          if (onGuessResult?.(message)) return;
          if (!message.payload.ok) {
            // Multiplayer owns its failures while mounted. Once its overlay is
            // closed, a late race response must not become the solo notice.
            if (message.payload.operation.startsWith("race")) return;
            if (message.payload.operation === "spendCoins" && message.requestId)
              dispatch({type: "rejectCoinSpend", requestId: message.requestId});
            if (message.payload.operation === "leaderboard") {
              dispatch({type: "leaderboardLoadFailed", requestId: message.requestId});
              return;
            }
            if (message.payload.operation === "guess") dispatch({type: "guessFailed"});
            if (message.payload.operation === "completeGame") {
              onCompletionResult?.(false, message.requestId);
              return;
            }
            dispatch({type: "setNotice", notice: message.payload.error ?? "ErrorMessages.GENERIC_UNEXPECTED_ERROR"});
            return;
          }

          /** Provides data behavior. */
          const data = getObject(message.payload.data);
          if (message.payload.operation === "guess") {
            /** Provides feedback items behavior. */
            const feedbackItems = getGuessFeedback(data.feedback);
            /** Provides attempts behavior. */
            const attempts = getNumber(data.attempts);
            if (attempts === undefined || feedbackItems.length === 0) {
              dispatch({type: "guessFailed"});
              dispatch({type: "setNotice", notice: "ErrorMessages.GENERIC_UNEXPECTED_ERROR"});
              return;
            }
            dispatch({
              type: "guessResolved",
              feedback: {
                guess: feedbackItems.flatMap((item) => item.letter),
                feedback: feedbackItems.flatMap((item) => item.feedback),
              },
              attempts,
              isCorrect: data.isCorrect === true,
              gameOver: data.gameOver === true,
              canContinue: data.canContinue === true,
            });
            return;
          }
          if (message.payload.operation === "hint") {
            if (message.payload.data === null) {
              dispatch({type: "rejectHint"});
              dispatch({type: "setNotice", notice: tr("GameScreenAlerts.HINT_NOT_AVAILABLE_MESSAGE")});
              return;
            }
            /** Provides index behavior. */
            const index = getNumber(data.index);
            /** Provides revealed letter behavior. */
            const revealedLetter = getString(data.revealedLetter);
            /** Provides achievement ids behavior. */
            const achievementIds = getStringArray(data.newlyUnlockedAchievementIds);
            if (index !== undefined && revealedLetter) {
              dispatch({type: "applyHint", index, letter: revealedLetter, newCoins: getNumber(data.newCoins)});
            }
            if (achievementIds.length > 0)
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
            return;
          }

          if (message.payload.operation === "spendCoins") {
            /** Provides new coins behavior. */
            const newCoins = getNumber(data.newCoins);
            if (message.requestId && stateRef.current.pendingCoinSpend?.requestId === message.requestId) {
              if (newCoins !== undefined) dispatch({type: "confirmCoinSpend", requestId: message.requestId, newCoins});
              else {
                dispatch({type: "rejectCoinSpend", requestId: message.requestId});
                dispatch({type: "setNotice", notice: "ErrorMessages.GENERIC_UNEXPECTED_ERROR"});
              }
            }
            return;
          }
          if (message.payload.operation === "accountDeletion") {
            dispatch({type: "closeModal"});
            dispatch({type: "setNotice", notice: tr("Profile.DELETE_ACCOUNT_SUCCESS_MESSAGE")});
            return;
          }
          if (message.payload.operation === "skip") {
            dispatch({type: "closeModal"});
            return;
          }
          if (message.payload.operation === "purchase") {
            if (data.cancelled === true) return;
            if (data.purchaseType === "subscription") {
              dispatch({type: "closeModal"});
              return;
            }
            /** Provides new coins behavior. */
            const newCoins = getNumber(data.newCoins);
            /** Provides coins awarded behavior. */
            const coinsAwarded = getNumber(data.coinsAwarded) ?? 0;
            if (newCoins !== undefined) dispatch({type: "coinsUpdated", newCoins});
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
          if (message.payload.operation === "raceOutcome" || message.payload.operation === "racePublish") {
            /** Provides achievement ids behavior. */
            const achievementIds = getStringArray(data.newlyUnlockedAchievementIds);
            if (achievementIds.length > 0) {
              dispatch({
                type: "showAuxiliaryFanfare",
                fanfare: {
                  id: `${message.payload.operation}-${Date.now()}`,
                  kind: "achievement",
                  coinsAwarded: getNumber(data.achievementCoinsAwarded) ?? 0,
                  totalCoins: getNumber(data.newCoins) ?? stateRef.current.profile?.coins ?? 0,
                  achievementIds,
                },
              });
            }
            return;
          }
          if (message.payload.operation === "completeGame") {
            /** Provides reward behavior. */
            const reward = getNumber(data.coinsEarned);
            /** Whether this reward still belongs to the visible riddle. */
            const currentCompletion = onCompletionResult?.(true, message.requestId) ?? true;
            /** Provides completed outcome behavior. */
            const completedOutcome = currentCompletion ? committedOutcomeRef.current : null;
            if (currentCompletion) dispatch({
              type: "completionReward",
              reward: {
                coinsEarned: reward ?? 0,
                totalCoins: getNumber(
                  data.rewardBreakdown && typeof data.rewardBreakdown === "object"
                    ? (data.rewardBreakdown as Record<string, unknown>).newBalance
                    : undefined,
                ),
                newXp: getNumber(data.newXp),
                newLevel: getNumber(data.newLevel),
                leveledUp: data.leveledUp === true,
                newWinStreak: getNumber(data.newWinStreak),
                newlyUnlockedAchievementIds: getStringArray(data.newlyUnlockedAchievementIds),
              },
            });
            if (currentCompletion && reward && stateRef.current.profile) {
              dispatch({type: "setNotice", notice: tr("GameMessages.COINS_EARNED") + reward});
            }
            if (completedOutcome?.kind === "loss") requestRiddle();
            return;
          }
          if (message.payload.operation === "leaderboard") {
            /** Provides {bridge leaderboard entry schema} behavior. */
            const {BridgeLeaderboardEntrySchema} = await import("@qwordly/core/bridge");
            if (isCurrent && !isCurrent()) return;
            /** Provides entries behavior. */
            const entries = Array.isArray(data.entries)
              ? data.entries.flatMap((entry) => {
                  /** Parses d. */
                  const parsed = BridgeLeaderboardEntrySchema.safeParse(entry);
                  return parsed.success ? [parsed.data] : [];
                })
              : [];
            /** Provides leaderboard type behavior. */
            const leaderboardType = data.type === "totalWins" || data.type === "bestStreak" || data.type === "multiplayerWins" ? data.type : "xp";
            dispatch({type: "leaderboardLoaded", leaderboardType, entries, requestId: message.requestId});
            return;
          }
          if (message.payload.operation === "profile") {
            /** Provides {bridge profile schema} behavior. */
            const {BridgeProfileSchema} = await import("@qwordly/core/bridge");
            if (isCurrent && !isCurrent()) return;
            /** Parses d. */
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
    [acceptRiddleResult, dispatch, onCompletionResult, onGuessResult, postToHost, requestRiddle, stateRef],
  );
}
