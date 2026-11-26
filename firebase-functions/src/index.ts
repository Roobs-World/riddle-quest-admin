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
import {setGlobalOptions} from "firebase-functions/v2";

setGlobalOptions({minInstances: 0, preserveExternalChanges: true});

// Initialize the Firebase Admin SDK once for all functions in this project.
if (getApps().length === 0) initializeApp();

import {getHint, spendCoins, skipRiddle} from "./gameplay/callables/gameLogic";
import {grantFacebookRewardedContinue} from "../../platforms/web/facebook/server/facebookRewardedContinueCallable";
import {getCurrentDailyChallenge, getCurrentClassicRiddle} from "./daily/dailyChallenge";
import {getClassicRiddleBuffer} from "./daily/classicRiddleBuffer";
import {deleteAccount, getPlayerProfile, syncJestAvatar, updateAvatar, updateUsername} from "./profile/index";
import {completeGame} from "./gameplay/callables/completeGameCallable";
import {submitSinglePlayerGuess} from "./gameplay/callables/submitSinglePlayerGuessCallable";
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
} from "./race/api/raceCallables";
import {
  exchangeJestIdentity,
  grantJestPurchase,
  retryJestAccountDeletion,
  syncJestSubscriptions,
  verifyJestReferrals,
} from "../../platforms/web/jest/server/jestEndpoints";
import {exchangeFacebookIdentity, issueFacebookIdentityNonce} from "../../platforms/web/facebook/server/facebookEndpoints";
import {grantFacebookPurchase, facebookPaymentWebhook} from "../../platforms/web/facebook/server/facebookPayments";
import {createAndroidReferral, bindAndroidReferralEntry, getAndroidReferralStatus} from "../../platforms/native/android/server/androidReferralCallables";
import {deliverAndroidReferralPlay} from "../../platforms/native/android/server/androidReferralDelivery";
import {setAndroidPushSubscription} from "../../platforms/native/android/server/androidNotifications";
import {dispatchAndroidNotification} from "../../platforms/native/android/server/notifications/androidNotificationDispatch";
import {provisionAndroidAccount} from "../../platforms/native/android/server/provisionAndroidAccount";
import {grantAndroidPurchase, syncAndroidSubscriptions} from "../../platforms/native/android/server/androidPurchaseEndpoints";
import {exchangeAndroidAttestation, issueAndroidAttestationNonce} from "../../platforms/native/android/server/androidAttestation";
import {facebookDataDeletionCallback, facebookDataDeletionStatus} from "../../platforms/web/facebook/server/facebookDataDeletionEndpoints";
import {listFacebookTournament, recordFacebookTournament} from "../../platforms/web/facebook/server/race/facebookTournamentCallable";
import {blockRival, reportRival} from "./social/socialSafetyCallables";
import {aggregatePresenceStatus} from "./presence/presenceAggregation";
import {setPresenceConsent} from "./presence/presenceConsentCallable";
import {bindFacebookReferral, createFacebookReferral} from "../../platforms/web/facebook/server/facebookReferralCallables";
import {syncBlockedRivalPresenceVisibility, syncKnownRivalPresenceVisibility} from "./presence/presenceVisibility";
import {
  joinFacebookContext,
  leaveFacebookContext,
  listFacebookContextBoard,
  recordFacebookContextRun,
} from "../../platforms/web/facebook/server/race/facebookContextCallables";
import {getFacebookClientConfiguration} from "../../platforms/web/facebook/server/facebookClientConfigurationCallable";
import {
  acceptFacebookNotificationPermissionPrompt,
  claimFacebookNotificationPermissionPrompt,
} from "../../platforms/web/facebook/server/facebookNotificationPromptCallables";
import {deleteRedditAccount, exchangeRedditIdentity} from "../../platforms/web/reddit/server/redditEndpoints";
import {redditStorage} from "../../platforms/web/reddit/server/redditStorageEndpoint";
import {redditGameplay} from "../../platforms/web/reddit/server/redditGameplayEndpoint";
import {yahooOAuthCallback, yahooOAuthStart} from "../../platforms/web/yahoo/server/yahooOAuthEndpoints";
import {
  confirmYahooStripeCheckout,
  createYahooStripeCheckout,
  yahooStripeWebhook,
} from "../../platforms/web/yahoo/server/yahooStripeEndpoints";
export {
  spendCoins,
  grantFacebookRewardedContinue,
  skipRiddle,
  getHint,
  getCurrentDailyChallenge,
  getCurrentClassicRiddle,
  getClassicRiddleBuffer,
  getPlayerProfile,
  updateUsername,
  updateAvatar,
  syncJestAvatar,
  deleteAccount,
  completeGame,
  submitSinglePlayerGuess,
  dailyChallengeScheduler,
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
  provisionAndroidAccount,
  setAndroidPushSubscription,
  dispatchAndroidNotification,
  createAndroidReferral,
  bindAndroidReferralEntry,
  getAndroidReferralStatus,
  deliverAndroidReferralPlay,
  grantAndroidPurchase,
  syncAndroidSubscriptions,
  issueAndroidAttestationNonce,
  exchangeAndroidAttestation,
  issueFacebookIdentityNonce,
  exchangeFacebookIdentity,
  grantFacebookPurchase,
  facebookPaymentWebhook,
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

export {deliverRaceSettlementEvent, deliverRacePerformanceEvent} from "./race/settlement/raceSettlementJobs";

export {replenishClassicSupplyOnDemand, retryClassicSupplyOnDemand} from "./riddles/classicSupplyWorker";

export {joinLiveRace, retireLiveRaceJoin, updateLiveRace, confirmLiveGuessReceipt, getLiveRaceChallenge, sendLiveRaceChallenge, listLiveRaceChallenges, listLiveRaceHistory} from "./race/api/raceLiveCallables";
export {deliverLiveRaceChallengePush} from "./race/notifications/raceLivePushJobs";
export {setNotificationPreference} from "./notifications/notificationPreferences";

export {createNotificationEnrollment, getNotificationEnrollmentStatus} from "./notifications/notificationEnrollment";
export {notificationBrowserBridge} from "./notifications/notificationBrowserBridge";
export {dispatchFirebaseNotification} from "./notifications/notificationDispatch";
