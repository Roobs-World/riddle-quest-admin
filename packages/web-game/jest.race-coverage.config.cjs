const baseConfig = require("./jest.config.cjs");

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  collectCoverage: true,
  collectCoverageFrom: [
    "packages/web-game/src/play/race/**/*.{ts,tsx}",
    "packages/hosted/src/race/**/*.ts",
    "!packages/web-game/src/play/race/**/__tests__/**",
    // Bridge lifecycle and focus/resize effects are verified by the multiplayer
    // Playwright flow; unit coverage targets the independently testable modules.
    "!packages/web-game/src/play/race/RaceTo10Game.tsx",
    "!packages/web-game/src/play/race/hooks/**",
    // Native input event normalization and provider-owned player overlays require
    // real DOM/provider lifecycles; target browser flows own those two seams.
    "!packages/web-game/src/play/race/components/NativeAnswerInput.tsx",
    "!packages/web-game/src/play/race/components/PlatformPlayerOverlay.tsx",
  ],
  coverageDirectory: "packages/web-game/coverage/race",
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
