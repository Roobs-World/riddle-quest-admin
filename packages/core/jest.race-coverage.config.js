const baseConfig = require("./jest.config.js");

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  collectCoverage: true,
  collectCoverageFrom: ["src/race/**/*.ts", "!src/race/**/__tests__/**"],
  coverageDirectory: "coverage/race",
  coverageReporters: ["text-summary", "json-summary", "lcov"],
  coverageThreshold: {
    global: {statements: 95, branches: 95, functions: 70, lines: 95},
  },
};
