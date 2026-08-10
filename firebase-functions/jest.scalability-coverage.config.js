const baseConfig = require("./jest.config.js");

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  testMatch: ["**/__tests__/dailyChallengeProgress.test.ts", "**/__tests__/riddleSupply.test.ts"],
  collectCoverage: true,
  collectCoverageFrom: ["src/daily/dailyChallengeProgress.ts", "src/riddles/riddleSupply.ts"],
  coverageDirectory: "coverage/scalability",
  coverageReporters: ["text", "text-summary", "json-summary"],
  coverageThreshold: {
    global: {statements: 100, branches: 100, functions: 100, lines: 100},
  },
};
