import type React from "react";
import type {View} from "react-native";

export type TooltipId =
  | "submitAnswer"
  | "hintAfterWrongGuess"
  | "shopOutOfCoins"
  | "achievementEarned"
  | "leaderboardFifthCorrectAnswer"
  | "classicFromDaily"
  | "profileProgression"
  | "profileDailyStreak"
  | "profileIdentity"
  | "profileDailyPuzzles"
  | "profileStats"
  | "profileCoins"
  | "profileAchievements"
  | "profileStatistics"
  | "profileLeaderboard";

export type TooltipTargetRef = React.RefObject<View | null>;

export interface TooltipContent {
  title: string;
  body: string;
  action: string;
}

export interface TooltipRequest {
  id: TooltipId;
  targetRef?: TooltipTargetRef | null;
  highlightElement?: React.ReactNode;
  content: TooltipContent;
  preferredPlacement?: "auto" | "above" | "below";
  persist?: boolean;
  userId?: string | null;
  onBeforeShow?: () => void | Promise<void>;
}

export type TooltipSequenceRequest = TooltipRequest;

export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
