/* eslint-env node */
module.exports = {
  rootDir: ".",
  roots: ["<rootDir>"],
  testEnvironment: "node",
  testEnvironmentOptions: {globalsCleanup: "on"},
  testMatch: ["**/__tests__/**/*.test.ts", "!**/__tests__/**/*.it.test.ts", "!lib/**"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  transform: {
    // Shared-contract tests follow portal re-exports into hosted source.
    "/packages/(?:portal|hosted)/src/.+\\.ts$": "<rootDir>/jest.portalTransform.js",
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  clearMocks: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "json-summary"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
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
    "src/race/raceRollout.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/gameplay/completeGameCallable.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/profile/updateAvatar.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/race/raceAchievements.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/race/raceContentImport.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/race/raceContentMigration.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/race/raceContentValidation.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/jest/jestSecurity.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/race/raceEngine.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/race/raceReadService.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
    "src/gameplay/achievements.ts": {statements: 100, branches: 100, functions: 100, lines: 100},
  },
  moduleNameMapper: {
    "^@riddle-quest/hosted$": "<rootDir>/../packages/hosted/src/index.ts",
    "^@riddle-quest/hosted/(.*)$": "<rootDir>/../packages/hosted/src/$1",
    "^jose$": "<rootDir>/__mocks__/jose.js",
    "^jwks-rsa$": "<rootDir>/__mocks__/jwks-rsa.js",
  },
  transformIgnorePatterns: ["/node_modules/(?!(?:@firebase|firebase)/)"],
  setupFiles: ["<rootDir>/jest.env.setup.js"],
  testTimeout: 30000, // Increase timeout to 30 seconds for complex integration tests
};
