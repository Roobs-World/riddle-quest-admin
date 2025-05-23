import * as admin from "firebase-admin";
// Removed onCall and CallableContext imports as they are now in sub-modules
// Removed Request and Response imports as they are now in adCallbacks.ts
// Removed getRiddleDataFromSheet as it's used only in gameLogic.ts now
// Removed firestoreService imports that are now in sub-modules

// Removed unused imports and types
// import type { FirestoreRiddle } from "../../src/validation/firestoreSchemas";

// Removed environment variable definitions - these should ideally be accessed within the modules that need them
// Or manage them centrally if necessary
// const spreadsheetId = process.env.SPREADSHEET_ID;
// const accessToken = process.env.ACCESS_TOKEN;
// const applovinSdkKey = process.env.APPLOVIN_SDK_KEY;

// Ensure environment variables are set - moved check to adCallbacks.ts
// if (!spreadsheetId || !accessToken || !applovinSdkKey) {
//   throw new Error("Missing required environment variables: SPREADSHEET_ID, ACCESS_TOKEN, and APPLOVIN_SDK_KEY");
// }

admin.initializeApp();

// game logic
// export * from "./adCallbacks.js";
// export * from "./iapValidation.js";
// export * from "./gameLogic.js";
// export * from "./dailyChallenge.js";
// export * from "./riddleGeneration.js";
// export * from "./profile.js";

// Explicitly import and export functions from sub-modules
import {awardedAdCallback} from "./adCallbacks.js";
import {validatePurchase} from "./iapValidation.js";
import {getHint, spendCoins, skipRiddle} from "./gameLogic.js";
import {setCompletedDailyChallenge, hasCompletedDailyChallenge} from "./dailyChallenge.js";
import {generateClassicRiddles} from "./riddleGeneration.js";
import {resetStats} from "./profile.js";
import {submitGuess} from "./submitGuessLogic.js";

export {
  awardedAdCallback,
  validatePurchase,
  getHint,
  spendCoins,
  skipRiddle,
  setCompletedDailyChallenge,
  hasCompletedDailyChallenge,
  generateClassicRiddles,
  resetStats,
  submitGuess,
};

// Removed all individual function definitions and exports from here
