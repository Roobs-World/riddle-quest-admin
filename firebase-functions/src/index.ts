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
import {getApps, initializeApp} from "firebase-admin/app";

// Initialize the Firebase Admin SDK once for all functions in this project.
if (getApps().length === 0) initializeApp();

import {getHint, spendCoins, skipRiddle} from "./gameLogic";
import {getCurrentDailyChallenge, getCurrentClassicRiddle} from "./dailyChallenge";
import {updateAvatar, updateUsername} from "./profile";
import {completeGame} from "./completeGameCallable";
import {dailyChallengeScheduler} from "./dailyScheduler";
import {getLeaderboard} from "./leaderboard";
import {
  getRaceChallenge,
  getRaceAccess,
  getRaceOutcome,
  listRaceCategories,
  listRaceInbox,
  publishRaceChallenge,
  recordRaceAnalytics,
  requestRaceHint,
  resumeRaceRun,
  skipRaceRiddle,
  startRaceRun,
  submitRaceGuess,
} from "./race/raceCallables";
import {exchangeJestIdentity, grantJestPurchase, syncJestSubscriptions, verifyJestReferrals} from "./jestEndpoints";
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
  listRaceCategories,
  listRaceInbox,
  startRaceRun,
  submitRaceGuess,
  requestRaceHint,
  skipRaceRiddle,
  resumeRaceRun,
  publishRaceChallenge,
  getRaceChallenge,
  getRaceAccess,
  getRaceOutcome,
  recordRaceAnalytics,
  exchangeJestIdentity,
  grantJestPurchase,
  syncJestSubscriptions,
  verifyJestReferrals,
};
