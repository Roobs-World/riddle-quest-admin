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
import {validatePurchase} from "./iapValidation";
import {spendCoins, skipRiddle} from "./gameLogic";
import {
  setCompletedDailyChallenge,
  hasCompletedDailyChallenge,
  getCurrentDailyChallenge,
  getCurrentDailyChallengeQuestion,
  advanceDailyChallengeProgress,
} from "./dailyChallenge";
import {
  generateClassicRiddles,
  initializeRiddleDatabase,
  generateDailyRiddles,
  generateTodaysDailyChallengeFunction,
  generateTutorialRiddles,
} from "./riddleGeneration";
import {getCurrentTutorialRiddle, advanceTutorialProgress, initializeTutorialRiddlesFunction} from "./tutorialRiddles";
import {updateAvatar, updateUsername} from "./profile";
import {submitGuess, completeGame} from "./submitGuessLogic";
import {dailyChallengeScheduler} from "./dailyScheduler";
import {initializeUser, ensureUserComplete, updateUserStats} from "./userManagement";
import {sendNotificationCampaign, registerFcmToken} from "./notificationCampaigns";
import {notifyRewardedAdCompleted} from "./adClientCallbacks";
import {getLeaderboard} from "./leaderboard";
import {dailyStreakReminder} from "./streakNotifications";
export {
  awardedAdCallback,
  validatePurchase,
  spendCoins,
  skipRiddle,
  setCompletedDailyChallenge,
  hasCompletedDailyChallenge,
  getCurrentDailyChallenge,
  getCurrentDailyChallengeQuestion,
  advanceDailyChallengeProgress,
  generateClassicRiddles,
  initializeRiddleDatabase,
  generateDailyRiddles,
  generateTodaysDailyChallengeFunction,
  generateTutorialRiddles,
  getCurrentTutorialRiddle,
  advanceTutorialProgress,
  initializeTutorialRiddlesFunction,
  updateAvatar,
  updateUsername,
  submitGuess,
  completeGame,
  dailyChallengeScheduler,
  initializeUser,
  ensureUserComplete,
  updateUserStats,
  sendNotificationCampaign,
  registerFcmToken,
  notifyRewardedAdCompleted,
  getLeaderboard,
  dailyStreakReminder,
};
