const base = require("./jest.config.js");

/** Measures the production source with both unit behavior and real emulator transactions. */
module.exports = {
  ...base,
  testMatch: ["**/__tests__/**/*.test.ts", "!lib/**"],
  reporters: ["default", "<rootDir>/scripts/test-progress-reporter.cjs"],
};
