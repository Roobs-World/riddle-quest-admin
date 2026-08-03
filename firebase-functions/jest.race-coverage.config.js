const baseConfig = require("./jest.config.js");

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  collectCoverage: true,
  collectCoverageFrom: [
    "src/race/**/*.ts",
    "!src/race/**/__tests__/**",
    // Firestore transactions and rollout persistence are covered by the
    // emulator-backed raceService/raceRules integration suites.
    "!src/race/raceService.ts",
    "!src/race/raceRollout.ts",
  ],
  coverageDirectory: "coverage/race",
  coverageReporters: ["text-summary", "json-summary", "lcov"],
  coverageThreshold: {
    global: {statements: 90, branches: 80, functions: 80, lines: 90},
  },
};
