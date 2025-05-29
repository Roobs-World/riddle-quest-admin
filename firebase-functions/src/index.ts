import * as admin from "firebase-admin";
// Removed onCall and CallableContext imports as they are now in sub-modules
// Removed Request and Response imports as they are now in adCallbacks.ts
// Removed getRiddleDataFromSheet as it's used only in gameLogic.ts now
// Removed firestoreService imports that are now in sub-modules

// Removed unused imports and types
// import type { FirestoreRiddle } from "../../src/validation/firestoreSchemas";

// Environment variables are now accessed within the modules that need them

console.log(`[ENV_TEST] MY_TEST_VARIABLE: ${process.env.MY_TEST_VARIABLE}`);
console.log(`[ENV_TEST] APPLE_SHARED_SECRET: ${process.env.APPLE_SHARED_SECRET}`);

admin.initializeApp();

// game logic
// export * from "./adCallbacks.js";
// export * from "./iapValidation.js";
// export * from "./gameLogic.js";
// export * from "./dailyChallenge.js";
// export * from "./riddleGeneration.js";
// export * from "./profile.js";

// Explicitly import and export functions from sub-modules
import {awardedAdCallback} from "./adCallbacks";
import {validatePurchase} from "./iapValidation";
import {getHint, spendCoins} from "./gameLogic";
import {setCompletedDailyChallenge, hasCompletedDailyChallenge, getCurrentDailyChallenge} from "./dailyChallenge";
import {generateClassicRiddles, initializeRiddleDatabase} from "./riddleGeneration";
import {resetStats, updateAvatar} from "./profile";
import {submitGuess} from "./submitGuessLogic";

export {
  awardedAdCallback,
  validatePurchase,
  getHint,
  spendCoins,
  setCompletedDailyChallenge,
  hasCompletedDailyChallenge,
  getCurrentDailyChallenge,
  generateClassicRiddles,
  initializeRiddleDatabase,
  resetStats,
  updateAvatar,
  submitGuess,
};

// Removed all individual function definitions and exports from here
