/* eslint-env node */
module.exports = {
  rootDir: "../..",
  roots: ["<rootDir>/src", "<rootDir>/../platforms/native/android/server", "<rootDir>/../platforms/web/jest/server", "<rootDir>/../platforms/web/facebook/server", "<rootDir>/../platforms/web/reddit/server", "<rootDir>/../platforms/web/yahoo/server"],
  modulePaths: ["<rootDir>/node_modules"],
  testEnvironment: "node",
  testEnvironmentOptions: {globalsCleanup: "on"},
  testMatch: ["**/__tests__/**/*.test.ts", "!**/__tests__/**/*.it.test.ts", "!**/lib/**", "!**/.build-source/**"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  transform: {
    // Shared contract checks use the root feature source.
    "/src/.+\\.ts$": "<rootDir>/config/testing/shared-source-transform.cjs",
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/config/testing/tsconfig.test.json",
      },
    ],
  },
  clearMocks: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "json-summary"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "../platforms/**/server/**/*.{ts,tsx}",
    "!../platforms/**/server/**/__tests__/**",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
    "!src/**/*.{test,spec}.{ts,tsx}",
  ],
  coverageThreshold: {
    global: {statements: 71, branches: 56, functions: 59, lines: 72},
    "src/profile/leaderboardProfile.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/profile/updateUsername.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/riddles/riddleQuality.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/validation/callableValidation.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/daily/dailyStreak.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/profile/avatarUpload.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/race/access/raceRollout.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/gameplay/callables/completeGameCallable.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/profile/updateAvatar.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/race/settlement/raceAchievements.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/race/content/raceContentImport.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/race/content/raceContentMigration.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/race/content/raceContentValidation.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "../platforms/web/jest/server/jestSecurity.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/race/runs/raceEngine.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/race/raceReadService.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/gameplay/achievements.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
  },
  moduleNameMapper: {
    "^jose$": "<rootDir>/__mocks__/jose.js",
    "^jwks-rsa$": "<rootDir>/__mocks__/jwks-rsa.js",
  },
  transformIgnorePatterns: ["/node_modules/(?!(?:@firebase|firebase)/)"],
  setupFiles: ["<rootDir>/config/testing/emulator-environment.cjs"],
  testTimeout: 30000, // Increase timeout to 30 seconds for complex integration tests
};
