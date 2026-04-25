import * as admin from "firebase-admin"; // Import admin for FieldValue type

export type Player = {
  userId: string;
  progress: {
    dailyChallengeIndex: number;
    classicIndex: number;
  };
  coins: number;
  username: string;
  email: string;
  displayName: string;
  registeredAt: Date | null;
  lastLogin: Date | null;
  lastDailyChallengeCompletedAt?: Date | null;
  currentRiddle?: Riddle;
  avatarUrl?: string | null;
  stats?: PlayerStats;
  hasPurchasedApp?: boolean;
};

export type PlayerStats = {
  xp: number | admin.firestore.FieldValue;
  level: number | admin.firestore.FieldValue;
  gamesPlayed: number | admin.firestore.FieldValue;
  wins: number | admin.firestore.FieldValue;
  winStreak: number | admin.firestore.FieldValue;
  bestStreak: number | admin.firestore.FieldValue;
  totalWordsGuessed: number | admin.firestore.FieldValue;
  winRate: number | admin.firestore.FieldValue;
  totalScore: number | admin.firestore.FieldValue;
  highestLevelClassic: number | admin.firestore.FieldValue;
  challengeWins: number | admin.firestore.FieldValue;
};

export type Riddle = {
  answer: string;
  text: string;
};

export interface PurchaseValidationResponse {
  success: boolean;
  newCoins?: number;
  newlyUnlockedAchievementIds?: string[];
}
