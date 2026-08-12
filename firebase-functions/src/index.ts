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

import {getHint, spendCoins, skipRiddle} from "./gameplay/gameLogic";
import {getCurrentDailyChallenge, getCurrentClassicRiddle} from "./daily/dailyChallenge";
import {deleteAccount, updateAvatar, updateUsername} from "./profile";
import {completeGame} from "./gameplay/completeGameCallable";
import {submitSinglePlayerGuess} from "./gameplay/submitSinglePlayerGuessCallable";
import {dailyChallengeScheduler} from "./daily/dailyScheduler";
import {getLeaderboard} from "./gameplay/leaderboard";
import {
  abandonRaceRun,
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
import {
  exchangeJestIdentity,
  grantJestPurchase,
  retryJestAccountDeletion,
  syncJestSubscriptions,
  verifyJestReferrals,
} from "./jest/jestEndpoints";
export {
  spendCoins,
  skipRiddle,
  getHint,
  getCurrentDailyChallenge,
  getCurrentClassicRiddle,
  updateUsername,
  updateAvatar,
  deleteAccount,
  completeGame,
  submitSinglePlayerGuess,
  dailyChallengeScheduler,
  getLeaderboard,
  listRaceCategories,
  listRaceInbox,
  startRaceRun,
  submitRaceGuess,
  requestRaceHint,
  skipRaceRiddle,
  resumeRaceRun,
  abandonRaceRun,
  publishRaceChallenge,
  getRaceChallenge,
  getRaceAccess,
  getRaceOutcome,
  recordRaceAnalytics,
  exchangeJestIdentity,
  grantJestPurchase,
  retryJestAccountDeletion,
  syncJestSubscriptions,
  verifyJestReferrals,
};
