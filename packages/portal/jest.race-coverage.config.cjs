const baseConfig = require("./jest.config.cjs");

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  collectCoverage: true,
  collectCoverageFrom: [
    "src/play/race/**/*.{ts,tsx}",
    "!src/play/race/**/__tests__/**",
    // Bridge lifecycle and focus/resize effects are verified by the multiplayer
    // Playwright flow; unit coverage targets the independently testable modules.
    "!src/play/race/RaceTo10Game.tsx",
    "!src/play/race/hooks/**",
  ],
  coverageDirectory: "coverage/race",
  coverageReporters: ["text-summary", "json-summary", "lcov"],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 70,
      functions: 85,
      lines: 90,
    },
  },
};
