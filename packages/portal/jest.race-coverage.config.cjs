const baseConfig = require("./jest.config.cjs");

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  collectCoverage: true,
  collectCoverageFrom: [
    "portal/src/play/race/**/*.{ts,tsx}",
    "hosted/src/race/**/*.ts",
    "!portal/src/play/race/**/__tests__/**",
    // Bridge lifecycle and focus/resize effects are verified by the multiplayer
    // Playwright flow; unit coverage targets the independently testable modules.
    "!portal/src/play/race/RaceTo10Game.tsx",
    "!portal/src/play/race/hooks/**",
    // Native input event normalization and provider-owned player overlays require
    // real DOM/provider lifecycles; target browser flows own those two seams.
    "!portal/src/play/race/components/NativeAnswerInput.tsx",
    "!portal/src/play/race/components/PlatformPlayerOverlay.tsx",
  ],
  coverageDirectory: "portal/coverage/race",
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
