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
import {grantFacebookRewardedContinue} from "./facebook/facebookRewardedContinueCallable";
import {getCurrentDailyChallenge, getCurrentClassicRiddle} from "./daily/dailyChallenge";
import {getClassicRiddleBuffer} from "./daily/classicRiddleBuffer";
import {deleteAccount, syncJestAvatar, updateAvatar, updateUsername} from "./profile";
import {completeGame} from "./gameplay/completeGameCallable";
import {submitSinglePlayerGuess} from "./gameplay/submitSinglePlayerGuessCallable";
import {dailyChallengeScheduler} from "./daily/dailyScheduler";
import {getLeaderboard} from "./gameplay/leaderboard";
import {
  abandonRaceRun,
  getRaceChallenge,
  getRaceAccess,
  findRaceMatch,
  getRaceOutcome,
  listRaceCategories,
  listRaceInbox,
  publishRaceChallenge,
  reserveRaceInvite,
  getRaceEntry,
  cancelRaceInvite,
  recordRaceAnalytics,
  requestRaceHint,
  resumeRaceRun,
  skipRaceRiddle,
  startRaceRun,
  readyRaceRun,
  submitRaceGuess,
} from "./race/raceCallables";
import {
  exchangeJestIdentity,
  grantJestPurchase,
  retryJestAccountDeletion,
  syncJestSubscriptions,
  verifyJestReferrals,
} from "./jest/jestEndpoints";
import {exchangeFacebookIdentity, issueFacebookIdentityNonce} from "./facebook/facebookEndpoints";
import {facebookDataDeletionCallback, facebookDataDeletionStatus} from "./facebook/facebookDataDeletionEndpoints";
import {listFacebookTournament, recordFacebookTournament} from "./race/facebookTournamentCallable";
import {blockRival, reportRival} from "./social/socialSafetyCallables";
import {aggregatePresenceStatus} from "./presence/presenceAggregation";
import {setPresenceConsent} from "./presence/presenceConsentCallable";
import {bindFacebookReferral, createFacebookReferral} from "./facebook/facebookReferralCallables";
import {syncBlockedRivalPresenceVisibility, syncKnownRivalPresenceVisibility} from "./presence/presenceVisibility";
import {
  joinFacebookContext,
  leaveFacebookContext,
  listFacebookContextBoard,
  recordFacebookContextRun,
} from "./race/facebookContextCallables";
import {facebookContextRetentionScheduler} from "./race/facebookContextRetentionScheduler";
import {getFacebookClientConfiguration} from "./facebook/facebookClientConfigurationCallable";
import {
  acceptFacebookNotificationPermissionPrompt,
  claimFacebookNotificationPermissionPrompt,
} from "./facebook/facebookNotificationPromptCallables";
import {deleteRedditAccount, exchangeRedditIdentity} from "./reddit/redditEndpoints";
import {redditStorage} from "./reddit/redditStorageEndpoint";
import {redditGameplay} from "./reddit/redditGameplayEndpoint";
import {redditProfileRetentionScheduler} from "./reddit/redditProfileRetentionScheduler";
import {yahooOAuthCallback, yahooOAuthStart} from "./yahoo/yahooOAuthEndpoints";
import {
  confirmYahooStripeCheckout,
  createYahooStripeCheckout,
  yahooStripeWebhook,
} from "./yahoo/yahooStripeEndpoints";
export {
  spendCoins,
  grantFacebookRewardedContinue,
  skipRiddle,
  getHint,
  getCurrentDailyChallenge,
  getCurrentClassicRiddle,
  getClassicRiddleBuffer,
  updateUsername,
  updateAvatar,
  syncJestAvatar,
  deleteAccount,
  completeGame,
  submitSinglePlayerGuess,
  dailyChallengeScheduler,
  facebookContextRetentionScheduler,
  redditProfileRetentionScheduler,
  getLeaderboard,
  listRaceCategories,
  listRaceInbox,
  startRaceRun,
  readyRaceRun,
  submitRaceGuess,
  requestRaceHint,
  skipRaceRiddle,
  resumeRaceRun,
  abandonRaceRun,
  publishRaceChallenge,
  reserveRaceInvite,
  getRaceEntry,
  cancelRaceInvite,
  getRaceChallenge,
  getRaceAccess,
  findRaceMatch,
  getRaceOutcome,
  recordRaceAnalytics,
  exchangeJestIdentity,
  grantJestPurchase,
  retryJestAccountDeletion,
  syncJestSubscriptions,
  verifyJestReferrals,
  issueFacebookIdentityNonce,
  exchangeFacebookIdentity,
  facebookDataDeletionCallback,
  facebookDataDeletionStatus,
  recordFacebookTournament,
  listFacebookTournament,
  blockRival,
  reportRival,
  aggregatePresenceStatus,
  setPresenceConsent,
  createFacebookReferral,
  bindFacebookReferral,
  syncKnownRivalPresenceVisibility,
  syncBlockedRivalPresenceVisibility,
  joinFacebookContext,
  leaveFacebookContext,
  listFacebookContextBoard,
  recordFacebookContextRun,
  getFacebookClientConfiguration,
  claimFacebookNotificationPermissionPrompt,
  acceptFacebookNotificationPermissionPrompt,
  exchangeRedditIdentity,
  deleteRedditAccount,
  redditStorage,
  redditGameplay,
  yahooOAuthStart,
  yahooOAuthCallback,
  createYahooStripeCheckout,
  confirmYahooStripeCheckout,
  yahooStripeWebhook,
};

export {deliverRaceSettlementEvent, deliverRacePerformanceEvent, settleRaceDeadlines} from "./race/raceSettlementJobs";
export {reconcileRaceMatchProjections} from "./race/raceProjectionReconciliation";
export {monitorRaceRecoveryHealth} from "./race/raceRecoveryHealth";

export {replenishClassicSupply} from "./riddles/classicSupplyWorker";

export {joinLiveRace, updateLiveRace, getLiveRaceChallenge} from "./race/raceLiveCallables";
