import {useMemo} from "react";
import type {Dispatch, MutableRefObject} from "react";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {BridgeLeaderboardEntrySchema, BridgeProfileSchema} from "@qwordly/core/bridge";
import {createGameMessageRouter} from "./bridgeRouter";
import {gameSessionReducer, type GameSessionState} from "./gameSession";
import {tr} from "./i18n";

const getObject = (data: unknown): Record<string, unknown> =>
  typeof data === "object" && data !== null ? data as Record<string, unknown> : {};
const getString = (value: unknown) => typeof value === "string" ? value : undefined;
const getNumber = (value: unknown) => typeof value === "number" ? value : undefined;
const getStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

type GameDispatch = Dispatch<Parameters<typeof gameSessionReducer>[1]>;

export function useGameMessageRouter({
  dispatch,
  stateRef,
  postToHost,
  requestRiddle,
}: {
  dispatch: GameDispatch;
  stateRef: MutableRefObject<GameSessionState>;
  postToHost: (message: GameToHostMessage) => void;
  requestRiddle: () => void;
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
    operationResult: (message) => {
      if (!message.payload.ok) {
        if (message.payload.operation === "leaderboard") dispatch({type: "leaderboardLoadFailed"});
        dispatch({type: "setNotice", notice: message.payload.error ?? "ErrorMessages.GENERIC_UNEXPECTED_ERROR"});
        return;
      }

      const data = getObject(message.payload.data);
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
      if (message.payload.operation === "skip") {
        dispatch({type: "closeModal"});
        return;
      }
      if (message.payload.operation === "purchase") {
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
            newlyUnlockedAchievementIds: getStringArray(data.newlyUnlockedAchievementIds),
          },
        });
        if (reward && stateRef.current.profile) {
          dispatch({type: "setNotice", notice: tr("GameMessages.COINS_EARNED") + reward});
        }
        if (completedOutcome?.kind === "loss") requestRiddle();
        return;
      }
      if (message.payload.operation === "leaderboard") {
        const entries = Array.isArray(data.entries) ? data.entries.flatMap((entry) => {
          const parsed = BridgeLeaderboardEntrySchema.safeParse(entry);
          return parsed.success ? [parsed.data] : [];
        }) : [];
        const leaderboardType = data.type === "totalWins" || data.type === "bestStreak" ? data.type : "xp";
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
  }), [dispatch, postToHost, requestRiddle, stateRef]);
}
