/**
 * @fileoverview
 * Firebase Functions entrypoint for Qwordly.
 *
 * This module initializes the Firebase Admin SDK once and re-exports all
 * callable and scheduled Cloud Functions from their feature-specific
 * submodules. Each submodule owns its own request/response validation and
 * environment variable access; this file is intentionally kept small and
 * declarative.
 */
import * as admin from "firebase-admin";

// Initialize the Firebase Admin SDK once for all functions in this project.
admin.initializeApp();

// Explicitly import and export functions from sub-modules
import {awardedAdCallback} from "./adCallbacks";
import {validatePurchase, grantDevCoinsForPurchase} from "./iapValidation";
import {spendCoins, skipRiddle} from "./gameLogic";
import {
  setCompletedDailyChallenge,
  hasCompletedDailyChallenge,
  getCurrentDailyChallenge,
  advanceDailyChallengeProgress,
} from "./dailyChallenge";
import {
  generateClassicRiddles,
  initializeRiddleDatabase,
  generateDailyRiddles,
  generateTodaysDailyChallengeFunction,
} from "./riddleGeneration";
import {updateAvatar, updateUsername} from "./profile";
import {submitGuess, completeGame} from "./submitGuessLogic";
import {dailyChallengeScheduler} from "./dailyScheduler";
import {initializeUser, ensureUserComplete, updateUserStats} from "./userManagement";
import {notifyRewardedAdCompleted} from "./adClientCallbacks";
import {getLeaderboard} from "./leaderboard";
import {dailyStreakReminder} from "./streakNotifications";
export {
  awardedAdCallback,
  validatePurchase,
  grantDevCoinsForPurchase,
  spendCoins,
  skipRiddle,
  setCompletedDailyChallenge,
  hasCompletedDailyChallenge,
  getCurrentDailyChallenge,
  advanceDailyChallengeProgress,
  generateClassicRiddles,
  initializeRiddleDatabase,
  generateDailyRiddles,
  generateTodaysDailyChallengeFunction,
  updateAvatar,
  updateUsername,
  submitGuess,
  completeGame,
  dailyChallengeScheduler,
  initializeUser,
  ensureUserComplete,
  updateUserStats,
  notifyRewardedAdCompleted,
  getLeaderboard,
  dailyStreakReminder,
};
