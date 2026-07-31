/**
 * @fileoverview
 * Firebase Functions entrypoint for Riddle Quest.
 *
 * This module initializes the Firebase Admin SDK once and re-exports the
 * minimal Jest trust boundary plus authoritative gameplay functions
 * submodules. Each submodule owns its own request/response validation and
 * environment variable access; this file is intentionally kept small and
 * declarative.
 */
import * as admin from "firebase-admin";

// Initialize the Firebase Admin SDK once for all functions in this project.
admin.initializeApp();

import {getHint, spendCoins, skipRiddle} from "./gameLogic";
import {
  getCurrentDailyChallenge,
  getCurrentClassicRiddle,
} from "./dailyChallenge";
import {updateAvatar, updateUsername} from "./profile";
import {completeGame} from "./submitGuessLogic";
import {dailyChallengeScheduler} from "./dailyScheduler";
import {getLeaderboard} from "./leaderboard";
import {
  exchangeJestIdentity,
  grantJestPurchase,
  syncJestSubscriptions,
  verifyJestReferrals,
} from "./jestEndpoints";
export {
  spendCoins,
  skipRiddle,
  getHint,
  getCurrentDailyChallenge,
  getCurrentClassicRiddle,
  updateUsername,
  updateAvatar,
  completeGame,
  dailyChallengeScheduler,
  getLeaderboard,
  exchangeJestIdentity,
  grantJestPurchase,
  syncJestSubscriptions,
  verifyJestReferrals,
};
