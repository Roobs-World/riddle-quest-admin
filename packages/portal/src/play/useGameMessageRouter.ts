import {useMemo} from "react";
import type {Dispatch, MutableRefObject} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {createGameMessageRouter} from "./bridgeRouter";
import {gameSessionReducer, type GameSessionState} from "./gameSession";
import {tr} from "./i18n";

/** Gets object. */
const getObject = (data: unknown): Record<string, unknown> =>
  typeof data === "object" && data !== null ? data as Record<string, unknown> : {};
/** Gets string. */
const getString = (value: unknown) => typeof value === "string" ? value : undefined;
/** Gets number. */
const getNumber = (value: unknown) => typeof value === "number" ? value : undefined;
/** Gets string array. */
const getStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
/** Parses canonical guess feedback returned by the backend. */
const getGuessFeedback = (value: unknown): Array<{
  letter: string[];
  feedback: Array<"green" | "yellow" | "red">;
}> => Array.isArray(value)
  ? value.flatMap((item) => {
      const entry = getObject(item);
      const letter = getString(entry.letter);
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
}: {
  dispatch: GameDispatch;
  stateRef: MutableRefObject<GameSessionState>;
  postToHost: (message: GameToHostMessage) => void;
  requestRiddle: () => void;
  onCompletionResult?: (ok: boolean) => void;
}) {
  return useMemo(() => createGameMessageRouter({
    init: (message) => dispatch({
      type: "hostInit",
      locale: message.payload.locale,
      gameMode: message.payload.gameMode,
      user: message.payload.user,
      profile: message.payload.profile,
      products: message.payload.products,
    }),
    authState: (message) => dispatch({type: "authState", user: message.payload.user, profile: message.payload.profile}),
    riddleLoaded: (message) => dispatch({type: "loadRiddle", riddle: message.payload.riddle, profile: message.payload.profile}),
    operationResult: async (message) => {
      if (!message.payload.ok) {
        if (message.payload.operation === "leaderboard") dispatch({type: "leaderboardLoadFailed"});
        if (message.payload.operation === "guess") dispatch({type: "guessFailed"});
        if (message.payload.operation === "completeGame") onCompletionResult?.(false);
        dispatch({type: "setNotice", notice: message.payload.error ?? "ErrorMessages.GENERIC_UNEXPECTED_ERROR"});
        return;
      }

      const data = getObject(message.payload.data);
      if (message.payload.operation === "guess") {
        const feedbackItems = getGuessFeedback(data.feedback);
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
        const index = getNumber(data.index);
        const revealedLetter = getString(data.revealedLetter);
        const achievementIds = getStringArray(data.newlyUnlockedAchievementIds);
        if (index !== undefined && revealedLetter) {
          dispatch({type: "applyHint", index, letter: revealedLetter, newCoins: getNumber(data.newCoins)});
        }
        if (achievementIds.length > 0) dispatch({
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
        const newCoins = getNumber(data.newCoins);
        if (newCoins !== undefined) dispatch({type: "coinsUpdated", newCoins});
        if (stateRef.current.modal === "continue") dispatch({type: "continueGranted"});
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
        const newCoins = getNumber(data.newCoins);
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
        const reward = getNumber(data.coinsEarned);
        const completedOutcome = stateRef.current.lastOutcome;
        dispatch({
          type: "completionReward",
          reward: {
            coinsEarned: reward ?? 0,
            totalCoins: getNumber(data.rewardBreakdown && typeof data.rewardBreakdown === "object"
              ? (data.rewardBreakdown as Record<string, unknown>).newBalance
              : undefined),
            newXp: getNumber(data.newXp),
            newLevel: getNumber(data.newLevel),
            leveledUp: data.leveledUp === true,
            newWinStreak: getNumber(data.newWinStreak),
            newlyUnlockedAchievementIds: getStringArray(data.newlyUnlockedAchievementIds),
          },
        });
        onCompletionResult?.(true);
        if (reward && stateRef.current.profile) {
          dispatch({type: "setNotice", notice: tr("GameMessages.COINS_EARNED") + reward});
        }
        if (completedOutcome?.kind === "loss") requestRiddle();
        return;
      }
      if (message.payload.operation === "leaderboard") {
        const {BridgeLeaderboardEntrySchema} = await import("@qwordly/core/bridge");
        const entries = Array.isArray(data.entries) ? data.entries.flatMap((entry) => {
          const parsed = BridgeLeaderboardEntrySchema.safeParse(entry);
          return parsed.success ? [parsed.data] : [];
        }) : [];
        const leaderboardType = data.type === "totalWins" || data.type === "bestStreak" ? data.type : "xp";
        dispatch({type: "leaderboardLoaded", leaderboardType, entries});
        return;
      }
      if (message.payload.operation === "profile") {
        const {BridgeProfileSchema} = await import("@qwordly/core/bridge");
        const parsed = BridgeProfileSchema.safeParse(data.profile);
        if (parsed.success) {
          dispatch({type: "profileUpdated", profile: parsed.data});
          dispatch({type: "openModal", modal: "profile"});
        }
      }
    },
    pause: () => dispatch({type: "pause"}),
    resume: () => dispatch({type: "resume"}),
  }), [dispatch, onCompletionResult, postToHost, requestRiddle, stateRef]);
}
