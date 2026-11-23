const baseConfig = require("./jest.config.js");

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  // The coverage gate exercises real transactions in the Firestore emulator,
  // alongside the pure engine, contracts and provider unit tests.
  testMatch: ["**/__tests__/race/**/*.test.ts", "**/__tests__/redditMatchmaking*.test.ts"],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/race/**/*.ts",
    "../platforms/web/facebook/server/notifications/facebookLiveChallengePush.ts",
    "../platforms/native/android/server/race/androidRaceAccount.ts",
    "!src/race/**/__tests__/**",
  ],
  coverageDirectory: "coverage/race",
  coverageReporters: ["text-summary", "json-summary", "lcov"],
  coverageThreshold: {
    global: {statements: 90, branches: 80, functions: 80, lines: 90},
  },
};
